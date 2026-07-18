-- Ensure batch-first class sessions always contain the batch's current active students.
-- This forward-only migration replaces RPC bodies and widens a participant check;
-- it does not delete or overwrite existing attendance/report data.

alter table public.session_participants drop constraint if exists session_participants_source_type_check;
alter table public.session_participants add constraint session_participants_source_type_check
  check (source_type in (
    'scheduled','batch','makeup','extra_class','temporary','trial','other',
    'individual_schedule','compensation','rescheduled','temporary_transfer','manual_other'
  ));

create or replace function public.find_or_create_batch_class_session(
  target_batch uuid,
  target_date date,
  target_start_time time,
  target_end_time time
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_batch public.batches%rowtype;
  v_session_id uuid;
  v_session_status text;
  v_existing_participant_count integer;
begin
  select b.* into v_batch
  from public.batches as b
  where b.id=target_batch and b.status='active';

  if v_batch.id is null then raise exception 'Batch belongs to another academy or is inactive.'; end if;
  if not (
    public.is_super_admin()
    or public.has_academy_role(v_batch.academy_id,'academy_admin')
    or public.is_assigned_coach(v_batch.academy_id,v_batch.id)
  ) then raise exception 'Permission denied.'; end if;
  if target_start_time is null or target_end_time is null or target_end_time<=target_start_time then
    raise exception 'Choose a valid class start and end time.';
  end if;

  select bcs.id,bcs.status into v_session_id,v_session_status
  from public.class_sessions as bcs
  where bcs.academy_id=v_batch.academy_id
    and bcs.primary_batch_id=v_batch.id
    and bcs.session_date=target_date
    and bcs.start_time=target_start_time
    and bcs.class_slot_id is null
  limit 1;

  if v_session_id is null then
    insert into public.class_sessions as bcs (
      academy_id,primary_batch_id,coach_id,session_date,start_time,end_time,location,status,created_by
    ) values (
      v_batch.academy_id,v_batch.id,v_batch.primary_coach_id,target_date,target_start_time,target_end_time,v_batch.location,'open',auth.uid()
    )
    on conflict do nothing
    returning bcs.id,bcs.status into v_session_id,v_session_status;

    if v_session_id is null then
      select bcs.id,bcs.status into v_session_id,v_session_status
      from public.class_sessions as bcs
      where bcs.academy_id=v_batch.academy_id
        and bcs.primary_batch_id=v_batch.id
        and bcs.session_date=target_date
        and bcs.start_time=target_start_time
        and bcs.class_slot_id is null
      limit 1;
    end if;
  end if;

  if v_session_id is null then raise exception 'Could not create or retrieve the class session.'; end if;

  select count(*) into v_existing_participant_count
  from public.session_participants as asp
  where asp.session_id=v_session_id;

  -- Repair only the known invalid state: a completed session with no participant rows.
  if v_session_status='completed' and v_existing_participant_count=0 then
    update public.class_sessions as bcs
    set status='open',completed_at=null,completed_by=null,reopened_at=now(),reopened_by=auth.uid()
    where bcs.id=v_session_id;
  end if;

  insert into public.session_source_batches as ssb (academy_id,session_id,batch_id,source_type,added_by)
  values (v_batch.academy_id,v_session_id,v_batch.id,'automatic',auth.uid())
  on conflict on constraint session_source_batches_session_id_batch_id_key do nothing;

  insert into public.session_participants as asp (
    academy_id,session_id,student_id,source_type,source_batch_id,attendance_status,added_by
  )
  select v_batch.academy_id,v_session_id,s.id,'scheduled',v_batch.id,'present',auth.uid()
  from public.batch_students as bm
  join public.students as s on s.id=bm.student_id
  where bm.academy_id=v_batch.academy_id
    and bm.batch_id=v_batch.id
    and bm.status='active'
    and s.academy_id=v_batch.academy_id
    and s.status='active'
  on conflict on constraint session_participants_session_id_student_id_key do nothing;

  return v_session_id;
end;
$$;

create or replace function public.refresh_class_session_roster(target_session uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_batch_id uuid;
  v_inserted_count integer;
begin
  select bcs.* into v_session from public.class_sessions as bcs where bcs.id=target_session for update;
  if v_session.id is null or not public.can_manage_class_session(v_session.id) then raise exception 'Permission denied.'; end if;
  if v_session.status='completed' then raise exception 'Session already completed.'; end if;

  select coalesce(v_session.primary_batch_id,ssb.batch_id) into v_batch_id
  from public.session_source_batches as ssb
  where ssb.session_id=v_session.id
  order by case when ssb.source_type='automatic' then 0 else 1 end,ssb.added_at
  limit 1;
  if v_batch_id is null then return 0; end if;

  insert into public.session_participants as asp (
    academy_id,session_id,student_id,source_type,source_batch_id,attendance_status,added_by
  )
  select v_session.academy_id,v_session.id,s.id,'scheduled',v_batch_id,'present',auth.uid()
  from public.batch_students as bm
  join public.students as s on s.id=bm.student_id
  where bm.academy_id=v_session.academy_id
    and bm.batch_id=v_batch_id
    and bm.status='active'
    and s.academy_id=v_session.academy_id
    and s.status='active'
  on conflict on constraint session_participants_session_id_student_id_key do nothing;
  get diagnostics v_inserted_count=row_count;
  return v_inserted_count;
end;
$$;

create or replace function public.add_student_to_class_session(
  target_session uuid,target_student uuid,reason text,note text default null,missed_session uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_participant_id uuid;
  v_home_batch_id uuid;
begin
  select bcs.* into v_session from public.class_sessions as bcs where bcs.id=target_session for update;
  if v_session.id is null or not public.can_manage_class_session(v_session.id) then raise exception 'Permission denied.'; end if;
  if v_session.status='completed' then raise exception 'Session already completed.'; end if;
  if not exists(
    select 1 from public.students as s
    where s.id=target_student and s.academy_id=v_session.academy_id and s.status='active'
  ) then raise exception 'Student belongs to another academy or is inactive.'; end if;
  if reason not in ('makeup','extra_class','temporary','trial','other') then raise exception 'Choose a valid attendance reason.'; end if;
  if reason='other' and nullif(trim(coalesce(note,'')),'') is null then raise exception 'A note is required for Other.'; end if;

  select bm.batch_id into v_home_batch_id
  from public.batch_students as bm
  where bm.student_id=target_student and bm.academy_id=v_session.academy_id and bm.status='active'
  order by bm.joined_at nulls last,bm.created_at limit 1;

  insert into public.session_participants as asp (
    academy_id,session_id,student_id,source_type,source_batch_id,added_reason,added_note,attendance_status,added_by
  ) values (
    v_session.academy_id,v_session.id,target_student,reason,v_home_batch_id,reason,nullif(trim(note),''),'present',auth.uid()
  )
  on conflict on constraint session_participants_session_id_student_id_key do nothing
  returning asp.id into v_participant_id;
  if v_participant_id is null then raise exception 'Student already exists in session.'; end if;

  insert into public.audit_logs as al (actor_user_id,academy_id,action,entity_type,entity_id,new_values)
  values (auth.uid(),v_session.academy_id,'session.student_added','session_participant',v_participant_id,
    jsonb_build_object('session_id',v_session.id,'student_id',target_student,'reason',reason));
  return v_participant_id;
end;
$$;

create or replace function public.remove_student_from_class_session(target_session uuid,target_student uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_participant public.session_participants%rowtype;
begin
  select bcs.* into v_session from public.class_sessions as bcs where bcs.id=target_session for update;
  if v_session.id is null or not public.can_manage_class_session(v_session.id) then raise exception 'Permission denied.'; end if;
  if v_session.status='completed' then raise exception 'Session already completed.'; end if;
  select asp.* into v_participant from public.session_participants as asp
  where asp.session_id=v_session.id and asp.student_id=target_student;
  if v_participant.id is null or v_participant.source_type in ('scheduled','batch','individual_schedule') then
    raise exception 'Only manually added students can be removed.';
  end if;
  delete from public.session_participants as asp where asp.id=v_participant.id;
  insert into public.audit_logs as al (actor_user_id,academy_id,action,entity_type,entity_id,old_values)
  values (auth.uid(),v_session.academy_id,'session.student_removed','session_participant',v_participant.id,to_jsonb(v_participant));
end;
$$;

revoke all on function public.find_or_create_batch_class_session(uuid,date,time,time) from public,anon;
revoke all on function public.refresh_class_session_roster(uuid) from public,anon;
revoke all on function public.add_student_to_class_session(uuid,uuid,text,text,uuid) from public,anon;
revoke all on function public.remove_student_from_class_session(uuid,uuid) from public,anon;
grant execute on function public.find_or_create_batch_class_session(uuid,date,time,time) to authenticated;
grant execute on function public.refresh_class_session_roster(uuid) to authenticated;
grant execute on function public.add_student_to_class_session(uuid,uuid,text,text,uuid) to authenticated;
grant execute on function public.remove_student_from_class_session(uuid,uuid) to authenticated;
