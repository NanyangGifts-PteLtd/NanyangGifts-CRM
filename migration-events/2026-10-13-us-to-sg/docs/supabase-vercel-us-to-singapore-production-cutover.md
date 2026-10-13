# US to Singapore production cutover runbook

This is the production version of the completed rehearsal. It migrates the
live Supabase project from US East to Singapore (`ap-southeast-1`) and moves
the production Vercel Function region to Singapore (`sin1`) while keeping the
existing production domain in place.

Do not use the deleted rehearsal project's reference, keys, URLs, or database
password. Every target value below means the **new final Singapore project**.
Never commit dumps, database URLs, passwords, service-role keys, JWT secrets,
or access tokens.

## What the rehearsal proved

- Logical schema/data restore works when the dump is left byte-for-byte intact.
- The target requires a temporary `supabase_functions.hooks_id_seq` sequence
  because the CLI data dump can retain a platform `setval` statement after its
  table is excluded.
- Application grants must be restored separately after the logical import. In
  rehearsal, this generated and applied 417 `public`/`private` grants.
- The `auth.users` profile trigger and seven application Storage policies are
  not recreated by the standard target platform and must be applied by
  `../scripts/rehearsal-managed-schema-customizations.sql`.
- Database rows, Storage metadata, and Storage bytes are separate concerns.
  The Storage-copy script transferred 267 files / 50,911,458 bytes in the
  rehearsal.
- Realtime publication membership and Data API exposure need dashboard
  configuration after restore.
- With warmed database caches, the Board database critical path fell from
  27.192 ms to 13.494 ms, the Gantt resource RPC from 10.817 ms to 9.742 ms,
  and sampled file-download redirect medians from 1.63 s to 175 ms.

## Success criteria and owner checklist

Name a cutover owner and a rollback decision-maker. Do not start the freeze
until all of these are true.

- [ ] Choose and document the write-freeze method. A tested technical
  maintenance mode is the strongest option, but a short **operational freeze**
  is acceptable for this internal application: every editor acknowledges the
  window, stops using the app, and closes open tabs; Vercel Cron and every
  external writer are paused; and an administrator verifies no active work is
  in progress before exporting. The repository does not establish either
  mechanism automatically.
- [ ] A user-facing maintenance notice states that users must sign in again
  after cutover. Existing browser tokens are issued by the US Supabase project
  and must not be relied on in the Singapore project.
- [ ] A final Singapore Supabase project exists in `ap-southeast-1`, with its
  database password and project ref stored only in the password manager.
- [ ] PostgreSQL client tools, Docker Desktop, Supabase CLI, Node dependencies,
  and the local `.local-migration` directory are ready on the operator's
  workstation. The directory must remain ignored by Git.
- [ ] A fresh, secure backup location exists for the final `roles.sql`,
  `schema.sql`, and `data.sql` files. Do not reuse the rehearsal dump.
- [ ] The production Vercel project is identified, and the operator has
  confirmed that it is distinct from any deleted rehearsal project.
- [ ] A short maintenance window is approved. Plan for a rollback decision
  before reopening writes in Singapore.

## Phase 1 — prepare the final Singapore target (before downtime)

### 1. Create and inventory the target

1. Create a new Supabase project in **Singapore / `ap-southeast-1`** using the
   intended production compute size.
2. Record the new project ref, API URL, publishable/anon key, service-role
   key, JWT secret, database password, and Session Pooler host in the password
   manager only.
3. Confirm in the dashboard that its region is Singapore. Do not change the
   existing US project's region or settings.
4. Obtain the exact target Session Pooler host from **Connect**. Do not infer
   it from the source host or region name.

### 2. Prepare target settings without connecting production traffic

Configure these before the final import. None should change the live US app.

- Auth: Email provider only; disable new sign-ups; enable confirm email; retain
  the existing production Site URL and allowed redirect URLs; keep the current
  default SMTP/templates unless deliberately changed later.
- Auth MFA/session settings: reproduce the captured production settings
  (TOTP enabled, max 10 factors, Phone disabled, AAL1 limit enabled, no single
  session limit, no time-box/inactivity timeout, 3600-second access token,
  refresh-token compromise detection enabled with 10-second reuse interval).
- Data API: expose `public` and `graphql_public`, not `private`; retain search
  path `public, extensions`, max rows `1000`, automatic pool sizing, and
  automatic table exposure enabled. After the schema import, match the source
  *specific* table/function selections (rehearsal source counts were 17/54
  tables and 74/100 functions); counts alone are not sufficient proof.
- Reconnect the same GitHub repository if preserving the existing dashboard
  integration is desired. It is safe only with **Deploy to production** and
  automatic branching disabled. The current project shows no Supabase
  migrations/branches and this repository has no authoritative `supabase/`
  migration history, so GitHub must not be used to restore this database and
  `supabase db push` must not be run for this cutover.
- Do not attach a rehearsal/custom domain, add live integration secrets, or
  enable Vercel cron yet.

### 3. Prepare Vercel changes, but do not deploy them

In the existing production Vercel project, prepare a secure values map. Current
source inspection shows that this application reads only these three
Supabase-related values at runtime:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The first two are browser-visible Next.js values and therefore must be Vercel
**Config** variables; the service-role key remains a Vercel **Secret**. The
legacy `POSTGRES_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` names are not read by the current application.
Do not change them during the cutover. Review and remove them as a separate,
low-risk cleanup after stabilization.

Keep `APP_BASE_URL` at `https://friday.nanyanggifts.com`. Auth0, QuickBooks,
Make, Zapier, Azure, and `CRON_SECRET` values do not change merely because the
database moved; they are paused during cutover and verified afterward.

Set the Vercel production Function region to **Singapore `sin1`**, but do not
deploy until the final validation gate in Phase 5.

### 4. Rehearse the write freeze

Before the production window, decide and test the exact way to block writes.
It must cover open browser tabs, direct application API calls, uploads, and
background work. Then prepare to pause all external producers:

- Vercel Cron (disable the feature for the duration), including:
  `/api/cron/client-reply-automation`, `/api/cron/crm-bin-purge`,
  `/api/cron/quickbooks-bill-sync`, `/api/cron/quickbooks-invoice-sync`, and
  `/api/cron/working-calendar-sync`.
- Make scenarios and the lead-assigned webhook.
- Zapier/WPForms/WooCommerce or any other inbound writer.
- QuickBooks webhooks/callbacks and sync activity.
- Any manual Azure extraction or operator process that can write data.

Record how to resume each producer. Do not rely on the database export alone
to protect against an inbound integration writing to US during cutover.

## Phase 2 — start the production maintenance window

1. Announce the maintenance window and start the chosen write freeze. For an
   operational freeze, obtain acknowledgement from each editor, ask them to
   close every application tab, and state a precise "stop editing" timestamp.
2. Confirm no user is actively creating, editing, or uploading data. For a
   technical block, also prove a normal user cannot write; keep a timestamped
   screenshot or log of the check.
3. Disable Vercel Cron and pause every external producer from Phase 1.4.
4. Verify no in-flight QuickBooks/import jobs remain and wait for any active
   write request to finish.
5. Run `../scripts/supabase-region-migration-source-audit.sql` in the US SQL
   Editor. Save its non-secret results as the final source baseline:
   public row counts, Auth-user count, Realtime publication membership,
   bucket counts/bytes/prefixes, functions, policies, triggers, and extensions.

The US project remains the source of truth until Phase 5 explicitly opens
writes in Singapore.

## Phase 3 — make the final export and import

All commands below run locally from the repository root. Use the final target
ref and its actual Pooler host. Passwords are prompted and retained only in
the current PowerShell process.

### 1. Produce a fresh source export

```powershell
Set-Location .local-migration

$sourceRef = 'US_PROJECT_REF'
$sourcePassword = Read-Host -AsSecureString 'US database password'
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

Confirm all three files exist and are non-empty. Never run PowerShell text
replacement, `Get-Content`/`Set-Content`, or other encoding-changing rewrites
over `data.sql`; that can corrupt UTF-8 `COPY` data and violate application
checks during restore.

### 2. Generate the grant restore script

```powershell
node ..\migration-events\2026-10-13-us-to-sg\scripts\extract-supabase-application-grants.mjs schema.sql application-grants.sql
```

The file is derived from the just-exported schema. Review only the first and
last lines plus its reported statement count; do not hand-edit the dump.

### 3. Restore roles, schema, and data into Singapore

```powershell
$targetRef = 'SG_FINAL_PROJECT_REF'
$targetPoolerHost = 'PASTE_TARGET_SESSION_POOLER_HOST'
$targetPassword = Read-Host -AsSecureString 'Singapore database password'
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
  --file data.sql `
  --dbname $targetDbUrl
```

The temporary schema/sequence is harmless and exists only to absorb the
platform `setval` from the dump. `session_replication_role = replica` prevents
restore-time application trigger side effects. Stop on any error; do not use
`--clean`, drop Supabase-managed schemas, or retry after modifying `data.sql`.

### 4. Restore application-owned target customizations and grants

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  --variable ON_ERROR_STOP=1 `
  --file ..\migration-events\2026-10-13-us-to-sg\scripts\rehearsal-managed-schema-customizations.sql `
  --file application-grants.sql `
  --dbname $targetDbUrl
```

This restores the `auth.users.on_auth_user_created` trigger and the seven
application-owned Storage policies, then source `public`/`private` privileges.
It does not recreate Supabase-owned Auth or Storage objects.

The Data API dashboard's table/function exposure controls can change API-role
privileges. Therefore, run the `application-grants.sql` command **again after
the final Data API selections have been saved** and before any application
login test. A `42501 permission denied for table profiles` response means this
final grants pass was skipped or later overwritten.

After the import, remove secrets from this shell:

```powershell
Remove-Variable sourcePassword, targetPassword, targetPasswordPlain, targetPasswordEncoded, targetDbUrl -ErrorAction SilentlyContinue
```

## Phase 4 — copy Storage and restore dashboard-managed configuration

### 1. Transfer object bytes

The logical database import creates Storage metadata, not the file bytes. In
PowerShell, set only current-session variables and first perform a dry run:

```powershell
$sourceServiceKeySecure = Read-Host -AsSecureString 'US service-role key'
$targetServiceKeySecure = Read-Host -AsSecureString 'Singapore service-role key'
$sourceServiceKeyPlain = [System.Net.NetworkCredential]::new('', $sourceServiceKeySecure).Password
$targetServiceKeyPlain = [System.Net.NetworkCredential]::new('', $targetServiceKeySecure).Password

$env:SOURCE_SUPABASE_URL = 'https://US_PROJECT_REF.supabase.co'
$env:SOURCE_SUPABASE_SERVICE_KEY = $sourceServiceKeyPlain
$env:TARGET_SUPABASE_URL = 'https://SG_FINAL_PROJECT_REF.supabase.co'
$env:TARGET_SUPABASE_SERVICE_KEY = $targetServiceKeyPlain
$env:DRY_RUN = '1'
npm run migrate:storage
```

Confirm that the discovered file count matches the final source Storage audit.
Then perform the copy:

```powershell
Remove-Item Env:DRY_RUN
$env:ALLOW_TARGET_OVERWRITE = 'YES'
npm run migrate:storage

Remove-Item Env:SOURCE_SUPABASE_URL, Env:SOURCE_SUPABASE_SERVICE_KEY, Env:TARGET_SUPABASE_URL, Env:TARGET_SUPABASE_SERVICE_KEY, Env:ALLOW_TARGET_OVERWRITE -ErrorAction SilentlyContinue
Remove-Variable sourceServiceKeyPlain, targetServiceKeyPlain -ErrorAction SilentlyContinue
```

The script transfers only `crm-files`, `order-confirmation-files`, and
`shipper-attachments`, retries each operation, and uses idempotent uploads.

### 2. Reapply target dashboard configuration

Before any production deployment, complete and verify:

1. Recreate the exact 15 `supabase_realtime` public-table memberships:
   `activity_log`, `client_assignees`, `clients`, `crm_groups`,
   `custom_columns`, `notifications`, `option_groups`, `option_values`,
   `order_confirmations`, `profiles`, `sales_round_robin_pool`,
   `sales_round_robin_state`, `shipper_spreadsheet_rows`,
   `subitem_assignees`, and `subitems`.
2. Confirm the `auth.users` trigger and seven `storage.objects` policies with
   the source-audit query. The trigger must call `public.handle_new_user()`.
3. Match the captured Data API schema/table/function selection, API search
   path, max rows, and automatic exposure setting.
4. Recheck Auth Site URL, redirect URLs, provider settings, session settings,
   MFA, email confirmation, SMTP/template settings, and no new public signups.
5. Confirm bucket visibility, size limits, and allowed MIME types match the
   source. Verify target bucket/prefix object counts and byte totals exactly
   match the frozen source baseline.

## Phase 5 — validate before exposing Singapore writes

Do not change Vercel Production variables or reopen writes until every check
below passes.

1. Re-run the row-count, Auth-user, Storage total/prefix, Realtime, policy,
   trigger, function, and extension queries from
   `../scripts/supabase-region-migration-source-audit.sql` against Singapore.
   Compare with the final frozen-US output. Counts must match exactly except
   for explicitly recorded target-only validation artifacts, which should be
   removed before release.
2. Confirm application grants exist. A quick authenticated validation is a
   read from `public.profiles`; a `42501 permission denied` response means the
   grants script was skipped or incomplete.
3. Perform safe smoke tests against Singapore while the write block remains:
   existing-user login, profile load, Board, filters, Tracking View, Gantt,
   Payment Vouchers/OCF, Shipper, Realtime in two sessions, and signed file
   open/download from each bucket. Use controlled, reversible data only.
4. In browser Network, verify API/Auth calls target the final Singapore
   Supabase URL, not the US project.
5. Record the results and have the cutover owner explicitly approve the
   Vercel switch.

## Phase 6 — switch production traffic

1. In the **production** Vercel project, replace only
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` with the final Singapore values. Retain the
   production domain in `APP_BASE_URL`.
2. Confirm Vercel Functions are set to **`sin1`** and Cron is still disabled.
3. Deploy Production. The custom domain stays attached to the same Vercel
   project, so no DNS change is required.
4. Through `https://friday.nanyanggifts.com`, verify login, profile loading,
   Board, Gantt, one signed file download, and one Realtime event. Confirm the
   browser targets Singapore.
5. Announce that users should refresh and sign in again. Do not assume an old
   US Supabase session remains valid in Singapore.
6. Only after these checks pass, remove the maintenance/write block and allow
   normal Singapore writes.

## Phase 7 — resume integrations gradually

Enable one producer at a time, observe it, then continue:

1. Vercel Cron (first non-destructive calendar/bin tasks, then QuickBooks
   syncs after a controlled verification).
2. Make scenarios and inbound webhook.
3. Zapier/WPForms/WooCommerce and other inbound sources.
4. QuickBooks callbacks/webhooks and scheduled synchronization.
5. Operator-triggered Azure document extraction.

For each, verify its endpoint is still the production domain and that its
database writes land in Singapore. Record the first successful run and any
retry/deduplication behavior.

## Rollback boundary

Rollback is straightforward **only before Singapore accepts normal writes**.
If a failure occurs before Phase 6.6, keep maintenance enabled, restore US
Supabase/Postgres values in Vercel, set Functions back to `iad1`, redeploy,
and resume the paused US producers.

After Singapore writes are enabled, do not casually switch back: new
Singapore data would be absent from US. Escalate to the cutover decision-maker
and choose between accepting loss of post-cutover writes or reconciling them
manually.

## Post-cutover and retirement

- Monitor Vercel errors/durations, Supabase Auth, Storage, Realtime, database
  logs, connection count, and integration runs closely for 24 hours.
- Re-run the Board, Gantt, and file-download browser timings from Singapore
  after normal traffic resumes.
- Keep the US project and the encrypted final exports for at least 14 days.
- Do not delete the US project until sign-off confirms no clients, background
  worker, OAuth callback, webhook, cron, or integration still references it.
- Securely remove local plaintext dumps and temporary target credentials only
  after the retention period and backup policy permit it.
