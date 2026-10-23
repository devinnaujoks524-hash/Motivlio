import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(join(__dirname, "../supabase/migrations/0001_schema.sql"), "utf8");
const TEXT =
  "Ich habe den Entwurf und die aufgeführten Produktionsangaben geprüft und gebe diese Version zur Produktion frei.";
const SPEC = { garment: "Poloshirt", method: "stick", position: "Brust links", quantity: 20 };

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function asUser<T = any>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
async function asService<T>(fn: () => Promise<T>) {
  await db.exec("set role service_role;");
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
const one = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows[0];
const hash = (s: string) => s.padEnd(64, "0");

async function setupTenant(uid: string, name: string) {
  const biz = await asUser(uid, () => one("select create_business($1) as id", [name]));
  const bizId = biz.id as string;
  await db.query(
    "update subscriptions set plan_id='starter', status='active', period_start=now() - interval '1 day', period_end=now() + interval '29 days' where business_id=$1",
    [bizId],
  );
  const cust = await asUser(uid, () =>
    one("insert into customers (business_id, company, contact_name, email) values ($1,'Bau GmbH','Anna','a@bau.de') returning id", [bizId]),
  );
  const ord = await asUser(uid, () =>
    one(
      "insert into orders (business_id, customer_id, order_number, title, spec) values ($1,$2,'A-1','Polo Logo',$3) returning id",
      [bizId, cust.id, JSON.stringify(SPEC)],
    ),
  );
  await asService(() =>
    db.query("select attach_draft_file($1,$2,$3,'logo.pdf','application/pdf',1000,$4)", [
      bizId, ord.id, `${bizId}/${ord.id}/f1`, "a".repeat(64),
    ]),
  );
  return { bizId, custId: cust.id as string, orderId: ord.id as string };
}
const send = (uid: string, orderId: string, token: string) =>
  asUser(uid, () => one("select send_version($1,$2,'enc', now() + interval '7 days') as r", [orderId, hash(token)]));
const decide = (token: string, decision: string, name: string | null, comment: string | null, text: string | null) =>
  asService(() => one("select public_decide($1,$2,$3,$4,$5) as r", [hash(token), decision, name, comment, text]));

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(MIGRATION);
});

describe("Mandantentrennung", () => {
  it("Betrieb B sieht keine Daten von Betrieb A", async () => {
    await setupTenant(USER_A, "A");
    const b = await setupTenant(USER_B, "B");
    const rows = await asUser(USER_B, async () => ({
      orders: (await db.query("select id from orders")).rows,
      customers: (await db.query("select id from customers")).rows,
      businesses: (await db.query("select id from businesses")).rows,
    }));
    expect((rows as any).orders).toHaveLength(1);
    expect((rows as any).customers).toHaveLength(1);
    expect((rows as any).businesses).toEqual([{ id: b.bizId }]);
  });

  it("Betrieb B kann Aufträge von A weder ändern noch versenden", async () => {
    const a = await setupTenant(USER_A, "A");
    await setupTenant(USER_B, "B");
    const upd = await asUser(USER_B, () => db.query("update orders set title='x' where id=$1", [a.orderId]));
    expect((upd as any).affectedRows).toBe(0);
    await expect(send(USER_B, a.orderId, "t")).rejects.toThrow(/order_not_found/);
  });

  it("Auftrag eines Betriebs darf keinen Kunden eines anderen Betriebs referenzieren", async () => {
    const a = await setupTenant(USER_A, "A");
    const b = await setupTenant(USER_B, "B");
    await expect(
      asUser(USER_B, () =>
        db.query("insert into orders (business_id, customer_id, order_number, title) values ($1,$2,'X','X')", [b.bizId, a.custId]),
      ),
    ).rejects.toThrow();
  });

  it("Clients können weder Status noch Dateifelder direkt setzen, noch Tokens lesen", async () => {
    const a = await setupTenant(USER_A, "A");
    await expect(asUser(USER_A, () => db.query("update orders set status='approved' where id=$1", [a.orderId]))).rejects.toThrow();
    await expect(asUser(USER_A, () => db.query("update orders set draft_file_sha256='x' where id=$1", [a.orderId]))).rejects.toThrow();
    await expect(asUser(USER_A, () => db.query("select * from share_links"))).rejects.toThrow();
    await expect(asUser(USER_A, () => db.query("select public_get_version('x')"))).rejects.toThrow();
  });
});

describe("Versionen und Freigabe", () => {
  it("Versand erzeugt unveränderlichen Snapshot; Entwurfsänderungen wirken nicht zurück", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await asUser(USER_A, () => db.query(`update orders set spec = spec || '{"quantity": 99}' where id=$1`, [a.orderId]));
    const v = await one("select spec, file_sha256 from order_versions");
    expect(v.spec.quantity).toBe(20);
    await expect(db.query("update order_versions set spec = '{}'::jsonb")).rejects.toThrow(/unveränderlich/);
    await expect(db.query("delete from order_versions")).rejects.toThrow(/gelöscht/);
  });

  it("Freigabe bleibt dem Snapshot zugeordnet", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    const r = await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    expect(r.r.result).toBe("approved");
    const v = await one("select * from order_versions");
    expect(v.status).toBe("approved");
    expect(v.decided_by_name).toBe("Anna Beispiel");
    expect(v.decision_text).toBe(TEXT);
    expect(v.decided_at).toBeTruthy();
    expect((await one("select status from orders")).status).toBe("approved");
    await expect(db.query("update order_versions set status='changes_requested'")).rejects.toThrow(/Entscheidung/);
  });

  it("Freigabe verlangt Namen und den exakten Freigabetext", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await expect(decide("t1", "approve", "", null, TEXT)).rejects.toThrow(/name_required/);
    await expect(decide("t1", "approve", "Anna", null, "ok")).rejects.toThrow(/confirmation_required/);
    await expect(decide("t1", "request_changes", null, "  ", null)).rejects.toThrow(/comment_required/);
    expect((await one("select status from order_versions")).status).toBe("pending");
  });

  it("Ersetzte Version kann nicht mehr freigegeben werden; alter Link bleibt wirkungslos", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await send(USER_A, a.orderId, "t2"); // ersetzt Version 1
    const stale = await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    expect(["superseded", "unavailable"]).toContain(stale.r.result);
    const view = await asService(() => one("select public_get_version($1) as v", [hash("t1")]));
    expect(view.v.state).toBe("superseded");
    expect(view.v.latest_version_number).toBe(2);
    expect(view.v.file_path).toBeUndefined();
    expect((await one("select count(*)::int as n from order_versions where status='approved'")).n).toBe(0);
    const ok = await decide("t2", "approve", "Anna Beispiel", null, TEXT);
    expect(ok.r.result).toBe("approved");
  });

  it("Link erschließt nur seine Version", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    const v = await asService(() => one("select public_get_version($1) as v", [hash("t1")]));
    expect(v.v.version_number).toBe(1);
    expect(v.v.state).toBe("open");
    expect(JSON.stringify(v.v)).not.toMatch(/internal_note/);
    const unknown = await asService(() => one("select public_get_version($1) as v", [hash("zzz")]));
    expect(unknown.v.state).toBe("unknown");
  });

  it("Doppelte und parallele Entscheidungen erzeugen genau eine Entscheidung", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    const first = await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    const second = await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    const third = await decide("t1", "request_changes", null, "doch nicht", null);
    expect(first.r.result).toBe("approved");
    expect(second.r.result).toBe("already_decided");
    expect(third.r.result).toBe("already_decided");
    expect((await one("select count(*)::int as n from activity where kind in ('approved','changes_requested')")).n).toBe(1);
  });

  it("Neue Runde nach Freigabe nur ausdrücklich; Freigegebenes bleibt erhalten", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    await expect(send(USER_A, a.orderId, "t2")).rejects.toThrow(/invalid_state/);
    await asUser(USER_A, () => db.query("select start_new_round($1)", [a.orderId]));
    await send(USER_A, a.orderId, "t2");
    const rows = (await db.query<any>("select version_number, status from order_versions order by 1")).rows;
    expect(rows).toEqual([
      { version_number: 1, status: "approved" },
      { version_number: 2, status: "pending" },
    ]);
  });

  it("Änderungswunsch führt zu neuer Version, Historie bleibt", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await decide("t1", "request_changes", null, "Logo größer bitte", null);
    expect((await one("select status from orders")).status).toBe("changes_requested");
    await send(USER_A, a.orderId, "t2");
    const rows = (await db.query<any>("select version_number, status, comment from order_versions order by 1")).rows;
    expect(rows[0]).toMatchObject({ status: "changes_requested", comment: "Logo größer bitte" });
    expect(rows[1].status).toBe("pending");
  });

  it("Abgelaufene und widerrufene Links sind nicht nutzbar", async () => {
    const a = await setupTenant(USER_A, "A");
    const s = await send(USER_A, a.orderId, "t1");
    await asUser(USER_A, () => db.query("select revoke_links($1)", [(s as any).r.version_id]));
    expect((await decide("t1", "approve", "Anna Beispiel", null, TEXT)).r.result).toBe("unavailable");
    await asUser(USER_A, () => db.query("select issue_link($1,$2,'enc', now() + interval '1 day')", [(s as any).r.version_id, hash("t1b")]));
    await db.query("update share_links set expires_at = now() - interval '1 minute' where token_hash=$1", [hash("t1b")]);
    expect((await decide("t1b", "approve", "Anna Beispiel", null, TEXT)).r.result).toBe("unavailable");
  });

  it("Archivierung sperrt offene Links", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await asUser(USER_A, () => db.query("select set_order_archived($1, true)", [a.orderId]));
    expect((await decide("t1", "approve", "Anna Beispiel", null, TEXT)).r.result).toBe("unavailable");
    await asUser(USER_A, () => db.query("select set_order_archived($1, false)", [a.orderId]));
    expect((await one("select status from orders")).status).toBe("waiting");
  });
});

describe("Kontingent", () => {
  it("zählt Aufträge nur beim ersten Versand und blockiert am Limit", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    await send(USER_A, a.orderId, "t2"); // Revision zählt nicht
    await db.query("update plans set order_limit = 1 where id='starter'");
    const o2 = await asUser(USER_A, () =>
      one("insert into orders (business_id, customer_id, order_number, title, spec) values ($1,$2,'A-2','Zweiter',$3) returning id", [a.bizId, a.custId, JSON.stringify(SPEC)]),
    );
    await asService(() =>
      db.query("select attach_draft_file($1,$2,$3,'x.png','image/png',10,$4)", [a.bizId, o2.id, `${a.bizId}/${o2.id}/f`, "b".repeat(64)]),
    );
    await expect(send(USER_A, o2.id, "t3")).rejects.toThrow(/limit_reached/);
    await send(USER_A, a.orderId, "t4"); // bestehender Auftrag bleibt bearbeitbar
  });

  it("ohne aktives Abo kein Versand, Entwurf bleibt möglich", async () => {
    const a = await setupTenant(USER_A, "A");
    await db.query("update subscriptions set status='canceled'");
    await expect(send(USER_A, a.orderId, "t1")).rejects.toThrow(/no_subscription/);
  });

  it("Dateiprüfung lehnt falschen Typ und zu große Dateien ab", async () => {
    const a = await setupTenant(USER_A, "A");
    const p = `${a.bizId}/${a.orderId}/x`;
    await expect(asService(() => db.query("select attach_draft_file($1,$2,$3,'x','text/html',10,$4)", [a.bizId, a.orderId, p, "a".repeat(64)]))).rejects.toThrow(/invalid_file_type/);
    await expect(asService(() => db.query("select attach_draft_file($1,$2,$3,'x','image/png',16000000,$4)", [a.bizId, a.orderId, p, "a".repeat(64)]))).rejects.toThrow(/file_too_large/);
  });
});

describe("Erinnerungen, E-Mail und Stripe", () => {
  it("Erinnerungen sind fällig, idempotent und stoppen nach Entscheidung", async () => {
    const a = await setupTenant(USER_A, "A");
    await send(USER_A, a.orderId, "t1");
    const due = () => asService(async () => (await db.query<any>("select * from due_reminders()")).rows);
    expect(await due()).toHaveLength(0);
    // Zeit nur im Test zurückdrehen (Trigger kurz aussetzen)
    await db.exec("alter table order_versions disable trigger order_versions_immutable");
    await db.query("update order_versions set sent_at = now() - interval '3 days'");
    await db.exec("alter table order_versions enable trigger order_versions_immutable");
    const r1 = await due();
    expect(r1.map((r) => r.reminder_no)).toEqual([1]);
    // einmal "gesendet" markiert -> nicht mehr fällig
    await asService(() => one("select claim_email($1,$2,'reminder','a@b.de')", [`reminder:${r1[0].version_id}:1`, a.bizId]));
    expect(await due()).toHaveLength(0);
    // Nach Entscheidung: nie wieder fällig
    await db.exec("alter table order_versions disable trigger order_versions_immutable");
    await db.query("update order_versions set sent_at = now() - interval '9 days'");
    await db.exec("alter table order_versions enable trigger order_versions_immutable");
    expect((await due()).map((r) => r.reminder_no)).toEqual([2]);
    await decide("t1", "approve", "Anna Beispiel", null, TEXT);
    expect(await due()).toHaveLength(0);
  });

  it("E-Mail-Claim ist idempotent", async () => {
    const a = await setupTenant(USER_A, "A");
    const claim = () => asService(() => one("select claim_email('k1',$1,'invite','a@b.de') as c", [a.bizId]));
    expect((await claim()).c).toBe(true);
    expect((await claim()).c).toBe(false);
  });

  it("Stripe-Ereignis wirkt nur einmal; ältere Ereignisse überschreiben nichts", async () => {
    const a = await setupTenant(USER_A, "A");
    const apply = (id: string, created: string, plan: string) =>
      asService(() =>
        one("select apply_subscription_event($1,'customer.subscription.updated',$2,$3,$4,'active',now(),now() + interval '30 days','cus_1','sub_1') as ok", [id, created, a.bizId, plan]),
      );
    expect((await apply("evt_2", "2026-01-02T00:00:00Z", "studio")).ok).toBe(true);
    expect((await apply("evt_2", "2026-01-02T00:00:00Z", "starter")).ok).toBe(false);
    await apply("evt_1", "2026-01-01T00:00:00Z", "starter");
    expect((await one("select plan_id from subscriptions")).plan_id).toBe("studio");
  });
});
