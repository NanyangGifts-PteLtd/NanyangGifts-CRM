-- Apply in the Singapore rehearsal project's SQL Editor after the logical restore.
-- This restores only application-owned customizations on Supabase-managed schemas.
-- It deliberately does not create or modify Supabase-owned auth/storage objects.

begin;

do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'Expected public.handle_new_user() to exist before creating the auth trigger.';
  end if;

  if to_regprocedure('private.is_internal_user()') is null
    or to_regprocedure('private.can_upload_crm_file(text)') is null
    or to_regprocedure('private.can_upload_ocf_item_image(text)') is null
    or to_regprocedure('private.can_access_shipper(uuid)') is null then
    raise exception 'Expected private Storage-policy helper functions to exist before creating policies.';
  end if;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists crm_files_insert_assigned on storage.objects;
create policy crm_files_insert_assigned
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'crm-files'
    and private.can_upload_crm_file(name)
  );

drop policy if exists crm_files_select_internal on storage.objects;
create policy crm_files_select_internal
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'crm-files'
    and private.is_internal_user()
  );

drop policy if exists order_confirmation_files_insert_assigned on storage.objects;
create policy order_confirmation_files_insert_assigned
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'order-confirmation-files'
    and private.can_upload_ocf_item_image(name)
  );

drop policy if exists order_confirmation_files_select_internal on storage.objects;
create policy order_confirmation_files_select_internal
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'order-confirmation-files'
    and private.is_internal_user()
  );

drop policy if exists shipper_attachments_delete_permitted on storage.objects;
create policy shipper_attachments_delete_permitted
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shipper-attachments'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and private.can_access_shipper(split_part(name, '/', 1)::uuid)
  );

drop policy if exists shipper_attachments_insert_permitted on storage.objects;
create policy shipper_attachments_insert_permitted
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'shipper-attachments'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and private.can_access_shipper(split_part(name, '/', 1)::uuid)
  );

drop policy if exists shipper_attachments_select_permitted on storage.objects;
create policy shipper_attachments_select_permitted
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'shipper-attachments'
    and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    and private.can_access_shipper(split_part(name, '/', 1)::uuid)
  );

commit;
