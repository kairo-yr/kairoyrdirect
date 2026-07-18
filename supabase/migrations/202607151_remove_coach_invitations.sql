-- Coach onboarding is email-claim based. Keep student invitations, remove the
-- obsolete coach-token branch, and harden the verified-email claim boundary.

revoke create on schema public from public,anon,authenticated;
alter function public.create_coach_for_academy(uuid,text,text,text,text) set search_path=pg_catalog,public;
alter function public.find_profile_by_email_for_coach(uuid,text) set search_path=pg_catalog,public;
alter function public.refresh_profile_role_from_memberships(uuid) set search_path=pg_catalog,public;

insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,old_values,new_values)
select i.created_by,i.academy_id,'coach.invite_retired','academy_invite',i.id,pg_catalog.to_jsonb(i),
  pg_catalog.jsonb_build_object('reason','Coach access uses verified email claiming')
from public.academy_invites i where i.role='coach';

delete from public.academy_invites where role='coach';

alter table public.academy_invites drop constraint if exists academy_invites_role_check;
alter table public.academy_invites add constraint academy_invites_role_check check(role='student');

create or replace function public.accept_academy_invite(target_invite uuid)
returns void language plpgsql security definer set search_path='' as $$
declare i public.academy_invites%rowtype; verified_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select pg_catalog.lower(pg_catalog.btrim(u.email)) into verified_email
  from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'A verified email is required.'; end if;
  select * into i from public.academy_invites where id=target_invite and role='student' for update;
  if i.id is null or i.status<>'pending' or i.expires_at<=pg_catalog.now() then raise exception 'Invite is invalid or expired.'; end if;
  if pg_catalog.lower(pg_catalog.btrim(i.email))<>verified_email then raise exception 'Sign in with the invited email.'; end if;
  update public.students set user_id=auth.uid(),status='active' where id=i.linked_profile_id and academy_id=i.academy_id and user_id is null;
  if not found then raise exception 'The student profile is already linked or unavailable.'; end if;
  update public.academy_memberships set user_id=auth.uid(),status='active',joined_at=coalesce(joined_at,pg_catalog.now())
    where academy_id=i.academy_id and role='student' and user_id is null and pg_catalog.lower(pg_catalog.btrim(email))=verified_email;
  update public.profiles set app_role='student',status='active',academy_id=i.academy_id::text,linked_student_id=i.linked_profile_id::text where id=auth.uid();
  update public.academy_invites set status='accepted',accepted_by=auth.uid(),accepted_at=pg_catalog.now() where id=i.id;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,new_values)
    values(auth.uid(),i.academy_id,'invite.accepted','academy_invite',i.id,pg_catalog.jsonb_build_object('role','student','linked_profile_id',i.linked_profile_id));
end $$;
revoke all on function public.accept_academy_invite(uuid) from public,anon;
grant execute on function public.accept_academy_invite(uuid) to authenticated;

create or replace function public.lookup_academy_invite(target_token text)
returns table(id uuid,academy_id uuid,role text,email text,linked_profile_id uuid,invite_token text,status text,created_by uuid,created_at timestamptz,expires_at timestamptz,accepted_by uuid,accepted_at timestamptz,academy_name text,profile_name text)
language sql stable security definer set search_path='' as $$
 select i.id,i.academy_id,i.role,i.email,i.linked_profile_id,i.invite_token,i.status,i.created_by,i.created_at,i.expires_at,i.accepted_by,i.accepted_at,a.name,s.full_name
 from public.academy_invites i join public.academies a on a.id=i.academy_id join public.students s on s.id=i.linked_profile_id
 where i.role='student' and i.invite_token=target_token limit 1
$$;
revoke all on function public.lookup_academy_invite(text) from public;
grant execute on function public.lookup_academy_invite(text) to anon,authenticated;

-- This older RPC duplicates resolve_my_coach_profile and has no runtime callers.
drop function if exists public.claim_my_coach_account();

-- Keep the proven atomic resolver implementation behind a confirmation guard.
alter function public.resolve_my_coach_profile(uuid) rename to resolve_my_coach_profile_legacy;
revoke all on function public.resolve_my_coach_profile_legacy(uuid) from public,anon,authenticated;
create function public.resolve_my_coach_profile(target_academy_id uuid default null)
returns setof public.coaches language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and nullif(pg_catalog.btrim(u.email),'') is not null)
 then raise exception 'A verified email is required.'; end if;
 return query select * from public.resolve_my_coach_profile_legacy(target_academy_id);
end $$;
revoke all on function public.resolve_my_coach_profile(uuid) from public,anon;
grant execute on function public.resolve_my_coach_profile(uuid) to authenticated;

-- Pending memberships remain required for email-based student and coach linking,
-- but the email must come from confirmed auth.users data, never editable profile data.
create or replace function public.claim_pending_memberships()
returns table(final_app_role text,linked_memberships_count integer)
language plpgsql security definer set search_path='' as $$
declare membership_row public.academy_memberships%rowtype; next_role text; verified_email text; linked_count integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)) into verified_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if verified_email is null then raise exception 'A verified email is required.'; end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid()) then raise exception 'Profile not found.'; end if;
 for membership_row in
  update public.academy_memberships m set user_id=auth.uid(),status='active',joined_at=coalesce(m.joined_at,pg_catalog.now())
  where pg_catalog.lower(pg_catalog.btrim(m.email))=verified_email and m.user_id is null and m.status='pending_login' and m.role in('coach','student') returning m.*
 loop
  linked_count:=linked_count+1;
  insert into public.audit_logs(actor_user_id,academy_id,action,entity_type,entity_id,old_values,new_values)
   values(auth.uid(),membership_row.academy_id,'membership.claimed','academy_membership',membership_row.id,
    pg_catalog.jsonb_build_object('email',membership_row.email,'status','pending_login'),pg_catalog.to_jsonb(membership_row));
  if membership_row.role='coach' then
   update public.coaches c set user_id=auth.uid(),membership_id=membership_row.id,status='active',joined_at=coalesce(c.joined_at,current_date)
    where c.academy_id=membership_row.academy_id and pg_catalog.lower(pg_catalog.btrim(c.email))=verified_email and (c.user_id is null or c.user_id=auth.uid());
  else
   update public.students s set user_id=auth.uid(),membership_id=membership_row.id,status='active',joined_at=coalesce(s.joined_at,current_date)
    where s.academy_id=membership_row.academy_id and pg_catalog.lower(pg_catalog.btrim(s.email))=verified_email and (s.user_id is null or s.user_id=auth.uid());
  end if;
 end loop;
 select case when p.platform_role='super_admin' then 'super_admin'
  when exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.role='academy_admin' and m.status='active') then 'academy_admin'
  when exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.role='coach' and m.status='active') then 'coach'
  when exists(select 1 from public.academy_memberships m where m.user_id=auth.uid() and m.role='student' and m.status='active') then 'student' else 'user' end
 into next_role from public.profiles p where p.id=auth.uid();
 update public.profiles set app_role=next_role,status='active' where id=auth.uid();
 return query select next_role,linked_count;
end $$;
revoke all on function public.claim_pending_memberships() from public,anon;
grant execute on function public.claim_pending_memberships() to authenticated;

-- Profiles can no longer self-edit identity, role, status, or linked IDs.
drop policy if exists "Users can update own profile" on public.profiles;
create or replace function public.update_my_profile(profile_name text,profile_phone text default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare result public.profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 update public.profiles set full_name=nullif(pg_catalog.btrim(profile_name),''),phone=nullif(pg_catalog.btrim(profile_phone),'') where id=auth.uid() returning * into result;
 if result.id is null then raise exception 'Profile not found.'; end if;
 return result;
end $$;
revoke all on function public.update_my_profile(text,text) from public,anon;
grant execute on function public.update_my_profile(text,text) to authenticated;

drop policy if exists "Users can insert own profile" on public.profiles;
create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; result public.profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required.'; end if;
 select * into u from auth.users where id=auth.uid();
 insert into public.profiles(id,email,full_name,avatar_url,platform_role,app_role,status)
 values(u.id,pg_catalog.lower(pg_catalog.btrim(u.email)),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'avatar_url','user','user','active')
 on conflict(id) do nothing;
 select * into result from public.profiles where id=auth.uid();
 return result;
end $$;
revoke all on function public.ensure_my_profile() from public,anon;
grant execute on function public.ensure_my_profile() to authenticated;
