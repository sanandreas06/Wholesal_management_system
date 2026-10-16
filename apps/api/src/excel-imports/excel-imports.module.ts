import { Module } from "@nestjs/common";
import { ExcelImportsController } from "./excel-imports.controller";
import { ExcelImportsService } from "./excel-imports.service";
import { ProductAliasesController, ProductAliasesService } from "./product-aliases";

@Module({ controllers: [ExcelImportsController, ProductAliasesController], providers: [ExcelImportsService, ProductAliasesService] })
export class ExcelImportsModule {}
