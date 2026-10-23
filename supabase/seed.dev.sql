-- NUR FÜR ENTWICKLUNG. Niemals gegen eine Produktionsdatenbank ausführen.
-- Schaltet für ALLE vorhandenen Betriebe einen Test-Tarif frei (ohne Stripe) und legt je Betrieb einen
-- Beispielkunden an. Im Supabase SQL-Editor des Entwicklungsprojekts ausführen, nachdem der Betrieb
-- unter /willkommen angelegt wurde.

update subscriptions
   set plan_id = 'starter', status = 'active',
       period_start = date_trunc('month', now()), period_end = date_trunc('month', now()) + interval '1 month';

insert into customers (business_id, company, contact_name, email)
select b.id, 'Beispiel Bau GmbH (DEV)', 'Erika Beispiel', 'erika@example.com'
  from businesses b
 where not exists (select 1 from customers c where c.business_id = b.id);
