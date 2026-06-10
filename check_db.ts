import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.product.count();
        console.log('Product count:', count);

        if (count > 0) {
            const sample = await prisma.product.findFirst({
                where: { name: { contains: 'Egg', mode: 'insensitive' } }
            });
            console.log('Sample search for "Egg":', sample);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

export {};
