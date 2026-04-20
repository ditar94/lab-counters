import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('Checking for dev users in the database...');
  const devUsers = await prisma.user.findMany({
    where: {
      cognitoId: { startsWith: 'dev-' },
    },
  });
  console.log(`Found ${devUsers.length} dev users:`);
  console.log(devUsers);
}

check()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
