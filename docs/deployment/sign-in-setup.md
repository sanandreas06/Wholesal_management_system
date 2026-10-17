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

## 2. Email codes from your Gmail (sanshubster@gmail.com)

WHOLESTRA sends the codes straight from your Gmail through Google's Gmail API
(over HTTPS, so Render's block on mail servers does not matter). Gmail allows
a few hundred emails a day from a normal account.

1. **console.cloud.google.com** → top bar project picker → **New project** →
   name it `WHOLESTRA` → **Create** (or reuse the one for Google sign-in).
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **Google Auth Platform** (older screens: *OAuth consent screen*) →
   **Get started**: app name `WHOLESTRA`, support email
   `sanshubster@gmail.com`, audience **External**, contact email the same →
   **Create**. Then **Audience → Publish app** (*In production*). Without this
   the key below stops working after 7 days.
4. **Clients → Create client** → type **Web application**, name
   `WHOLESTRA mail`. Under **Authorised redirect URIs** add
   `https://developers.google.com/oauthplayground` → **Create**. Copy the
   **Client ID** and **Client secret**.
5. Open **developers.google.com/oauthplayground**. Click the **gear** (top
   right) → tick **Use your own OAuth credentials** → paste the Client ID and
   Client secret → **Close**.
6. In the box under the list on the left (*Input your own scopes*) paste
   `https://www.googleapis.com/auth/gmail.send` → **Authorize APIs** → choose
   sanshubster@gmail.com. Google warns the app is not verified: click
   **Advanced → Go to WHOLESTRA (unsafe)** (it is your own app) → **Continue**.
7. Back in the playground click **Exchange authorization code for tokens**.
   Copy the **Refresh token**.
8. On Render (**wms-api → Environment**) set:

   | Name | Value |
   | --- | --- |
   | `MAIL_PROVIDER` | `gmail` |
   | `MAIL_FROM` | `sanshubster@gmail.com` |
   | `MAIL_FROM_NAME` | `WHOLESTRA` |
   | `GMAIL_CLIENT_ID` | from step 4 |
   | `GMAIL_CLIENT_SECRET` | from step 4 |
   | `GMAIL_REFRESH_TOKEN` | from step 7 |

   `MAIL_API_KEY` (Brevo) can be deleted. **Save, rebuild and deploy**.
9. **Test it** (PowerShell; the key is `PLATFORM_ADMIN_KEY` from Render):

   ```powershell
   $h = @{ "x-admin-key" = "PASTE-THE-KEY" }
   Invoke-RestMethod "https://wms-api-rcsy.onrender.com/api/admin/mail-test" -Method Post -Headers $h -ContentType "application/json" -Body '{"to":"sanshubster@gmail.com"}'
   ```

   `ok : True` means it works. Otherwise `error` says exactly what Google or
   the provider refused.

Brevo or Resend still work too (`MAIL_PROVIDER=brevo` with `MAIL_API_KEY`).
Note that Brevo replaces a Gmail sender address with its own, which is why
Gmail is used directly here.

**Trying things out before email is ready:** `OTP_DEV_ECHO=true` on Render
shows each code on screen ("Test mode") instead of emailing it. Remove it as
soon as email works.

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
