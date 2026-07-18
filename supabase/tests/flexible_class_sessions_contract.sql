-- Run after migrations in a disposable Supabase test database.
begin;
do $$
declare missing text;
begin
  select string_agg(name,', ') into missing from (values
    ('class_sessions'),('session_source_batches'),('session_participants')
  ) required(name) where to_regclass('public.'||name) is null;
  if missing is not null then raise exception 'Missing session tables: %',missing; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='class_sessions_batch_date_time_uidx') then raise exception 'Missing batch/date/time uniqueness.'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname like '%session_participants%' and indexdef ilike '%unique%') then raise exception 'Missing participant uniqueness.'; end if;
  if exists(select 1 from (values ('class_sessions'),('session_source_batches'),('session_participants')) required(name)
    left join pg_class c on c.relname=required.name left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public' where not coalesce(c.relrowsecurity,false)) then raise exception 'RLS is not enabled on session data.'; end if;
  if to_regprocedure('public.find_or_create_batch_class_session(uuid,date,time without time zone,time without time zone)') is null or to_regprocedure('public.save_class_session_attendance(uuid,jsonb,boolean)') is null then raise exception 'Batch session RPCs are missing.'; end if;
end $$;
rollback;
