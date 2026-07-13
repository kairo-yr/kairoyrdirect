import { supabase } from './supabaseClient';

export type CoachStatus = 'pending_login' | 'active' | 'disabled' | 'removed';
export type CoachEmploymentType = 'full_time' | 'part_time' | 'freelance' | 'trial';

export type Coach = {
  id: string;
  academy_id: string;
  user_id: string | null;
  membership_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  specialization: string | null;
  status: CoachStatus;
  employment_type: CoachEmploymentType | null;
  joined_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachInput = {
  academy_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  specialization?: string | null;
  status?: CoachStatus;
  employment_type?: CoachEmploymentType | null;
  joined_at?: string | null;
  notes?: string | null;
};

type MatchedProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: string | null;
  app_role: string | null;
};

function normalizeEmail(email?: string | null) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function getActorUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function insertAuditLog(input: {
  actor_user_id: string | null;
  academy_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: input.actor_user_id,
    academy_id: input.academy_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    old_values: input.old_values ?? null,
    new_values: input.new_values ?? null,
  });
  if (error) throw error;
}

async function findProfileByEmail(academyId: string, email: string | null) {
  if (!email) return null;
  const { data, error } = await supabase.rpc('find_profile_by_email_for_coach', {
    target_academy_id: academyId,
    target_email: email,
  });
  if (error) throw error;
  return (data?.[0] ?? null) as MatchedProfile | null;
}

async function createOrUpdateActiveCoachMembership(input: { academyId: string; profileId: string; email: string; actorUserId: string | null }) {
  const { data: existing, error: existingError } = await supabase
    .from('academy_memberships')
    .select('*')
    .eq('academy_id', input.academyId)
    .eq('user_id', input.profileId)
    .eq('role', 'coach')
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    academy_id: input.academyId,
    user_id: input.profileId,
    email: input.email,
    role: 'coach',
    status: 'active',
    invited_by: input.actorUserId,
    joined_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase.from('academy_memberships').update(payload).eq('id', existing.id).select('*').single()
    : await supabase.from('academy_memberships').insert(payload).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: input.actorUserId,
    academy_id: input.academyId,
    action: 'membership.created',
    entity_type: 'academy_membership',
    entity_id: data.id,
    new_values: data,
  });

  return data as { id: string; status: string };
}

async function createOrUpdatePendingCoachMembership(input: { academyId: string; email: string; actorUserId: string | null }) {
  const { data: existing, error: existingError } = await supabase
    .from('academy_memberships')
    .select('*')
    .eq('academy_id', input.academyId)
    .eq('email', input.email)
    .eq('role', 'coach')
    .eq('status', 'pending_login')
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    academy_id: input.academyId,
    user_id: null,
    email: input.email,
    role: 'coach',
    status: 'pending_login',
    invited_by: input.actorUserId,
    joined_at: null,
  };

  const { data, error } = existing
    ? await supabase.from('academy_memberships').update(payload).eq('id', existing.id).select('*').single()
    : await supabase.from('academy_memberships').insert(payload).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: input.actorUserId,
    academy_id: input.academyId,
    action: 'membership.pending_created',
    entity_type: 'academy_membership',
    entity_id: data.id,
    new_values: data,
  });

  return data as { id: string; status: string };
}

async function getRequiredCoach(id: string) {
  const coach = await getCoachById(id);
  if (!coach) throw new Error('Coach not found.');
  return coach;
}

export async function getCoachesByAcademy(academyId: string) {
  const { data, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Coach[];
}

export async function getCoachById(id: string) {
  const { data, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Coach | null;
}

export async function getCurrentUserCoach(academyId?: string | null) {
  const actorUserId = await getActorUserId();
  if (!actorUserId) return null;

  let query = supabase
    .from('coaches')
    .select('*')
    .eq('user_id', actorUserId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (academyId) {
    query = query.eq('academy_id', academyId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Coach | null;
}

export async function createCoach(input: CoachInput) {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error('Coach email is required for email-based access.');
  const { data, error } = await supabase.rpc('create_coach_for_academy', {
    target_academy_id: input.academy_id,
    coach_full_name: input.full_name,
    coach_email: email,
    coach_phone: cleanText(input.phone),
    coach_specialization: cleanText(input.specialization),
  });
  if (error) throw error;
  return data as Coach;
}

export async function updateCoach(id: string, input: Partial<Omit<CoachInput, 'academy_id'>>) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredCoach(id);
  const nextEmail = input.email === undefined ? undefined : normalizeEmail(input.email);
  let matchedProfile: MatchedProfile | null = null;
  let membership: { id: string; status: string } | null = null;

  if (nextEmail && nextEmail !== previous.email) {
    matchedProfile = await findProfileByEmail(previous.academy_id, nextEmail);
    membership = matchedProfile
      ? await createOrUpdateActiveCoachMembership({ academyId: previous.academy_id, profileId: matchedProfile.id, email: nextEmail, actorUserId })
      : await createOrUpdatePendingCoachMembership({ academyId: previous.academy_id, email: nextEmail, actorUserId });
  }

  const update = {
    ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
    ...(input.email !== undefined ? { email: nextEmail } : {}),
    ...(input.phone !== undefined ? { phone: cleanText(input.phone) } : {}),
    ...(input.avatar_url !== undefined ? { avatar_url: cleanText(input.avatar_url) } : {}),
    ...(input.bio !== undefined ? { bio: cleanText(input.bio) } : {}),
    ...(input.specialization !== undefined ? { specialization: cleanText(input.specialization) } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.employment_type !== undefined ? { employment_type: input.employment_type } : {}),
    ...(input.joined_at !== undefined ? { joined_at: input.joined_at } : {}),
    ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
    ...(nextEmail && !matchedProfile ? { user_id: null, membership_id: membership?.id ?? null, status: 'pending_login' as CoachStatus } : {}),
    ...(matchedProfile ? { user_id: matchedProfile.id, membership_id: membership?.id ?? null, status: 'active' as CoachStatus } : {}),
  };

  const { data, error } = await supabase.from('coaches').update(update).eq('id', id).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'coach.updated',
    entity_type: 'coach',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  if (matchedProfile) {
    await supabase.rpc('refresh_profile_role_from_memberships', { target_user_id: matchedProfile.id });
    await insertAuditLog({
      actor_user_id: actorUserId,
      academy_id: data.academy_id,
      action: 'coach.linked_to_profile',
      entity_type: 'coach',
      entity_id: data.id,
      new_values: { coach_id: data.id, profile_id: matchedProfile.id, membership_id: membership?.id ?? null },
    });
  }

  return data as Coach;
}

export async function disableCoach(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredCoach(id);
  const { data, error } = await supabase
    .from('coaches')
    .update({ status: 'disabled' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  if (previous.membership_id) {
    const { data: membership, error: membershipError } = await supabase
      .from('academy_memberships')
      .update({ status: 'disabled' })
      .eq('id', previous.membership_id)
      .select('*')
      .single();
    if (membershipError) throw membershipError;
    await insertAuditLog({
      actor_user_id: actorUserId,
      academy_id: previous.academy_id,
      action: 'membership.updated',
      entity_type: 'academy_membership',
      entity_id: previous.membership_id,
      old_values: { status: 'active' },
      new_values: membership,
    });
  }

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'coach.disabled',
    entity_type: 'coach',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Coach;
}

export async function reactivateCoach(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredCoach(id);
  const { data, error } = await supabase
    .from('coaches')
    .update({ status: 'active' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  if (previous.membership_id) {
    const { data: membership, error: membershipError } = await supabase
      .from('academy_memberships')
      .update({ status: 'active' })
      .eq('id', previous.membership_id)
      .select('*')
      .single();
    if (membershipError) throw membershipError;
    await insertAuditLog({
      actor_user_id: actorUserId,
      academy_id: previous.academy_id,
      action: 'membership.updated',
      entity_type: 'academy_membership',
      entity_id: previous.membership_id,
      old_values: { status: 'disabled' },
      new_values: membership,
    });
  }

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'coach.reactivated',
    entity_type: 'coach',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Coach;
}

export async function linkCoachToProfile(coachId: string, profileId: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredCoach(coachId);
  if (!previous.email) throw new Error('Coach email is required before linking a profile.');
  const membership = await createOrUpdateActiveCoachMembership({ academyId: previous.academy_id, profileId, email: previous.email, actorUserId });
  const { data, error } = await supabase
    .from('coaches')
    .update({ user_id: profileId, membership_id: membership.id, status: 'active' })
    .eq('id', coachId)
    .select('*')
    .single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'coach.linked_to_profile',
    entity_type: 'coach',
    entity_id: coachId,
    old_values: previous,
    new_values: data,
  });

  return data as Coach;
}
