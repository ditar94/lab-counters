import { PrismaClient } from '@prisma/client';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const prisma = new PrismaClient();

// Cognito client for syncing real users
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2',
});

interface CognitoUser {
  cognitoId: string;
  username: string;
  email: string;
  name: string;
}

async function getCognitoUsers(): Promise<CognitoUser[]> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    console.log('  No COGNITO_USER_POOL_ID set, skipping Cognito sync');
    return [];
  }

  try {
    const users: CognitoUser[] = [];
    let paginationToken: string | undefined;

    do {
      const command = new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
        Limit: 60,
      });

      const result = await cognitoClient.send(command);

      for (const user of result.Users || []) {
        const getAttribute = (name: string) =>
          user.Attributes?.find((attr) => attr.Name === name)?.Value || '';

        users.push({
          cognitoId: getAttribute('sub'),
          username: user.Username || '',
          email: getAttribute('email'),
          name: getAttribute('name'),
        });
      }

      paginationToken = result.PaginationToken;
    } while (paginationToken);

    return users;
  } catch (error) {
    console.log('  Could not connect to Cognito:', (error as Error).message);
    return [];
  }
}

// Map of known email patterns to their org/role assignments
// Add your real email here to auto-restore after database reset
const KNOWN_USERS: Record<string, { orgSlug: string; siteId: string; role: string }> = {
  'dionicytt@gmail.com': { orgSlug: 'system', siteId: 'system-site', role: 'superadmin' },
};

async function main() {
  console.log('Seeding database...');

  // ============================================
  // System Organization (for superadmins)
  // ============================================
  const systemOrg = await prisma.organization.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'System',
      slug: 'system',
      settings: {},
    },
  });

  console.log('Created system organization');

  // Create system site for superadmins
  const systemSite = await prisma.site.upsert({
    where: { id: 'system-site' },
    update: {},
    create: {
      id: 'system-site',
      orgId: systemOrg.id,
      name: 'System',
      location: '',
    },
  });

  // Create superadmin user
  await prisma.user.upsert({
    where: { cognitoId: 'dev-superadmin' },
    update: {},
    create: {
      cognitoId: 'dev-superadmin',
      email: 'superadmin@cellcounter.io',
      name: 'Super Admin',
      orgId: systemOrg.id,
      siteId: systemSite.id,
      role: 'superadmin',
      status: 'active',
    },
  });

  const superadmin = await prisma.user.findUnique({ where: { cognitoId: 'dev-superadmin' } });
  if (superadmin) {
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: superadmin.id, siteId: systemSite.id } },
      update: {},
      create: { userId: superadmin.id, siteId: systemSite.id },
    });
  }

  console.log('Created superadmin user');

  // ============================================
  // Test Hospital #1 - General Hospital
  // ============================================
  const org1 = await prisma.organization.upsert({
    where: { slug: 'general-hospital' },
    update: {},
    create: {
      name: 'General Hospital',
      slug: 'general-hospital',
      settings: {
        timezone: 'America/New_York',
        defaultDilution: 10,
        requireVerification: true,
        allowSelfVerification: false,
      },
    },
  });

  console.log('Created organization:', org1.name);

  // Create sites for org1
  const org1Site1 = await prisma.site.upsert({
    where: { id: 'gh-main-lab' },
    update: {},
    create: {
      id: 'gh-main-lab',
      orgId: org1.id,
      name: 'Main Laboratory',
      location: 'Building A, Floor 2',
    },
  });

  const org1Site2 = await prisma.site.upsert({
    where: { id: 'gh-hematology' },
    update: {},
    create: {
      id: 'gh-hematology',
      orgId: org1.id,
      name: 'Hematology Lab',
      location: 'Building A, Floor 3',
    },
  });

  console.log('Created sites for General Hospital');

  // Create users for org1
  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-admin' },
    update: {},
    create: {
      cognitoId: 'dev-gh-admin',
      email: 'admin@general-hospital.com',
      name: 'Sarah Johnson',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-supervisor-1' },
    update: {},
    create: {
      cognitoId: 'dev-gh-supervisor-1',
      email: 'mjones@general-hospital.com',
      name: 'Michael Jones',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'supervisor',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-supervisor-2' },
    update: {},
    create: {
      cognitoId: 'dev-gh-supervisor-2',
      email: 'ewilliams@general-hospital.com',
      name: 'Emily Williams',
      orgId: org1.id,
      siteId: org1Site2.id,
      role: 'supervisor',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-tech-1' },
    update: {},
    create: {
      cognitoId: 'dev-gh-tech-1',
      email: 'dbrown@general-hospital.com',
      name: 'David Brown',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'technologist',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-tech-2' },
    update: {},
    create: {
      cognitoId: 'dev-gh-tech-2',
      email: 'lgarcia@general-hospital.com',
      name: 'Lisa Garcia',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'technologist',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-gh-tech-3' },
    update: {},
    create: {
      cognitoId: 'dev-gh-tech-3',
      email: 'rmartinez@general-hospital.com',
      name: 'Robert Martinez',
      orgId: org1.id,
      siteId: org1Site2.id,
      role: 'technologist',
      status: 'active',
    },
  });

  console.log('Created users for General Hospital');

  // Create UserSite entries for org1 users
  // Some users get access to both sites
  const org1Users = await prisma.user.findMany({ where: { orgId: org1.id } });
  for (const user of org1Users) {
    // Always add their primary site
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: user.id, siteId: user.siteId } },
      update: {},
      create: { userId: user.id, siteId: user.siteId },
    });

    // Admins and some supervisors get access to both sites
    if (user.role === 'admin' || user.cognitoId === 'dev-gh-supervisor-1') {
      const otherSite = user.siteId === org1Site1.id ? org1Site2.id : org1Site1.id;
      await prisma.userSite.upsert({
        where: { userId_siteId: { userId: user.id, siteId: otherSite } },
        update: {},
        create: { userId: user.id, siteId: otherSite },
      });
    }
  }

  console.log('Created site assignments for General Hospital users');

  // ============================================
  // Test Hospital #2 - City Medical Center
  // ============================================
  const org2 = await prisma.organization.upsert({
    where: { slug: 'city-medical' },
    update: {},
    create: {
      name: 'City Medical Center',
      slug: 'city-medical',
      settings: {
        timezone: 'America/Los_Angeles',
        defaultDilution: 20,
        requireVerification: true,
        allowSelfVerification: true,
      },
    },
  });

  console.log('Created organization:', org2.name);

  // Create site for org2
  const org2Site1 = await prisma.site.upsert({
    where: { id: 'cmc-lab' },
    update: {},
    create: {
      id: 'cmc-lab',
      orgId: org2.id,
      name: 'Clinical Laboratory',
      location: 'West Wing, Level B1',
    },
  });

  console.log('Created site for City Medical Center');

  // Create users for org2
  await prisma.user.upsert({
    where: { cognitoId: 'dev-cmc-admin' },
    update: {},
    create: {
      cognitoId: 'dev-cmc-admin',
      email: 'admin@citymedical.org',
      name: 'James Wilson',
      orgId: org2.id,
      siteId: org2Site1.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-cmc-supervisor-1' },
    update: {},
    create: {
      cognitoId: 'dev-cmc-supervisor-1',
      email: 'achen@citymedical.org',
      name: 'Amanda Chen',
      orgId: org2.id,
      siteId: org2Site1.id,
      role: 'supervisor',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-cmc-tech-1' },
    update: {},
    create: {
      cognitoId: 'dev-cmc-tech-1',
      email: 'klee@citymedical.org',
      name: 'Kevin Lee',
      orgId: org2.id,
      siteId: org2Site1.id,
      role: 'technologist',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-cmc-tech-2' },
    update: {},
    create: {
      cognitoId: 'dev-cmc-tech-2',
      email: 'npatel@citymedical.org',
      name: 'Nina Patel',
      orgId: org2.id,
      siteId: org2Site1.id,
      role: 'technologist',
      status: 'active',
    },
  });

  console.log('Created users for City Medical Center');

  // Create UserSite entries for org2 users
  const org2Users = await prisma.user.findMany({ where: { orgId: org2.id } });
  for (const user of org2Users) {
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: user.id, siteId: user.siteId } },
      update: {},
      create: { userId: user.id, siteId: user.siteId },
    });
  }

  console.log('Created site assignments for City Medical Center users');

  // ============================================
  // Legacy users (keep for backwards compatibility)
  // ============================================
  await prisma.user.upsert({
    where: { cognitoId: 'dev-admin' },
    update: {},
    create: {
      cognitoId: 'dev-admin',
      email: 'dev-admin@test.com',
      name: 'Dev Admin',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'admin',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-supervisor' },
    update: {},
    create: {
      cognitoId: 'dev-supervisor',
      email: 'dev-supervisor@test.com',
      name: 'Dev Supervisor',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'supervisor',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { cognitoId: 'dev-tech' },
    update: {},
    create: {
      cognitoId: 'dev-tech',
      email: 'dev-tech@test.com',
      name: 'Dev Technologist',
      orgId: org1.id,
      siteId: org1Site1.id,
      role: 'technologist',
      status: 'active',
    },
  });

  // Create UserSite entries for legacy users
  const legacyUsers = await prisma.user.findMany({
    where: { cognitoId: { in: ['dev-admin', 'dev-supervisor', 'dev-tech'] } },
  });
  for (const user of legacyUsers) {
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: user.id, siteId: user.siteId } },
      update: {},
      create: { userId: user.id, siteId: user.siteId },
    });
    // Legacy admin gets access to both sites
    if (user.role === 'admin') {
      await prisma.userSite.upsert({
        where: { userId_siteId: { userId: user.id, siteId: org1Site2.id } },
        update: {},
        create: { userId: user.id, siteId: org1Site2.id },
      });
    }
  }

  // ============================================
  // Sync real Cognito users
  // ============================================
  console.log('\nChecking for Cognito users to restore...');
  const cognitoUsers = await getCognitoUsers();

  if (cognitoUsers.length > 0) {
    console.log(`  Found ${cognitoUsers.length} users in Cognito`);

    for (const cognitoUser of cognitoUsers) {
      // Skip if user already exists in database
      const existing = await prisma.user.findUnique({
        where: { cognitoId: cognitoUser.cognitoId },
      });

      if (existing) {
        continue; // Already synced
      }

      // Check if this email is in our known users map
      const knownConfig = KNOWN_USERS[cognitoUser.email.toLowerCase()];

      if (knownConfig) {
        // Find the org by slug
        const org = await prisma.organization.findUnique({
          where: { slug: knownConfig.orgSlug },
        });

        if (org) {
          // Verify site exists
          const site = await prisma.site.findUnique({
            where: { id: knownConfig.siteId },
          });

          if (site) {
            const user = await prisma.user.create({
              data: {
                cognitoId: cognitoUser.cognitoId,
                username: cognitoUser.username,
                email: cognitoUser.email,
                name: cognitoUser.name || cognitoUser.email.split('@')[0],
                orgId: org.id,
                siteId: site.id,
                role: knownConfig.role,
                status: 'active',
              },
            });

            // Create UserSite entry
            await prisma.userSite.create({
              data: { userId: user.id, siteId: site.id },
            });

            console.log(`  ✅ Restored user: ${cognitoUser.email} as ${knownConfig.role}`);
          }
        }
      } else {
        console.log(`  ⚠️  Orphaned Cognito user: ${cognitoUser.email} (add to KNOWN_USERS to auto-restore)`);
      }
    }
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\nOrganizations:');
  console.log('  1. System (for superadmin)');
  console.log('  2. General Hospital (2 sites, 6 users)');
  console.log('  3. City Medical Center (1 site, 4 users)');
  console.log('\nUse the dev login picker to select a specific user.');
  console.log('\nTo auto-restore real Cognito users after reset, add their emails to KNOWN_USERS in seed.ts');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
