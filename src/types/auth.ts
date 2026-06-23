import type { User } from '@supabase/supabase-js';

export type Role = 'super_admin' | 'academy_admin' | 'coach' | 'parent' | 'student' | 'unassigned' | 'user';

export type UserStatus = 'active' | 'pending' | 'disabled';
export type AcademyStatus = 'pending' | 'active' | 'rejected' | 'disabled' | 'archived';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type InvitableRole = 'coach' | 'student';

export type AuthUser = User;

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  platform_role: string;
  app_role: Role;
  created_at: unknown;
  updated_at: unknown;
  // Legacy aliases kept until Firestore-backed academy data is migrated.
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  platformRole: string;
  appRole: string;
  status: UserStatus;
  academyId: string | null;
  linkedCoachId: string | null;
  linkedStudentId: string | null;
  linkedParentId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt: unknown;
}

export interface AcademyRegistration {
  id: string;
  name: string;
  city: string;
  phone: string;
  ownerUid: string;
  ownerEmail: string;
  status: AcademyStatus;
  createdAt: unknown;
  approvedAt?: unknown;
  approvedBy?: string | null;
  rejectedAt?: unknown;
  rejectedBy?: string | null;
  rejectionReason?: string;
  disabledAt?: unknown;
  disabledBy?: string | null;
  reactivatedAt?: unknown;
  reactivatedBy?: string | null;
}

export interface AcademyInvite {
  id: string;
  academyId: string;
  role: InvitableRole;
  email: string;
  linkedProfileId: string;
  inviteToken: string;
  status: InviteStatus;
  createdByUid: string;
  createdAt: unknown;
  expiresAt: unknown;
  acceptedByUid: string | null;
  acceptedAt: unknown;
}

export interface AcademyCoachProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'invited' | 'active' | 'disabled';
  userUid: string | null;
  inviteId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AcademyStudentProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  monthlyFee?: number | null;
  batchId?: string | null;
  status: 'invited' | 'active' | 'disabled';
  userUid: string | null;
  inviteId: string;
  createdAt: unknown;
  updatedAt: unknown;
}
