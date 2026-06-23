import type { Role } from '../types/auth';

export const ROLES: Record<Role, Role> = {
  super_admin: 'super_admin',
  academy_admin: 'academy_admin',
  coach: 'coach',
  parent: 'parent',
  student: 'student',
  unassigned: 'unassigned',
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Kairoyr Super Admin',
  academy_admin: 'Academy Admin',
  coach: 'Coach',
  parent: 'Parent (Future)',
  student: 'Student',
  unassigned: 'Unassigned',
};

export const ALL_ROLES = Object.values(ROLES);
