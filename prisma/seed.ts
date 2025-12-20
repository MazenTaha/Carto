
const { PrismaClient } = require('@prisma/client')
require('dotenv').config()

const prisma = new PrismaClient()

// Categories to fetch from Open Food Facts
const CATEGORIES = [
    'dairies',
    'beverages',
    'meats',
    'seafood',
    'fresh-fruits',
    'fresh-vegetables',
    'breads',
    'snacks',
    'frozen-foods',
    'condiments'
]

// Map categories to emojis
function getEmojiForCategory(category: string) {
    if (category.includes('dairies') || category.includes('milk') || category.includes('cheese')) return '🧀';
    if (category.includes('beverage') || category.includes('drink')) return '🥤';
    if (category.includes('meat') || category.includes('poultry')) return '🥩';
    if (category.includes('seafood') || category.includes('fish')) return '🐟';
    if (category.includes('fruit')) return '🍎';
    if (category.includes('vegetable') || category.includes('plant')) return '🥦';
    if (category.includes('bread') || category.includes('bakery')) return '🍞';
    if (category.includes('snack') || category.includes('sweet')) return '🍪';
    if (category.includes('frozen') || category.includes('ice-cream')) return '🍦';
    if (category.includes('condiment') || category.includes('sauce')) return '🥫';
    return '📦';
}

function cleanName(name: string) {
    if (!name) return 'Unknown Product';
    // Remove brand names if possible or just keep it simple
    return name.split(',')[0].trim();
}

async function fetchCategory(category: string) {
    try {
        console.log(`Fetching ${category}...`)
        // Using native fetch which is available in Node 18+
        const url = `https://world.openfoodfacts.org/category/${category}.json?page_size=25&fields=product_name,categories_tags,image_front_small_url`
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Failed to fetch ${category}: ${response.statusText}`)
        }

        const data = await response.json()
        return data.products || []
    } catch (error) {
        console.error(`Error fetching category ${category}:`, error)
        return []
    }
}

async function main() {
    console.log('Start seeding products from Open Food Facts...')

    let count = 0

    for (const category of CATEGORIES) {
        const products = await fetchCategory(category)

        for (const item of products) {
            if (!item.product_name) continue

            const name = cleanName(item.product_name)
            // Check for duplicates
            const existing = await prisma.product.findFirst({
                where: { name: { equals: name, mode: 'insensitive' } }
            })

            if (!existing) {
                await prisma.product.create({
                    data: {
                        name: name,
                        category: category.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                        emoji: getEmojiForCategory(category),
                        price: Number((Math.random() * 10 + 1).toFixed(2)),
                        popularity: Math.floor(Math.random() * 100)
                    }
                })
                count++
                // console.log(`Added ${name}`)
            }
        }
    }

    console.log(`Seeding finished. Added ${count} new products.`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
