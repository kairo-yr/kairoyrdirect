import { supabase } from './supabaseClient';

export type StudentStatus = 'pending_login' | 'active' | 'inactive' | 'disabled' | 'removed';
export type StudentLevel = 'absolute_beginner' | 'beginner' | 'intermediate' | 'advanced' | 'tournament';

export type Student = {
  id: string;
  academy_id: string;
  user_id: string | null;
  membership_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  school_name: string | null;
  grade: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  secondary_parent_name: string | null;
  secondary_parent_email: string | null;
  secondary_parent_phone: string | null;
  level: StudentLevel | null;
  status: StudentStatus;
  joined_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentInput = {
  academy_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  school_name?: string | null;
  grade?: string | null;
  parent_name?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;
  secondary_parent_name?: string | null;
  secondary_parent_email?: string | null;
  secondary_parent_phone?: string | null;
  level?: StudentLevel | null;
  status?: StudentStatus;
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
  const { data, error } = await supabase.rpc('find_profile_by_email_for_student', {
    target_academy_id: academyId,
    target_email: email,
  });
  if (error) throw error;
  return (data?.[0] ?? null) as MatchedProfile | null;
}

async function upsertStudentMembership(input: { academyId: string; profileId: string; actorUserId: string | null }) {
  const { data: existing, error: existingError } = await supabase
    .from('academy_memberships')
    .select('*')
    .eq('academy_id', input.academyId)
    .eq('user_id', input.profileId)
    .eq('role', 'student')
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    academy_id: input.academyId,
    user_id: input.profileId,
    role: 'student',
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

async function getRequiredStudent(id: string) {
  const student = await getStudentById(id);
  if (!student) throw new Error('Student not found.');
  return student;
}

export async function getStudentsByAcademy(academyId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('academy_id', academyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Student[];
}

export async function getStudentById(id: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

export async function getCurrentUserStudent(academyId?: string | null) {
  const actorUserId = await getActorUserId();
  if (!actorUserId) return null;

  let query = supabase
    .from('students')
    .select('*')
    .eq('user_id', actorUserId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (academyId) query = query.eq('academy_id', academyId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

export async function createStudent(input: StudentInput) {
  const { data, error } = await supabase.rpc('create_student_for_academy', {
    target_academy_id: input.academy_id,
    student_full_name: input.full_name,
    student_email: normalizeEmail(input.email),
    student_phone: cleanText(input.phone),
    student_school_name: cleanText(input.school_name),
    student_grade: cleanText(input.grade),
    parent_name: cleanText(input.parent_name),
    parent_email: normalizeEmail(input.parent_email),
    parent_phone: cleanText(input.parent_phone),
    level: input.level ?? 'beginner',
    notes: cleanText(input.notes),
  });
  if (error) throw error;
  return data as Student;
}

export async function updateStudent(id: string, input: Partial<Omit<StudentInput, 'academy_id'>>) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredStudent(id);
  const nextEmail = input.email === undefined ? undefined : normalizeEmail(input.email);
  let matchedProfile: MatchedProfile | null = null;
  let membership: { id: string; status: string } | null = null;

  if (nextEmail && nextEmail !== previous.email) {
    matchedProfile = await findProfileByEmail(previous.academy_id, nextEmail);
    membership = matchedProfile
      ? await upsertStudentMembership({ academyId: previous.academy_id, profileId: matchedProfile.id, actorUserId })
      : null;
  }

  const update = {
    ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
    ...(input.email !== undefined ? { email: nextEmail } : {}),
    ...(input.phone !== undefined ? { phone: cleanText(input.phone) } : {}),
    ...(input.avatar_url !== undefined ? { avatar_url: cleanText(input.avatar_url) } : {}),
    ...(input.date_of_birth !== undefined ? { date_of_birth: input.date_of_birth } : {}),
    ...(input.gender !== undefined ? { gender: cleanText(input.gender) } : {}),
    ...(input.school_name !== undefined ? { school_name: cleanText(input.school_name) } : {}),
    ...(input.grade !== undefined ? { grade: cleanText(input.grade) } : {}),
    ...(input.parent_name !== undefined ? { parent_name: cleanText(input.parent_name) } : {}),
    ...(input.parent_email !== undefined ? { parent_email: normalizeEmail(input.parent_email) } : {}),
    ...(input.parent_phone !== undefined ? { parent_phone: cleanText(input.parent_phone) } : {}),
    ...(input.secondary_parent_name !== undefined ? { secondary_parent_name: cleanText(input.secondary_parent_name) } : {}),
    ...(input.secondary_parent_email !== undefined ? { secondary_parent_email: normalizeEmail(input.secondary_parent_email) } : {}),
    ...(input.secondary_parent_phone !== undefined ? { secondary_parent_phone: cleanText(input.secondary_parent_phone) } : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.joined_at !== undefined ? { joined_at: input.joined_at } : {}),
    ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
    ...(matchedProfile ? { user_id: matchedProfile.id, membership_id: membership?.id ?? null, status: 'active' as StudentStatus } : {}),
  };

  const { data, error } = await supabase.from('students').update(update).eq('id', id).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'student.updated',
    entity_type: 'student',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  if (matchedProfile) {
    await insertAuditLog({
      actor_user_id: actorUserId,
      academy_id: data.academy_id,
      action: 'student.linked_to_profile',
      entity_type: 'student',
      entity_id: data.id,
      new_values: { student_id: data.id, profile_id: matchedProfile.id, membership_id: membership?.id ?? null },
    });
  }

  return data as Student;
}

export async function disableStudent(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredStudent(id);
  const { data, error } = await supabase
    .from('students')
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
    action: 'student.disabled',
    entity_type: 'student',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Student;
}

export async function reactivateStudent(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredStudent(id);
  const { data, error } = await supabase
    .from('students')
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
    action: 'student.reactivated',
    entity_type: 'student',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Student;
}

export async function linkStudentToProfile(studentId: string, profileId: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredStudent(studentId);
  const membership = await upsertStudentMembership({ academyId: previous.academy_id, profileId, actorUserId });
  const { data, error } = await supabase
    .from('students')
    .update({ user_id: profileId, membership_id: membership.id, status: 'active' })
    .eq('id', studentId)
    .select('*')
    .single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.academy_id,
    action: 'student.linked_to_profile',
    entity_type: 'student',
    entity_id: studentId,
    old_values: previous,
    new_values: data,
  });

  return data as Student;
}
