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

2. **Give the owner account a real email address.** Once email codes are on,
   every sign-in starts with a code sent to the account's email. The starting
   owner account `admin@wholesale.local` is not a real inbox. Sign in, open
   **Settings → Sign-in and security → Change email** and enter an address you
   can open. (The app also shows a red "Action needed" bar until you do.)
   Do the same for any staff account with a made-up email: an owner can now
   correct it in **Users → Edit**.

   As a second way in, turn on the **authenticator app** on the same screen:
   the sign-in page always offers "Use my authenticator app instead".

## 1. Two addresses the API needs (Render)

| Name | Value |
| --- | --- |
| `WEB_URL` | your website's address, for example `https://your-site.vercel.app` (no slash at the end) |
| `API_PUBLIC_URL` | `https://wms-api-rcsy.onrender.com` |

Social sign-in sends people back to `WEB_URL`, and tells Google, Facebook and
LinkedIn to return to `API_PUBLIC_URL`.

## 2. Email codes (Brevo, free)

Render's free plan blocks normal mail-server connections (SMTP), so WHOLESTRA
sends email through the provider's web API instead.

1. Create a free account at **brevo.com** (the free plan allows a few hundred
   emails a day; check their current limit).
2. **Senders, domains & dedicated IPs → Senders → Add a sender**: the address
   codes should come from (for example `no-reply@yourcompany.com` or your own
   Gmail). Confirm it from the email Brevo sends you.
3. **SMTP & API → API keys → Generate a new API key**. Copy it once.
4. On Render add:

   | Name | Value |
   | --- | --- |
   | `MAIL_PROVIDER` | `brevo` |
   | `MAIL_API_KEY` | the key from step 3 |
   | `MAIL_FROM` | the sender address from step 2 |
   | `MAIL_FROM_NAME` | `WHOLESTRA` |

5. Save and redeploy. On the sign-in page, enter your email: a code should
   arrive within a minute (check spam the first time).

Resend (resend.com) also works: `MAIL_PROVIDER=resend` and its API key. It
needs your own web domain to send from.

**Trying things out before email is ready:** `OTP_DEV_ECHO=true` on Render
shows each code on screen ("Test mode") instead of emailing it. That means an
email address is not really proven, so remove it as soon as email works.

## 3. Continue with Google

1. Open **console.cloud.google.com**, create a project called WHOLESTRA.
2. Open **Google Auth Platform** (older screens call it *APIs & Services →
   OAuth consent screen*): app name WHOLESTRA, your support email, audience
   **External**. Add your website address and the privacy page
   (`WEB_URL/privacy`). When ready for everyone, **Publish app**; until then
   only the test users you list can sign in.
3. **Clients → Create client → Web application**. Under *Authorised redirect
   URIs* add exactly:

   `https://wms-api-rcsy.onrender.com/api/auth/oauth/google/callback`

4. Copy the Client ID and Client secret into Render as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. Redeploy. The Google button turns on by itself.

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

## 6. Our contact details (Vercel)

Shown in the site footer, the Contact page, under the sign-in box and at the
bottom of every screen inside the app. Leave out any you do not want shown.

| Name | Example |
| --- | --- |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `hello@yourcompany.com` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | `233201234567` (digits only, with 233) |
| `NEXT_PUBLIC_CONTACT_PHONE` | `+233 20 123 4567` |
| `NEXT_PUBLIC_CONTACT_HOURS` | `Monday to Saturday, 8am to 6pm (GMT)` |
| `NEXT_PUBLIC_CONTACT_LOCATION` | `Accra, Ghana` |

Then **Redeploy** on Vercel.

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

## 8. The demo company

"Try the demo" opens a shared sample company (Demo Wholesale Ltd) with three
branches, twelve products with pictures and six weeks of sales. It is built the
first time someone opens it, its dates move forward so it always looks recent,
and it is read-only: nothing anyone does there is saved. Nothing to set up.
