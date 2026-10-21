/** The people who run WHOLESTRA: PLATFORM_ADMINS is a comma-separated list of their emails.
 *  They may open the Platform monitor and System checks, and receive error alerts.
 *  When PLATFORM_ADMINS is not set, the Gmail address that sends the sign-in codes (MAIL_FROM) counts, so the owner is never locked out.
 *  Kept free of imports so any module can use it. */
export function platformAdmins(): string[] {
  const list = (process.env.PLATFORM_ADMINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length) return list;
  const from = (process.env.MAIL_FROM ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) ? [from] : [];
}
export const isPlatformAdmin = (email?: string | null) => !!email && platformAdmins().includes(email.trim().toLowerCase());
