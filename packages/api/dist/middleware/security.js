"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensitiveRateLimiter = exports.authRateLimiter = exports.generalRateLimiter = void 0;
exports.correlationId = correlationId;
exports.securityHeaders = securityHeaders;
exports.securityLogger = securityLogger;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const uuid_1 = require("uuid");
/**
 * Get client IP address, handling proxies
 * Uses X-Forwarded-For if behind a load balancer
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || 'unknown';
    }
    return req.ip || 'unknown';
}
/**
 * Create a rate limiter with proper IPv6 handling
 */
function createRateLimiter(options) {
    return (0, express_rate_limit_1.default)({
        ...options,
        // Disable the validation that complains about IPv6
        validate: { xForwardedForHeader: false },
    });
}
/**
 * Add correlation ID to every request for tracing
 * This ID follows the request through all logs and can be used for debugging
 */
function correlationId(req, res, next) {
    // Use existing correlation ID from header or generate new one
    const id = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    next();
}
/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
exports.generalRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    message: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
    },
    keyGenerator: (req) => getClientIp(req),
});
/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per minute per IP (prevents brute force)
 */
exports.authRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later',
    },
    keyGenerator: (req) => getClientIp(req),
    // Skip rate limiting for successful requests in development
    skip: () => process.env.NODE_ENV === 'development',
});
/**
 * Very strict rate limiter for sensitive operations
 * 5 requests per minute per user
 */
exports.sensitiveRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        code: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
        message: 'Too many sensitive operations, please try again later',
    },
    keyGenerator: (req) => {
        // Rate limit by user ID if authenticated, otherwise by IP
        return req.user?.id || getClientIp(req);
    },
});
/**
 * Enhanced security headers beyond helmet defaults
 */
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy (disable unnecessary browser features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
}
/**
 * Log security-relevant request details
 */
function securityLogger(req, res, next) {
    const startTime = Date.now();
    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            correlationId: req.correlationId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'],
            userId: req.user?.id,
            orgId: req.user?.orgId,
        };
        // Log based on status code
        if (res.statusCode >= 500) {
            console.error('[SECURITY] Server Error:', JSON.stringify(logData));
        }
        else if (res.statusCode >= 400) {
            console.warn('[SECURITY] Client Error:', JSON.stringify(logData));
        }
        else if (req.path.includes('/auth') || req.path.includes('/verify')) {
            // Always log auth-related requests
            console.info('[SECURITY] Auth Request:', JSON.stringify(logData));
        }
    });
    next();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWlkZGxld2FyZS9zZWN1cml0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUF3Q0Esc0NBTUM7QUEwREQsMENBaUJDO0FBS0Qsd0NBOEJDO0FBNUpELDRFQUE2RDtBQUU3RCwrQkFBb0M7QUFFcEM7OztHQUdHO0FBQ0gsU0FBUyxXQUFXLENBQUMsR0FBWTtJQUMvQixNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDakQsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNsQyxPQUFPLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDO0lBQ3RELENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQyxFQUFFLElBQUksU0FBUyxDQUFDO0FBQzdCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsaUJBQWlCLENBQUMsT0FBeUI7SUFDbEQsT0FBTyxJQUFBLDRCQUFTLEVBQUM7UUFDZixHQUFHLE9BQU87UUFDVixtREFBbUQ7UUFDbkQsUUFBUSxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFO0tBQ3pDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFXRDs7O0dBR0c7QUFDSCxTQUFnQixhQUFhLENBQUMsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQjtJQUMzRSw4REFBOEQ7SUFDOUQsTUFBTSxFQUFFLEdBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBWSxJQUFJLElBQUEsU0FBTSxHQUFFLENBQUM7SUFDbkUsR0FBRyxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFDdkIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0QyxJQUFJLEVBQUUsQ0FBQztBQUNULENBQUM7QUFFRDs7O0dBR0c7QUFDVSxRQUFBLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDO0lBQ2xELFFBQVEsRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLFdBQVc7SUFDaEMsR0FBRyxFQUFFLEdBQUcsRUFBRSwwQkFBMEI7SUFDcEMsZUFBZSxFQUFFLElBQUksRUFBRSxvQ0FBb0M7SUFDM0QsYUFBYSxFQUFFLEtBQUs7SUFDcEIsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLHFCQUFxQjtRQUMzQixPQUFPLEVBQUUsMkNBQTJDO0tBQ3JEO0lBQ0QsWUFBWSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0NBQ3hDLENBQUMsQ0FBQztBQUVIOzs7R0FHRztBQUNVLFFBQUEsZUFBZSxHQUFHLGlCQUFpQixDQUFDO0lBQy9DLFFBQVEsRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLFdBQVc7SUFDaEMsR0FBRyxFQUFFLEVBQUUsRUFBRSx5QkFBeUI7SUFDbEMsZUFBZSxFQUFFLElBQUk7SUFDckIsYUFBYSxFQUFFLEtBQUs7SUFDcEIsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLDBCQUEwQjtRQUNoQyxPQUFPLEVBQUUsMERBQTBEO0tBQ3BFO0lBQ0QsWUFBWSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0lBQ3ZDLDREQUE0RDtJQUM1RCxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYTtDQUNuRCxDQUFDLENBQUM7QUFFSDs7O0dBR0c7QUFDVSxRQUFBLG9CQUFvQixHQUFHLGlCQUFpQixDQUFDO0lBQ3BELFFBQVEsRUFBRSxFQUFFLEdBQUcsSUFBSSxFQUFFLFdBQVc7SUFDaEMsR0FBRyxFQUFFLENBQUMsRUFBRSx3QkFBd0I7SUFDaEMsZUFBZSxFQUFFLElBQUk7SUFDckIsYUFBYSxFQUFFLEtBQUs7SUFDcEIsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLCtCQUErQjtRQUNyQyxPQUFPLEVBQUUsdURBQXVEO0tBQ2pFO0lBQ0QsWUFBWSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7UUFDcEIsMERBQTBEO1FBQzFELE9BQU8sR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDLENBQUM7Q0FDRixDQUFDLENBQUM7QUFFSDs7R0FFRztBQUNILFNBQWdCLGVBQWUsQ0FBQyxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCO0lBQzdFLHVCQUF1QjtJQUN2QixHQUFHLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRXpDLDZCQUE2QjtJQUM3QixHQUFHLENBQUMsU0FBUyxDQUFDLHdCQUF3QixFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRW5ELG9CQUFvQjtJQUNwQixHQUFHLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBRW5ELGtCQUFrQjtJQUNsQixHQUFHLENBQUMsU0FBUyxDQUFDLGlCQUFpQixFQUFFLGlDQUFpQyxDQUFDLENBQUM7SUFFcEUsNERBQTREO0lBQzVELEdBQUcsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLEVBQUUsMENBQTBDLENBQUMsQ0FBQztJQUVoRixJQUFJLEVBQUUsQ0FBQztBQUNULENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCO0lBQzVFLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUU3Qix5QkFBeUI7SUFDekIsR0FBRyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1FBQ3BCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUM7UUFDeEMsTUFBTSxPQUFPLEdBQUc7WUFDZCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWE7WUFDaEMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNO1lBQ2xCLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSTtZQUNkLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVTtZQUMxQixRQUFRLEVBQUUsR0FBRyxRQUFRLElBQUk7WUFDekIsRUFBRSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUM7WUFDcEIsU0FBUyxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1lBQ3BDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDcEIsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSztTQUN2QixDQUFDO1FBRUYsMkJBQTJCO1FBQzNCLElBQUksR0FBRyxDQUFDLFVBQVUsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUMxQixPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDO2FBQU0sSUFBSSxHQUFHLENBQUMsVUFBVSxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7YUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDdEUsbUNBQW1DO1lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksRUFBRSxDQUFDO0FBQ1QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCByYXRlTGltaXQsIHsgdHlwZSBPcHRpb25zIH0gZnJvbSAnZXhwcmVzcy1yYXRlLWxpbWl0JztcbmltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlLCBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gJ3V1aWQnO1xuXG4vKipcbiAqIEdldCBjbGllbnQgSVAgYWRkcmVzcywgaGFuZGxpbmcgcHJveGllc1xuICogVXNlcyBYLUZvcndhcmRlZC1Gb3IgaWYgYmVoaW5kIGEgbG9hZCBiYWxhbmNlclxuICovXG5mdW5jdGlvbiBnZXRDbGllbnRJcChyZXE6IFJlcXVlc3QpOiBzdHJpbmcge1xuICBjb25zdCBmb3J3YXJkZWQgPSByZXEuaGVhZGVyc1sneC1mb3J3YXJkZWQtZm9yJ107XG4gIGlmICh0eXBlb2YgZm9yd2FyZGVkID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmb3J3YXJkZWQuc3BsaXQoJywnKVswXT8udHJpbSgpIHx8ICd1bmtub3duJztcbiAgfVxuICByZXR1cm4gcmVxLmlwIHx8ICd1bmtub3duJztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSByYXRlIGxpbWl0ZXIgd2l0aCBwcm9wZXIgSVB2NiBoYW5kbGluZ1xuICovXG5mdW5jdGlvbiBjcmVhdGVSYXRlTGltaXRlcihvcHRpb25zOiBQYXJ0aWFsPE9wdGlvbnM+KSB7XG4gIHJldHVybiByYXRlTGltaXQoe1xuICAgIC4uLm9wdGlvbnMsXG4gICAgLy8gRGlzYWJsZSB0aGUgdmFsaWRhdGlvbiB0aGF0IGNvbXBsYWlucyBhYm91dCBJUHY2XG4gICAgdmFsaWRhdGU6IHsgeEZvcndhcmRlZEZvckhlYWRlcjogZmFsc2UgfSxcbiAgfSk7XG59XG5cbi8vIEV4dGVuZCBFeHByZXNzIFJlcXVlc3QgdHlwZSB0byBpbmNsdWRlIGNvcnJlbGF0aW9uSWRcbmRlY2xhcmUgZ2xvYmFsIHtcbiAgbmFtZXNwYWNlIEV4cHJlc3Mge1xuICAgIGludGVyZmFjZSBSZXF1ZXN0IHtcbiAgICAgIGNvcnJlbGF0aW9uSWQ/OiBzdHJpbmc7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQWRkIGNvcnJlbGF0aW9uIElEIHRvIGV2ZXJ5IHJlcXVlc3QgZm9yIHRyYWNpbmdcbiAqIFRoaXMgSUQgZm9sbG93cyB0aGUgcmVxdWVzdCB0aHJvdWdoIGFsbCBsb2dzIGFuZCBjYW4gYmUgdXNlZCBmb3IgZGVidWdnaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb3JyZWxhdGlvbklkKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKTogdm9pZCB7XG4gIC8vIFVzZSBleGlzdGluZyBjb3JyZWxhdGlvbiBJRCBmcm9tIGhlYWRlciBvciBnZW5lcmF0ZSBuZXcgb25lXG4gIGNvbnN0IGlkID0gKHJlcS5oZWFkZXJzWyd4LWNvcnJlbGF0aW9uLWlkJ10gYXMgc3RyaW5nKSB8fCB1dWlkdjQoKTtcbiAgcmVxLmNvcnJlbGF0aW9uSWQgPSBpZDtcbiAgcmVzLnNldEhlYWRlcignWC1Db3JyZWxhdGlvbi1JRCcsIGlkKTtcbiAgbmV4dCgpO1xufVxuXG4vKipcbiAqIEdlbmVyYWwgQVBJIHJhdGUgbGltaXRlclxuICogMTAwIHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIElQXG4gKi9cbmV4cG9ydCBjb25zdCBnZW5lcmFsUmF0ZUxpbWl0ZXIgPSBjcmVhdGVSYXRlTGltaXRlcih7XG4gIHdpbmRvd01zOiA2MCAqIDEwMDAsIC8vIDEgbWludXRlXG4gIG1heDogMTAwLCAvLyAxMDAgcmVxdWVzdHMgcGVyIG1pbnV0ZVxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsIC8vIFJldHVybiByYXRlIGxpbWl0IGluZm8gaW4gaGVhZGVyc1xuICBsZWdhY3lIZWFkZXJzOiBmYWxzZSxcbiAgbWVzc2FnZToge1xuICAgIGNvZGU6ICdSQVRFX0xJTUlUX0VYQ0VFREVEJyxcbiAgICBtZXNzYWdlOiAnVG9vIG1hbnkgcmVxdWVzdHMsIHBsZWFzZSB0cnkgYWdhaW4gbGF0ZXInLFxuICB9LFxuICBrZXlHZW5lcmF0b3I6IChyZXEpID0+IGdldENsaWVudElwKHJlcSksXG59KTtcblxuLyoqXG4gKiBTdHJpY3QgcmF0ZSBsaW1pdGVyIGZvciBhdXRoZW50aWNhdGlvbiBlbmRwb2ludHNcbiAqIDEwIHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIElQIChwcmV2ZW50cyBicnV0ZSBmb3JjZSlcbiAqL1xuZXhwb3J0IGNvbnN0IGF1dGhSYXRlTGltaXRlciA9IGNyZWF0ZVJhdGVMaW1pdGVyKHtcbiAgd2luZG93TXM6IDYwICogMTAwMCwgLy8gMSBtaW51dGVcbiAgbWF4OiAxMCwgLy8gMTAgcmVxdWVzdHMgcGVyIG1pbnV0ZVxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxuICBtZXNzYWdlOiB7XG4gICAgY29kZTogJ0FVVEhfUkFURV9MSU1JVF9FWENFRURFRCcsXG4gICAgbWVzc2FnZTogJ1RvbyBtYW55IGF1dGhlbnRpY2F0aW9uIGF0dGVtcHRzLCBwbGVhc2UgdHJ5IGFnYWluIGxhdGVyJyxcbiAgfSxcbiAga2V5R2VuZXJhdG9yOiAocmVxKSA9PiBnZXRDbGllbnRJcChyZXEpLFxuICAvLyBTa2lwIHJhdGUgbGltaXRpbmcgZm9yIHN1Y2Nlc3NmdWwgcmVxdWVzdHMgaW4gZGV2ZWxvcG1lbnRcbiAgc2tpcDogKCkgPT4gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcsXG59KTtcblxuLyoqXG4gKiBWZXJ5IHN0cmljdCByYXRlIGxpbWl0ZXIgZm9yIHNlbnNpdGl2ZSBvcGVyYXRpb25zXG4gKiA1IHJlcXVlc3RzIHBlciBtaW51dGUgcGVyIHVzZXJcbiAqL1xuZXhwb3J0IGNvbnN0IHNlbnNpdGl2ZVJhdGVMaW1pdGVyID0gY3JlYXRlUmF0ZUxpbWl0ZXIoe1xuICB3aW5kb3dNczogNjAgKiAxMDAwLCAvLyAxIG1pbnV0ZVxuICBtYXg6IDUsIC8vIDUgcmVxdWVzdHMgcGVyIG1pbnV0ZVxuICBzdGFuZGFyZEhlYWRlcnM6IHRydWUsXG4gIGxlZ2FjeUhlYWRlcnM6IGZhbHNlLFxuICBtZXNzYWdlOiB7XG4gICAgY29kZTogJ1NFTlNJVElWRV9SQVRFX0xJTUlUX0VYQ0VFREVEJyxcbiAgICBtZXNzYWdlOiAnVG9vIG1hbnkgc2Vuc2l0aXZlIG9wZXJhdGlvbnMsIHBsZWFzZSB0cnkgYWdhaW4gbGF0ZXInLFxuICB9LFxuICBrZXlHZW5lcmF0b3I6IChyZXEpID0+IHtcbiAgICAvLyBSYXRlIGxpbWl0IGJ5IHVzZXIgSUQgaWYgYXV0aGVudGljYXRlZCwgb3RoZXJ3aXNlIGJ5IElQXG4gICAgcmV0dXJuIHJlcS51c2VyPy5pZCB8fCBnZXRDbGllbnRJcChyZXEpO1xuICB9LFxufSk7XG5cbi8qKlxuICogRW5oYW5jZWQgc2VjdXJpdHkgaGVhZGVycyBiZXlvbmQgaGVsbWV0IGRlZmF1bHRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZWN1cml0eUhlYWRlcnMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pOiB2b2lkIHtcbiAgLy8gUHJldmVudCBjbGlja2phY2tpbmdcbiAgcmVzLnNldEhlYWRlcignWC1GcmFtZS1PcHRpb25zJywgJ0RFTlknKTtcblxuICAvLyBQcmV2ZW50IE1JTUUgdHlwZSBzbmlmZmluZ1xuICByZXMuc2V0SGVhZGVyKCdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJywgJ25vc25pZmYnKTtcblxuICAvLyBFbmFibGUgWFNTIGZpbHRlclxuICByZXMuc2V0SGVhZGVyKCdYLVhTUy1Qcm90ZWN0aW9uJywgJzE7IG1vZGU9YmxvY2snKTtcblxuICAvLyBSZWZlcnJlciBwb2xpY3lcbiAgcmVzLnNldEhlYWRlcignUmVmZXJyZXItUG9saWN5JywgJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nKTtcblxuICAvLyBQZXJtaXNzaW9ucyBwb2xpY3kgKGRpc2FibGUgdW5uZWNlc3NhcnkgYnJvd3NlciBmZWF0dXJlcylcbiAgcmVzLnNldEhlYWRlcignUGVybWlzc2lvbnMtUG9saWN5JywgJ2dlb2xvY2F0aW9uPSgpLCBtaWNyb3Bob25lPSgpLCBjYW1lcmE9KCknKTtcblxuICBuZXh0KCk7XG59XG5cbi8qKlxuICogTG9nIHNlY3VyaXR5LXJlbGV2YW50IHJlcXVlc3QgZGV0YWlsc1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2VjdXJpdHlMb2dnZXIocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pOiB2b2lkIHtcbiAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAvLyBMb2cgb24gcmVzcG9uc2UgZmluaXNoXG4gIHJlcy5vbignZmluaXNoJywgKCkgPT4ge1xuICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICBjb25zdCBsb2dEYXRhID0ge1xuICAgICAgY29ycmVsYXRpb25JZDogcmVxLmNvcnJlbGF0aW9uSWQsXG4gICAgICBtZXRob2Q6IHJlcS5tZXRob2QsXG4gICAgICBwYXRoOiByZXEucGF0aCxcbiAgICAgIHN0YXR1c0NvZGU6IHJlcy5zdGF0dXNDb2RlLFxuICAgICAgZHVyYXRpb246IGAke2R1cmF0aW9ufW1zYCxcbiAgICAgIGlwOiBnZXRDbGllbnRJcChyZXEpLFxuICAgICAgdXNlckFnZW50OiByZXEuaGVhZGVyc1sndXNlci1hZ2VudCddLFxuICAgICAgdXNlcklkOiByZXEudXNlcj8uaWQsXG4gICAgICBvcmdJZDogcmVxLnVzZXI/Lm9yZ0lkLFxuICAgIH07XG5cbiAgICAvLyBMb2cgYmFzZWQgb24gc3RhdHVzIGNvZGVcbiAgICBpZiAocmVzLnN0YXR1c0NvZGUgPj0gNTAwKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbU0VDVVJJVFldIFNlcnZlciBFcnJvcjonLCBKU09OLnN0cmluZ2lmeShsb2dEYXRhKSk7XG4gICAgfSBlbHNlIGlmIChyZXMuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgIGNvbnNvbGUud2FybignW1NFQ1VSSVRZXSBDbGllbnQgRXJyb3I6JywgSlNPTi5zdHJpbmdpZnkobG9nRGF0YSkpO1xuICAgIH0gZWxzZSBpZiAocmVxLnBhdGguaW5jbHVkZXMoJy9hdXRoJykgfHwgcmVxLnBhdGguaW5jbHVkZXMoJy92ZXJpZnknKSkge1xuICAgICAgLy8gQWx3YXlzIGxvZyBhdXRoLXJlbGF0ZWQgcmVxdWVzdHNcbiAgICAgIGNvbnNvbGUuaW5mbygnW1NFQ1VSSVRZXSBBdXRoIFJlcXVlc3Q6JywgSlNPTi5zdHJpbmdpZnkobG9nRGF0YSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgbmV4dCgpO1xufVxuIl19