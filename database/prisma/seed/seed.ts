import { PrismaClient, PermissionAction, RoleStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  // ============================================================
  // ORGANIZATION
  // ============================================================

  const organization = await prisma.organization.upsert({
    where: { code: "WMS-DEMO" },
    update: {},
    create: {
      name: "Wholesale Management Demo",
      code: "WMS-DEMO",
    },
  });

  // ============================================================
  // REGIONS
  // ============================================================

  const ashantiRegion = await prisma.region.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "ASH",
      },
    },
    update: {
      name: "Ashanti Region",
      description: "Ashanti regional operations",
      status: RoleStatus.ACTIVE,
    },
    create: {
      organizationId: organization.id,
      name: "Ashanti Region",
      code: "ASH",
      description: "Ashanti regional operations",
      status: RoleStatus.ACTIVE,
    },
  });

  const greaterAccraRegion = await prisma.region.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "GAR",
      },
    },
    update: {
      name: "Greater Accra Region",
      description: "Greater Accra regional operations",
      status: RoleStatus.ACTIVE,
    },
    create: {
      organizationId: organization.id,
      name: "Greater Accra Region",
      code: "GAR",
      description: "Greater Accra regional operations",
      status: RoleStatus.ACTIVE,
    },
  });

  const westernRegion = await prisma.region.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "WR",
      },
    },
    update: {
      name: "Western Region",
      description: "Western regional operations",
      status: RoleStatus.ACTIVE,
    },
    create: {
      organizationId: organization.id,
      name: "Western Region",
      code: "WR",
      description: "Western regional operations",
      status: RoleStatus.ACTIVE,
    },
  });

  // ============================================================
  // BRANCHES
  // ============================================================

  const branchDefinitions = [
    {
      name: "Kumasi Central",
      code: "KSI-001",
      location: "Kumasi",
      regionId: ashantiRegion.id,
    },
    {
      name: "Accra Branch",
      code: "ACC-001",
      location: "Accra",
      regionId: greaterAccraRegion.id,
    },
    {
      name: "Tarkwa Branch",
      code: "TKW-001",
      location: "Tarkwa",
      regionId: westernRegion.id,
    },
  ];

  const branches = [];

  for (const branch of branchDefinitions) {
    const result = await prisma.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: branch.code,
        },
      },
      update: {
        name: branch.name,
        location: branch.location,
        regionId: branch.regionId,
      },
      create: {
        organizationId: organization.id,
        name: branch.name,
        code: branch.code,
        location: branch.location,
        regionId: branch.regionId,
      },
    });

    branches.push(result);
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================

  const permissionDefinitions = [
    ["ORGANIZATION", PermissionAction.READ],
    ["ORGANIZATION", PermissionAction.UPDATE],

    ["REGIONS", PermissionAction.READ],
    ["REGIONS", PermissionAction.CREATE],
    ["REGIONS", PermissionAction.UPDATE],
    ["REGIONS", PermissionAction.DELETE],

    ["BRANCHES", PermissionAction.READ],
    ["BRANCHES", PermissionAction.CREATE],
    ["BRANCHES", PermissionAction.UPDATE],
    ["BRANCHES", PermissionAction.DELETE],

    ["USERS", PermissionAction.READ],
    ["USERS", PermissionAction.CREATE],
    ["USERS", PermissionAction.UPDATE],
    ["USERS", PermissionAction.DELETE],

    ["ROLES", PermissionAction.READ],
    ["ROLES", PermissionAction.CREATE],
    ["ROLES", PermissionAction.UPDATE],
    ["ROLES", PermissionAction.DELETE],

    ["PERMISSIONS", PermissionAction.READ],

    ["PRODUCTS", PermissionAction.READ],
    ["PRODUCTS", PermissionAction.CREATE],
    ["PRODUCTS", PermissionAction.UPDATE],
    ["PRODUCTS", PermissionAction.DELETE],

    ["INVENTORY", PermissionAction.READ],
    ["INVENTORY", PermissionAction.CREATE],
    ["INVENTORY", PermissionAction.UPDATE],

    ["SALES", PermissionAction.READ],
    ["SALES", PermissionAction.CREATE],
    ["SALES", PermissionAction.UPDATE],

    ["REPORTS", PermissionAction.READ],
    ["REPORTS", PermissionAction.EXPORT],
  ] as const;

  const permissions = [];

  for (const [resource, action] of permissionDefinitions) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource,
          action,
        },
      },
      update: {},
      create: {
        resource,
        action,
        description: `${action} access to ${resource}`,
      },
    });

    permissions.push(permission);
  }

  // ============================================================
  // ROLES
  // ============================================================

  const roleDefinitions = [
    {
      name: "Super Administrator",
      code: "SUPER_ADMIN",
      description: "Full system access",
    },
    {
      name: "Organization Administrator",
      code: "ORGANIZATION_ADMIN",
      description: "Organization-wide administrative access",
    },
    {
      name: "Regional Manager",
      code: "REGIONAL_MANAGER",
      description: "Manages assigned regional operations",
    },
    {
      name: "Branch Manager",
      code: "BRANCH_MANAGER",
      description: "Manages assigned branch operations",
    },
    {
      name: "Sales User",
      code: "SALES_USER",
      description: "Handles sales operations",
    },
    {
      name: "Inventory User",
      code: "INVENTORY_USER",
      description: "Handles inventory operations",
    },
  ];

  const roles = [];

  for (const roleDefinition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: roleDefinition.code,
        },
      },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        status: RoleStatus.ACTIVE,
      },
      create: {
        organizationId: organization.id,
        name: roleDefinition.name,
        code: roleDefinition.code,
        description: roleDefinition.description,
        status: RoleStatus.ACTIVE,
      },
    });

    roles.push(role);
  }

  // ============================================================
  // SUPER ADMIN → ALL PERMISSIONS
  // ============================================================

  const superAdminRole = roles.find(
    (role) => role.code === "SUPER_ADMIN",
  );

  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role was not created.");
  }

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // ============================================================
  // ORGANIZATION ADMIN
  // ============================================================

  const organizationAdminRole = roles.find(
    (role) => role.code === "ORGANIZATION_ADMIN",
  );

  if (!organizationAdminRole) {
    throw new Error("ORGANIZATION_ADMIN role was not created.");
  }

  const organizationAdminResources = [
  "ORGANIZATION",
  "REGIONS",
  "BRANCHES",
  "USERS",
  "ROLES",
  "PERMISSIONS",
  "PRODUCTS",
  "INVENTORY",
  "SALES",
  "REPORTS",
];

  for (const permission of permissions) {
    if (organizationAdminResources.includes(permission.resource)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: organizationAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: organizationAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // ============================================================
  // ADMIN USER
  // ============================================================

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@wholesale.local",
    },
    update: {
      passwordHash,
      organizationId: organization.id,
      branchId: branches[0].id,
    },
    create: {
      organizationId: organization.id,
      branchId: branches[0].id,
      email: "admin@wholesale.local",
      name: "System Administrator",
      passwordHash,
    },
  });

  // Assign SUPER_ADMIN to admin
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: superAdminRole.id,
    },
  });

  // ============================================================
  // PRODUCTS
  // ============================================================

  const products = [
  {
    sku: "RICE-001",
    name: "Premium Rice 25kg",
    category: "Rice",
    unitPrice: 280,
    stockQuantity: 120,
  },
  {
    sku: "RICE-002",
    name: "Jasmine Rice 25kg",
    category: "Rice",
    unitPrice: 320,
    stockQuantity: 80,
  },
  {
    sku: "OIL-001",
    name: "Vegetable Oil 5L",
    category: "Cooking Oil",
    unitPrice: 95,
    stockQuantity: 45,
  },
  {
    sku: "DRY-001",
    name: "Wheat Flour 25kg",
    category: "Dry Goods",
    unitPrice: 190,
    stockQuantity: 30,
  },
  {
    sku: "CAN-001",
    name: "Canned Tomatoes Carton",
    category: "Canned Goods",
    unitPrice: 145,
    stockQuantity: 25,
  },
  {
    sku: "BEV-001",
    name: "Malt Drink Case",
    category: "Beverages",
    unitPrice: 110,
    stockQuantity: 20,
  },
];

  for (const product of products) {
  await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: organization.id,
        sku: product.sku,
      },
    },
    update: {
      name: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      stockQuantity: product.stockQuantity,
    },
    create: {
      organizationId: organization.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      stockQuantity: product.stockQuantity,
    },
  });
}

  // ============================================================
  // DEMO SALES
  // ============================================================

  const dbProducts = await prisma.product.findMany({
    where: {
      organizationId: organization.id,
    },
  });

  if (
    (await prisma.sale.count({
      where: {
        organizationId: organization.id,
      },
    })) === 0
  ) {
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
          items: {
            create: {
              productId: product.id,
              quantity,
              unitPrice: product.unitPrice,
              lineTotal: totalAmount,
            },
          },
        },
      });
    }
  }

  console.log("Phase 2 Batch 1 seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());