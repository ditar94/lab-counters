"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = auditLog;
exports.getAuditHistory = getAuditHistory;
const prisma_1 = require("../lib/prisma");
/**
 * Get the real client IP address, handling proxies
 */
function getClientIp(req) {
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
async function auditLog(params) {
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
        await prisma_1.prisma.auditEvent.create({
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
    }
    catch (error) {
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
async function getAuditHistory(orgId, entityType, entityId) {
    return prisma_1.prisma.auditEvent.findMany({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2VydmljZXMvYXVkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFzQ0EsNEJBNkNDO0FBRUQsMENBZ0JDO0FBcEdELDBDQUF1QztBQVd2Qzs7R0FFRztBQUNILFNBQVMsV0FBVyxDQUFDLEdBQVk7SUFDL0IsbUVBQW1FO0lBQ25FLE1BQU0sWUFBWSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwRCxJQUFJLFlBQVksRUFBRSxDQUFDO1FBQ2pCLE1BQU0sR0FBRyxHQUFHLE9BQU8sWUFBWSxLQUFLLFFBQVE7WUFDMUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO1lBQ3pCLENBQUMsQ0FBQyxZQUFZLENBQUM7UUFDakIsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDeEIsQ0FBQztJQUVELDRCQUE0QjtJQUM1QixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3hDLElBQUksTUFBTSxFQUFFLENBQUM7UUFDWCxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVELE9BQU8sR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQztBQUM3QyxDQUFDO0FBRUQ7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLFFBQVEsQ0FBQyxNQUFzQjtJQUNuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBRW5GLE1BQU0sYUFBYSxHQUFHLEdBQUcsRUFBRSxhQUFhLENBQUM7SUFDekMsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNyRCxNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRXpDLDBDQUEwQztJQUMxQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3JDLGFBQWE7UUFDYixNQUFNO1FBQ04sVUFBVTtRQUNWLFFBQVE7UUFDUixXQUFXO1FBQ1gsS0FBSztRQUNMLFNBQVM7UUFDVCxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7S0FDcEMsQ0FBQyxDQUFDLENBQUM7SUFFSixJQUFJLENBQUM7UUFDSCxNQUFNLGVBQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO1lBQzdCLElBQUksRUFBRTtnQkFDSixLQUFLO2dCQUNMLFdBQVc7Z0JBQ1gsTUFBTTtnQkFDTixVQUFVO2dCQUNWLFFBQVE7Z0JBQ1IsUUFBUSxFQUFFO29CQUNSLEdBQUcsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO29CQUNuQixhQUFhO29CQUNiLFNBQVM7b0JBQ1QsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7aUJBQy9EO2FBQ0Y7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLDhDQUE4QztRQUM5QyxPQUFPLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRTtZQUM3QixhQUFhO1lBQ2IsS0FBSyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLGVBQWU7WUFDL0QsTUFBTTtZQUNOLFVBQVU7WUFDVixRQUFRO1NBQ1QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztBQUNILENBQUM7QUFFTSxLQUFLLFVBQVUsZUFBZSxDQUNuQyxLQUFhLEVBQ2IsVUFBa0IsRUFDbEIsUUFBZ0I7SUFFaEIsT0FBTyxlQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztRQUNoQyxLQUFLLEVBQUU7WUFDTCxLQUFLO1lBQ0wsVUFBVTtZQUNWLFFBQVE7U0FDVDtRQUNELE9BQU8sRUFBRTtZQUNQLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFO1NBQzVDO1FBQ0QsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRTtLQUMvQixDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUmVxdWVzdCB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSAnLi4vbGliL3ByaXNtYSc7XG5pbnRlcmZhY2UgQXVkaXRMb2dQYXJhbXMge1xuICBvcmdJZDogc3RyaW5nO1xuICBhY3RvclVzZXJJZDogc3RyaW5nO1xuICBhY3Rpb246IHN0cmluZztcbiAgZW50aXR5VHlwZTogc3RyaW5nO1xuICBlbnRpdHlJZDogc3RyaW5nO1xuICBtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICByZXE/OiBSZXF1ZXN0O1xufVxuXG4vKipcbiAqIEdldCB0aGUgcmVhbCBjbGllbnQgSVAgYWRkcmVzcywgaGFuZGxpbmcgcHJveGllc1xuICovXG5mdW5jdGlvbiBnZXRDbGllbnRJcChyZXE6IFJlcXVlc3QpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAvLyBYLUZvcndhcmRlZC1Gb3IgY2FuIGNvbnRhaW4gbXVsdGlwbGUgSVBzOiBjbGllbnQsIHByb3h5MSwgcHJveHkyXG4gIGNvbnN0IGZvcndhcmRlZEZvciA9IHJlcS5oZWFkZXJzWyd4LWZvcndhcmRlZC1mb3InXTtcbiAgaWYgKGZvcndhcmRlZEZvcikge1xuICAgIGNvbnN0IGlwcyA9IHR5cGVvZiBmb3J3YXJkZWRGb3IgPT09ICdzdHJpbmcnXG4gICAgICA/IGZvcndhcmRlZEZvci5zcGxpdCgnLCcpXG4gICAgICA6IGZvcndhcmRlZEZvcjtcbiAgICByZXR1cm4gaXBzWzBdPy50cmltKCk7XG4gIH1cblxuICAvLyBYLVJlYWwtSVAgKHVzZWQgYnkgbmdpbngpXG4gIGNvbnN0IHJlYWxJcCA9IHJlcS5oZWFkZXJzWyd4LXJlYWwtaXAnXTtcbiAgaWYgKHJlYWxJcCkge1xuICAgIHJldHVybiB0eXBlb2YgcmVhbElwID09PSAnc3RyaW5nJyA/IHJlYWxJcCA6IHJlYWxJcFswXTtcbiAgfVxuXG4gIHJldHVybiByZXEuaXAgfHwgcmVxLnNvY2tldD8ucmVtb3RlQWRkcmVzcztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gYXVkaXQgbG9nIGVudHJ5IGZvciBjb21wbGlhbmNlIHRyYWNraW5nXG4gKiBFdmVyeSBkYXRhIG1vZGlmaWNhdGlvbiBpcyBsb2dnZWQgd2l0aCBmdWxsIGNvbnRleHRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1ZGl0TG9nKHBhcmFtczogQXVkaXRMb2dQYXJhbXMpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgeyBvcmdJZCwgYWN0b3JVc2VySWQsIGFjdGlvbiwgZW50aXR5VHlwZSwgZW50aXR5SWQsIG1ldGFkYXRhLCByZXEgfSA9IHBhcmFtcztcblxuICBjb25zdCBjb3JyZWxhdGlvbklkID0gcmVxPy5jb3JyZWxhdGlvbklkO1xuICBjb25zdCBpcEFkZHJlc3MgPSByZXEgPyBnZXRDbGllbnRJcChyZXEpIDogdW5kZWZpbmVkO1xuICBjb25zdCB1c2VyQWdlbnQgPSByZXE/LmdldCgndXNlci1hZ2VudCcpO1xuXG4gIC8vIExvZyB0byBjb25zb2xlIGZvciByZWFsLXRpbWUgbW9uaXRvcmluZ1xuICBjb25zb2xlLmluZm8oJ1tBVURJVF0nLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY29ycmVsYXRpb25JZCxcbiAgICBhY3Rpb24sXG4gICAgZW50aXR5VHlwZSxcbiAgICBlbnRpdHlJZCxcbiAgICBhY3RvclVzZXJJZCxcbiAgICBvcmdJZCxcbiAgICBpcEFkZHJlc3MsXG4gICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gIH0pKTtcblxuICB0cnkge1xuICAgIGF3YWl0IHByaXNtYS5hdWRpdEV2ZW50LmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIG9yZ0lkLFxuICAgICAgICBhY3RvclVzZXJJZCxcbiAgICAgICAgYWN0aW9uLFxuICAgICAgICBlbnRpdHlUeXBlLFxuICAgICAgICBlbnRpdHlJZCxcbiAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAuLi4obWV0YWRhdGEgPz8ge30pLFxuICAgICAgICAgIGNvcnJlbGF0aW9uSWQsXG4gICAgICAgICAgaXBBZGRyZXNzLFxuICAgICAgICAgIHVzZXJBZ2VudDogdXNlckFnZW50ID8gdXNlckFnZW50LnN1YnN0cmluZygwLCA1MDApIDogdW5kZWZpbmVkLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBMb2cgZXJyb3IgYnV0IGRvbid0IGZhaWwgdGhlIG1haW4gb3BlcmF0aW9uXG4gICAgY29uc29sZS5lcnJvcignW0FVRElUIEVSUk9SXScsIHtcbiAgICAgIGNvcnJlbGF0aW9uSWQsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICBhY3Rpb24sXG4gICAgICBlbnRpdHlUeXBlLFxuICAgICAgZW50aXR5SWQsXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEF1ZGl0SGlzdG9yeShcbiAgb3JnSWQ6IHN0cmluZyxcbiAgZW50aXR5VHlwZTogc3RyaW5nLFxuICBlbnRpdHlJZDogc3RyaW5nXG4pIHtcbiAgcmV0dXJuIHByaXNtYS5hdWRpdEV2ZW50LmZpbmRNYW55KHtcbiAgICB3aGVyZToge1xuICAgICAgb3JnSWQsXG4gICAgICBlbnRpdHlUeXBlLFxuICAgICAgZW50aXR5SWQsXG4gICAgfSxcbiAgICBpbmNsdWRlOiB7XG4gICAgICBhY3RvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgIH0sXG4gICAgb3JkZXJCeTogeyBjcmVhdGVkQXQ6ICdkZXNjJyB9LFxuICB9KTtcbn1cbiJdfQ==