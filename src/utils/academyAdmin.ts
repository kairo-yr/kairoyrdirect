import { collection, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { InvitableRole, UserProfile } from '../types/auth';
import { createAuditLog } from './superAdminActions';

export function makeInviteToken() {
  return Math.random().toString(36).slice(2, 12);
}

export function academyInviteLink(role: InvitableRole, token: string) {
  return `${window.location.origin}/join/${role}/${token}`;
}

export async function createAcademyInvite(input: {
  academyId: string;
  role: InvitableRole;
  email: string;
  linkedProfileId: string;
  createdByUid: string;
}) {
  const inviteRef = doc(collection(db, 'academyInvites'));
  const inviteToken = makeInviteToken();
  await setDoc(inviteRef, {
    academyId: input.academyId,
    role: input.role,
    email: input.email.toLowerCase(),
    linkedProfileId: input.linkedProfileId,
    inviteToken,
    status: 'pending',
    createdByUid: input.createdByUid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    acceptedByUid: null,
    acceptedAt: null,
  });
  return { inviteId: inviteRef.id, inviteToken };
}

export async function revokeAcademyInvite(input: {
  academyId: string;
  inviteId: string;
  actor: UserProfile;
}) {
  await updateDoc(doc(db, 'academyInvites', input.inviteId), { status: 'revoked' });
  await createAuditLog({
    actor: input.actor,
    action: 'academy.invite.revoked',
    targetType: 'academyInvite',
    targetId: input.inviteId,
    academyId: input.academyId,
    message: 'Academy invite revoked.',
    metadata: { academyId: input.academyId },
  });
}
