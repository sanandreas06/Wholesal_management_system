/** Our own contact details, shown on the public pages, the sign-in pages and at the bottom of every screen inside the app. Set them when building the site (Vercel → Settings → Environment Variables); a detail that is not set is simply not shown. */
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();
/** Digits only, with the country code, for example 233201234567. */
export const CONTACT_WHATSAPP = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");
/** A phone number to call, written the way people should see it, for example +233 20 123 4567. Falls back to the WhatsApp number. */
export const CONTACT_PHONE = (process.env.NEXT_PUBLIC_CONTACT_PHONE || (CONTACT_WHATSAPP ? `+${CONTACT_WHATSAPP}` : "")).trim();
/** When someone answers, for example "Mon to Sat, 8am to 6pm GMT". */
export const CONTACT_HOURS = (process.env.NEXT_PUBLIC_CONTACT_HOURS || "Monday to Saturday, 8am to 6pm (GMT)").trim();
/** Where we are, for example "Accra, Ghana". */
export const CONTACT_LOCATION = (process.env.NEXT_PUBLIC_CONTACT_LOCATION || "Accra, Ghana").trim();

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
export const whatsappHref = (text?: string) => CONTACT_WHATSAPP ? `https://wa.me/${CONTACT_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
export const hasContact = () => !!(CONTACT_EMAIL || CONTACT_WHATSAPP || CONTACT_PHONE);
