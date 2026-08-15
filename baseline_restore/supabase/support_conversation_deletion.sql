-- FICONTER · Permanent support conversation deletion
-- Removes request-scoped customer notifications in the same transaction before
-- support message rows cascade from support_requests.

begin;

create index if not exists user_notifications_support_request_idx
  on public.user_notifications (user_id, ((metadata ->> 'request_id')))
  where metadata ? 'request_id';

create or replace function public.cleanup_support_request_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_notifications notification
  where notification.user_id = old.user_id
    and notification.metadata ->> 'request_id' = old.id::text;

  return old;
end;
$$;

drop trigger if exists support_requests_cleanup_notifications
  on public.support_requests;
create trigger support_requests_cleanup_notifications
before delete on public.support_requests
for each row execute function public.cleanup_support_request_notifications();

comment on function public.cleanup_support_request_notifications() is
  'Deletes notifications linked to a support conversation before that conversation is permanently removed.';

commit;

notify pgrst, 'reload schema';
