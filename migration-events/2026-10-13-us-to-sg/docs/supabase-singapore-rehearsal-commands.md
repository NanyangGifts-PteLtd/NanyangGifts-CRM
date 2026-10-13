# Singapore rehearsal command sheet

Use this only for the short-lived rehearsal. It is intentionally written with
placeholders: never paste database URLs, passwords, API keys, or service-role
keys into this file, Git, chat, or an unignored shell script.

## Known source

- Source project ref: `agjgcjkokmdqworznzux` (`us-east-1`)
- Source database: PostgreSQL 17.6
- Required local tools: Docker Desktop, `npx supabase` 2.120.0, and PostgreSQL
  client 17.11 (`psql`, `pg_dump`, `pg_restore`).

## 1. Create the isolated rehearsal target

In the Supabase Dashboard, create a new **Micro** project in **Singapore /
`ap-southeast-1`**. Do not use “Restore to a new project”, which preserves the
old infrastructure region. Record its project ref and database password only
in a password manager or the current terminal session.

Before importing data, configure the target as follows:

- Data API: expose `public` and `graphql_public`; search path `public`,
  `extensions`; max rows `1000`; automatic exposure enabled.
- Auth: Email only, new signups disabled, email confirmation enabled, default
  templates/SMTP; configure only an isolated rehearsal URL as Site URL.
- Do not attach `friday.nanyanggifts.com` or copy live integration secrets.
- Keep Vercel Cron disabled for any rehearsal deployment.

## 2. Capture fresh source baseline

Immediately before the source export, run the source audit queries and record
the current row counts, 15 Realtime publication tables, three Storage bucket
counts/bytes, and Auth user count. The previous figures are planning baselines
only; normal production writes may have changed them.

## 3. Export roles, schema, and data

Run in PowerShell from the repository root. The password stays in memory and
does not go into command history.

```powershell
Set-Location .local-migration
$sourceRef = 'agjgcjkokmdqworznzux'
$sourcePassword = Read-Host -AsSecureString 'Source database password'
$sourcePasswordPlain = [System.Net.NetworkCredential]::new('', $sourcePassword).Password

npx --prefix .. supabase db dump --project-ref $sourceRef --password $sourcePasswordPlain `
  --role-only --file roles.sql
npx --prefix .. supabase db dump --project-ref $sourceRef --password $sourcePasswordPlain `
  --file schema.sql
npx --prefix .. supabase db dump --project-ref $sourceRef --password $sourcePasswordPlain `
  --data-only --use-copy --exclude storage.buckets_vectors `
  --exclude storage.vector_indexes --exclude supabase_functions.hooks `
  --file data.sql

Remove-Variable sourcePasswordPlain
```

The Supabase CLI starts temporary Docker containers for these dumps; it does
not copy production into Docker or modify the source database.

Confirm `roles.sql`, `schema.sql`, and `data.sql` exist and are non-empty.
Do not open, upload, email, or commit them.

Current CLI versions can leave a `setval` statement for the excluded
`supabase_functions.hooks` sequence in `data.sql`. **Do not edit, filter, or
rewrite the dump with PowerShell text cmdlets.** A text round-trip can corrupt
UTF-8 values in `COPY` data. Instead, create a harmless temporary target
schema and sequence immediately before the import; it lets that platform-only
`setval` execute without changing any source bytes.

## 4. Capture managed-schema customizations before restore

This repository is **not** a complete Supabase CLI project: it has no
`supabase/config.toml` and no authoritative, replayable migration history.
The live US database—not the repository migration folder—is the source of
truth. Do not run `supabase db push`, and do not use `db diff` as a proxy for
the production schema.

The source capture confirms exactly one application-specific managed-schema
trigger: `auth.users.on_auth_user_created`, which calls `public.handle_new_user`.
All observed Storage triggers call `storage.*` functions and are
Supabase-managed; do not recreate them. The seven Storage RLS policies are
application-specific and must be restored after their `private.*` helper
functions exist.

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname in ('auth', 'storage')
order by 1, 2, 3;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('auth', 'storage')
order by 1, 2, 3;
```

Do not attempt to recreate platform-owned `auth` or `storage` tables, roles,
or functions. We will turn this source output into a small reviewed target
customization script after the rehearsal target exists.

## 5. Restore into the target

In the target Dashboard’s **Connect** panel, copy its exact Session Pooler
host (do not assume an `aws-0` or `aws-1` hostname). Construct the URL from
the target ref and a password prompted locally:

```powershell
Set-Location .local-migration
$targetRef = 'fcvxkwxwezgrjsppjcfv'
$targetPoolerHost = 'PASTE-THE-SESSION-POOLER-HOST-HERE'
$targetPassword = Read-Host -AsSecureString 'Target database password'
$targetPasswordPlain = [System.Net.NetworkCredential]::new('', $targetPassword).Password
$targetPasswordEncoded = [uri]::EscapeDataString($targetPasswordPlain)
$targetDbUrl = "postgresql://postgres.$targetRef`:$targetPasswordEncoded@$targetPoolerHost`:5432/postgres"

& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  --variable ON_ERROR_STOP=1 `
  --command 'CREATE SCHEMA IF NOT EXISTS supabase_functions; CREATE SEQUENCE IF NOT EXISTS supabase_functions.hooks_id_seq;' `
  --dbname $targetDbUrl

& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  --single-transaction `
  --variable ON_ERROR_STOP=1 `
  --file roles.sql `
  --file schema.sql `
  --command 'SET session_replication_role = replica' `
  --file data-fresh.sql `
  --dbname $targetDbUrl

Remove-Variable targetPasswordPlain
Remove-Variable targetPasswordEncoded
Remove-Variable targetDbUrl
```

If the documented `supabase_admin` ownership or `cli_login_postgres` grant
errors occur, stop, preserve the error output, and apply only the specific
Supabase-documented correction. Do not use `--clean`, drop managed schemas,
or retry with a destructive restore.

## 6. Restore configuration that database SQL does not move

1. Re-enable the 15 application tables in the target Realtime publication.
2. Apply `../scripts/rehearsal-managed-schema-customizations.sql` in the target
   SQL Editor. It restores only `auth.users.on_auth_user_created` and the
   seven application Storage policies; it must not be replaced by a dump of
   Supabase-managed schemas.
3. Generate and apply the source `public`/`private` grants with
   `../scripts/extract-supabase-application-grants.mjs`. Logical restores can
   leave those application grants absent even when the target has the correct
   tables and RLS policies.
3. Configure the three Storage buckets and policies, then transfer all object
   bytes and validate counts/bytes and paths. The database metadata restore is
   not a substitute for object transfer.
4. Configure target Auth settings recorded in the worksheet. Importing Auth
   users must retain IDs and must not double-fire the profile-creation trigger.
5. Do not enable external integrations, live QuickBooks actions, or Cron.

## 7. Validate, then delete

Compare fresh source and target baselines. Test login, confirmation/invite,
RLS, CRM Board, Gantt, Realtime, files/downloads, and a controlled Storage
upload/download. Record the results, revoke any temporary credentials, then
delete the rehearsal project and its rehearsal Vercel deployment.
