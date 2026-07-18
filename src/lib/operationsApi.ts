import { supabase } from './supabaseClient';

type Payload = Record<string, unknown>;

function unwrap(row: Record<string, unknown>) {
  const payload = (row.payload ?? {}) as Payload;
  return {
    ...payload,
    id: row.id,
    academyId: row.academy_id,
    batchId: row.batch_id ?? payload.batchId,
    coachId: row.coach_id ?? payload.coachId ?? null,
    studentId: row.student_id ?? payload.studentId,
    date: row.attendance_date ?? row.report_date ?? payload.date,
    month: row.fee_month ?? payload.month,
    classSessionId: row.class_session_id ?? payload.classSessionId ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list(table: string, academyId?: string) {
  let query = supabase.from(table).select('*');
  if (academyId) query = query.eq('academy_id', academyId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => unwrap(row as Record<string, unknown>));
}

export const listAttendance = (academyId?: string) => list('attendance_records', academyId);
export const listClassReports = (academyId?: string) => list('class_reports', academyId);
export const listProgressReports = (academyId?: string) => list('progress_reports', academyId);
export const listFees = (academyId?: string) => list('fee_records', academyId);

type ClassReportIdentity = {
  academyId: string;
  batchId: string;
  date: string;
  classSessionId: string;
};

async function findSessionLinkedClassReport(identity: ClassReportIdentity) {
  const { data, error } = await supabase
    .from('class_reports')
    .select('*')
    .eq('academy_id', identity.academyId)
    .eq('class_session_id', identity.classSessionId)
    .maybeSingle();
  if (error) throw error;
  return data ? unwrap(data as Record<string, unknown>) : null;
}

export async function findClassReportForSession(identity: ClassReportIdentity) {
  const sessionReport = await findSessionLinkedClassReport(identity);
  if (sessionReport) return sessionReport;

  // Legacy reports predate class_session_id. Only an unlinked batch/date row is
  // eligible for this fallback, so a report owned by another same-day session
  // can never be opened accidentally.
  const { data, error } = await supabase
    .from('class_reports')
    .select('*')
    .eq('academy_id', identity.academyId)
    .eq('batch_id', identity.batchId)
    .eq('report_date', identity.date)
    .is('class_session_id', null)
    .maybeSingle();
  if (error) throw error;
  return data ? unwrap(data as Record<string, unknown>) : null;
}

export async function getOrCreateClassReport(payload: Payload) {
  const identity: ClassReportIdentity = {
    academyId: String(payload.academyId),
    batchId: String(payload.batchId),
    date: String(payload.date),
    classSessionId: String(payload.classSessionId),
  };
  let existing = await findClassReportForSession(identity);
  if (existing) {
    if (!existing.classSessionId) {
      const { data, error } = await supabase
        .from('class_reports')
        .update({ class_session_id: identity.classSessionId })
        .eq('id', existing.id)
        .is('class_session_id', null)
        .select('*')
        .maybeSingle();
      if (error && error.code !== '23505') throw error;
      if (data) existing = unwrap(data as Record<string, unknown>);
      else existing = await findSessionLinkedClassReport(identity) ?? existing;
    }
    return { report: existing, created: false };
  }

  try {
    return { report: await saveClassReport(payload), created: true };
  } catch (error) {
    // Concurrent clicks may both observe no row. The unique session index is the
    // final arbiter; the loser re-reads and opens the winner instead of failing.
    if ((error as { code?: string })?.code !== '23505') throw error;
    existing = await findClassReportForSession(identity);
    if (!existing) throw error;
    return { report: existing, created: false };
  }
}

export async function saveAttendance(payload: Payload, id?: string) {
  const row = { academy_id: payload.academyId, batch_id: payload.batchId, coach_id: payload.coachId || null, attendance_date: payload.date, student_ids: payload.studentIds ?? [], payload };
  const query = id ? supabase.from('attendance_records').update(row).eq('id', id) : supabase.from('attendance_records').insert(row);
  const { data, error } = await query.select('*').single(); if (error) throw error; return unwrap(data);
}

export async function saveClassReport(payload: Payload, id?: string) {
  const students = [...new Set([...(payload.studentsPresentIds as string[] ?? []), ...(payload.studentsAbsentIds as string[] ?? [])])];
  const row = { academy_id: payload.academyId, batch_id: payload.batchId, coach_id: payload.coachId || null, class_session_id: payload.classSessionId || null, report_date: payload.date, student_ids: students, payload };
  const query = id ? supabase.from('class_reports').update(row).eq('id', id) : supabase.from('class_reports').insert(row);
  const { data, error } = await query.select('*').single(); if (error) throw error; return unwrap(data);
}

export async function saveProgressReport(payload: Payload, id?: string) {
  const row = { academy_id: payload.academyId, student_id: payload.studentId, batch_id: payload.batchId || null, coach_id: payload.coachId || null, report_date: payload.date, payload };
  const query = id ? supabase.from('progress_reports').update(row).eq('id', id) : supabase.from('progress_reports').insert(row);
  const { data, error } = await query.select('*').single(); if (error) throw error; return unwrap(data);
}

export async function saveFee(payload: Payload, id?: string) {
  const row = { academy_id: payload.academyId, student_id: payload.studentId, fee_month: payload.month, payload };
  const query = id ? supabase.from('fee_records').update(row).eq('id', id) : supabase.from('fee_records').insert(row);
  const { data, error } = await query.select('*').single(); if (error) throw error; return unwrap(data);
}

function mapInvite(row: Record<string, unknown>) {
  return { id: row.id, academyId: row.academy_id, role: row.role, email: row.email, linkedProfileId: row.linked_profile_id, inviteToken: row.invite_token, status: row.status, createdByUid: row.created_by, createdAt: row.created_at, expiresAt: row.expires_at, acceptedByUid: row.accepted_by, acceptedAt: row.accepted_at };
}

export async function listInvites(academyId?: string) {
  let query = supabase.from('academy_invites').select('*'); if (academyId) query = query.eq('academy_id', academyId);
  const { data, error } = await query.order('created_at', { ascending: false }); if (error) throw error;
  return (data ?? []).map((row) => mapInvite(row));
}

export async function findInviteByToken(token: string) {
  const { data, error } = await supabase.rpc('lookup_academy_invite', { target_token: token });
  if (error) throw error; const row = Array.isArray(data) ? data[0] : data; return row ? { ...mapInvite(row), academyName: row.academy_name, profileName: row.profile_name } : null;
}

export async function createInviteRecord(input: { academyId: string; role: 'student'; email: string; linkedProfileId: string; inviteToken: string }) {
  const { data, error } = await supabase.from('academy_invites').insert({ academy_id: input.academyId, role: input.role, email: input.email.toLowerCase(), linked_profile_id: input.linkedProfileId, invite_token: input.inviteToken }).select('*').single();
  if (error) throw error; return mapInvite(data);
}

export async function revokeInviteRecord(id: string) { const { error } = await supabase.from('academy_invites').update({ status: 'revoked' }).eq('id', id); if (error) throw error; }
export async function acceptInviteRecord(id: string) { const { error } = await supabase.rpc('accept_academy_invite', { target_invite: id }); if (error) throw error; }
