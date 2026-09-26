import { PrismaClient, UserRole } from '@prisma/client';

/** Usage: node dist/cli/promote-user.js <email> [EDITOR|ADMIN] — bootstraps the first admin. */
async function main(): Promise<void> {
  const [email, role = 'ADMIN'] = process.argv.slice(2);

  if (!email || !(role in UserRole)) {
    throw new Error('Usage: promote-user <email> [TRAVELLER|EDITOR|ADMIN]');
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { role: role as UserRole },
      select: { email: true, role: true }
    });
    console.log(`${user.email} is now ${user.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
