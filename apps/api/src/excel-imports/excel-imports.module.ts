import { Module } from "@nestjs/common";
import { ExcelImportsController } from "./excel-imports.controller";
import { ExcelImportsService } from "./excel-imports.service";

@Module({ controllers: [ExcelImportsController], providers: [ExcelImportsService] })
export class ExcelImportsModule {}
