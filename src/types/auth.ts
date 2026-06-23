import type { User } from 'firebase/auth';

export type Role = 'super_admin' | 'academy_admin' | 'coach' | 'parent' | 'student' | 'unassigned';

export type UserStatus = 'active' | 'pending' | 'disabled';
export type AcademyStatus = 'pending' | 'active' | 'rejected' | 'disabled';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type InvitableRole = 'coach' | 'student';

export type FirebaseUser = User;

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
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
