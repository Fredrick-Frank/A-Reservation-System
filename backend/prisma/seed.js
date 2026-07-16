import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.preorderedFood.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.space.deleteMany({});
  await prisma.menuItem.deleteMany({});

  const space1 = await prisma.space.create({
    data: { name: "Seat Sequence A-1", type: "Counter", capacity: 1, pricePerHour: 50.00 }
  });
  const space2 = await prisma.space.create({
    data: { name: "Seat Sequence A-2", type: "Counter", capacity: 1, pricePerHour: 50.00 }
  });
  const space3 = await prisma.space.create({
    data: { name: "Chamber Table 04", type: "Private Alcove", capacity: 4, pricePerHour: 150.00 }
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Monolithic Broth", description: "Infused with charred cedar", price: 24.00, category: "starters" },
      { name: "Raw Aged Beef Ribbon", description: "Cured with sea salt crystals", price: 42.00, category: "mains" },
      { name: "Fermented Plum Tonic", description: "Still water companion", price: 14.00, category: "drinks" }
    ]
  });

  console.log("Database seeded successfully.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });