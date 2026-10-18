# Sign-in emails, Google / Facebook / LinkedIn, contact details and refer & earn

Batch 29 added sign-up, email codes, an authenticator app, social sign-in, a
demo company and refer & earn. Each piece switches itself on when its settings
are filled in. Nothing breaks while a setting is empty: the matching button or
step is simply hidden or explained on screen.

Where the settings go on the free demo hosting:

| Setting | Where |
| --- | --- |
| Anything without `NEXT_PUBLIC_` | **Render** → your API service (`wms-api`) → **Environment** → Add environment variable, then **Save, rebuild and deploy** |
| `NEXT_PUBLIC_...` | **Vercel** → your project → **Settings → Environment Variables**, then **Deployments → Redeploy** (these are read when the site is built) |

On your own server they all go in `deploy/.env.production` (see `deploy/env.production.example`).

> **Sign-in not working? Start here.** Open your website followed by `/status`
> (for example `https://your-site.vercel.app/status`, also linked at the bottom
> of every page as **System status**). It checks the server, the database,
> email, the two addresses and Google/Facebook/LinkedIn, and says in plain
> words what to fix for every item marked ✕. Fix those, press **Check again**,
> and sign-in works once everything is ✓ (Facebook and LinkedIn may stay grey
> until you switch them on). The free server sleeps, so the first check can take
> up to a minute.

---

## 0. Before anything else

1. **Update the database** (new tables and columns; nothing existing is removed).
   In PowerShell, in the project folder, with your Neon connection string:

   ```powershell
   $env:DATABASE_URL = "postgresql://...your Neon string..."
   pnpm install
   pnpm db:generate
   pnpm db:push
   Remove-Item Env:DATABASE_URL
   ```

2. **Owner email.** Once email codes are on, every sign-in starts with a code
   sent to the account's email, so it must be a real inbox. The owner is now
   `sanshubster@gmail.com`: running `pnpm db:seed` moves an owner still called
   `admin@wholesale.local` to it. Or sign in and use **Settings → Sign-in and
   security → Change email** (the app shows a red "Action needed" bar until the
   email is a real one). Staff with made-up emails can be corrected by the owner
   in **Users → Edit**.

   As a second way in, turn on the **authenticator app** on the same screen:
   the sign-in page always offers "Use my authenticator app instead".

## 1. Two addresses the API needs (Render)

| Name | Value |
| --- | --- |
| `WEB_URL` | your website's address, for example `https://your-site.vercel.app` (no slash at the end) |
| `API_PUBLIC_URL` | `https://wms-api-rcsy.onrender.com` |

Social sign-in sends people back to `WEB_URL`, and tells Google, Facebook and
LinkedIn to return to `API_PUBLIC_URL`.

## 2. Email codes from your Gmail, and Continue with Google (one set of Google keys)

WHOLESTRA sends the codes straight from your Gmail through Google's Gmail API
(over HTTPS, so Render's block on mail servers does not matter). The same
Google keys also switch on **Continue with Google**, so this one section fixes
both red items on the status page. No OAuth Playground and no refresh token to
copy any more: you press **Connect Gmail** instead.

**A. In Google (console.cloud.google.com), about 10 minutes**

1. Top bar project picker → **New project** → name it `WHOLESTRA` →
   **Create** (or open the one you already made).
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **Google Auth Platform** (older screens: *OAuth consent screen*) →
   **Get started**: app name `WHOLESTRA`, support email
   `sanshubster@gmail.com`, audience **External**, contact email the same →
   **Create**.
4. **Audience → Publish app** → confirm, so it says **In production**.
   Important: while it says *Testing*, Google cancels the Gmail permission
   after 7 days and codes stop arriving.
5. **Clients → Create client** → type **Web application**, name `WHOLESTRA`.
   Under **Authorised redirect URIs** add both lines exactly:

   `https://wms-api-rcsy.onrender.com/api/auth/oauth/google/callback`
   `https://wms-api-rcsy.onrender.com/api/auth/gmail/callback`

   → **Create**. Copy the **Client ID** and the **Client secret** (keep the
   secret private: it goes only into Render, never into a chat).

**B. On Render (wms-api → Environment)**

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the Client ID from step 5 |
| `GOOGLE_CLIENT_SECRET` | the Client secret from step 5 |
| `MAIL_PROVIDER` | `gmail` |
| `MAIL_FROM` | `sanshubster@gmail.com` |
| `MAIL_FROM_NAME` | `WHOLESTRA` |
| `API_PUBLIC_URL` | `https://wms-api-rcsy.onrender.com` (already there) |

`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` are no longer
needed (if you set them, they are used instead). **Save, rebuild and deploy.**

**C. Connect Gmail**

1. Open your website's **/status** page. *Email codes* now says "Almost there"
   with a **Connect Gmail** button. Press it.
2. Choose **sanshubster@gmail.com**. Google warns the app is not verified:
   **Advanced → Go to WHOLESTRA (unsafe)** (it is your own app). Leave the box
   **Send email on your behalf** ticked → **Continue**.
3. You come back to the status page with a green message, a test email arrives
   in the inbox, and *Email codes* turns ✓.

Only the Google account that is `MAIL_FROM` can do this: if anyone else tries,
nothing is saved. The permission is kept encrypted in the database. To take it
back at any time: myaccount.google.com/permissions → WHOLESTRA → Remove.

Brevo or Resend still work too (`MAIL_PROVIDER=brevo` with `MAIL_API_KEY`).

**Trying things out before email is ready:** `OTP_DEV_ECHO=true` on Render
shows each code on screen ("Test mode") instead of emailing it. Remove it as
soon as email works.

## 3. Continue with Google

Done in section 2: the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
switch the Google button on. Until the consent screen is *In production*, only
test users you list can use it. In **Google Auth Platform → Branding** add your
website address and the privacy page (`WEB_URL/privacy`).

## 4. Continue with Facebook

1. **developers.facebook.com → My Apps → Create app**, use case
   *Authenticate and request data from users with Facebook Login*.
2. In **Facebook Login → Settings**, *Valid OAuth Redirect URIs*:

   `https://wms-api-rcsy.onrender.com/api/auth/oauth/facebook/callback`

3. Make sure the **email** permission is included, add the privacy page
   address in **App settings → Basic**, and switch the app to **Live**.
4. Copy **App ID** and **App secret** into Render as `FACEBOOK_APP_ID` and
   `FACEBOOK_APP_SECRET`.

## 5. Continue with LinkedIn

1. **linkedin.com/developers → Create app** (LinkedIn asks for a company page
   to attach it to).
2. **Products → Sign In with LinkedIn using OpenID Connect → Request access**.
3. **Auth → Authorized redirect URLs**:

   `https://wms-api-rcsy.onrender.com/api/auth/oauth/linkedin/callback`

4. Copy **Client ID** and **Client Secret** into Render as
   `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.

A Google, Facebook or LinkedIn account is matched to WHOLESTRA by its
confirmed email address. Someone who already has an account with that email
simply signs in; a new email creates a new company and goes to the company
set-up screen.

## 6. Our contact details

Built in: sanshubster@gmail.com, +233 50 989 8272 | +233 54 301 6993, with a
WhatsApp link to each number. They show in the site footer, the Contact page,
under the sign-in box and at the bottom of every screen inside the app.
Nothing to set. To change them later without a code change, add these on
Vercel and **Redeploy**:

| Name | Example |
| --- | --- |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `hello@yourcompany.com` |
| `NEXT_PUBLIC_CONTACT_PHONE` | `+233 50 989 8272 \| +233 54 301 6993` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | `233509898272, 233543016993` (digits only; defaults to the phone numbers) |
| `NEXT_PUBLIC_CONTACT_HOURS` | `Monday to Saturday, 8am to 6pm (GMT)` |
| `NEXT_PUBLIC_CONTACT_LOCATION` | `Accra, Ghana` |

## 7. Refer & earn: confirming rewards

Each company gets a referral link under **Refer & earn**. A company that signs
up with it shows there as *Signed up*. Your staff confirm and pay rewards with
a private key (`PLATFORM_ADMIN_KEY`, made by Render; on Render open the
service's Environment tab and reveal it; if it is not listed, add it yourself
as any 32 or more random letters and digits). There is no screen for this yet;
in PowerShell:

```powershell
$h = @{ "x-admin-key" = "PASTE-THE-KEY" }
$api = "https://wms-api-rcsy.onrender.com/api"
# list referrals
Invoke-RestMethod "$api/admin/referrals" -Headers $h
# confirm one with a US$30 reward (use the id from the list)
Invoke-RestMethod "$api/admin/referrals/THE-ID" -Method Patch -Headers $h -ContentType "application/json" -Body '{"status":"CONFIRMED","rewardUsd":30}'
# after paying it
Invoke-RestMethod "$api/admin/referrals/THE-ID" -Method Patch -Headers $h -ContentType "application/json" -Body '{"status":"PAID"}'
```

`REFERRAL_MAX_USD` (default 30) is the most a single reward can be.
Statuses: `REGISTERED` (signed up), `CONFIRMED`, `PAID`, `REJECTED`.

## 8. Contact page messages

The Contact page has a form (name, email, phone, company, subject and message
are required). Every message is saved. Once email is set up (section 2), each
one is also emailed to `INQUIRY_TO` (Render; defaults to `MAIL_FROM`), with
"reply" going straight to the sender, and the sender gets a short "we received
your message" email. To list them without email, in PowerShell:

```powershell
$h = @{ "x-admin-key" = "PASTE-THE-KEY" }
Invoke-RestMethod "https://wms-api-rcsy.onrender.com/api/admin/inquiries" -Headers $h
```

## 9. Who opened the demo

The demo asks for the visitor's shop or company name first. To see the list:

```powershell
Invoke-RestMethod "https://wms-api-rcsy.onrender.com/api/admin/demo-visits" -Headers $h
```

## 10. The authenticator and the 5-hour rule

An account with Google Authenticator turned on is asked for its 6-digit code
when signing in. After a correct code, that browser is trusted for 5 hours:
signing in again within 5 hours needs only the email code and the password.
After 5 hours away, or on any other browser, the authenticator code is asked
again. Wrong email codes, authenticator codes and passwords are recorded as
"FAILED SIGN-IN" in Audit → Change log, under the company's name.

## 11. The demo company

"Try the demo" opens a shared sample company (Demo Wholesale Ltd) with three
branches, twelve products with pictures and six weeks of sales. It is built the
first time someone opens it, its dates move forward so it always looks recent,
and it is read-only: nothing anyone does there is saved. Nothing to set up.

## 12. WHOLESTRA as an app on phones and computers

WHOLESTRA installs straight from the website, no app store needed. It gets its
own icon and opens in its own window on the Dashboard, and every update you
deploy reaches everyone at once.

- **Android (Chrome)** and **Windows/Mac (Chrome or Edge):** press **Install app**
  (top bar of the website, the phone menu, or the user menu inside the app) and
  confirm. Chrome may also offer it in the address bar.
- **iPhone/iPad:** open the site in Safari, tap **Share**, then **Add to Home
  Screen**. The **Install app** button shows these steps.

The app's name under the icon is **WHOLESTRA** (on Android, Windows and Mac),
and inside the app window the title bar always reads WHOLESTRA, whatever page
is open. The refer & earn strip is hidden inside the app.

**Already installed it before this update?** Chrome checks the app's details when
the app is opened and updates the name and icon by itself (on a computer it may
ask you to accept the new name; on Android it can take up to a day). If the icon
still has no name or the wrong one, it was added as a plain shortcut: remove it
(press and hold the icon, then Remove/Uninstall) and install again from the
**Install app** button.

Nothing needs setting up: the website must be on `https://` (Vercel already is).
The app still needs the internet; without it, it shows a "You are offline" page
and reloads by itself when the connection is back. No business data is kept on
the device.

## 13. The WHOLESTRA assistant

A chat button sits at the bottom right of every page.

- **On the website** it answers questions (features, pricing, security, sign-up,
  sign-in problems, the app, refer & earn), takes visitors to the right page,
  opens the demo, shows our contact details and gives a guided tour that
  highlights each part of the page.
- **Inside the app and the demo** it gives a guided tour of the screen, explains
  how to do things step by step, answers questions from the company's records
  ("sales today", "sales last week at Kumasi", "what's running low?", "how many
  rice do we have?") and does tasks: **record a sale** (with payment), **create a
  purchase order** (saved as a draft), **record an expense** and **add a
  customer**. It asks for anything missing, then shows a card with every detail;
  nothing is saved until the person presses **Confirm**. It uses the person's own
  sign-in, so it can never see or do more than their role allows, and everything
  it saves goes into the change log like any other change. In the demo it shows
  the card but cannot save.

It works straight away with its built-in understanding. For **smart replies**
(it understands any wording, follow-up questions and longer requests), add an
Anthropic API key:

1. Go to **console.anthropic.com**, sign in, add a payment method under
   **Billing** and create a key under **API keys**. Copy it (it is shown once).
2. On **Render** → `wms-api` → **Environment**, add `ANTHROPIC_API_KEY` with the
   key, then **Save, rebuild and deploy**. Never paste the key into a chat or the
   code.
3. Optional: `ASSISTANT_DAILY_LIMIT` (default 3000 smart replies a day for the
   whole server) caps the bill; `ASSISTANT_MODEL` changes the model (default
   `claude-haiku-5-5`, the fast and low-cost one).

Each smart reply costs a fraction of a US cent with the default model. Visitors
on the website are limited to 30 messages every 15 minutes, signed-in people to
120. If the key is missing, wrong or out of credit, the assistant quietly falls
back to its built-in answers.

## 14. Sign-in codes by text message (SMS), optional

Once email codes work, people can also get their sign-in code by text: on the
sign-in page, **Get the code by text message**, or on the code screen, **Text
the code to my phone instead**. The text goes to the mobile number saved on
their account (**My profile → Phone**, or **Users → Edit** for staff). Like
email, the page never shows whether an account or number exists. New accounts
still confirm their email (text codes are for signing in only).

Recommended for Ghana: **Arkesel** (sms.arkesel.com), which charges a few
pesewas per text.

1. Create an account at **sms.arkesel.com** and buy some credit (mobile money
   works).
2. **Sender IDs → Request** `WHOLESTRA` (up to 11 letters). Approval usually
   takes a day; texts fail until it is approved.
3. **SMS API → API key**: copy it.
4. On Render add `SMS_PROVIDER` = `arkesel` and `SMS_API_KEY` = the key.
   **Save, rebuild and deploy.** The status page shows *Text-message codes* ✓.

Other choices: `SMS_PROVIDER=mnotify` with `SMS_API_KEY` (mNotify), or
`SMS_PROVIDER=twilio` with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`TWILIO_FROM` (worldwide, dearer). `SMS_SENDER` changes the sender name
(default WHOLESTRA). Numbers typed the local way (024…) get the country code
from `SMS_COUNTRY_CODE` (default 233). If a text fails (no credit, sender ID not
approved), the sign-in page says so and the status page shows the provider's
reason.

