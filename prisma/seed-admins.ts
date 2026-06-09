const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAdminPassword() {
  return process.env.ADMIN_SEED_PASSWORD?.trim() || '';
}

function buildAdminName(email) {
  const localPart = email.split('@')[0] || 'Admin';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Admin';
}

async function main() {
  const adminEmails = getAdminEmails();
  const adminPassword = getAdminPassword();

  if (adminEmails.length === 0) {
    throw new Error('ADMIN_EMAILS is empty. Add at least one admin email before running this script.');
  }

  if (!adminPassword) {
    throw new Error('ADMIN_SEED_PASSWORD is missing. Set a real password before running this script.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: {
        password: passwordHash,
        name: buildAdminName(email),
      },
      create: {
        email,
        password: passwordHash,
        name: buildAdminName(email),
      },
    });
  }

  console.log(`Admin accounts ready: ${adminEmails.join(', ')}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
