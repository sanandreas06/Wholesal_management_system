import { ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { checkSecrets } from "./common/secrets-check";
import { SchemaOutOfDateFilter } from "./common/schema-out-of-date.filter";
import { MonitorService } from "./monitor/monitor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // behind the web server (Caddy) the visitor's real address arrives in a header; only believe it when told we are behind one
  if (process.env.TRUST_PROXY === "true") (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set("trust proxy", 1);
  const config = app.get(ConfigService);
  // a weak or placeholder secret stops a real (production) server from starting; on a dev machine it only warns
  const secrets = checkSecrets(process.env);
  secrets.warnings.forEach((w) => console.warn(`[security] ${w}`));
  if (secrets.problems.length) {
    secrets.problems.forEach((p) => console.error(`[security] ${p}`));
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to start with weak secrets. See the messages above.");
  }
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new SchemaOutOfDateFilter(app.get(HttpAdapterHost).httpAdapter, app.get(MonitorService)));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // hosts such as Render tell the app which port to use through PORT
  await app.listen(Number(config.get("PORT") ?? config.get("API_PORT") ?? 4000), "0.0.0.0");
}
bootstrap();
