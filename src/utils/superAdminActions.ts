import { supabase } from '../lib/supabaseClient';
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
  const { error } = await supabase.from('audit_logs').insert({ actor_user_id: actor.id, academy_id: academyId, action, entity_type: targetType, entity_id: targetId || null, new_values: { message, ...metadata } });
  if (error) throw error;
}
