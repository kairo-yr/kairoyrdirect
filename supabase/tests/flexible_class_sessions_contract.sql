-- Run after migrations in a disposable Supabase test database.
-- These assertions fail the transaction if the session/RLS contract is incomplete.
begin;
do $$
declare missing text;
begin
  select string_agg(name,', ') into missing from (values
    ('recurring_class_slots'),('batch_class_slots'),('student_class_schedules'),('class_sessions'),('session_source_batches'),('session_participants')
  ) required(name) where to_regclass('public.'||name) is null;
  if missing is not null then raise exception 'Missing session tables: %',missing; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='class_sessions_slot_date_uidx') then raise exception 'Missing slot/date uniqueness.'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname like '%session_participants%' and indexdef ilike '%unique%') then raise exception 'Missing participant uniqueness.'; end if;
  if exists(select 1 from (values ('recurring_class_slots'),('batch_class_slots'),('student_class_schedules'),('class_sessions'),('session_source_batches'),('session_participants')) required(name)
    left join pg_class c on c.relname=required.name left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where not coalesce(c.relrowsecurity,false)) then raise exception 'RLS is not enabled on every session table.'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename in ('recurring_class_slots','batch_class_slots','student_class_schedules','class_sessions','session_source_batches','session_participants')) < 16 then raise exception 'Expected session RLS policies are missing.'; end if;
  if to_regprocedure('public.find_or_create_class_session(uuid,date)') is null or to_regprocedure('public.save_class_session_attendance(uuid,jsonb,boolean)') is null then raise exception 'Session RPCs are missing.'; end if;
end $$;
rollback;
