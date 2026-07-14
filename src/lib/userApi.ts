import { supabase } from './supabaseClient';
import type { Role, UserProfile, UserStatus } from '../types/auth';

type ApplicationUserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  platform_role: string;
  app_role: Role;
  status: UserStatus;
  academy_id: string | null;
  linked_coach_id: string | null;
  linked_student_id: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
};

function mapApplicationUser(row: ApplicationUserRow): UserProfile {
  const name = row.full_name?.trim() || '';
  const email = row.email?.trim().toLowerCase() || '';
  const role = row.app_role || 'user';

  return {
    id: row.user_id,
    full_name: name,
    avatar_url: row.avatar_url,
    phone: row.phone,
    platform_role: row.platform_role,
    app_role: role,
    created_at: row.created_at,
    updated_at: row.updated_at,
    uid: row.user_id,
    name,
    email,
    photoURL: row.avatar_url,
    role,
    platformRole: row.platform_role,
    appRole: role,
    status: row.status,
    academyId: row.academy_id,
    linkedCoachId: row.linked_coach_id,
    linkedStudentId: row.linked_student_id,
    linkedParentId: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_sign_in_at,
  };
}

export async function getApplicationUsers() {
  const { data, error } = await supabase.rpc('list_application_users');
  if (error) throw error;
  return ((data ?? []) as ApplicationUserRow[]).map(mapApplicationUser);
}

export async function setApplicationUserStatus(userId: string, status: 'active' | 'disabled') {
  const { error } = await supabase.rpc('set_application_user_status', {
    target_user_id: userId,
    target_status: status,
  });
  if (error) throw error;
}
