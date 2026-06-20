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

export async function createAcademyStudentWithInvite(input: {
  academyId: string;
  actor: UserProfile;
  name: string;
  email: string;
  phone: string;
  monthlyFee?: number | null;
}) {
  const studentRef = doc(collection(db, 'academies', input.academyId, 'students'));
  const normalizedEmail = input.email.trim().toLowerCase();
  const invite = normalizedEmail
    ? await createAcademyInvite({
        academyId: input.academyId,
        role: 'student',
        email: normalizedEmail,
        linkedProfileId: studentRef.id,
        createdByUid: input.actor.uid,
      })
    : null;
  await setDoc(studentRef, {
    name: input.name,
    email: normalizedEmail,
    phone: input.phone,
    monthlyFee: input.monthlyFee ?? null,
    status: invite ? 'invited' : 'active',
    batchId: null,
    userUid: null,
    inviteId: invite?.inviteId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await createAuditLog({
    actor: input.actor,
    action: 'academy.student.created',
    targetType: 'student',
    targetId: studentRef.id,
    academyId: input.academyId,
    message: `${input.name} student profile created.`,
    metadata: { academyId: input.academyId, email: normalizedEmail, inviteId: invite?.inviteId ?? null },
  });
  return invite;
}

export async function createAcademyCoachWithInvite(input: {
  academyId: string;
  actor: UserProfile;
  name: string;
  email: string;
  phone: string;
}) {
  const coachRef = doc(collection(db, 'academies', input.academyId, 'coaches'));
  const invite = await createAcademyInvite({
    academyId: input.academyId,
    role: 'coach',
    email: input.email,
    linkedProfileId: coachRef.id,
    createdByUid: input.actor.uid,
  });
  await setDoc(coachRef, {
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    status: 'invited',
    userUid: null,
    inviteId: invite.inviteId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await createAuditLog({
    actor: input.actor,
    action: 'academy.coach.created',
    targetType: 'coach',
    targetId: coachRef.id,
    academyId: input.academyId,
    message: `${input.name} coach profile created.`,
    metadata: { academyId: input.academyId, email: input.email.toLowerCase(), inviteId: invite.inviteId },
  });
  return invite;
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
