import { base32Decode, base32Encode, decryptSecret, encryptSecret, generateRecoveryCodes, generateSecret, hashRecovery, hotp, keyFrom, normaliseRecovery, otpauthUri, totp, verifyTotp } from "../src/auth/totp";

// RFC 6238 appendix B test vectors (SHA-1, 8 digits) with the shared secret "12345678901234567890".
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const VECTORS: [number, string][] = [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]];

describe("TOTP (RFC 6238)", () => {
  it.each(VECTORS)("matches the RFC vector at T=%i", (t, expected) => {
    expect(hotp(base32Decode(SECRET), Math.floor(t / 30), 8)).toBe(expected);
  });

  it("base32 round-trips", () => {
    const s = generateSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(base32Decode(SECRET).toString()).toBe("12345678901234567890");
  });

  it("accepts the current code and one step either side, but not further", () => {
    const now = 1_700_000_000_000;
    const step = 30_000;
    const cur = totp(SECRET, now);
    expect(verifyTotp(SECRET, cur, now)).not.toBeNull();
    expect(verifyTotp(SECRET, totp(SECRET, now - step), now)).not.toBeNull();
    expect(verifyTotp(SECRET, totp(SECRET, now + step), now)).not.toBeNull();
    expect(verifyTotp(SECRET, totp(SECRET, now - 3 * step), now)).toBeNull();
  });

  it("rejects malformed codes", () => {
    for (const bad of ["", "12345", "abcdef", "1234567"]) expect(verifyTotp(SECRET, bad)).toBeNull();
  });

  it("builds an otpauth link an authenticator app understands", () => {
    const u = otpauthUri({ secret: SECRET, account: "a@b.com", issuer: "WHOLESTRA" });
    expect(u.startsWith("otpauth://totp/")).toBe(true);
    expect(u).toContain("secret=" + SECRET);
    expect(u).toContain("issuer=WHOLESTRA");
  });
});

describe("secret encryption", () => {
  const key = keyFrom("jwt-secret-for-tests", "totp");
  it("round-trips and is not deterministic", () => {
    const a = encryptSecret(SECRET, key), b = encryptSecret(SECRET, key);
    expect(a).not.toBe(b);
    expect(a).not.toContain(SECRET);
    expect(decryptSecret(a, key)).toBe(SECRET);
  });
  it("fails with the wrong key or a tampered blob", () => {
    const blob = encryptSecret(SECRET, key);
    expect(() => decryptSecret(blob, keyFrom("other", "totp"))).toThrow();
    const raw = Buffer.from(blob, "base64"); raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret(raw.toString("base64"), key)).toThrow();
  });
});

describe("recovery codes", () => {
  it("makes unique, well-formed codes that hash the same however they are typed", () => {
    const codes = generateRecoveryCodes(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) {
      expect(c).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
      expect(hashRecovery(c.toUpperCase())).toBe(hashRecovery(c));
      expect(hashRecovery(c.replace("-", " "))).toBe(hashRecovery(c));
      expect(normaliseRecovery(c)).toHaveLength(10);
    }
  });
});
