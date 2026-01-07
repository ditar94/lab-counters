import { Request } from 'express';
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
 * Create an audit log entry for compliance tracking
 * Every data modification is logged with full context
 */
export declare function auditLog(params: AuditLogParams): Promise<void>;
export declare function getAuditHistory(orgId: string, entityType: string, entityId: string): Promise<({
    actor: {
        id: string;
        name: string;
    };
} & {
    id: string;
    createdAt: Date;
    orgId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: import("@prisma/client/runtime/library").JsonValue;
})[]>;
export {};
