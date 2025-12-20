import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { auditLog } from '../services/audit';

export const authRouter = Router();

// Apply stricter rate limiting to auth routes
authRouter.use(authRateLimiter);

// Get current user info
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
        site: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// This endpoint is called after Cognito authentication to sync user
authRouter.post('/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // User already exists (middleware found them)
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
        site: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Register new user (used during initial signup flow)
// In production, this would be triggered by Cognito post-confirmation hook
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cognitoId, email, name, orgSlug, siteName } = req.body;

    // Find or create organization
    let org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: orgSlug, // Use slug as name initially
          slug: orgSlug,
          settings: {
            timezone: 'America/New_York',
            defaultDilution: 10,
            requireVerification: true,
            allowSelfVerification: false,
          },
        },
      });
    }

    // Find or create site
    let site = await prisma.site.findFirst({
      where: {
        orgId: org.id,
        name: siteName || 'Default Site',
      },
    });

    if (!site) {
      site = await prisma.site.create({
        data: {
          orgId: org.id,
          name: siteName || 'Default Site',
          location: '',
        },
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        cognitoId,
        email,
        name,
        orgId: org.id,
        siteId: site.id,
        role: 'technologist',
        status: 'pending', // Requires admin approval
      },
      include: {
        organization: true,
        site: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});
