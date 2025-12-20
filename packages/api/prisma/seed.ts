import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test organization
  const org = await prisma.organization.upsert({
    where: { slug: 'test-hospital' },
    update: {},
    create: {
      name: 'Test Hospital Laboratory',
      slug: 'test-hospital',
      settings: {
        timezone: 'America/New_York',
        defaultDilution: 10,
        requireVerification: true,
        allowSelfVerification: false,
      },
    },
  });

  console.log('Created organization:', org.name);

  // Create test site
  const site = await prisma.site.upsert({
    where: { id: 'test-site-1' },
    update: {},
    create: {
      id: 'test-site-1',
      orgId: org.id,
      name: 'Main Laboratory',
      location: 'Building A, Floor 2',
    },
  });

  console.log('Created site:', site.name);

  // Create test users
  const admin = await prisma.user.upsert({
    where: { cognitoId: 'dev-admin' },
    update: {},
    create: {
      cognitoId: 'dev-admin',
      email: 'admin@test-hospital.com',
      name: 'Admin User',
      orgId: org.id,
      siteId: site.id,
      role: 'admin',
      status: 'active',
    },
  });

  console.log('Created admin user:', admin.email);

  const supervisor = await prisma.user.upsert({
    where: { cognitoId: 'dev-supervisor' },
    update: {},
    create: {
      cognitoId: 'dev-supervisor',
      email: 'supervisor@test-hospital.com',
      name: 'Supervisor User',
      orgId: org.id,
      siteId: site.id,
      role: 'supervisor',
      status: 'active',
    },
  });

  console.log('Created supervisor user:', supervisor.email);

  const tech = await prisma.user.upsert({
    where: { cognitoId: 'dev-tech' },
    update: {},
    create: {
      cognitoId: 'dev-tech',
      email: 'tech@test-hospital.com',
      name: 'Lab Technologist',
      orgId: org.id,
      siteId: site.id,
      role: 'technologist',
      status: 'active',
    },
  });

  console.log('Created technologist user:', tech.email);

  console.log('\n✅ Database seeded successfully!');
  console.log('\nTest users:');
  console.log('  - admin@test-hospital.com (Admin)');
  console.log('  - supervisor@test-hospital.com (Supervisor)');
  console.log('  - tech@test-hospital.com (Technologist)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
