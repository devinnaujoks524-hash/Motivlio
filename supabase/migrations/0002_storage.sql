-- Privater Bucket für Entwürfe und Logos. Absichtlich OHNE Storage-Policies:
-- Clients (anon/authenticated) haben keinerlei direkten Zugriff. Alle Dateizugriffe laufen über
-- den Server (service_role) nach Berechtigungsprüfung; Downloads über kurzlebige signierte URLs
-- bzw. über Server-Routen, die den Freigabelink erneut prüfen.
-- Dieses Skript läuft nur auf Supabase (Schema "storage" vorhanden).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drafts', 'drafts', false, 15728640, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
