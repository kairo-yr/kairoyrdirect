-- Restore batch-first attendance while retaining the useful session participant records.
-- The slot tables from 202607180 are intentionally left untouched and unused so no
-- production data is destroyed. This migration is forward-only and additive apart
-- from replacing RPC implementations and widening a session-only check constraint.

alter table public.class_sessions
  add column if not exists primary_batch_id uuid references public.batches(id) on delete restrict;

update public.class_sessions cs
set primary_batch_id = (
  select ssb.batch_id from public.session_source_batches ssb
  where ssb.session_id = cs.id
  order by case when ssb.source_type = 'automatic' then 0 else 1 end, ssb.added_at
  limit 1
)
where cs.primary_batch_id is null
  and exists(select 1 from public.session_source_batches ssb where ssb.session_id=cs.id);

create unique index if not exists class_sessions_batch_date_time_uidx
  on public.class_sessions(academy_id, primary_batch_id, session_date, start_time)
  where primary_batch_id is not null and class_slot_id is null;

alter table public.session_participants drop constraint if exists session_participants_source_type_check;
alter table public.session_participants add constraint session_participants_source_type_check
  check (source_type in (
    'batch','makeup','extra_class','temporary','trial','other',
    'individual_schedule','compensation','rescheduled','temporary_transfer','manual_other'
  ));

create or replace function public.find_or_create_batch_class_session(target_batch uuid, target_date date, target_start_time time, target_end_time time)
returns uuid language plpgsql security definer set search_path='' as $$
declare selected_batch public.batches%rowtype; session_id uuid;
begin
  select * into selected_batch from public.batches where id=target_batch and status='active';
  if selected_batch.id is null then raise exception 'Batch belongs to another academy or is inactive.'; end if;
  if not (public.is_super_admin() or public.has_academy_role(selected_batch.academy_id,'academy_admin') or public.is_assigned_coach(selected_batch.academy_id,selected_batch.id)) then
    raise exception 'Permission denied.';
  end if;
  if target_start_time is null or target_end_time is null or target_end_time<=target_start_time then
    raise exception 'Choose a valid class start and end time.';
  end if;

  insert into public.class_sessions(academy_id,primary_batch_id,coach_id,session_date,start_time,end_time,location,status,created_by)
  values(selected_batch.academy_id,selected_batch.id,selected_batch.primary_coach_id,target_date,target_start_time,target_end_time,selected_batch.location,'open',auth.uid())
  on conflict(academy_id,primary_batch_id,session_date,start_time) where primary_batch_id is not null and class_slot_id is null
  do update set updated_at=public.class_sessions.updated_at
  returning id into session_id;

  insert into public.session_source_batches(academy_id,session_id,batch_id,source_type,added_by)
  values(selected_batch.academy_id,session_id,selected_batch.id,'automatic',auth.uid())
  on conflict(session_id,batch_id) do nothing;

  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select selected_batch.academy_id,session_id,s.id,'batch',selected_batch.id,auth.uid()
  from public.batch_students bs
  join public.students s on s.id=bs.student_id
  where bs.batch_id=selected_batch.id and bs.status='active' and s.status='active'
    and coalesce(bs.joined_at,target_date)<=target_date
    and (bs.removed_at is null or bs.removed_at>=target_date)
  on conflict(session_id,student_id) do nothing;

  return session_id;
end $$;

create or replace function public.add_student_to_class_session(target_session uuid,target_student uuid,reason text,note text default null,missed_session uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; participant_id uuid; source text;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  if not exists(select 1 from public.students s where s.id=target_student and s.academy_id=cs.academy_id and s.status='active') then
    raise exception 'Student belongs to another academy or is inactive.';
  end if;
  if reason not in ('makeup','extra_class','temporary','trial','other') then raise exception 'Choose a valid attendance reason.'; end if;
  if reason='other' and nullif(trim(coalesce(note,'')),'') is null then raise exception 'A note is required for Other.'; end if;
  source:=reason;

  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_reason,added_note,added_by)
  select cs.academy_id,cs.id,target_student,source,s.home_batch_id,reason,nullif(trim(note),''),auth.uid()
  from public.students s where s.id=target_student
  on conflict(session_id,student_id) do nothing returning id into participant_id;
  if participant_id is null then raise exception 'Student already exists in session.'; end if;

  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values)
  values(auth.uid(),cs.academy_id,'session.student_added','session_participant',participant_id,
    jsonb_build_object('session_id',cs.id,'student_id',target_student,'reason',reason));
  return participant_id;
end $$;

create or replace function public.search_students_for_class_session(target_session uuid,search_text text default '',result_limit integer default 30)
returns table(id uuid,full_name text,parent_name text,parent_phone text,home_batch_id uuid,home_batch_name text)
language sql stable security definer set search_path='' as $$
  select s.id,s.full_name,s.parent_name,s.parent_phone,current_batch.id,current_batch.name
  from public.class_sessions cs
  join public.students s on s.academy_id=cs.academy_id
  left join lateral (
    select b.id,b.name from public.batch_students bs join public.batches b on b.id=bs.batch_id
    where bs.student_id=s.id and bs.status='active' and b.status='active'
    order by bs.joined_at nulls last,bs.created_at limit 1
  ) current_batch on true
  where cs.id=target_session and public.can_manage_class_session(cs.id) and s.status='active'
    and not exists(select 1 from public.session_participants p where p.session_id=cs.id and p.student_id=s.id)
    and (nullif(trim(search_text),'') is null or s.full_name ilike '%'||trim(search_text)||'%')
  order by s.full_name limit least(greatest(result_limit,1),50);
$$;

create or replace function public.refresh_class_session_roster(target_session uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare cs public.class_sessions%rowtype; source_batch uuid; inserted_count integer;
begin
  select * into cs from public.class_sessions where id=target_session for update;
  if cs.id is null or not public.can_manage_class_session(cs.id) then raise exception 'Permission denied.'; end if;
  if cs.status='completed' then raise exception 'Session already completed.'; end if;
  select coalesce(cs.primary_batch_id,ssb.batch_id) into source_batch
  from public.session_source_batches ssb where ssb.session_id=cs.id
  order by case when ssb.source_type='automatic' then 0 else 1 end,ssb.added_at limit 1;
  if source_batch is null then return 0; end if;
  insert into public.session_participants(academy_id,session_id,student_id,source_type,source_batch_id,added_by)
  select cs.academy_id,cs.id,s.id,'batch',source_batch,auth.uid()
  from public.batch_students bs join public.students s on s.id=bs.student_id
  where bs.batch_id=source_batch and bs.status='active' and s.status='active'
    and coalesce(bs.joined_at,cs.session_date)<=cs.session_date
    and (bs.removed_at is null or bs.removed_at>=cs.session_date)
  on conflict(session_id,student_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

revoke all on function public.find_or_create_batch_class_session(uuid,date,time,time) from public,anon;
grant execute on function public.find_or_create_batch_class_session(uuid,date,time,time) to authenticated;
