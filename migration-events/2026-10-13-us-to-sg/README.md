# US to Singapore Supabase/Vercel migration — 2026-10-13

This is the one-time operational archive for the production migration of the
NanyangGifts CRM Supabase project from US East to Singapore (`ap-southeast-1`),
with the related Vercel cutover.

The application was migrated on 2026-10-13. Keep this directory for audit and
historical reference; it is not part of the normal application deployment or
schema-migration workflow.

## Contents

- `docs/` — rehearsal evidence, the production cutover guide, configuration
  worksheet, and the frozen source/target audit snapshots.
- `scripts/` — the one-time source audit, grant extraction, storage-copy, and
  managed-schema customization helpers used during the migration.

The audit snapshots contain no credentials, but do contain operational schema,
policy, and storage metadata. Treat them as internal project documentation.

## Intentionally excluded

Raw database dumps, database URLs, passwords, API keys, session tokens, and
temporary restore output are not in this archive and must not be committed.
They remain local under the gitignored `.local-migration/` directory (or were
cleared after the event).

## Reuse

Do not rerun these scripts against a live project as a routine deployment step.
Any future region migration should use a new dated event directory, fresh
exports and audits, and a separately reviewed migration plan.
