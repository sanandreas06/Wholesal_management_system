/** Our own contact details, shown on the public pages, the sign-in pages and at the bottom of every screen inside the app.
 *  The values below are WHOLESTRA's; they can be replaced when building the site (Vercel → Settings → Environment Variables). */
const list = (v: string) => v.split(/[|,;]/).map((x) => x.trim()).filter(Boolean);

export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || "sanshubster@gmail.com").trim();
/** Phone numbers to call, written the way people should see them. Several can be given, separated by | */
export const CONTACT_PHONES = list(process.env.NEXT_PUBLIC_CONTACT_PHONE || "+233 50 989 8272 | +233 54 301 6993");
/** The first number, for places with room for only one. */
export const CONTACT_PHONE = CONTACT_PHONES[0] ?? "";
/** WhatsApp numbers, digits only with the country code. Defaults to the phone numbers above. */
export const CONTACT_WHATSAPPS = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ? list(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP) : CONTACT_PHONES).map((n) => n.replace(/\D/g, "")).filter(Boolean);
export const CONTACT_WHATSAPP = CONTACT_WHATSAPPS[0] ?? "";
/** When someone answers. */
export const CONTACT_HOURS = (process.env.NEXT_PUBLIC_CONTACT_HOURS || "Monday to Saturday, 8am to 6pm (GMT)").trim();
/** Where we are. */
export const CONTACT_LOCATION = (process.env.NEXT_PUBLIC_CONTACT_LOCATION || "Accra, Ghana").trim();

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
/** A WhatsApp chat link; `number` picks one of the WhatsApp numbers (the first by default). */
export const whatsappHref = (text?: string, number: string = CONTACT_WHATSAPP) => number ? `https://wa.me/${number.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
/** "+233 50 989 8272" → "050 989 8272", the way people in Ghana write a local number. */
export const localNumber = (n: string) => n.replace(/^\+233\s*/, "0").trim();
export const hasContact = () => !!(CONTACT_EMAIL || CONTACT_WHATSAPP || CONTACT_PHONE);
/** "233509898272" → "050 989 8272", for WhatsApp links. */
export const waLabel = (digits: string) => { const d = digits.replace(/\D/g, ""); const local = d.startsWith("233") ? "0" + d.slice(3) : "+" + d; return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local; };
