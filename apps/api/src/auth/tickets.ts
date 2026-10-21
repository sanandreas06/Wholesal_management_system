import { BadRequestException, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { keyFrom } from "./totp";

/** "device": this browser passed the authenticator check recently, so it is not asked again for a few hours */
export type TicketType = "email" | "mfa" | "oauth" | "oauth-state" | "device" | "reset";
export interface Ticket { typ: TicketType; [k: string]: unknown }

/**
 * Short-lived signed notes the server hands the browser between sign-in steps ("this email is confirmed", "this person still owes an authenticator code").
 * They are signed with a key derived from JWT_SECRET but different from it, so a ticket can never be used as a sign-in token.
 */
@Injectable()
export class TicketService {
  private readonly secret: string;
  private readonly used = new Map<string, number>();
  constructor(private readonly jwt: JwtService, config: ConfigService) {
    const base = config.get<string>("JWT_SECRET") || "development-secret";
    this.secret = createHash("sha256").update(`wms-ticket:${base}`).digest("hex");
  }
  /** Key for things kept in the database (authenticator secrets, email-code fingerprints). Derived from the same server secret. */
  keyFor(label: string): Buffer { return keyFrom(this.secret, label); }

  sign(payload: Ticket, expiresInSeconds: number): Promise<string> {
    return this.jwt.signAsync({ ...payload }, { secret: this.secret, expiresIn: expiresInSeconds });
  }
  async verify<T extends Ticket>(token: string, typ: TicketType, message = "That step has expired. Please start again."): Promise<T> {
    let p: T & { exp?: number };
    try { p = await this.jwt.verifyAsync<T & { exp?: number }>(token, { secret: this.secret }); } catch { throw new BadRequestException(message); }
    if (p.typ !== typ) throw new BadRequestException(message);
    return p;
  }
  /** Marks a one-use ticket as spent. Returns false if it was already used. Remembered only until it would have expired anyway. */
  spend(token: string, ttlSeconds = 600): boolean {
    const now = Date.now();
    for (const [k, t] of this.used) if (t < now) this.used.delete(k);
    const id = createHash("sha256").update(token).digest("hex");
    if (this.used.has(id)) return false;
    this.used.set(id, now + ttlSeconds * 1000);
    return true;
  }
}
