-- Supabase US -> Singapore migration: Phase A source audit
--
-- Run this file in the CURRENT US Supabase project's SQL Editor as a project
-- administrator. Every query below is read-only. Save the result of each
-- section with the migration runbook; do not paste secrets into tickets or git.
--
-- Some Supabase-managed schemas may be inaccessible under restricted roles.
-- If a section reports insufficient privilege, record that fact and collect the
-- equivalent information from the Supabase dashboard instead.

-- 1. Database identity, Postgres version, and primary size baseline.
select
  current_database() as database_name,
  current_user as executed_as,
  version() as postgres_version,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as database_size_bytes,
  now() at time zone 'utc' as audited_at_utc;

-- 2. Current database settings that can materially affect a restore or runtime.
select name, setting, unit, source
from pg_settings
where name in (
  'TimeZone',
  'max_connections',
  'shared_buffers',
  'work_mem',
  'maintenance_work_mem',
  'statement_timeout',
  'lock_timeout',
  'idle_in_transaction_session_timeout',
  'random_page_cost',
  'effective_cache_size'
)
order by name;

-- 3. Installed extensions. Recreate/verify every required extension in the
-- target project before declaring the rehearsal ready.
select extname, extversion, extnamespace::regnamespace::text as schema_name
from pg_extension
order by extname;

-- 4. Largest application tables and dead-tuple indicators. This is a health
-- signal, not an exact bloat calculation.
select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  case
    when n_live_tup + n_dead_tup = 0 then 0
    else round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
  end as dead_tuple_percent,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_total_relation_size(relid) as total_size_bytes,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;

-- 5. Index sizes. Keep this with the schema export so large or custom indexes
-- are checked on the target after import.
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_relation_size(indexrelid) as index_size_bytes,
  idx_scan
from pg_stat_user_indexes
where schemaname = 'public'
order by pg_relation_size(indexrelid) desc;

-- 6. Exact row-count commands for public tables. Copy the generated statement
-- into a second SQL Editor tab and run it on both source and target after the
-- final sync. This is intentionally generated rather than executed dynamically
-- so the audit itself remains read-only.
select string_agg(
  format(
    'select %L as table_name, count(*)::bigint as row_count from %I.%I',
    schemaname || '.' || tablename,
    schemaname,
    tablename
  ),
  E'\nunion all\n' order by schemaname, tablename
) || E'\norder by table_name;' as exact_public_row_count_sql
from pg_tables
where schemaname = 'public';

-- 7. Application functions/RPCs and private authorization helpers. Compare
-- names, arguments, owner, and source target-side. The private schema is
-- essential: public and storage RLS policies call its helper functions.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.provolatile as volatility
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname, identity_arguments;

-- 8. RLS configuration and policies. Both must be identical in Singapore.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

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
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 9. Triggers. Pay special attention to trigger functions with HTTP, cron,
-- notification, audit, or external side effects before replaying a restore.
select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_condition,
  action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth', 'storage')
order by schema_name, table_name, trigger_name, event_manipulation;

-- 10. Realtime publication membership. Confirm every expected table is in the
-- target publication before enabling production traffic.
select
  pubname as publication_name,
  schemaname,
  tablename,
  attnames,
  rowfilter
from pg_publication_tables
order by pubname, schemaname, tablename;

-- 11. Storage inventory. The app currently uses crm-files,
-- order-confirmation-files, and shipper-attachments; this query also catches
-- any dashboard-created buckets.
select
  b.id as bucket_id,
  b.name as bucket_name,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  count(o.id)::bigint as object_count,
  coalesce(sum(nullif(o.metadata ->> 'size', '')::bigint), 0)::bigint as object_bytes,
  pg_size_pretty(coalesce(sum(nullif(o.metadata ->> 'size', '')::bigint), 0)) as object_size
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types
order by object_bytes desc, b.name;

-- 12. Storage object counts/bytes by top-level path. This helps validate the
-- final storage delta copy without listing every object in a ticket.
select
  bucket_id,
  coalesce(nullif(split_part(name, '/', 1), ''), '(root)') as top_level_prefix,
  count(*)::bigint as object_count,
  coalesce(sum(nullif(metadata ->> 'size', '')::bigint), 0)::bigint as object_bytes
from storage.objects
group by bucket_id, coalesce(nullif(split_part(name, '/', 1), ''), '(root)')
order by bucket_id, object_bytes desc, top_level_prefix;

-- 13. Auth-volume baseline. Run only in the Supabase SQL Editor with access to
-- auth schema. Do not export names, emails, or token data for this audit.
select count(*)::bigint as auth_user_count
from auth.users;

-- 14. Current connections grouped by database/user/application. This helps
-- choose a maintenance window and validate connection-pool behaviour.
select
  datname,
  usename,
  application_name,
  state,
  count(*)::bigint as connection_count
from pg_stat_activity
where datname = current_database()
group by datname, usename, application_name, state
order by connection_count desc, usename, application_name, state;

-- 15. Optional follow-ups (run separately only when the relevant extension or
-- Supabase feature is present):
--
-- select * from cron.job order by jobid;              -- only if pg_cron exists
-- select * from extensions.pg_stat_statements
--   order by total_exec_time desc limit 50;           -- if pg_stat_statements exists
--
-- Dashboard-only inventory still required:
-- * Auth providers/site URL/redirect URLs/email SMTP/templates.
-- * Database Webhooks, Edge Functions, Vault secret names, network
--   restrictions, custom domains, and API settings.
-- * Any Make, Zapier, WooCommerce, QuickBooks, or other external endpoint.
