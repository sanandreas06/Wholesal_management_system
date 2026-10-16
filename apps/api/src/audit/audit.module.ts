import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditLogInterceptor } from "./audit-log.interceptor";
import { AuditSealService } from "./audit-seal";

@Module({
  controllers:[AuditController],
  providers:[AuditService, AuditSealService, { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
  exports:[AuditSealService]
})
export class AuditModule {}
