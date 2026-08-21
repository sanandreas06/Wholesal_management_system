import { Controller, Get } from "@nestjs/common";
@Controller("health")
export class HealthController {
  @Get() health() { return { status: "ok", service: "wms-api", timestamp: new Date().toISOString() }; }
}
