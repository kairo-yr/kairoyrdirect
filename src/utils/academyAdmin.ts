import { createInviteRecord, revokeInviteRecord } from '../lib/operationsApi';
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
  const inviteToken = makeInviteToken();
  const invite = await createInviteRecord({ ...input, inviteToken });
  return { inviteId: String(invite.id), inviteToken };
}

export async function revokeAcademyInvite(input: {
  academyId: string;
  inviteId: string;
  actor: UserProfile;
}) {
  await revokeInviteRecord(input.inviteId);
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
