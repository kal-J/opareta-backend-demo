import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding currencies...');

    const currencies = ['UGX', 'USD'];
    for (const currency of currencies) {
        await prisma.currency.upsert({
            where: { name: currency },
            update: {},
            create: { name: currency },
        });
    }

    console.log('Seeded currencies:', currencies);

    console.log('Seeding payment provider...');
    const paymentProviders = [
        {
            name: 'MTN_UGANDA',
            payment_methods: [
                {
                    name: 'MOBILE_MONEY',
                    description: 'Mobile Money payment method',
                }
            ]
        }
    ];
    for (const paymentProvider of paymentProviders) {
        const provider = await prisma.paymentProvider.upsert({
            where: { name: paymentProvider.name },
            update: {},
            create: { name: paymentProvider.name },
        });
        for (const paymentMethod of paymentProvider.payment_methods) {
            await prisma.paymentMethod.upsert({
                where: { name: paymentMethod.name },
                update: {},
                create: { name: paymentMethod.name, description: paymentMethod.description, payment_provider_id: provider.id }
            });
        }
    }
    console.log('Seeded payment providers and payment methods:', paymentProviders);

    console.log('Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

