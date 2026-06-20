import type { Role } from '../types/auth';

export type Permission =
  | 'canManageAcademies'
  | 'canApproveAcademies'
  | 'canManageCoaches'
  | 'canManageStudents'
  | 'canCreateInvites'
  | 'canRevokeInvites'
  | 'canManageBatches'
  | 'canAssignCoaches'
  | 'canMarkAttendance'
  | 'canWriteClassReports'
  | 'canViewFeeTracker'
  | 'canViewOwnProfile'
  | 'canViewHomework'
  | 'canAccessPlay';

export const permissions: Record<Permission, Role[]> = {
  canManageAcademies: ['super_admin'],
  canApproveAcademies: ['super_admin'],
  canManageCoaches: ['academy_admin'],
  canManageStudents: ['academy_admin'],
  canCreateInvites: ['academy_admin'],
  canRevokeInvites: ['academy_admin'],
  canManageBatches: ['academy_admin'],
  canAssignCoaches: ['academy_admin'],
  canMarkAttendance: ['academy_admin', 'coach'],
  canWriteClassReports: ['academy_admin', 'coach'],
  canViewFeeTracker: ['academy_admin'],
  canViewOwnProfile: ['coach', 'student', 'parent', 'academy_admin'],
  canViewHomework: ['student'],
  canAccessPlay: ['student'],
};

export const hasPermission = (role: Role | null | undefined, permission: Permission) => {
  if (!role) return false;
  return permissions[permission].includes(role);
};
