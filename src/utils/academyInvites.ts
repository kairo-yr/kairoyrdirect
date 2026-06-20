import { collection, doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AcademyInvite, InvitableRole } from '../types/auth';

export type CreateAcademyInviteInput = {
  email: string;
  academyId: string;
  role: InvitableRole;
  linkedProfileId: string;
  inviteToken: string;
  createdByUid: string;
};

export async function createAcademyInvite(input: CreateAcademyInviteInput) {
  const inviteRef = doc(collection(db, 'academyInvites'));
  const invite = {
    email: input.email.toLowerCase(),
    academyId: input.academyId,
    role: input.role,
    linkedProfileId: input.linkedProfileId,
    inviteToken: input.inviteToken,
    status: 'pending',
    createdByUid: input.createdByUid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    acceptedByUid: null,
    acceptedAt: null,
  } satisfies Omit<AcademyInvite, 'id'>;

  await setDoc(inviteRef, invite);
  return inviteRef.id;
}
