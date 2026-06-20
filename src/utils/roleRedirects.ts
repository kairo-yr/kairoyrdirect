import type { Role } from '../types/auth';
import type { UserProfile } from '../types/auth';

export const getDashboardPathByRole = (role: Role) => {
  const paths: Record<Role, string> = {
    super_admin: '/super-admin',
    academy_admin: '/academy',
    coach: '/coach',
    parent: '/parent',
    student: '/student',
    unassigned: '/onboarding',
  };

  return paths[role];
};

export const getAuthRedirectPath = (profile: Pick<UserProfile, 'role' | 'status'>) => {
  if (profile.status === 'disabled') return '/unauthorized';
  if (profile.status === 'pending' && profile.role === 'unassigned') return '/onboarding';
  if (profile.status === 'pending') return '/pending-approval';
  return getDashboardPathByRole(profile.role);
};
