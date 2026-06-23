import type { Role, UserProfile } from '../types/auth';

export const getProfileRouteRole = (profile: Pick<UserProfile, 'platform_role' | 'app_role'>): Role => {
  if (profile.platform_role === 'super_admin') return 'super_admin';
  return profile.app_role;
};

export const getDashboardPathByRole = (role: Role) => {
  const paths: Record<Role, string> = {
    super_admin: '/super-admin',
    academy_admin: '/academy',
    coach: '/coach',
    parent: '/onboarding',
    student: '/student',
    unassigned: '/onboarding',
    user: '/onboarding',
  };

  return paths[role];
};

export const getProfileRedirectPath = (profile: Pick<UserProfile, 'platform_role' | 'app_role' | 'status'>) => {
  const role = getProfileRouteRole(profile);
  if (profile.status === 'disabled') return '/unauthorized';
  if (profile.status === 'pending' && role === 'unassigned') return '/onboarding';
  if (profile.status === 'pending') return '/pending-approval';
  return getDashboardPathByRole(role);
};
