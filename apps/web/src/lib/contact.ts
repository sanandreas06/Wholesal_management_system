/** Where "Get started" and "Contact" messages go. Set these when building the site (Vercel → Settings → Environment Variables); nothing is shown or sent until they are. */
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();
/** Digits only, with the country code, for example 233201234567. */
export const CONTACT_WHATSAPP = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");
