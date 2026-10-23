-- Freigabeklar: Kernschema (Mandantentrennung per RLS, Geschäftslogik in Funktionen)
-- Erwartet Supabase-Rollen: anon, authenticated, service_role und auth.uid().

-- ---------------------------------------------------------------- Tabellen

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  name text not null check (length(trim(name)) between 1 and 120),
  reply_to_email text check (reply_to_email is null or reply_to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  logo_path text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  company text not null check (length(trim(company)) between 1 and 160),
  contact_name text not null check (length(trim(contact_name)) between 1 and 160),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create type order_status as enum ('draft', 'waiting', 'changes_requested', 'approved', 'archived');
create type version_status as enum ('pending', 'superseded', 'approved', 'changes_requested');

create table orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null,
  order_number text not null check (length(trim(order_number)) between 1 and 60),
  title text not null check (length(trim(title)) between 1 and 160),
  due_date date,
  internal_note text check (internal_note is null or length(internal_note) <= 4000),
  spec jsonb not null default '{}'::jsonb,
  status order_status not null default 'draft',
  counted_at timestamptz,
  draft_file_path text,
  draft_file_name text,
  draft_file_mime text,
  draft_file_size integer,
  draft_file_sha256 text,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, order_number),
  foreign key (customer_id, business_id) references customers (id, business_id)
);
create index orders_business_status_idx on orders (business_id, status);

create table order_versions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  business_id uuid not null,
  version_number integer not null,
  spec jsonb not null,
  file_path text not null,
  file_name text not null,
  file_mime text not null,
  file_size integer not null,
  file_sha256 text not null,
  status version_status not null default 'pending',
  sent_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_name text,
  decision_text text,
  comment text,
  foreign key (order_id, business_id) references orders (id, business_id) on delete cascade,
  unique (order_id, version_number),
  unique (id, business_id)
);
-- höchstens eine offene Version je Auftrag
create unique index one_pending_version_per_order on order_versions (order_id) where status = 'pending';

create table share_links (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references order_versions(id) on delete cascade,
  token_hash text not null unique,
  token_enc text not null, -- AES-GCM-verschlüsselt (Schlüssel nur auf dem Server): Erinnerungen, erneutes Anzeigen
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table activity (
  id bigint generated always as identity primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  version_id uuid references order_versions(id) on delete cascade,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index activity_order_idx on activity (order_id, created_at);

create table plans (
  id text primary key,
  name text not null,
  order_limit integer not null
);
insert into plans values ('starter', 'Starter', 50), ('studio', 'Studio', 200);

create table subscriptions (
  business_id uuid primary key references businesses(id) on delete cascade,
  plan_id text references plans(id),
  status text not null default 'none',
  period_start timestamptz,
  period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);

create table stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table email_log (
  dedupe_key text primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,
  to_email text not null,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------- Unveränderlichkeit

create function versions_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Versionen können nicht gelöscht werden' using errcode = 'P0001';
  end if;
  if new.order_id is distinct from old.order_id
     or new.business_id is distinct from old.business_id
     or new.version_number is distinct from old.version_number
     or new.spec is distinct from old.spec
     or new.file_path is distinct from old.file_path
     or new.file_name is distinct from old.file_name
     or new.file_mime is distinct from old.file_mime
     or new.file_size is distinct from old.file_size
     or new.file_sha256 is distinct from old.file_sha256
     or new.sent_at is distinct from old.sent_at then
    raise exception 'Der Snapshot einer versendeten Version ist unveränderlich' using errcode = 'P0001';
  end if;
  -- Entscheidungen sind endgültig
  if old.status in ('approved', 'changes_requested') and new.status is distinct from old.status then
    raise exception 'Eine getroffene Entscheidung kann nicht geändert werden' using errcode = 'P0001';
  end if;
  if old.status = 'superseded' and new.status is distinct from old.status then
    raise exception 'Eine ersetzte Version kann nicht reaktiviert werden' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger order_versions_immutable
  before update or delete on order_versions
  for each row execute function versions_immutable();

-- ---------------------------------------------------------------- Hilfsfunktionen

create function app_owns_business(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

create function log_activity(p_business uuid, p_order uuid, p_version uuid, p_kind text, p_detail text default null)
returns void language sql security definer set search_path = public as $$
  insert into activity (business_id, order_id, version_id, kind, detail)
  values (p_business, p_order, p_version, p_kind, p_detail);
$$;

-- Bestimmt den Auftragsstatus aus der jüngsten Version (für Wiederherstellen aus dem Archiv)
create function derive_order_status(p_order uuid) returns order_status
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case v.status
              when 'pending' then 'waiting'
              when 'approved' then 'approved'
              when 'changes_requested' then 'changes_requested'
              else 'draft'
            end::order_status
       from order_versions v where v.order_id = p_order order by v.version_number desc limit 1),
    'draft');
$$;

-- ---------------------------------------------------------------- Betrieb & Dateien

create function create_business(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into businesses (owner_id, name) values (auth.uid(), trim(p_name)) returning id into v_id;
  insert into subscriptions (business_id) values (v_id);
  return v_id;
end $$;

-- Nur serverseitig (service_role): Dateien werden vom Server geprüft und gehasht.
create function attach_draft_file(
  p_business uuid, p_order uuid, p_path text, p_name text, p_mime text, p_size integer, p_sha256 text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_mime not in ('application/pdf', 'image/png', 'image/jpeg') then
    raise exception 'invalid_file_type' using errcode = 'P0001';
  end if;
  if p_size <= 0 or p_size > 15 * 1024 * 1024 then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_checksum' using errcode = 'P0001';
  end if;
  if p_path not like p_business::text || '/' || p_order::text || '/%' then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;
  update orders set draft_file_path = p_path, draft_file_name = p_name, draft_file_mime = p_mime,
                    draft_file_size = p_size, draft_file_sha256 = p_sha256
   where id = p_order and business_id = p_business;
  if not found then raise exception 'order_not_found' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------- Versand

-- Erstellt einen neuen Snapshot, ersetzt eine offene Version und legt einen Link an.
create function send_version(p_order uuid, p_token_hash text, p_token_enc text, p_expires_at timestamptz)
returns json language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  sub subscriptions%rowtype;
  v_limit integer;
  v_used integer;
  v_number integer;
  v_version uuid;
  v_old uuid;
begin
  select * into o from orders where id = p_order for update;
  if not found or not app_owns_business(o.business_id) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if o.status not in ('draft', 'changes_requested', 'waiting') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  if o.draft_file_path is null then raise exception 'missing_file' using errcode = 'P0001'; end if;
  if p_expires_at <= now() then raise exception 'invalid_expiry' using errcode = 'P0001'; end if;
  if not (o.spec ?& array['garment', 'method', 'position']) then
    raise exception 'missing_spec' using errcode = 'P0001';
  end if;

  -- Kontingent: ein Auftrag zählt nur beim ersten Versand
  if o.counted_at is null then
    select * into sub from subscriptions where business_id = o.business_id for update;
    if sub.plan_id is null or sub.status not in ('active', 'trialing') then
      raise exception 'no_subscription' using errcode = 'P0001';
    end if;
    select order_limit into v_limit from plans where id = sub.plan_id;
    select count(*) into v_used from orders
     where business_id = o.business_id and counted_at >= sub.period_start
       and (sub.period_end is null or counted_at < sub.period_end);
    if v_used >= v_limit then raise exception 'limit_reached' using errcode = 'P0001'; end if;
    update orders set counted_at = now() where id = o.id;
  end if;

  -- offene Version ersetzen und deren Links widerrufen
  select id into v_old from order_versions where order_id = o.id and status = 'pending';
  if found then
    update order_versions set status = 'superseded' where id = v_old;
    update share_links set revoked_at = now() where version_id = v_old and revoked_at is null;
    perform log_activity(o.business_id, o.id, v_old, 'superseded');
  end if;

  select coalesce(max(version_number), 0) + 1 into v_number from order_versions where order_id = o.id;
  insert into order_versions (order_id, business_id, version_number, spec, file_path, file_name, file_mime, file_size, file_sha256)
  values (o.id, o.business_id, v_number, o.spec, o.draft_file_path, o.draft_file_name,
          o.draft_file_mime, o.draft_file_size, o.draft_file_sha256)
  returning id into v_version;
  insert into share_links (version_id, token_hash, token_enc, expires_at) values (v_version, p_token_hash, p_token_enc, p_expires_at);
  update orders set status = 'waiting' where id = o.id;
  perform log_activity(o.business_id, o.id, v_version, 'sent', 'Version ' || v_number);
  return json_build_object('version_id', v_version, 'version_number', v_number);
end $$;

-- Neuer Link für die offene Version (alte Links dieser Version werden widerrufen)
create function issue_link(p_version uuid, p_token_hash text, p_token_enc text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v order_versions%rowtype;
begin
  select * into v from order_versions where id = p_version for update;
  if not found or not app_owns_business(v.business_id) then
    raise exception 'version_not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'pending' then raise exception 'invalid_state' using errcode = 'P0001'; end if;
  if p_expires_at <= now() then raise exception 'invalid_expiry' using errcode = 'P0001'; end if;
  update share_links set revoked_at = now() where version_id = v.id and revoked_at is null;
  insert into share_links (version_id, token_hash, token_enc, expires_at) values (v.id, p_token_hash, p_token_enc, p_expires_at);
  perform log_activity(v.business_id, v.order_id, v.id, 'link_issued');
end $$;

create function revoke_links(p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v order_versions%rowtype;
begin
  select * into v from order_versions where id = p_version;
  if not found or not app_owns_business(v.business_id) then
    raise exception 'version_not_found' using errcode = 'P0001';
  end if;
  update share_links set revoked_at = now() where version_id = v.id and revoked_at is null;
  perform log_activity(v.business_id, v.order_id, v.id, 'links_revoked');
end $$;

-- Ausdrücklich neue Freigaberunde nach einer Freigabe
create function start_new_round(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found or not app_owns_business(o.business_id) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if o.status <> 'approved' then raise exception 'invalid_state' using errcode = 'P0001'; end if;
  update orders set status = 'draft' where id = o.id;
  perform log_activity(o.business_id, o.id, null, 'new_round');
end $$;

create function set_order_archived(p_order uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order for update;
  if not found or not app_owns_business(o.business_id) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if p_archived then
    if o.status = 'archived' then return; end if;
    update orders set status = 'archived' where id = o.id;
    update share_links set revoked_at = now()
     where revoked_at is null and version_id in (select id from order_versions where order_id = o.id and status = 'pending');
    perform log_activity(o.business_id, o.id, null, 'archived');
  else
    if o.status <> 'archived' then return; end if;
    update orders set status = derive_order_status(o.id) where id = o.id;
    perform log_activity(o.business_id, o.id, null, 'unarchived');
  end if;
end $$;

-- ---------------------------------------------------------------- Öffentliche Kundenansicht (nur service_role)

create function public_get_version(p_token_hash text) returns json
language plpgsql security definer set search_path = public as $$
declare
  l share_links%rowtype;
  v order_versions%rowtype;
  o orders%rowtype;
  b businesses%rowtype;
  c customers%rowtype;
  v_latest integer;
  v_state text;
begin
  select * into l from share_links where token_hash = p_token_hash;
  if not found then return json_build_object('state', 'unknown'); end if;
  select * into v from order_versions where id = l.version_id;
  select * into o from orders where id = v.order_id;
  select * into b from businesses where id = v.business_id;
  select * into c from customers where id = o.customer_id;
  select max(version_number) into v_latest from order_versions where order_id = o.id;

  -- Ersetzte Version: klarer Hinweis "nicht mehr aktuell", ohne Dokument und Angaben
  if v.status = 'superseded' then
    return json_build_object('state', 'superseded', 'business_name', b.name, 'business_logo_path', b.logo_path,
      'order_number', o.order_number, 'title', o.title, 'version_number', v.version_number,
      'latest_version_number', v_latest);
  end if;

  if l.revoked_at is not null or l.expires_at <= now() then
    v_state := 'unavailable';
  elsif v.status = 'approved' then v_state := 'approved';
  elsif v.status = 'changes_requested' then v_state := 'changes_requested';
  elsif o.status = 'waiting' then v_state := 'open';
  else v_state := 'unavailable';
  end if;

  if v_state = 'unavailable' then
    return json_build_object('state', v_state, 'business_name', b.name);
  end if;

  return json_build_object(
    'state', v_state,
    'business_name', b.name,
    'business_logo_path', b.logo_path,
    'order_number', o.order_number,
    'title', o.title,
    'customer_company', c.company,
    'version_id', v.id,
    'version_number', v.version_number,
    'latest_version_number', v_latest,
    'spec', v.spec,
    'file_path', v.file_path,
    'file_name', v.file_name,
    'file_mime', v.file_mime,
    'file_sha256', v.file_sha256,
    'sent_at', v.sent_at,
    'decided_at', v.decided_at,
    'decided_by_name', v.decided_by_name,
    'comment', v.comment
  );
end $$;

-- Entscheidung des Kunden: atomar, genau einmal, nur für die offene Version.
create function public_decide(p_token_hash text, p_decision text, p_name text, p_comment text, p_text text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c_required constant text :=
    'Ich habe den Entwurf und die aufgeführten Produktionsangaben geprüft und gebe diese Version zur Produktion frei.';
  l share_links%rowtype;
  v order_versions%rowtype;
  o orders%rowtype;
begin
  if p_decision not in ('approve', 'request_changes') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into l from share_links where token_hash = p_token_hash;
  if not found then return json_build_object('result', 'unknown'); end if;

  -- Sperre in fester Reihenfolge: Auftrag, dann Version
  select o2.* into o from orders o2 join order_versions v2 on v2.order_id = o2.id
   where v2.id = l.version_id for update of o2;
  select * into v from order_versions where id = l.version_id for update;

  if l.revoked_at is not null or l.expires_at <= now() then
    return json_build_object('result', 'unavailable');
  end if;
  if v.status = 'superseded' then return json_build_object('result', 'superseded'); end if;
  if v.status in ('approved', 'changes_requested') then
    return json_build_object('result', 'already_decided', 'status', v.status);
  end if;
  if o.status <> 'waiting' then return json_build_object('result', 'unavailable'); end if;

  if p_decision = 'approve' then
    if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 160 then
      raise exception 'name_required' using errcode = 'P0001';
    end if;
    if p_text is distinct from c_required then
      raise exception 'confirmation_required' using errcode = 'P0001';
    end if;
    update order_versions set status = 'approved', decided_at = now(), decided_by_name = trim(p_name),
           decision_text = c_required, comment = nullif(trim(coalesce(p_comment, '')), '')
     where id = v.id;
    update orders set status = 'approved' where id = o.id;
    perform log_activity(o.business_id, o.id, v.id, 'approved', trim(p_name));
    return json_build_object('result', 'approved', 'version_id', v.id, 'order_id', o.id, 'business_id', o.business_id);
  else
    if p_comment is null or length(trim(p_comment)) < 3 or length(p_comment) > 4000 then
      raise exception 'comment_required' using errcode = 'P0001';
    end if;
    update order_versions set status = 'changes_requested', decided_at = now(), comment = trim(p_comment),
           decided_by_name = nullif(trim(coalesce(p_name, '')), '')
     where id = v.id;
    update orders set status = 'changes_requested' where id = o.id;
    perform log_activity(o.business_id, o.id, v.id, 'changes_requested', trim(p_comment));
    return json_build_object('result', 'changes_requested', 'version_id', v.id, 'order_id', o.id, 'business_id', o.business_id);
  end if;
end $$;

-- ---------------------------------------------------------------- E-Mail-Idempotenz & Erinnerungen (nur service_role)

-- true, wenn dieser Aufruf den Versand "besitzt"; wiederholte Aufrufe erhalten false.
create function claim_email(p_key text, p_business uuid, p_kind text, p_to text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into email_log (dedupe_key, business_id, kind, to_email) values (p_key, p_business, p_kind, p_to)
  on conflict (dedupe_key) do nothing;
  return found;
end $$;

create function finish_email(p_key text, p_ok boolean, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update email_log set status = case when p_ok then 'sent' else 'failed' end, error = left(p_error, 500)
   where dedupe_key = p_key;
$$;

-- Fällige Erinnerungen: nur offene, aktuelle Version eines wartenden Auftrags.
create function due_reminders(p_first_after interval default '2 days', p_second_after interval default '5 days')
returns table (version_id uuid, order_id uuid, business_id uuid, reminder_no integer)
language sql stable security definer set search_path = public as $$
  select v.id, v.order_id, v.business_id, n.no
    from order_versions v
    join orders o on o.id = v.order_id and o.status = 'waiting'
    cross join lateral (values (1, p_first_after), (2, p_second_after)) as n(no, after)
   where v.status = 'pending'
     and v.sent_at <= now() - n.after
     and exists (select 1 from share_links l where l.version_id = v.id and l.revoked_at is null and l.expires_at > now())
     and not exists (select 1 from email_log e where e.dedupe_key = 'reminder:' || v.id || ':' || n.no);
$$;

-- ---------------------------------------------------------------- Rate Limit (nur service_role)

create function rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  delete from rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------- Stripe (nur service_role)

-- Ereignis und Abo-Änderung in einer Transaktion; wiederholte/ältere Ereignisse sind wirkungslos.
create function apply_subscription_event(
  p_event_id text, p_event_type text, p_event_created timestamptz,
  p_business uuid, p_plan text, p_status text,
  p_period_start timestamptz, p_period_end timestamptz,
  p_customer text, p_subscription text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into stripe_events (id, type) values (p_event_id, p_event_type) on conflict (id) do nothing;
  if not found then return false; end if;
  update subscriptions set
      plan_id = p_plan, status = p_status, period_start = p_period_start, period_end = p_period_end,
      stripe_customer_id = coalesce(p_customer, stripe_customer_id),
      stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
      last_event_at = p_event_created, updated_at = now()
   where business_id = p_business
     and (last_event_at is null or last_event_at <= p_event_created);
  return true;
end $$;

-- ---------------------------------------------------------------- RLS & Rechte

alter table businesses enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_versions enable row level security;
alter table share_links enable row level security;
alter table activity enable row level security;
alter table subscriptions enable row level security;
alter table plans enable row level security;
alter table stripe_events enable row level security;
alter table email_log enable row level security;
alter table rate_limits enable row level security;

create policy businesses_select on businesses for select to authenticated using (owner_id = auth.uid());
create policy businesses_update on businesses for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy customers_all on customers for all to authenticated
  using (app_owns_business(business_id)) with check (app_owns_business(business_id));
create policy orders_select on orders for select to authenticated using (app_owns_business(business_id));
create policy orders_insert on orders for insert to authenticated with check (app_owns_business(business_id));
create policy orders_update on orders for update to authenticated
  using (app_owns_business(business_id)) with check (app_owns_business(business_id));
create policy versions_select on order_versions for select to authenticated using (app_owns_business(business_id));
create policy activity_select on activity for select to authenticated using (app_owns_business(business_id));
create policy subscriptions_select on subscriptions for select to authenticated using (app_owns_business(business_id));
create policy plans_select on plans for select to authenticated, anon using (true);
-- share_links, stripe_events, email_log, rate_limits: keine Policy => kein Zugriff für Clients

-- Alles sperren, dann gezielt öffnen
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on businesses, customers, orders, order_versions, activity, subscriptions, plans to authenticated;
grant update (name, reply_to_email) on businesses to authenticated;
grant insert, update, delete on customers to authenticated;
grant insert (business_id, customer_id, order_number, title, due_date, internal_note, spec) on orders to authenticated;
grant update (customer_id, order_number, title, due_date, internal_note, spec) on orders to authenticated;
grant delete on orders to authenticated;

grant execute on function app_owns_business(uuid) to authenticated;
grant execute on function create_business(text) to authenticated;
grant execute on function send_version(uuid, text, text, timestamptz) to authenticated;
grant execute on function issue_link(uuid, text, text, timestamptz) to authenticated;
grant execute on function revoke_links(uuid) to authenticated;
grant execute on function start_new_round(uuid) to authenticated;
grant execute on function set_order_archived(uuid, boolean) to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
