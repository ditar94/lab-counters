/**
 * Link a Cognito user to an existing database user
 *
 * Usage: npx tsx scripts/link-cognito-user.ts <cognito-sub> <user-email>
 *
 * Example: npx tsx scripts/link-cognito-user.ts abc123-def456 superadmin@system.local
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [cognitoSub, email] = process.argv.slice(2);

  if (!cognitoSub || !email) {
    console.error('Usage: npx tsx scripts/link-cognito-user.ts <cognito-sub> <user-email>');
    console.error('');
    console.error('To find the cognito-sub:');
    console.error('  1. Go to AWS Console → Cognito → Your User Pool → Users');
    console.error('  2. Click on the user');
    console.error('  3. Copy the "Sub" value (User ID)');
    console.error('');
    console.error('Available users in database:');

    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true, cognitoId: true },
      orderBy: { role: 'asc' },
    });

    for (const user of users) {
      const linked = user.cognitoId.startsWith('dev-') ? '(dev)' : '(linked)';
      console.error(`  - ${user.email} [${user.role}] ${linked}`);
    }

    process.exit(1);
  }

  // Find the user by email
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.error(`User not found with email: ${email}`);
    process.exit(1);
  }

  // Update the cognitoId
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { cognitoId: cognitoSub },
  });

  console.log(`Successfully linked Cognito user to database user:`);
  console.log(`  Name: ${updated.name}`);
  console.log(`  Email: ${updated.email}`);
  console.log(`  Role: ${updated.role}`);
  console.log(`  Cognito Sub: ${updated.cognitoId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
