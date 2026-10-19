import { BadRequestException } from "@nestjs/common";
import { promises as dns } from "dns";

/** Checks that an email address can really receive mail before we send a code or say "no account":
 *   1. the shape: name@domain.tld, with a real-looking ending (letters only, 2 to 24 of them);
 *   2. the domain exists and accepts mail (it has mail servers, or at least an address, and has not declared "no mail").
 *  If our own DNS lookups are not working (checked against a domain that always exists), the address is let through,
 *  so a network hiccup never locks people out. EMAIL_DOMAIN_CHECK=off (and automated tests) skip step 2. Answers are remembered for an hour. */

const SHAPE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
const RESERVED = /\.(test|example|invalid|localhost|local)$|^example\.(com|net|org)$/i;
const cache = new Map<string, { ok: boolean; at: number }>();
const HOUR = 3_600_000;

function within<T>(p: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms))]);
}

/** true = accepts mail, false = does not exist or refuses mail, null = could not tell. */
async function domainAcceptsMail(domain: string): Promise<boolean | null> {
  try {
    const mx = await within(dns.resolveMx(domain));
    if (mx.length === 0) return false;
    return !(mx.length === 1 && (mx[0].exchange === "" || mx[0].exchange === ".")); // "null MX": the domain says it takes no mail
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENODATA") {
      // no mail servers listed: mail still goes to the domain's own address, if it has one
      try { await within(dns.resolve4(domain)); return true; } catch { /* try IPv6 */ }
      try { await within(dns.resolve6(domain)); return true; } catch { return false; }
    }
    if (code === "ENOTFOUND") return false;
    return null;
  }
}

let resolverOk: { ok: boolean; at: number } | null = null;
async function resolverWorks() {
  if (resolverOk && Date.now() - resolverOk.at < 10 * 60_000) return resolverOk.ok;
  const ok = (await domainAcceptsMail("gmail.com")) === true;
  resolverOk = { ok, at: Date.now() };
  return ok;
}

export async function assertRealEmail(raw: string) {
  const email = String(raw ?? "").trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (!SHAPE.test(email) || domain.includes("..")) throw bad("This email address does not look right. Check it and try again, for example name@gmail.com.");
  // automated tests use reserved domains such as example.com, so the domain checks are skipped there
  if ((process.env.EMAIL_DOMAIN_CHECK ?? "").toLowerCase() === "off" || process.env.NODE_ENV === "test") return;
  if (RESERVED.test(domain)) throw bad(`"${domain}" is not a real email domain. Please use an address you can open.`);
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < HOUR) { if (!hit.ok) throw noDomain(domain); return; }
  const ok = await domainAcceptsMail(domain);
  if (ok === false && (await resolverWorks())) { cache.set(domain, { ok: false, at: Date.now() }); throw noDomain(domain); }
  if (ok === true) cache.set(domain, { ok: true, at: Date.now() });
}

const bad = (message: string) => new BadRequestException({ statusCode: 400, error: "BAD_EMAIL", message });
const noDomain = (d: string) => bad(`We could not find the email domain "${d}", so no email can reach it. Check the spelling after the @.`);
