import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AcademyRegistration, UserProfile } from '../types/auth';

type AuditInput = {
  actor: UserProfile;
  action: string;
  targetType: string;
  targetId: string;
  academyId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function createAuditLog({ actor, action, targetType, targetId, academyId = null, message, metadata = {} }: AuditInput) {
  const logRef = doc(collection(db, 'auditLogs'));
  await setDoc(logRef, {
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    academyId,
    message,
    metadata,
    createdAt: serverTimestamp(),
  });
}

async function getAcademy(academyId: string) {
  const academySnapshot = await getDoc(doc(db, 'academies', academyId));
  if (!academySnapshot.exists()) throw new Error('Academy not found.');
  return { id: academySnapshot.id, ...academySnapshot.data() } as AcademyRegistration;
}

export async function approveAcademy(academyId: string, actor: UserProfile) {
  const academy = await getAcademy(academyId);
  await updateDoc(doc(db, 'academies', academyId), {
    status: 'active',
    approvedAt: serverTimestamp(),
    approvedBy: actor.uid,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
  });
  await updateDoc(doc(db, 'users', academy.ownerUid), {
    role: 'academy_admin',
    status: 'active',
    academyId,
    updatedAt: serverTimestamp(),
  });
  await createAuditLog({
    actor,
    action: 'academy.approved',
    targetType: 'academy',
    targetId: academyId,
    academyId,
    message: `${academy.name} approved.`,
    metadata: { ownerUid: academy.ownerUid, ownerEmail: academy.ownerEmail },
  });
}

export async function rejectAcademy(academyId: string, reason: string, actor: UserProfile) {
  const academy = await getAcademy(academyId);
  await updateDoc(doc(db, 'academies', academyId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: actor.uid,
    rejectionReason: reason,
  });
  await createAuditLog({
    actor,
    action: 'academy.rejected',
    targetType: 'academy',
    targetId: academyId,
    academyId,
    message: `${academy.name} rejected.`,
    metadata: { reason, ownerUid: academy.ownerUid, ownerEmail: academy.ownerEmail },
  });
}

export async function disableAcademy(academyId: string, actor: UserProfile) {
  const academy = await getAcademy(academyId);
  await updateDoc(doc(db, 'academies', academyId), {
    status: 'disabled',
    disabledAt: serverTimestamp(),
    disabledBy: actor.uid,
  });
  await createAuditLog({
    actor,
    action: 'academy.disabled',
    targetType: 'academy',
    targetId: academyId,
    academyId,
    message: `${academy.name} disabled.`,
    metadata: { previousStatus: academy.status },
  });
}

export async function reactivateAcademy(academyId: string, actor: UserProfile) {
  const academy = await getAcademy(academyId);
  await updateDoc(doc(db, 'academies', academyId), {
    status: 'active',
    reactivatedAt: serverTimestamp(),
    reactivatedBy: actor.uid,
  });
  await createAuditLog({
    actor,
    action: 'academy.reactivated',
    targetType: 'academy',
    targetId: academyId,
    academyId,
    message: `${academy.name} reactivated.`,
    metadata: { previousStatus: academy.status },
  });
}

export async function disableUser(uid: string, actor: UserProfile) {
  if (uid === actor.uid) throw new Error('You cannot disable your own super admin account.');
  const targetSnapshot = await getDoc(doc(db, 'users', uid));
  if (!targetSnapshot.exists()) throw new Error('User not found.');
  const targetUser = { uid: targetSnapshot.id, ...targetSnapshot.data() } as UserProfile;
  if (targetUser.role === 'super_admin') throw new Error('Protected admin accounts cannot be disabled.');
  await updateDoc(doc(db, 'users', uid), {
    status: 'disabled',
    updatedAt: serverTimestamp(),
  });
  await createAuditLog({
    actor,
    action: 'user.disabled',
    targetType: 'user',
    targetId: uid,
    academyId: null,
    message: `User ${uid} disabled.`,
  });
}

export async function reactivateUser(uid: string, actor: UserProfile) {
  await updateDoc(doc(db, 'users', uid), {
    status: 'active',
    updatedAt: serverTimestamp(),
  });
  await createAuditLog({
    actor,
    action: 'user.reactivated',
    targetType: 'user',
    targetId: uid,
    academyId: null,
    message: `User ${uid} reactivated.`,
  });
}
