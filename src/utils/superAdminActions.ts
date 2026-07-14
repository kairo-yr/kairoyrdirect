import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
