import { ArgumentsHost, Catch, HttpException, HttpServer, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { MonitorService } from "../monitor/monitor";
import { Prisma } from "@prisma/client";

/** When the code is newer than the database (a table or column is missing because `pnpm db:push` was not run),
 *  say so plainly instead of a bare "Internal server error". Everything else is handled as usual. */
@Catch()
export class SchemaOutOfDateFilter extends BaseExceptionFilter {
  private readonly log = new Logger("Database");
  constructor(adapter?: HttpServer, private readonly monitor?: MonitorService) { super(adapter); }
  catch(e: unknown, host: ArgumentsHost) {
    // every server error (5xx, or anything that was not a deliberate answer) goes to the Platform monitor
    const status = e instanceof HttpException ? e.getStatus() : 500;
    if (status >= 500 && this.monitor) {
      const req = host.switchToHttp().getRequest<{ originalUrl?: string; url?: string; method?: string; headers?: Record<string, unknown>; user?: { sub?: string; organizationId?: string } }>();
      const err = e instanceof Error ? e : new Error(String(e));
      void this.monitor.capture({ source: "api", message: err.message, stack: err.stack, path: req?.originalUrl ?? req?.url, method: req?.method, status,
        userAgent: String(req?.headers?.["user-agent"] ?? ""), orgId: req?.user?.organizationId, userId: req?.user?.sub });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      this.log.error(`The database is older than the code (${e.code}: ${String(e.meta?.table ?? e.meta?.column ?? e.message).slice(0, 200)}). Run: pnpm db:generate, then pnpm db:push, then restart the API.`);
      const res = host.switchToHttp().getResponse<{ status(n: number): { json(b: unknown): void } }>();
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ statusCode: 503, message: "WHOLESTRA is finishing an update. Please try again in a few minutes." });
      return;
    }
    super.catch(e, host);
  }
}
