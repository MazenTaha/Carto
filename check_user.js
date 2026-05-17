const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@gmail.com' },
    });
    console.log('User found:', user);
    
    // Test password verification
    if (user && user.password) {
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare('Admin_1', user.password);
      console.log('Password valid:', isValid);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
