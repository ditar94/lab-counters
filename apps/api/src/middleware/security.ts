import rateLimit, { type Options } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get client IP address, handling proxies
 * Uses X-Forwarded-For if behind a load balancer
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Create a rate limiter with proper IPv6 handling
 */
function createRateLimiter(options: Partial<Options>) {
  return rateLimit({
    ...options,
    // Disable the validation that complains about IPv6
    validate: { xForwardedForHeader: false },
  });
}

// Extend Express Request type to include correlationId
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
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  // Use existing correlation ID from header or generate new one
  const id = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const generalRateLimiter = createRateLimiter({
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
export const authRateLimiter = createRateLimiter({
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
export const sensitiveRateLimiter = createRateLimiter({
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
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
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
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
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
    } else if (res.statusCode >= 400) {
      console.warn('[SECURITY] Client Error:', JSON.stringify(logData));
    } else if (req.path.includes('/auth') || req.path.includes('/verify')) {
      // Always log auth-related requests
      console.info('[SECURITY] Auth Request:', JSON.stringify(logData));
    }
  });

  next();
}
