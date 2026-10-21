# Platform monitor: error tracking and uptime

WHOLESTRA records its own errors and checks that it is up. You see both on **Platform monitor** in the app menu
(only for the emails in `PLATFORM_ADMINS`). The page refreshes every 15 seconds.

## What is tracked

| What | How | Where it shows |
| --- | --- | --- |
| API errors | every request that ends in a server error (5xx) | Errors list, marked **API** |
| Website errors | any unhandled error in someone's browser, on any page | Errors list, marked **Website** |
| Uptime | an outside check every 5 minutes (GitHub Actions) | Status tiles and the hour-by-hour grid |
| Restarts | the API notes each time it starts (deploy, crash, waking up) | Under the grid |

The same error happening again adds to its count instead of making a new line. A **new** error, or one that comes back
after you marked it fixed, is emailed to everyone in `PLATFORM_ADMINS` (at most once an hour for each error, 30 a day in all).
Nothing typed into forms and no passwords are ever recorded. Fixed errors are cleared after 90 days, uptime checks after 35 days.

## Set up (about 10 minutes)

1. **Render** (the API service > Environment), add:
   - `PLATFORM_ADMINS` = `sanshubster@gmail.com` (add more emails with commas). If it is not set, the Gmail address in
     `MAIL_FROM` counts as the platform owner, so you are never locked out.
   - `MONITOR_KEY` = a long random value. Make one in PowerShell:
     `[Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))`
2. **GitHub** (repository > Settings > Secrets and variables > Actions):
   - **Secrets** tab > New repository secret: `MONITOR_KEY` = the same value as on Render.
   - Only if your addresses change: **Variables** tab > `API_URL` and `WEB_URL`.
3. **Database**: run `pnpm db:push` (locally and on Neon) to add the two new tables.
4. Push to `main`. On GitHub open **Actions > Uptime check > Run workflow** once to test it.
5. Sign out and in again (so the menu shows Platform monitor), open it, and press **Send a test API error**.
   It should appear within seconds, and an alert email should arrive if Gmail is connected.

## When the API is down

A server that is down cannot report itself, so the outside check does it: the GitHub run fails and GitHub emails you.
Make sure that is switched on at github.com > Settings > Notifications > **Actions** (send notifications for failed workflows).

## Good to know

- The check every 5 minutes also keeps the free Render server awake, so the first visitor in the morning no longer waits
  for it to wake. One service running all month uses about 744 of the 750 free hours Render allows.
- GitHub sometimes runs scheduled checks a few minutes late. An hour only counts as down when no check succeeded in it.
- To stop alert emails for a while, remove your email from `PLATFORM_ADMINS` (you will also lose access to the page).

## System checks (only for platform owners)

The page that checks sign-in, email, Google and the database is at **/status** and in the menu under Platform.
Everyone else gets "page not found", and the server refuses the checks unless you are signed in as a platform owner.
"Connect Gmail" still comes back to this page, so sign in first, then connect.
If email codes ever stop working and you cannot sign in, use **Sign in with Google Authenticator** (set it up now in
Sign-in & security, before you need it) or Continue with Google.
