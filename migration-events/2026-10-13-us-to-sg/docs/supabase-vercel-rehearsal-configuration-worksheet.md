# Singapore rehearsal configuration worksheet

Use this worksheet before creating the paid Singapore rehearsal project. Record
setting names, enabled/disabled state, and redacted identifiers only. Never
commit passwords, access tokens, database URLs, API keys, client secrets, JWT
secrets, or service-role keys.

## Source project: Supabase US

### Auth

- [x] Site URL recorded: `https://friday.nanyanggifts.com`.
- [x] Allowed redirect URLs recorded:
  - `https://nanyanggifts.vercel.app`
  - `http://localhost:3000/**`
  - `http://localhost:3000`
  - `https://nanyanggifts.vercel.app/auth/invite`
  - `https://friday.nanyanggifts.com`
  - `https://friday.nanyanggifts.com/auth/*`
- [x] Enabled Auth provider recorded: Email only; no third-party providers,
  phone provider, SAML, manual identity linking, or anonymous sign-ins.
- [x] User-signup state recorded: new user signup disabled; email confirmation
  enabled.
- [x] Email confirmation, invite, recovery, and magic-link templates reviewed:
  all use Supabase defaults (no customization).
- [x] No custom SMTP/email provider is configured.
- [x] Password/OTP settings recorded: secure email change enabled; secure
  password change disabled; current-password requirement disabled; leaked
  password prevention disabled; minimum password length 6; no additional
  password requirements; email OTP/link expiry 3,600 seconds; email OTP length
  8 digits.
- [x] CAPTCHA is not enabled. MFA: TOTP enabled, maximum 10 factors per user;
  SMS MFA disabled; AAL1-session time limit enabled. User sessions: single
  session disabled, time-box disabled (0), inactivity timeout disabled (0).
  Tokens: access-token expiry 3,600 seconds, compromised-refresh-token
  detection enabled, refresh-token reuse interval 10 seconds.
- [ ] Current Auth user count recorded: **13**.

For the Singapore rehearsal, do **not** copy the production Site URL or
production redirect URLs as the active defaults. Use the isolated rehearsal
Vercel URL and, if needed, localhost-only redirects. The application has both
`/auth/confirm` token verification and `/auth/invite` hash-session handling,
so rehearsal must test confirmation, invitation, recovery, and password setup
using its own URL before production settings are copied to the final target.

### Platform configuration

- [x] Data API settings recorded: exposed schemas `graphql_public`, `public`;
  extra search path `public`, `extensions`; maximum rows 1,000; automatic
  exposure of new tables/functions enabled; automatic pool sizing.
- [x] No database network restrictions / allowed IP ranges configured.
- [x] No Supabase custom domain configured.
- [x] No Database Webhooks configured.
- [x] No Edge Functions configured; no non-default Edge Function secrets.
- [x] No Vault secrets configured.
- [x] No log drains, read replicas, PITR, IPv4, or other non-default project
  add-ons configured.

### Storage and Realtime

- [x] Storage buckets/counts/bytes captured: `crm-files`,
  `order-confirmation-files`, `shipper-attachments`.
- [x] Storage policies captured.
- [x] Realtime publication membership captured: 15 public application tables.
- [ ] Record whether any dashboard-only Storage configuration exists beyond
  the bucket settings/policies already captured.

## Vercel production project

- [x] Production domains recorded: `friday.nanyanggifts.com` and
  `nanyanggifts.vercel.app`.
- [x] Function Region recorded: current `iad1`; final target `sin1`.
- [ ] Production environment variable **names** compared with this repository:
  `APP_BASE_URL`, Auth0 variables, all Supabase URL/key/JWT/connection
  variables, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`,
  `AZURE_DOCUMENT_INTELLIGENCE_KEY`, `CRON_SECRET`,
  `MAKE_INTEGRATION_SECRET`, `MAKE_LEAD_ASSIGNED_WEBHOOK_URL`,
  QuickBooks variables, and `ZAPIER_INBOUND_SECRET`.
- [x] Variable scopes recorded: `AZURE_DOCUMENT_INTELLIGENCE_KEY`,
  `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `MAKE_INTEGRATION_SECRET`, and
  `MAKE_LEAD_ASSIGNED_WEBHOOK_URL` are Production-only; all other listed
  variables are configured for Production and Preview. None are configured
  for Development.
- [x] Vercel Cron is enabled. Schedules are UTC: client reply automation
  (`0 16 * * *`), CRM-bin purge (`0 17 * * *`), QuickBooks bill sync
  (`10 18 * * *`), QuickBooks invoice sync (`0 18 * * *`), and working
  calendar sync (`0 18 1 10 *`). The rehearsal deployment must have cron
  disabled before it can receive imported production data.
- [ ] Confirm no `vercel.json` `regions` override is present; the current
  region is controlled in Vercel Project Settings.

## External integration cutover map

| Integration | Inbound/outbound | Current production endpoint or redirect recorded outside git | Rehearsal action | Production cutover action |
| --- | --- | --- | --- | --- |
| Make email enquiry | Inbound | [ ] | Disable or use a test scenario | Switch after Singapore smoke test |
| Make reply-status / lead assignment | Outbound | [ ] | Point to harmless test receiver or disable | Re-enable after cutover |
| Zapier / WPForms | Inbound | [ ] | Pause or use test event | Switch after Singapore smoke test |
| WooCommerce | Inbound | [ ] | Pause or use test event | Switch after Singapore smoke test |
| QuickBooks OAuth | Bidirectional | [ ] | Test redirect only; no live mutations | Update/confirm production redirect and callback |
| Azure Document Intelligence | Outbound | [ ] | Use controlled document only | Retain same secret/configuration |

## Rehearsal deployment safety

- [ ] The rehearsal uses a separate Supabase project in `ap-southeast-1`.
- [ ] The rehearsal uses a separate Vercel project/deployment if `sin1`
  end-to-end timings are required.
- [ ] No production custom domain is attached to rehearsal.
- [ ] Rehearsal Auth redirects and email configuration cannot send users into
  the production application unexpectedly.
- [ ] Vercel Cron, Database Webhooks, Edge Functions, and external automations
  are disabled, guarded, or test-only before the imported data is reachable.
- [ ] A named owner can decide whether an unexpected outbound side effect is
  safe to test.

## Tooling readiness

- [ ] Install and authenticate the Supabase CLI.
- [ ] Install PostgreSQL client tools: `pg_dump`, `pg_restore`, and `psql`.
- [ ] Verify the commands are available locally before creating the rehearsal
  project.
- [ ] Prepare a local, ignored migration-work directory for encrypted/exported
  artifacts; never place production backups in the repository.
- [ ] Record the exact CLI versions used for the rehearsal.
