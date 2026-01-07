import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}
/**
 * Add correlation ID to every request for tracing
 * This ID follows the request through all logs and can be used for debugging
 */
export declare function correlationId(req: Request, res: Response, next: NextFunction): void;
/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export declare const generalRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per minute per IP (prevents brute force)
 */
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Very strict rate limiter for sensitive operations
 * 5 requests per minute per user
 */
export declare const sensitiveRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Enhanced security headers beyond helmet defaults
 */
export declare function securityHeaders(req: Request, res: Response, next: NextFunction): void;
/**
 * Log security-relevant request details
 */
export declare function securityLogger(req: Request, res: Response, next: NextFunction): void;
