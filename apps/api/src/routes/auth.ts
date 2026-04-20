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
    let user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        organization: true,
        site: true,
        sites: {
          include: { site: true },
          orderBy: { site: { name: 'asc' } },
        },
      },
    });

    // Activate pending users when they successfully authenticate
    // (they've completed password setup if they can call this endpoint)
    if (user && user.status === 'pending') {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: 'active' },
        include: {
          organization: true,
          site: true,
          sites: {
            include: { site: true },
            orderBy: { site: { name: 'asc' } },
          },
        },
      });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Switch current site
authRouter.post('/switch-site', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { siteId } = req.body;

    if (!siteId) {
      res.status(400).json({ code: 'MISSING_SITE_ID', message: 'Site ID is required' });
      return;
    }

    // Verify user has access to this site
    const userSite = await prisma.userSite.findUnique({
      where: {
        userId_siteId: {
          userId: req.user!.id,
          siteId,
        },
      },
      include: { site: true },
    });

    if (!userSite) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this site' });
      return;
    }

    if (userSite.site.status !== 'active') {
      res.status(403).json({ code: 'SITE_INACTIVE', message: 'Site access is not active' });
      return;
    }

    // Update user's current site
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { siteId },
      include: {
        organization: true,
        site: true,
        sites: {
          include: { site: true },
          orderBy: { site: { name: 'asc' } },
        },
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      actorUserId: req.user!.id,
      action: 'switch_site',
      entityType: 'user',
      entityId: user.id,
      metadata: { previousSiteId: req.user!.siteId, newSiteId: siteId },
      req,
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Dev-only: Get all users for dev login picker
authRouter.get('/dev-users', async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        cognitoId: { startsWith: 'dev-' },
        status: 'active',
      },
      include: {
        organization: true,
        site: true,
      },
      orderBy: [
        { organization: { name: 'asc' } },
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by organization
    type UserType = typeof users[number];
    type OrgGroupType = Record<string, { org: UserType['organization']; users: UserType[] }>;
    const grouped = users.reduce((acc: OrgGroupType, user: UserType) => {
      const orgName = user.organization.name;
      if (!acc[orgName]) {
        acc[orgName] = { org: user.organization, users: [] };
      }
      acc[orgName].users.push(user);
      return acc;
    }, {} as OrgGroupType);

    res.json({
      organizations: Object.values(grouped),
    });
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
