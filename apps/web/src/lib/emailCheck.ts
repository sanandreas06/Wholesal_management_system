/** Catches mistyped email addresses before anything is sent: the shape (name@domain.ending), and slips in the big providers' names
 *  ("gmail.comdzg", "gmial.com", "yahoo.con"), with a suggested fix. The server makes the final check that the domain takes mail. */

const SHAPE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
const PROVIDERS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "live.com", "ymail.com", "aol.com", "proton.me", "protonmail.com", "googlemail.com", "yahoo.co.uk", "mail.com", "zoho.com"];

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
  {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // swapped letters
  }
  return d[a.length][b.length];
}

/** A better guess for a mistyped provider domain, or null. */
function guessDomain(domain: string) {
  if (PROVIDERS.includes(domain)) return null;
  const head = PROVIDERS.find(p => domain.startsWith(p) && domain.length > p.length); // "gmail.comdzghwrhrw"
  if (head) return head;
  let best: string | null = null, bestD = 2; // one slip only: a wrong, missing, extra or swapped letter
  for (const p of PROVIDERS) { const dd = distance(domain, p); if (dd < bestD) { best = p; bestD = dd; } }
  return best;
}

/** null when the address looks fine; otherwise what is wrong, and a corrected address when we can guess one.
 *  A guess is only a nudge: pressing the button again with the same address goes ahead (see `soft`). */
export function emailProblem(raw: string): { message: string; suggestion?: string; soft?: boolean } | null {
  const email = raw.trim().toLowerCase();
  if (!email) return { message: "Type your email address." };
  const [name, domain = ""] = email.split("@");
  const guess = domain ? guessDomain(domain) : null;
  if (!SHAPE.test(email) || domain.includes("..")) return { message: "This email address does not look right. Check it and try again, for example name@gmail.com.", ...(guess && name ? { suggestion: `${name}@${guess}` } : {}) };
  // letters glued onto a provider's name ("gmail.comdzg") can never be right, so that one is not just a nudge
  const glued = !!guess && domain.startsWith(guess) && domain[guess.length] !== ".";
  if (glued && name) return { message: `This email address does not look right. Did you mean ${name}@${guess}?`, suggestion: `${name}@${guess}` };
  if (guess && name) return { message: `Did you mean ${name}@${guess}? If your address is right as typed, press the button again.`, suggestion: `${name}@${guess}`, soft: true };
  return null;
}
