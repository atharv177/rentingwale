import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = [
    { name: "Black Designer Suit", category: "Clothing", dailyRate: 1500, securityDeposit: 3000, quantity: 3, condition: "Premium / Clean" },
    { name: "Mirrorless Camera Kit", category: "Electronics", dailyRate: 2200, securityDeposit: 8000, quantity: 4, condition: "Excellent" },
    { name: "Temple Jewellery Set", category: "Jewellery", dailyRate: 900, securityDeposit: 2500, quantity: 6, condition: "Very good" },
    { name: "Event PA Speaker", category: "Equipment", dailyRate: 1800, securityDeposit: 5000, quantity: 2, condition: "Good" },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: product,
      create: product,
    });
  }

  const customers = [
    { name: "Aarav Patil", phone: "+91 98765 43210", email: "aarav@example.com" },
    { name: "Mira Joshi", phone: "+91 98765 43211", email: "mira@example.com" },
    { name: "Rohan Deshmukh", phone: "+91 98765 43212", email: "rohan@example.com" },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: customer,
      create: customer,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });