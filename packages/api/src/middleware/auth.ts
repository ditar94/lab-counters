import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { prisma } from '../lib/prisma';
import type { User, UserRole } from '@lab-counters/shared';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      cognitoSub?: string;
    }
  }
}

// In-memory store for failed login attempts (use Redis in production)
const failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Log authentication events for security monitoring
 */
function logAuthEvent(
  event: 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'AUTH_LOCKOUT' | 'TOKEN_EXPIRED' | 'USER_INACTIVE',
  req: Request,
  details: Record<string, unknown> = {}
): void {
  const logData = {
    event,
    correlationId: req.correlationId,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (event === 'AUTH_SUCCESS') {
    console.info('[AUTH]', JSON.stringify(logData));
  } else {
    console.warn('[AUTH]', JSON.stringify(logData));
  }
}

/**
 * Check if an IP is locked out due to too many failed attempts
 */
function isLockedOut(ip: string): boolean {
  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;

  // Check if lockout has expired
  const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
  if (timeSinceLastAttempt > LOCKOUT_DURATION_MS) {
    failedAttempts.delete(ip);
    return false;
  }

  return attempts.count >= MAX_FAILED_ATTEMPTS;
}

/**
 * Record a failed authentication attempt
 */
function recordFailedAttempt(ip: string): void {
  const current = failedAttempts.get(ip) || { count: 0, lastAttempt: new Date() };
  current.count += 1;
  current.lastAttempt = new Date();
  failedAttempts.set(ip, current);
}

/**
 * Clear failed attempts for an IP (on successful auth)
 */
function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

// JWKS client for Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  // Check for lockout
  if (isLockedOut(clientIp)) {
    logAuthEvent('AUTH_LOCKOUT', req, { ip: clientIp });
    res.status(429).json({
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Too many failed authentication attempts. Please try again later.',
    });
    return;
  }

  const authHeader = req.headers.authorization;

  // Development bypass - allow dev-token with user type
  if (process.env.NODE_ENV === 'development') {
    const devUserType = req.headers['x-dev-user-type'] as string;
    const token = authHeader?.substring(7);

    if (token === 'dev-token') {
      // Map user type to cognito ID
      const cognitoId = devUserType ? `dev-${devUserType}` : 'dev-admin';

      const devUser = await prisma.user.findFirst({
        where: { cognitoId, status: 'active' },
        include: { organization: true, site: true },
      });
      if (devUser) {
        req.user = devUser as unknown as User;
        req.cognitoSub = devUser.cognitoId;
        logAuthEvent('AUTH_SUCCESS', req, { userId: devUser.id, email: devUser.email, dev: true });
        next();
        return;
      }
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordFailedAttempt(clientIp);
    logAuthEvent('AUTH_FAILURE', req, { reason: 'no_token' });
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded as jwt.JwtPayload);
        }
      );
    });

    const cognitoSub = decoded.sub;
    if (!cognitoSub) {
      recordFailedAttempt(clientIp);
      logAuthEvent('AUTH_FAILURE', req, { reason: 'invalid_token_no_sub' });
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token' });
      return;
    }

    // Look up user in database
    const user = await prisma.user.findUnique({
      where: { cognitoId: cognitoSub },
    });

    if (!user) {
      recordFailedAttempt(clientIp);
      logAuthEvent('AUTH_FAILURE', req, { reason: 'user_not_found', cognitoSub });
      res.status(401).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }

    if (user.status !== 'active') {
      logAuthEvent('USER_INACTIVE', req, { userId: user.id, status: user.status });
      res.status(403).json({ code: 'USER_INACTIVE', message: 'User account is not active' });
      return;
    }

    // Successful auth - clear failed attempts
    clearFailedAttempts(clientIp);

    req.user = user as unknown as User;
    req.cognitoSub = cognitoSub;

    logAuthEvent('AUTH_SUCCESS', req, { userId: user.id, email: user.email });
    next();
  } catch (error) {
    recordFailedAttempt(clientIp);

    // Check for specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      logAuthEvent('TOKEN_EXPIRED', req, { expiredAt: error.expiredAt });
      res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logAuthEvent('AUTH_FAILURE', req, { reason: 'invalid_token', error: error.message });
      res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid token' });
      return;
    }

    logAuthEvent('AUTH_FAILURE', req, { reason: 'unknown_error', error: String(error) });
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication failed' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// Ensure user can only access their own org's data
export function enforceOrgScope(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    return;
  }

  // Add org filter to request for use in queries
  req.query.orgId = req.user.orgId;
  next();
}
