import { Request } from 'express';
import { prisma } from '../lib/prisma';
interface AuditLogParams {
  orgId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Get the real client IP address, handling proxies
 */
function getClientIp(req: Request): string | undefined {
  // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = typeof forwardedFor === 'string'
      ? forwardedFor.split(',')
      : forwardedFor;
    return ips[0]?.trim();
  }

  // X-Real-IP (used by nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  return req.ip || req.socket?.remoteAddress;
}

/**
 * Create an audit log entry for compliance tracking
 * Every data modification is logged with full context
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  const { orgId, actorUserId, action, entityType, entityId, metadata, req } = params;

  const correlationId = req?.correlationId;
  const ipAddress = req ? getClientIp(req) : undefined;
  const userAgent = req?.get('user-agent');

  // Log to console for real-time monitoring
  console.info('[AUDIT]', JSON.stringify({
    correlationId,
    action,
    entityType,
    entityId,
    actorUserId,
    orgId,
    ipAddress,
    timestamp: new Date().toISOString(),
  }));

  try {
    await prisma.auditEvent.create({
      data: {
        orgId,
        actorUserId,
        action,
        entityType,
        entityId,
        metadata: {
          ...(metadata ?? {}),
          correlationId,
          ipAddress,
          userAgent: userAgent ? userAgent.substring(0, 500) : undefined,
        },
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('[AUDIT ERROR]', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action,
      entityType,
      entityId,
    });
  }
}

export async function getAuditHistory(
  orgId: string,
  entityType: string,
  entityId: string
) {
  return prisma.auditEvent.findMany({
    where: {
      orgId,
      entityType,
      entityId,
    },
    include: {
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
