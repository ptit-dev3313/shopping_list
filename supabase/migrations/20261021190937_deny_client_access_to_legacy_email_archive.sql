-- Legacy archive: keep RLS and explicitly deny every client operation.
-- Administrative access remains unchanged; no rows or grants are modified.
create policy legacy_email_archive_deny_clients
on private.allowed_emails
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
