import { supabase } from './supabaseClient';

export type AcademyStatus = 'pending' | 'active' | 'rejected' | 'disabled' | 'archived';

export type Academy = {
  id: string;
  name: string;
  slug: string | null;
  status: AcademyStatus;
  logo_url: string | null;
  description: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  website_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  timezone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  plan_type: string | null;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademyInput = Partial<Omit<Academy, 'id' | 'created_at' | 'updated_at'>> & {
  name: string;
};

export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  academy_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  actor?: { email: string | null; full_name: string | null; platform_role: string | null; app_role: string | null } | null;
  academy?: { name: string | null } | null;
};

export type AcademyCounts = {
  totalAcademies: number;
  activeAcademies: number;
  pendingAcademies: number;
  disabledAcademies: number;
};

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function getActorUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function insertAuditLog(input: {
  actor_user_id: string | null;
  academy_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: input.actor_user_id,
    academy_id: input.academy_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    old_values: input.old_values ?? null,
    new_values: input.new_values ?? null,
  });
  if (error) throw error;
}

async function getRequiredAcademy(id: string) {
  const academy = await getAcademyById(id);
  if (!academy) throw new Error('Academy not found.');
  return academy;
}

export async function getAcademies() {
  const { data, error } = await supabase
    .from('academies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Academy[];
}

export async function getAcademyById(id: string) {
  const { data, error } = await supabase
    .from('academies')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Academy | null;
}

export async function createAcademy(input: AcademyInput) {
  const actorUserId = await getActorUserId();
  const insert = {
    ...input,
    slug: input.slug ?? makeSlug(input.name),
    status: input.status ?? 'pending',
    country: input.country ?? 'India',
    timezone: input.timezone ?? 'Asia/Kolkata',
    plan_type: input.plan_type ?? 'trial',
    created_by: input.created_by ?? actorUserId,
  };

  const { data, error } = await supabase.from('academies').insert(insert).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: data.id,
    action: 'academy.created',
    entity_type: 'academy',
    entity_id: data.id,
    new_values: data,
  });

  return data as Academy;
}

export async function updateAcademy(id: string, input: Partial<AcademyInput>) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredAcademy(id);
  const { data, error } = await supabase.from('academies').update(input).eq('id', id).select('*').single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: id,
    action: 'academy.updated',
    entity_type: 'academy',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Academy;
}

export async function approveAcademy(id: string) {
  const { data, error } = await supabase.rpc('approve_academy_application', { target_academy_id: id });
  if (error) throw error;
  return data as Academy;
}

export async function rejectAcademy(id: string, reason?: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredAcademy(id);
  const { data, error } = await supabase
    .from('academies')
    .update({ status: 'rejected', notes: reason ? `Rejected: ${reason}` : previous.notes })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: id,
    action: 'academy.rejected',
    entity_type: 'academy',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Academy;
}

export async function disableAcademy(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredAcademy(id);
  const { data, error } = await supabase
    .from('academies')
    .update({ status: 'disabled', disabled_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: id,
    action: 'academy.disabled',
    entity_type: 'academy',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Academy;
}

export async function reactivateAcademy(id: string) {
  const actorUserId = await getActorUserId();
  const previous = await getRequiredAcademy(id);
  const { data, error } = await supabase
    .from('academies')
    .update({ status: 'active', disabled_at: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  await insertAuditLog({
    actor_user_id: actorUserId,
    academy_id: id,
    action: 'academy.reactivated',
    entity_type: 'academy',
    entity_id: id,
    old_values: previous,
    new_values: data,
  });

  return data as Academy;
}

export async function getAcademyCounts() {
  const academies = await getAcademies();
  return {
    totalAcademies: academies.length,
    activeAcademies: academies.filter((academy) => academy.status === 'active').length,
    pendingAcademies: academies.filter((academy) => academy.status === 'pending').length,
    disabledAcademies: academies.filter((academy) => academy.status === 'disabled').length,
  } satisfies AcademyCounts;
}

export async function getAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_user_id_fkey(email, full_name, platform_role, app_role), academy:academies(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AuditLog[];
}
