-- Fix PL/pgSQL name ambiguity in the batch-first class-session RPC.
-- This only replaces the function body; no tables or production rows are changed.

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
begin
  select b.*
  into v_batch
  from public.batches as b
  where b.id=target_batch
    and b.status='active';

  if v_batch.id is null then
    raise exception 'Batch belongs to another academy or is inactive.';
  end if;

  if not (
    public.is_super_admin()
    or public.has_academy_role(v_batch.academy_id,'academy_admin')
    or public.is_assigned_coach(v_batch.academy_id,v_batch.id)
  ) then
    raise exception 'Permission denied.';
  end if;

  if target_start_time is null or target_end_time is null or target_end_time<=target_start_time then
    raise exception 'Choose a valid class start and end time.';
  end if;

  select bcs.id
  into v_session_id
  from public.class_sessions as bcs
  where bcs.academy_id=v_batch.academy_id
    and bcs.primary_batch_id=v_batch.id
    and bcs.session_date=target_date
    and bcs.start_time=target_start_time
    and bcs.class_slot_id is null
  limit 1;

  if v_session_id is null then
    insert into public.class_sessions as bcs (
      academy_id,
      primary_batch_id,
      coach_id,
      session_date,
      start_time,
      end_time,
      location,
      status,
      created_by
    )
    values (
      v_batch.academy_id,
      v_batch.id,
      v_batch.primary_coach_id,
      target_date,
      target_start_time,
      target_end_time,
      v_batch.location,
      'open',
      auth.uid()
    )
    on conflict do nothing
    returning bcs.id into v_session_id;

    if v_session_id is null then
      select bcs.id
      into v_session_id
      from public.class_sessions as bcs
      where bcs.academy_id=v_batch.academy_id
        and bcs.primary_batch_id=v_batch.id
        and bcs.session_date=target_date
        and bcs.start_time=target_start_time
        and bcs.class_slot_id is null
      limit 1;
    end if;
  end if;

  if v_session_id is null then
    raise exception 'Could not create or retrieve the class session.';
  end if;

  insert into public.session_source_batches as ssb (
    academy_id,
    session_id,
    batch_id,
    source_type,
    added_by
  )
  values (
    v_batch.academy_id,
    v_session_id,
    v_batch.id,
    'automatic',
    auth.uid()
  )
  on conflict on constraint session_source_batches_session_id_batch_id_key do nothing;

  insert into public.session_participants as asp (
    academy_id,
    session_id,
    student_id,
    source_type,
    source_batch_id,
    added_by
  )
  select
    v_batch.academy_id,
    v_session_id,
    s.id,
    'batch',
    v_batch.id,
    auth.uid()
  from public.batch_students as bm
  join public.students as s on s.id=bm.student_id
  where bm.batch_id=v_batch.id
    and bm.status='active'
    and s.status='active'
    and coalesce(bm.joined_at,target_date)<=target_date
    and (bm.removed_at is null or bm.removed_at>=target_date)
  on conflict on constraint session_participants_session_id_student_id_key do nothing;

  return v_session_id;
end;
$$;

revoke all on function public.find_or_create_batch_class_session(uuid,date,time,time) from public,anon;
grant execute on function public.find_or_create_batch_class_session(uuid,date,time,time) to authenticated;
