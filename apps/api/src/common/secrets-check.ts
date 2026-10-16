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
  return { problems, warnings };
}
