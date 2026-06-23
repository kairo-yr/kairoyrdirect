import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types/auth';

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
