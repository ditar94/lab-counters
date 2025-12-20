import { Request } from 'express';
import { prisma } from '../lib/prisma';
import type { AuditAction } from '@lab-counters/shared';

interface AuditLogParams {
  orgId: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldValues?: unknown;
  newValues?: unknown;
  userId: string;
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
  const { orgId, tableName, recordId, action, oldValues, newValues, userId, req } = params;

  const correlationId = req?.correlationId;
  const ipAddress = req ? getClientIp(req) : undefined;
  const userAgent = req?.get('user-agent');

  // Log to console for real-time monitoring
  console.info('[AUDIT]', JSON.stringify({
    correlationId,
    action,
    tableName,
    recordId,
    userId,
    orgId,
    ipAddress,
    timestamp: new Date().toISOString(),
  }));

  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        tableName,
        recordId,
        action,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        userId,
        ipAddress,
        userAgent: userAgent ? userAgent.substring(0, 500) : null, // Truncate long user agents
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('[AUDIT ERROR]', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      action,
      tableName,
      recordId,
    });
  }
}

export async function getAuditHistory(
  orgId: string,
  tableName: string,
  recordId: string
) {
  return prisma.auditLog.findMany({
    where: {
      orgId,
      tableName,
      recordId,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { timestamp: 'desc' },
  });
}
