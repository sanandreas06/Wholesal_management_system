import { ArgumentsHost, Catch, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Prisma } from "@prisma/client";

/** When the code is newer than the database (a table or column is missing because `pnpm db:push` was not run),
 *  say so plainly instead of a bare "Internal server error". Everything else is handled as usual. */
@Catch()
export class SchemaOutOfDateFilter extends BaseExceptionFilter {
  private readonly log = new Logger("Database");
  catch(e: unknown, host: ArgumentsHost) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      this.log.error(`The database is older than the code (${e.code}: ${String(e.meta?.table ?? e.meta?.column ?? e.message).slice(0, 200)}). Run: pnpm db:generate, then pnpm db:push, then restart the API.`);
      const res = host.switchToHttp().getResponse<{ status(n: number): { json(b: unknown): void } }>();
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ statusCode: 503, message: "The database needs updating. Run pnpm db:push on the server, then restart it." });
      return;
    }
    super.catch(e, host);
  }
}
