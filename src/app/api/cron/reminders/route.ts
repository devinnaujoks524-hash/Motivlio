import { timingSafeEqual } from "node:crypto";
import { REMINDER_FIRST_AFTER, REMINDER_SECOND_AFTER } from "@/lib/config";
import { sendReminder } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Wird täglich von einem Scheduler aufgerufen (siehe README). Wiederholte Läufe sind harmlos (Dedupe-Key). */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Nicht erlaubt", { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("due_reminders", {
    p_first_after: REMINDER_FIRST_AFTER,
    p_second_after: REMINDER_SECOND_AFTER,
  });
  if (error) return new Response("Fehler", { status: 500 });
  const counts = { sent: 0, duplicate: 0, failed: 0 };
  for (const r of (data ?? []) as { version_id: string; reminder_no: number }[]) {
    counts[await sendReminder(r.version_id, r.reminder_no)]++;
  }
  return Response.json(counts);
}
