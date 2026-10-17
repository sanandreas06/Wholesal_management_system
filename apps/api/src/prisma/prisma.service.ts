import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

/** Big text columns (product pictures) are left out of every query unless a query asks for them, so lists, sales and stock screens stay light. */
export const PRISMA_OPTIONS = { omit: { product: { imageUrl: true } } } satisfies Prisma.PrismaClientOptions;

@Injectable()
export class PrismaService extends PrismaClient<typeof PRISMA_OPTIONS> implements OnModuleInit, OnModuleDestroy {
  constructor() { super(PRISMA_OPTIONS); }
  async onModuleInit(){ await this.$connect(); }
  async onModuleDestroy(){ await this.$disconnect(); }
}
