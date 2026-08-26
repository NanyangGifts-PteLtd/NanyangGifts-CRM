create table if not exists public.lead_ingestions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  submission_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  client_id uuid references public.clients(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  subitems_created boolean not null default false,
  activity_logged boolean not null default false,
  notification_sent boolean not null default false,
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint lead_ingestions_source_external_key unique (source, external_id)
);

create index if not exists lead_ingestions_client_id_idx
  on public.lead_ingestions(client_id);

create index if not exists lead_ingestions_status_updated_idx
  on public.lead_ingestions(status, updated_at);

with existing_inbound_clients as (
  select
    c.id as client_id,
    case
      when lower(coalesce(c.custom_fields->>'submissionType', '')) like '%woocommerce%' then 'woocommerce'
      else 'wpforms'
    end as source,
    case
      when lower(coalesce(c.custom_fields->>'submissionType', '')) like '%woocommerce%' then coalesce(
        nullif(btrim(c.custom_fields->>'external_id'), ''),
        nullif(btrim(c.custom_fields->'raw'->>'externalId'), ''),
        case when coalesce(c.nbd, '') !~ '^\d{4}-\d{2}-\d{2}$' then nullif(btrim(c.nbd), '') end
      )
      else nullif(btrim(c.custom_fields->>'external_id'), '')
    end as external_id,
    coalesce(nullif(c.custom_fields->>'submissionType', ''), 'legacy_inbound') as submission_type,
    coalesce(c.created_at, now()) as created_at,
    (
      select ca.user_id
      from public.client_assignees ca
      where ca.client_id = c.id
      order by ca.assigned_at nulls last
      limit 1
    ) as assigned_user_id
  from public.clients c
  where nullif(btrim(c.custom_fields->>'external_id'), '') is not null
     or lower(coalesce(c.custom_fields->>'submissionType', '')) like '%woocommerce%'
)
insert into public.lead_ingestions (
  source, external_id, submission_type, status, client_id, assigned_user_id,
  subitems_created, activity_logged, notification_sent, completed_at,
  created_at, updated_at
)
select
  source, external_id, submission_type, 'completed', client_id, assigned_user_id,
  true, true, true, created_at, created_at, created_at
from existing_inbound_clients
where external_id is not null
on conflict (source, external_id) do nothing;

insert into public.activity_log (
  client_id, subitem_id, actor_name, action, field_name, old_value, new_value,
  subitem_name, link, title, description, meta, created_at
)
select
  li.client_id,
  null,
  'Inbound integration',
  'client_added',
  null,
  null,
  null,
  null,
  null,
  case when li.source = 'woocommerce'
    then 'created this client from WooCommerce'
    else 'created this client from WPForms'
  end,
  'Inbound reference: ' || li.external_id,
  jsonb_build_object(
    'ingestionId', li.id,
    'source', li.source,
    'submissionType', li.submission_type,
    'externalId', li.external_id,
    'assignedUserId', li.assigned_user_id
  ),
  li.created_at
from public.lead_ingestions li
where li.client_id is not null
  and not exists (
    select 1
    from public.activity_log activity
    where activity.client_id = li.client_id
      and activity.meta @> jsonb_build_object('ingestionId', li.id)
  );

update public.clients
set nbd = ''
where lower(coalesce(custom_fields->>'submissionType', '')) like '%woocommerce%'
  and nullif(btrim(nbd), '') is not null
  and nbd !~ '^\d{4}-\d{2}-\d{2}$';

alter table public.lead_ingestions enable row level security;
revoke all on table public.lead_ingestions from anon, authenticated;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_unique_idx
  on public.notifications(dedupe_key)
  where dedupe_key is not null;

create or replace function public.assign_lead_ingestion_sales_user(ingestion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_user_id uuid;
begin
  select li.assigned_user_id
    into selected_user_id
  from public.lead_ingestions li
  where li.id = ingestion_id
  for update;

  if not found then
    raise exception 'Lead ingestion not found';
  end if;

  if selected_user_id is not null then
    return selected_user_id;
  end if;

  select assignment.user_id
    into selected_user_id
  from public.get_next_sales_assignee() assignment
  limit 1;

  if selected_user_id is null then
    raise exception 'No sales assignee returned from Round Robin';
  end if;

  update public.lead_ingestions
  set assigned_user_id = selected_user_id,
      updated_at = now()
  where id = ingestion_id;

  return selected_user_id;
end;
$$;

revoke all on function public.assign_lead_ingestion_sales_user(uuid) from public, anon, authenticated;
grant execute on function public.assign_lead_ingestion_sales_user(uuid) to service_role;
