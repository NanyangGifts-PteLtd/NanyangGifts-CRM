# Supabase + Vercel US-to-Singapore migration runbook

## Objective

Move production from:

| Service | Current region | Target region |
| --- | --- | --- |
| Supabase | AWS `us-east-1` (North Virginia) | AWS `ap-southeast-1` (Singapore) |
| Vercel Functions | `iad1` (Washington, D.C.) | `sin1` (Singapore) |

The application must never be intentionally left with Vercel Functions and
Supabase in different regions. Static content remains served by Vercel's CDN;
this project changes the location of dynamic server work and primary data.

## Guardrails

- Do not edit the current Supabase project's displayed region. An existing
  project cannot be relocated in place.
- Do not use Supabase **Restore to a New Project** as the regional migration
  mechanism: it restores to the source region. Use it only for same-region
  recovery/rehearsal if useful.
- Do not expose, paste, commit, or copy secret values into this document.
- Do not allow both the US and Singapore environments to run scheduled or
  externally-visible side effects at the same time.
- Keep the US project available and read-only-capable until the Singapore
  production environment has passed the post-cutover observation period.

Relevant vendor references:

- [Supabase: change project region](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)
- [Supabase: migrate within Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase)
- [Supabase: restore limitations](https://supabase.com/docs/guides/platform/clone-project)
- [Vercel: Function regions](https://vercel.com/docs/functions/configuring-functions/region)

## Application inventory

This inventory is derived from the repository and must be checked against the
current production dashboards before cutover.

### Supabase clients and credentials

| Variable / setting | Purpose | Target action |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase endpoint | Replace with the new Singapore project URL in Vercel Production. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser API/Realtime/Auth access | Replace with the Singapore key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted server-side administration and Storage actions | Replace with the Singapore key; never expose to the browser. |
| Auth site URL / allowed redirects | Login, invitations, password recovery, confirmations | Recreate and validate against the production domain. |
| SMTP / email templates / provider settings | Auth emails | Reconfigure and send a controlled test. |
| Realtime publication | Board, Gantt, Shipper, activity, payment-voucher updates | Enable the same tables and validate two-session updates. |

### Storage

The code references these buckets:

| Bucket | Uses |
| --- | --- |
| `crm-files` | Client/subitem attachments, PDF archives, email attachments, CRM bin purge, signed downloads. |
| `order-confirmation-files` | OCF item artwork/images and client signatures. |
| `shipper-attachments` | Shipper image uploads and signed image URLs. |

For each bucket, copy both objects and configuration: bucket visibility,
allowed MIME/size settings, and all `storage.objects` policies. Reconcile by
object count and total bytes before production cutover. Test signed URLs from
`/api/files/download` and `/api/shipper/image` after switching credentials.

### Realtime

At minimum, verify the publication contains the tables subscribed to by the
application:

- `clients`, `subitems`, `client_assignees`, `subitem_assignees`
- `profiles`, `crm_groups`, `option_values`, `custom_columns`
- `notifications`, `sales_round_robin_pool`
- the Shipper spreadsheet tables and the payment-voucher data used by their
  respective Realtime subscriptions

Run two-browser-session tests for Board client moves, Gantt timeline edits,
and Shipper spreadsheet updates.

### Source-audit snapshot (2026-10)

The current source Storage inventory is small enough for a controlled final
delta copy: **241 objects / 46,549,769 bytes** across three private buckets.

| Bucket | Objects | Object bytes | Target setting to preserve |
| --- | ---: | ---: | --- |
| `crm-files` | 121 | 35,132,834 | Private; 25 MiB file limit; no MIME allowlist. |
| `order-confirmation-files` | 110 | 9,877,274 | Private; no configured file limit or MIME allowlist. |
| `shipper-attachments` | 10 | 1,539,661 | Private; no configured file limit or MIME allowlist. |

The `crm-files` reconciliation must retain every existing top-level prefix:
`clients`, `quickbooks-bills-only`, `legacy-migration`, `subitems`,
`email-review`, and `sample-estimates`. Do not assume `legacy-migration`
objects can be omitted: they remain referenced historical files until an
explicit retention decision is made.

The public-table relation footprint is also small: 54 tables total about
20.2 MiB including their indexes and TOAST data. `activity_log` (about
5.6 MiB), `subitems` (about 4.2 MiB), and `clients` (about 2.1 MiB) are the
largest. Dead-tuple percentages are high on some very small, frequently
updated tables, but no table is large enough for bloat to justify a disruptive
manual `VACUUM FULL` before migration. Normal autovacuum activity is present;
the logical import into the target will naturally create compact relations.

An exact source row-count baseline was captured for all 54 public tables. Key
counts at the time of audit are: `clients` 341, `subitems` 99,
`activity_log` 2,785, `client_assignees` 346, `subitem_assignees` 207,
`subitem_payment_rows` 61, `notifications` 384, `lead_ingestions` 333,
`integration_inbound_events` 512, and `integration_outbox` 317. Re-run the
same generated exact-count query **during the production write freeze**, after
the final source export, and then against Singapore after the final sync. The
two freeze-window results—not this earlier rehearsal snapshot—must match
before writes reopen.

The source Auth baseline currently contains 13 users. Auth-user UUIDs must be
preserved together with the public `profiles` rows; recapture and compare the
Auth count during the production write freeze as well.

The source `supabase_realtime` publication contains 15 application tables:
`activity_log`, `client_assignees`, `clients`, `crm_groups`,
`custom_columns`, `notifications`, `option_groups`, `option_values`,
`order_confirmations`, `profiles`, `sales_round_robin_pool`,
`sales_round_robin_state`, `shipper_spreadsheet_rows`,
`subitem_assignees`, and `subitems`. All have no publication row filter.

Do not attempt to migrate or manually add the `realtime.messages_*` tables
from the `supabase_realtime_messages_publication`; those are Supabase-managed
internal partitions that the new project provisions itself.

The source policies are compatible with a project-to-project migration, but
they depend heavily on `private.*` authorization helper functions (for example
`private.is_internal_user`, `private.can_edit_client`,
`private.can_access_shipper`, and upload validators). The logical schema
export must include both the `public` and `private` schemas before RLS policies
are restored. Storage has seven application policies on `storage.objects`:
two for `crm-files`, two for `order-confirmation-files`, and three for
`shipper-attachments`.

The source trigger inventory contains 33 triggers: one on `auth.users`, 24 on
application tables, and eight Supabase-managed Storage triggers. No
application trigger was found to invoke an external HTTP service. However,
application triggers must be controlled during logical import: several update
CRM totals, set creator fields, or create profiles. In particular,
`auth.users.on_auth_user_created` calls `handle_new_user()`; importing Auth
users while that trigger is active could create duplicate/conflicting profile
rows. The rehearsal must prove an import sequence that prevents trigger side
effects, imports source data faithfully, and then restores normal trigger
operation.

Do not manually dump/restore Supabase-managed `storage` tables as a substitute
for copying files. Create buckets/configuration on the target, copy actual
objects through the supported Storage workflow, and let that workflow maintain
the target `storage.objects` metadata.

### Vercel scheduled routes

`vercel.json` currently schedules:

| Route | Schedule currently in source |
| --- | --- |
| `/api/cron/client-reply-automation` | `0 16 * * *` |
| `/api/cron/crm-bin-purge` | `0 17 * * *` |
| `/api/cron/quickbooks-invoice-sync` | `0 18 * * *` |
| `/api/cron/quickbooks-bill-sync` | `10 18 * * *` |
| `/api/cron/working-calendar-sync` | `0 18 1 10 *` |

Confirm the intended timezone and disable/guard these side effects during the
rehearsal and cutover. Also inventory Supabase `pg_cron`, `pg_net`, Database
Webhooks, and any external schedules in the dashboard; these are not fully
represented in this repository.

### External integrations

| Integration | Repository evidence | Cutover check |
| --- | --- | --- |
| QuickBooks | OAuth connect/callback, estimates, invoices, bills, PDF archives | Verify redirect URI, client credentials, token persistence, quote generation, and the scheduled syncs. |
| Make | Email enquiry and attachment inbound routes; lead-assigned/reply-status outbound webhook | Pause scenarios during final sync, preserve shared secrets, then point to production and test an attachment. |
| Zapier / WPForms / WooCommerce | Inbound order routes protected by `ZAPIER_INBOUND_SECRET` | Pause or queue incoming calls during cutover, then send one controlled event per source. |
| Azure Document Intelligence | Environment variables used by bill-document extraction | Preserve credentials and perform a controlled extraction test. |

The application environment variable names to compare in Vercel are:

```text
APP_BASE_URL
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
AZURE_DOCUMENT_INTELLIGENCE_KEY
CRON_SECRET
MAKE_INBOUND_SECRET
MAKE_INTEGRATION_SECRET
MAKE_LEAD_ASSIGNED_WEBHOOK_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_URL
QUICKBOOKS_CLIENT_ID
QUICKBOOKS_CLIENT_SECRET
QUICKBOOKS_INCOME_ACCOUNT_ID
QUICKBOOKS_REDIRECT_URI
SUPABASE_SERVICE_ROLE_KEY
ZAPIER_INBOUND_SECRET
```

`VERCEL_*` variables are platform-provided and should not be copied manually.

## Phase A — baseline and source audit

**Owner:** database/application owner

1. Record baseline p50/p95 timings from a Singapore connection for login,
   Board first page, Gantt first page, one signed file download, and one
   representative API route.
2. In Supabase US, record database size, Storage size by bucket, compute tier,
   active connections, Realtime usage, slow-query data, extensions, database
   settings, network restrictions, webhooks, cron jobs, and enabled Auth
   providers.
3. Export non-secret configuration screenshots or a redacted inventory:
   Auth URLs/providers, Storage buckets/policies, Realtime publications,
   Database Webhooks, Edge Functions, Vault secret *names*, and scheduled
   jobs.
4. Decide the production maintenance window and a maximum acceptable outage.
5. Confirm named owners for database migration, external integrations,
   validation, and the rollback decision.

**Exit criterion:** the migration inventory is complete and the final write
freeze duration is agreed.

## Phase B — Singapore rehearsal

**Owner:** database/application owner

1. Create a new, independent Supabase project in `ap-southeast-1`.
2. Use a logical export/import procedure to copy the US schema and data. Do
   not use the same-region restore feature as the region-change mechanism.
3. Recreate or verify extensions, RLS, policies, grants, RPCs, triggers,
   database settings, Auth configuration, Realtime publication, Storage
   buckets/policies, Edge Functions, webhooks, and secret values.
4. Copy Storage objects into the matching Singapore buckets.
5. Create a Vercel Preview deployment configured only with the Singapore
   Supabase URL/publishable key/service-role key. Keep scheduled jobs and
   outgoing integrations disabled or pointed to test-safe targets.
6. Do not attach the production custom domain or send production Auth email
   until this environment has passed validation.

### Rehearsal reconciliation

Compare US source and Singapore target:

- row counts for every application table and `auth.users`;
- representative checksums/counts for critical client/subitem/attachment data;
- Storage object count and bytes per bucket;
- bucket settings and Storage policies;
- installed extensions, RLS enabled state, functions/RPC signatures, triggers,
  and Realtime publication membership;
- option data, CRM groups, profiles, notifications, QuickBooks-linked records,
  and current active workflows.

### Rehearsal smoke tests

- Existing-user login, invitation, password reset, and logout.
- Board, filters, quick-filter counts, Tracking View, client move, Gantt,
  client/subitem editing, and two-session Realtime refresh.
- Upload/download/preview a CRM file and a Shipper attachment.
- Email lead creation plus attachment upload from a safe Make scenario.
- QuickBooks OAuth callback and one non-production-safe verification agreed
  with the finance owner.
- OCF and PDF archive workflow.
- Every cron route in a dry-run/controlled mode.

**Exit criterion:** reconciliation is clean, all critical smoke tests pass,
and the preview deployment uses Singapore end-to-end without unintended side
effects.

### Rehearsal exit and deletion checklist

Complete this list before deleting the Singapore rehearsal project. Store only
redacted outputs, commands, object counts, and configuration names in the
repository/runbook—never passwords, API keys, access tokens, or private URLs.

#### Pre-activation work — complete before creating the rehearsal project

- [ ] Complete [the non-secret configuration worksheet](./supabase-vercel-rehearsal-configuration-worksheet.md).
- [ ] Complete the remaining US dashboard inventory: Auth providers/Site URL/
  redirect URLs/SMTP/templates, Database Webhooks, Edge Functions, Vault
  secret names, API settings, network restrictions, and custom domains.
- [ ] Capture the Vercel Production variable *names* and external integration
  endpoints that will need swapping: Make, Zapier/WPForms/WooCommerce,
  QuickBooks, and Azure Document Intelligence.
- [ ] Decide the Auth rehearsal approach. It must preserve user UUIDs and
  profile mappings, while avoiding `auth.users.on_auth_user_created` creating
  duplicate profiles during import.
- [ ] Prepare and peer-review the exact logical export, target import,
  trigger-control, Storage-copy, and reconciliation commands before creating
  the paid project.
- [ ] Prepare a separate Vercel rehearsal project/deployment in `sin1` if an
  end-to-end Singapore latency test is required. Never change the production
  Vercel Function Region for this exercise.
- [ ] Pause or redirect all write-capable external integrations for rehearsal:
  Make inbound/outbound scenarios, Zapier/WPForms/WooCommerce, QuickBooks
  callbacks/syncs, Vercel cron routes, Database Webhooks, and Edge Functions.

#### Required proof while the rehearsal project is active

- [ ] Verify the new project is specifically `ap-southeast-1` and record its
  project reference without recording credentials.
- [ ] Import the complete application schema, including `public`, `private`,
  all 101 application functions, extensions, RLS policies, grants, indexes,
  and 33 trigger definitions.
- [ ] Prove that the import sequence suppresses restore-time trigger side
  effects, then restores normal trigger operation. In particular, validate the
  `auth.users` profile-creation trigger and CRM/QuickBooks total-refresh
  triggers.
- [ ] Recreate the three private Storage buckets and their settings/policies;
  copy all 241 current objects and reconcile counts/bytes/prefixes.
- [ ] Recreate the 15 application-table memberships in
  `supabase_realtime`; do not manually migrate `realtime.messages_*` tables.
- [ ] Reconfigure Auth safely for rehearsal: test-only Site URL/redirects,
  provider configuration, SMTP/template behavior, and no production email
  sends unless explicitly approved.
- [ ] Validate all external integration configuration with safe test inputs;
  do not send real QuickBooks mutations, production Make workflows, or
  scheduled side effects from rehearsal.
- [ ] Run source/target reconciliation for public table counts, Auth users and
  UUID/profile mappings, Storage buckets/policies/object totals, functions,
  extensions, RLS policies, triggers, and Realtime membership.
- [ ] Run application smoke tests: existing-user login, Board/filters/Tracking
  View, Gantt, two-session Realtime, client/subitem edits, OCF, file
  upload/download/preview, Shipper, email-lead attachment upload, and
  controlled QuickBooks/PDF behavior.
- [ ] Measure Singapore p50/p95 timings from a Singapore connection for login,
  Board, Gantt, signed download, and representative server routes. Compare
  them with the US baseline.

#### Rehearsal performance evidence

The following are warm third-run database measurements (`EXPLAIN (ANALYZE,
BUFFERS)`) captured on 2026-10-13. They measure PostgreSQL execution only;
they do **not** include browser rendering, Vercel/network latency, or Storage
file-transfer time. The source remains writable during rehearsal, so matching
row counts are not assumed for these measurements.

| Surface / RPC | US execution | Singapore execution | Change |
| --- | ---: | ---: | ---: |
| Board landing page — `crm_board_initial_page_hydrated_v1` | 27.192 ms | 13.494 ms | 50.4% faster |
| Board group counts — `crm_board_client_group_counts_v3` | 11.055 ms | 9.770 ms | 11.6% faster |
| Board quick-filter counts — `crm_board_quick_filter_counts_v2` | 13.178 ms | 11.489 ms | 12.8% faster |
| Expanded Board group — `crm_board_client_page_hydrated_v3` | 19.199 ms | 18.461 ms | 3.8% faster |
| Gantt resource selection — `gantt_resource_page` | 10.817 ms | 9.742 ms | 10.0% faster |

For the unfiltered Board landing page, the three RPCs run concurrently. Its
database critical path is therefore the slowest call: 27.192 ms in US versus
13.494 ms in Singapore (13.698 ms, or 50.4%, faster). Capture equivalent
third-run Gantt and browser Network download timings before closing the
rehearsal evidence.

##### File-download route observations

Browser Network screenshots captured a small convenience sample of the
application's `GET /api/files/download` redirect route. These timings are
useful end-to-end evidence, but are not a controlled p50/p95 benchmark: the
sample sizes differ and the screenshots do not prove that every entry refers
to the same object.

| Environment | Observed route durations | Median | Mean |
| --- | --- | ---: | ---: |
| US | 1.81 s, 1.52 s, 1.73 s, 1.74 s, 1.53 s, 1.07 s | 1.63 s | 1.57 s |
| Singapore | 181 ms, 169 ms, 930 ms, 887 ms, 868 ms, 845 ms, 162 ms, 164 ms, 137 ms, 157 ms | 175 ms | 450 ms |

The SG sample's median application redirect time is approximately 1.46 s
lower (about 89% faster). The 845–930 ms SG outliers show that Storage/signing
and transient network work still matter; retain the raw values rather than
claiming a guaranteed per-file reduction.

#### Capture before deletion

- [ ] Record the exact sequence, commands, durations, failures, and fixes
  needed for the rehearsal; turn it into the final production cutover script.
- [ ] Record a redacted old-to-new configuration map for Supabase, Vercel,
  Auth, Storage, Realtime, cron, Make/Zapier/WooCommerce, QuickBooks, and
  Azure.
- [ ] Document final migration prerequisites and the freeze-window count/
  Storage reconciliation queries. The production target will receive a fresh
  final source export; rehearsal counts are not the cutover counts.
- [ ] Obtain explicit sign-off that the rehearsal met functional, security,
  data-integrity, and latency acceptance criteria.
- [ ] Download/save any required logs or reports, then revoke any temporary
  rehearsal credentials, disconnect test-only integration callbacks, delete
  the rehearsal Vercel project/deployment if created, and delete the Supabase
  rehearsal project.

The rehearsal can be deleted immediately once the checklist is complete; it
does not need to remain active until the eventual production cutover.

## Phase C — production cutover

1. Enable a maintenance/read-only mode in the US application.
2. Pause Make, Zapier, WooCommerce, and other inbound write sources.
3. Disable or guard Vercel cron routes and any Supabase background jobs in
   both environments.
4. Take the final logical database export from US and apply it to Singapore.
5. Perform the final Storage delta copy.
6. Run the production reconciliation checks before reopening writes.
7. Set Vercel Production environment variables to the Singapore project
   values.
8. In Vercel Project Settings -> Functions, select only `sin1`; deploy the
   production build. Do not add `regions` to `vercel.json` unless we decide to
   version-control the setting; either configuration overrides the other.
9. Run production smoke tests, then re-enable schedules and inbound sources
   one at a time.
10. Announce completion and monitor errors/latency continuously.

## Rollback

Before any new Singapore writes are accepted, rollback is straightforward:

1. Keep maintenance mode enabled.
2. Restore Vercel Production variables to the US project values.
3. Set Vercel Functions back to `iad1` and redeploy.
4. Re-enable US schedules and inbound sources.

After Singapore accepts writes, rollback requires a business decision: either
accept loss of post-cutover writes or reconcile them into US manually. This is
why all reconciliation and production smoke tests occur before writes reopen.

## Post-cutover observation and retirement

- Monitor Vercel function error/duration metrics and Supabase compute,
  connections, Storage, Realtime, Auth, and database logs for seven days.
- Re-run the baseline timings from Singapore and compare p50/p95 values.
- Keep the US project, backups, and migration artifacts for at least 14 days.
- Decommission US only after formal sign-off and confirmation that no external
  provider still targets it.
