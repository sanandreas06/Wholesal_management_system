import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  const organization = await prisma.organization.upsert({
    where: { code: "WMS-DEMO" },
    update: {},
    create: {
      name: "Wholesale Management Demo",
      code: "WMS-DEMO",
      branches: {
        create: [
          { name: "Kumasi Central", code: "KSI-001", location: "Kumasi" },
          { name: "Accra Branch", code: "ACC-001", location: "Accra" },
          { name: "Tarkwa Branch", code: "TKW-001", location: "Tarkwa" }
        ]
      }
    },
    include: { branches: true }
  });

  const branches = organization.branches;
  const admin = await prisma.user.upsert({
    where: { email: "admin@wholesale.local" },
    update: { passwordHash, organizationId: organization.id },
    create: {
      organizationId: organization.id,
      branchId: branches[0].id,
      email: "admin@wholesale.local",
      name: "System Administrator",
      passwordHash
    }
  });

  const products = [
    ["RICE-001", "Premium Rice 25kg", "Rice", 280, 120],
    ["RICE-002", "Jasmine Rice 25kg", "Rice", 320, 80],
    ["OIL-001", "Vegetable Oil 5L", "Cooking Oil", 95, 45],
    ["DRY-001", "Wheat Flour 25kg", "Dry Goods", 190, 30],
    ["CAN-001", "Canned Tomatoes Carton", "Canned Goods", 145, 25],
    ["BEV-001", "Malt Drink Case", "Beverages", 110, 20]
  ];

  for (const [sku, name, category, unitPrice, stockQuantity] of products) {
    await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku } },
      update: { name, category, unitPrice, stockQuantity },
      create: { organizationId: organization.id, sku, name, category, unitPrice, stockQuantity }
    });
  }

  const dbProducts = await prisma.product.findMany({ where: { organizationId: organization.id }});
  if (await prisma.sale.count({ where: { organizationId: organization.id }}) === 0) {
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const soldAt = new Date(now);
      soldAt.setDate(now.getDate() - (13 - i));
      const product = dbProducts[i % dbProducts.length];
      const quantity = 2 + (i % 5);
      const totalAmount = Number(product.unitPrice) * quantity;
      await prisma.sale.create({
        data: {
          organizationId: organization.id,
          branchId: branches[i % branches.length].id,
          userId: admin.id,
          invoiceNumber: `INV-DEMO-${String(i + 1).padStart(4, "0")}`,
          totalAmount,
          soldAt,
          items: { create: { productId: product.id, quantity, unitPrice: product.unitPrice, lineTotal: totalAmount }}
        }
      });
    }
  }
  console.log("Phase 1 seed complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
