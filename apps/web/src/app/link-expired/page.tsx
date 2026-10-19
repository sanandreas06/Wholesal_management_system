import type { Metadata } from "next";
import StatusPage from "../../components/status/StatusPage";

export const metadata: Metadata = { title: "Link expired | WHOLESTRA", robots: { index: false } };

const WHY: Record<string, { title: string; text: string; again: { label: string; href: string } }> = {
  signin: { title: "This sign-in link has expired", text: "Sign-in links work once and only for a few minutes, to keep your account safe. This one has already been used, took too long, or was opened in a different browser.", again: { label: "Sign in again", href: "/login" } },
  signup: { title: "This sign-up did not finish", text: "Sign-up codes and links work only for a few minutes, and only in the browser where you started. Nothing was created, so you can simply start again.", again: { label: "Start sign-up again", href: "/get-started" } },
  invite: { title: "This invitation is no longer valid", text: "The invitation may have been used already or withdrawn. Ask the person who invited you to send a new one.", again: { label: "Sign in", href: "/login" } },
};

/** Where old, used or unfinished sign-in and sign-up links end up. ?why=signin|signup|invite picks the wording. */
export default async function LinkExpired({ searchParams }: { searchParams: Promise<{ why?: string }> }) {
  const { why } = await searchParams;
  const w = WHY[why ?? ""] ?? { title: "This link has expired", text: "Links like this work only once and only for a short time, to keep accounts safe. It has already been used or is too old.", again: { label: "Sign in", href: "/login" } };
  return (
    <StatusPage code="Link expired" art="expired" title={w.title}
      text={<><p>{w.text}</p><p>For your safety we never reopen an old link. Start again and you will get a new one.</p></>}
      actions={[{ ...w.again, primary: true }, { label: "Home page", href: "/" }]} />
  );
}
