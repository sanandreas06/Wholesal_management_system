import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("JWT_SECRET") || "development-secret",
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    organizationId: string;
    branchId?: string | null;
  }) {
    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      branchId: payload.branchId ?? null,
    };
  }
}