-- NUR FÜR ENTWICKLUNG. Niemals gegen eine Produktionsdatenbank ausführen.
-- Setzt für ein bestehendes Konto (nach der Registrierung) einen Test-Tarif und einen Beispielkunden.
-- Im Supabase SQL-Editor (Entwicklungsprojekt) ausführen, nachdem die E-Mail unten angepasst wurde.

do $$
declare
  v_email text := 'dev@example.com'; -- HIER die E-Mail des Test-Kontos eintragen
  v_user uuid;
  v_biz uuid;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then raise exception 'Kein Konto mit dieser E-Mail – bitte zuerst registrieren'; end if;
  select id into v_biz from businesses where owner_id = v_user;
  if v_biz is null then raise exception 'Bitte zuerst den Betrieb unter /willkommen anlegen'; end if;

  update subscriptions
     set plan_id = 'starter', status = 'active',
         period_start = date_trunc('month', now()), period_end = date_trunc('month', now()) + interval '1 month'
   where business_id = v_biz;

  insert into customers (business_id, company, contact_name, email)
  values (v_biz, 'Beispiel Bau GmbH (DEV)', 'Erika Beispiel', 'erika@example.com')
  on conflict do nothing;
end $$;
