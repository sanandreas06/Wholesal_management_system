import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { checkSecrets } from "./common/secrets-check";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  // a weak or placeholder secret stops a real (production) server from starting; on a dev machine it only warns
  const secrets = checkSecrets(process.env);
  secrets.warnings.forEach((w) => console.warn(`[security] ${w}`));
  if (secrets.problems.length) {
    secrets.problems.forEach((p) => console.error(`[security] ${p}`));
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to start with weak secrets. See the messages above.");
  }
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(config.get<number>("API_PORT") ?? 4000);
}
bootstrap();
