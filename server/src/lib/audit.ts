import { AuditLog } from '../models/index.js';

export async function audit(e: {
  actorId?: string | null; groupId?: string | null; action: string;
  entityType?: string; entityId?: string; metadata?: unknown; ip?: string;
}) {
  try {
    await AuditLog.create({ actor: e.actorId ?? undefined, group: e.groupId ?? undefined, action: e.action, entityType: e.entityType, entityId: e.entityId, metadata: e.metadata, ip: e.ip });
  } catch (err) { console.error('audit log failed', err); } // never break the request because of logging
}
