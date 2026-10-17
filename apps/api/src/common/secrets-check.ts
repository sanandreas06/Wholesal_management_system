/** Looks at the secrets the API starts with. Pure, so it can be tested without starting anything. */
export interface SecretsReport { problems: string[]; warnings: string[] }

const WEAK = /change-this|development-secret|^secret$|^password$|^changeme/i;

export function isStrong(value: string | undefined): boolean {
  return !!value && value.length >= 32 && !WEAK.test(value);
}

export function checkSecrets(env: Record<string, string | undefined>): SecretsReport {
  const problems: string[] = [], warnings: string[] = [];
  if (!isStrong(env.JWT_SECRET)) problems.push("JWT_SECRET is missing, too short (under 32 characters) or still the placeholder. Anyone who knows it can sign in as anybody. Run `pnpm secrets:set`.");
  if (env.AUDIT_SEAL_KEY === undefined || env.AUDIT_SEAL_KEY === "") warnings.push("AUDIT_SEAL_KEY is not set, so the Change log is sealed with JWT_SECRET. Run `pnpm secrets:set` to give it its own key.");
  else if (!isStrong(env.AUDIT_SEAL_KEY)) problems.push("AUDIT_SEAL_KEY is too short or a placeholder. Run `pnpm secrets:set`.");
  if (env.AUDIT_SEAL_KEY_OLD) warnings.push("AUDIT_SEAL_KEY_OLD is still in .env: the Change log has not been carried over to the new key, so it will show as NOT intact until you run `pnpm audit:rotate-key` (API stopped).");
  const mailReady = (env.MAIL_PROVIDER === "brevo" || env.MAIL_PROVIDER === "resend") && !!env.MAIL_API_KEY && !!env.MAIL_FROM;
  if (env.OTP_DEV_ECHO === "true" && env.NODE_ENV === "production") warnings.push("OTP_DEV_ECHO is on: sign-in and sign-up codes are shown on screen instead of being emailed, so an email address is not really proven. Use it only to try things out, then set up email (MAIL_PROVIDER, MAIL_API_KEY, MAIL_FROM) and remove OTP_DEV_ECHO.");
  else if (!mailReady && env.OTP_DEV_ECHO !== "true") warnings.push("Email is not set up (MAIL_PROVIDER, MAIL_API_KEY, MAIL_FROM), so sign-in works with email and password only and new companies can sign up only with Google, Facebook or LinkedIn.");
  if (env.PLATFORM_ADMIN_KEY && env.PLATFORM_ADMIN_KEY.length < 24) warnings.push("PLATFORM_ADMIN_KEY is shorter than 24 characters, so the referral admin endpoints stay switched off.");
  return { problems, warnings };
}
