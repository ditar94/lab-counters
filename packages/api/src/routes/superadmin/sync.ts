import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { listCognitoUsers, CognitoUserInfo } from '../../services/cognito';

export const syncRouter = Router();

interface OrphanedUser extends CognitoUserInfo {
  isOrphaned: boolean;
}

// List Cognito users with their sync status
syncRouter.get('/cognito-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all Cognito users
    const cognitoUsers = await listCognitoUsers();

    // Get all database users with their cognitoIds
    const dbUsers = await prisma.user.findMany({
      select: { cognitoId: true },
    });

    const dbCognitoIds = new Set(dbUsers.map((u) => u.cognitoId));

    // Mark orphaned users
    const usersWithStatus: OrphanedUser[] = cognitoUsers.map((user) => ({
      ...user,
      isOrphaned: !dbCognitoIds.has(user.cognitoId),
    }));

    // Return orphaned users first, then synced users
    const sorted = usersWithStatus.sort((a, b) => {
      if (a.isOrphaned && !b.isOrphaned) return -1;
      if (!a.isOrphaned && b.isOrphaned) return 1;
      return a.email.localeCompare(b.email);
    });

    res.json({
      total: sorted.length,
      orphaned: sorted.filter((u) => u.isOrphaned).length,
      synced: sorted.filter((u) => !u.isOrphaned).length,
      users: sorted,
    });
  } catch (error) {
    next(error);
  }
});

// Import an orphaned Cognito user into the database
syncRouter.post('/import-user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cognitoId, orgId, siteId, role } = req.body;

    if (!cognitoId || !orgId || !siteId || !role) {
      throw new AppError(400, 'MISSING_FIELDS', 'cognitoId, orgId, siteId, and role are required');
    }

    // Validate role
    const validRoles = ['admin', 'supervisor', 'technologist', 'readonly'];
    if (!validRoles.includes(role)) {
      throw new AppError(400, 'INVALID_ROLE', `Role must be one of: ${validRoles.join(', ')}`);
    }

    // Verify org exists and is not system
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    }

    if (org.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot import users into system organization');
    }

    // Verify site belongs to org
    const site = await prisma.site.findFirst({
      where: { id: siteId, orgId },
    });

    if (!site) {
      throw new AppError(400, 'INVALID_SITE', 'Site not found in this organization');
    }

    // Check if user already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { cognitoId },
    });

    if (existingUser) {
      throw new AppError(400, 'USER_EXISTS', 'User already exists in database');
    }

    // Get user info from Cognito
    const cognitoUsers = await listCognitoUsers();
    const cognitoUser = cognitoUsers.find((u) => u.cognitoId === cognitoId);

    if (!cognitoUser) {
      throw new AppError(404, 'COGNITO_USER_NOT_FOUND', 'User not found in Cognito');
    }

    // Check if email/username already exists
    const duplicateCheck = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cognitoUser.email },
          { username: cognitoUser.username },
        ],
      },
    });

    if (duplicateCheck) {
      throw new AppError(400, 'DUPLICATE_USER', 'A user with this email or username already exists');
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        cognitoId: cognitoUser.cognitoId,
        username: cognitoUser.username,
        email: cognitoUser.email,
        name: cognitoUser.name || cognitoUser.email.split('@')[0],
        orgId,
        siteId,
        role,
        status: 'active', // They already confirmed their Cognito account
      },
      include: {
        organization: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});
