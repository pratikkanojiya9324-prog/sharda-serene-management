# Society Gate

Visitor management for housing societies. A guard logs a visitor at the gate, the flat's residents get a push notification and approve or deny, and the guard sees the answer. Residents can also create pass codes for expected guests. One backend can serve many societies.

## What's in the repo

| Path | What it is |
| --- | --- |
| `supabase/` | The backend: database migrations (`migrations/`), database tests (`tests/`), the `notify` Edge Function (`functions/notify`), a dev seed (`seed.sql`) and the production first-society script (`setup-society.sql`). |
| `apps/mobile` | The Expo / React Native app (guards and residents). Routes live in `apps/mobile/src/app`. |
| `apps/admin` | The Vite web admin panel (society admins manage flats, guards and residents). |
| `packages/shared` | TypeScript code shared by both apps (types, helpers). |
| `scripts/dev-secrets.sh` | Local helper that sets the Vault secrets the push-notification trigger needs. |

Everything is TypeScript. This is an npm workspaces monorepo: run `npm install` once at the root.

## Prerequisites

- **Node.js** (v20 or newer; developed on Node 24) and npm.
- **Docker Desktop**, running. The local Supabase stack runs in containers.
- **Supabase CLI**: nothing to install, use it as `npx supabase ...` (it is a dev dependency).
- **Expo account** (free) at expo.dev, for building the Android app.
- **An Android phone** to test with.
- Bash (Git Bash on Windows) for `scripts/dev-secrets.sh`.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Start the local Supabase stack (first run downloads images, be patient):
   ```
   npx supabase start
   ```
   It prints the API URL (`http://127.0.0.1:54321`) and the anon key. `npx supabase status` shows them again.
3. Load the schema and the dev seed (a "Demo Society" with tower A, flats A-101 and A-102, and an admin invite for `+919999999999`):
   ```
   npx supabase db reset
   ```
4. Create the local Vault secrets the notify trigger reads:
   ```
   npm run dev:secrets
   ```
   This stores `notify_url` and a fresh random `notify_secret` in Vault and writes the same secret to `supabase/functions/.env` as `NOTIFY_SECRET` (gitignored), which the function checks. **Run this after every `db reset`**, because a reset wipes Vault, and restart `functions serve` afterwards.
5. Serve the `notify` Edge Function (leave it running in its own terminal):
   ```
   npx supabase functions serve notify
   ```
6. Create the env files. Copy `apps/admin/.env.example` to `apps/admin/.env` and `apps/mobile/.env.example` to `apps/mobile/.env`, then fill in the anon key from `npx supabase status`.
   - Admin: `VITE_SUPABASE_URL=http://127.0.0.1:54321`.
   - Mobile: a physical phone cannot reach `localhost` on your PC. Use your PC's LAN IP, for example `EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321` (find it with `ipconfig`). Phone and PC must be on the same Wi-Fi.
7. Run the admin site:
   ```
   npm run dev -w apps/admin
   ```
8. Run the mobile app:
   ```
   cd apps/mobile
   npx expo start
   ```
   Scan the QR code with **Expo Go** on your phone. Push notifications need a real build with an EAS project (see "Building the Android app"); Expo Go is fine for everything else.

**Test logins.** Local Supabase accepts fixed test phones with OTP `123456`: `919999999999` (the seeded admin), `919888888888` and `919777777777`. Invite the others as a guard or resident from the admin site, then log in with them on the phone. No SMS is sent locally. (`npm run smoke` invites `919888888888` as a guard and `919777777777` as a resident of the first flat if they are not invited yet.)

## Running tests

```
npm test --workspaces                       # shared, admin and mobile unit tests
npx supabase test db                        # database tests (needs the local stack running)
npx -y deno test supabase/functions/notify  # Edge Function tests (Deno is fetched on demand)
npm run smoke                               # runs every app query that embeds related tables against the local stack
```

`npm run smoke` signs in as the local admin, guard and resident test phones and runs the select strings from `packages/shared/src/selects.ts` (which both apps use). It catches errors the unit tests cannot, such as PostgREST `PGRST201` ("more than one relationship was found") when a new foreign key makes an embed ambiguous. Run it after `db reset` and after any schema change.

## Going live

1. **Create a Supabase project** at supabase.com. Note the project ref (the `abcdxyz` in `https://abcdxyz.supabase.co`), the anon key and the service role key (Project Settings, API). Keep the service role key secret.
2. **Link and push the database:**
   ```
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Do not run `seed.sql` in production; it is dev data only.
3. **Deploy the Edge Function:**
   ```
   npx supabase functions deploy notify
   ```
   `supabase/config.toml` turns the gateway JWT check off for `notify` (`[functions.notify] verify_jwt = false`) because the database calls it with a shared secret instead. If you deploy some other way, pass `--no-verify-jwt`.
4. **Create the notify shared secret** so the database can call the function. Generate one long random value (for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and store the **same value** in two places:
   - as the function's secret:
     ```
     npx supabase secrets set NOTIFY_SECRET=<the-random-value>
     ```
   - in Vault, together with the function URL (dashboard → SQL editor):
     ```sql
     select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify', 'notify_url');
     select vault.create_secret('<the-random-value>', 'notify_secret');
     ```
   To rotate it later, set the new value in both places (`select vault.update_secret((select id from vault.secrets where name = 'notify_secret'), '<new-value>');`). The function reads the database with the auto-provided `SUPABASE_SERVICE_ROLE_KEY`; you do not store that key anywhere.
5. **Set up real SMS for phone login** (Authentication, Providers, Phone). Supabase supports Twilio, MessageBird, Textlocal and Vonage. SMS is billed per message by that provider, so budget for it. Keep **Confirm phone** turned ON: the app relies on a verified phone to claim invites. **For Indian numbers read "SMS login in India" below first: it takes days to weeks.**
6. **Point the apps at production:** set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (admin) to `https://<project-ref>.supabase.co` and the production anon key, and set `EXPO_PUBLIC_ADMIN_URL` (mobile, optional) to the admin site's address so admin-only users see it in the app. Never put the service role key in either app.
7. **Deploy the admin site:**
   ```
   npm run build -w apps/admin
   ```
   Upload `apps/admin/dist` to any static host (Vercel, Netlify, Cloudflare Pages...). Set the two `VITE_` variables in the host before building there.

## SMS login in India (start early)

Indian carriers drop SMS that are not registered on TRAI's DLT (Distributed Ledger Technology) platform. Without it, residents never get their OTP and cannot log in.

1. **Register as an entity (Principal Entity)** on a DLT portal (Jio, Airtel, Vodafone Idea, BSNL...). You need the society's or your business's PAN/GST or registration documents. Approval takes from a few days to a few weeks.
2. **Register a sender ID (header)**, e.g. `SOCGTE` (6 letters), for transactional/service messages.
3. **Register the exact OTP template** as a content template of type service/transactional (OTP). The DLT template text must match, character for character, the SMS template set in Supabase (Authentication → Providers → Phone → SMS message; locally `template` under `[auth.sms]` in `supabase/config.toml`). The variable part is `{{ .Code }}` in Supabase and `{#var#}` in DLT. Example: Supabase `Your Society Gate login code is {{ .Code }}` ↔ DLT `Your Society Gate login code is {#var#}`. If they differ by a single character, carriers silently drop the SMS.
4. **Give your SMS provider** the DLT entity ID, sender ID and template ID (Twilio, Vonage, MessageBird and Textlocal each have a DLT section). Send yourself a test OTP before onboarding anyone.
5. **Raise the Auth SMS rate limit before onboarding day.** Supabase limits how many SMS the project sends per hour (Authentication → Rate Limits, "SMS sent"; locally `sms_sent` under `[auth.rate_limit]`). When a whole society installs the app on the same evening, the default limit is hit quickly and logins fail. Raise it for the day, then lower it again.
6. **SMS pumping risk.** Attackers can request OTPs to premium or random numbers so that you pay for the SMS. Keep the rate limit only as high as you need, watch your provider's spend dashboard, set a spend alert or cap there, and turn off destinations you do not need (allow only India, +91, if your provider supports geo permissions). Only invited phones can finish logging in, but sending the OTP still costs money.

## Check notifications are working

A guard logs a visitor → the database trigger POSTs to the `notify` function → the function sends to Expo → Expo delivers through Firebase. To see where it stops:

1. **Did the database call the function?** In the SQL editor:
   ```sql
   select id, status_code, content, error_msg, timed_out, created
   from net._http_response
   order by created desc
   limit 10;
   ```
   - No new rows after a visit: the Vault secrets `notify_url` / `notify_secret` are missing (`select name from vault.secrets;`).
   - `status_code` 401: `notify_secret` in Vault and `NOTIFY_SECRET` of the function differ (or the function was deployed with JWT verification on).
   - `status_code` 200 with `{"sent":0}`: nobody in that flat has a push token (they have not logged in on a real build, or denied notifications).
   - `failedBatches` greater than 0: Expo did not accept the batch even after one retry; see the function logs.
2. **What did Expo answer?** Dashboard → Edge Functions → `notify` → **Logs** (locally, the `functions serve` terminal). Each batch logs `expo push <status> <body>`. Tickets with `DeviceNotRegistered` are removed automatically; `InvalidCredentials` means the FCM V1 key is missing in EAS (see "Push notifications on Android (Firebase)").
3. **Phone side:** notifications allowed for Society Gate, battery set to "Unrestricted". The resident home screen shows a red "Notifications are off" banner when the app could not register for push.

## Building the Android app

Run these from `apps/mobile`.

1. Log in and create the EAS project (this writes your `projectId` into the app config; push tokens need it):
   ```
   npx eas login
   npx eas init
   ```
2. **APK to install directly** (for society phones, no Play Store needed):
   ```
   npx eas build -p android --profile preview
   ```
   When it finishes, EAS gives a download link/QR code for the `.apk`.
3. **Play Store bundle (AAB):**
   ```
   npx eas build -p android --profile production
   ```
   Publishing on Google Play needs a developer account (US$25, one time).
4. **Android push notifications need Firebase (FCM V1).** Do the one-time setup in "Push notifications on Android (Firebase)" below **before** the build you give to residents, or visitor alerts will not arrive.

### Push notifications on Android (Firebase)

Expo delivers Android pushes through Firebase Cloud Messaging (FCM V1). EAS does not create the Firebase project or `google-services.json` for you. You (the owner) do these console steps once; the code is already wired.

1. Go to https://console.firebase.google.com and click **Add project** (any name, e.g. "Society Gate"). Google Analytics is not needed.
2. In the project, **Add app** → **Android**. Package name: `in.societygate.app` (it must match `android.package` in `apps/mobile/app.json`). The nickname is optional; skip the SHA-1.
3. Download **google-services.json** and save it as `apps/mobile/google-services.json`. It is not a secret (it only identifies the Firebase project), so you can commit it. `apps/mobile/app.config.js` adds it to the build automatically when the file exists; without it the app still builds, but Android push will not work.
4. In Firebase: **Project settings** → **Service accounts** → **Generate new private key**. This downloads a JSON key. **This one IS secret**: do not commit it; keep it somewhere safe.
5. Upload that key to EAS so Expo can send through your Firebase project:
   ```
   cd apps/mobile
   npx eas credentials
   ```
   Choose **Android** → your build profile (e.g. `preview` or `production`) → **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Set up a Google Service Account Key for Push Notifications (FCM V1)** → **Upload a new service account key**, and pick the JSON from step 4.
6. Build again (`npx eas build -p android --profile preview`), install it, and log in as a resident. A row should appear in `push_tokens` (SQL editor: `select * from push_tokens;`). Then follow "Check notifications are working" below.

The Android package name is `in.societygate.app` (in `apps/mobile/app.json`). **Change it before your first Play Store upload if you want a different one: it cannot be changed afterwards.**

The `development` profile builds a dev client; it also needs `npx expo install expo-dev-client` first. You can skip it unless you want to debug native code.

## Setting up your society

1. Create the society and its first admin invite, using the production database URL (Project Settings, Database, connection string):
   ```
   psql "$DB_URL" -v society_name='Green Park Society' -v admin_phone='+919812345678' -v admin_name='Your Name' -f supabase/setup-society.sql
   ```
   `admin_phone` must be an Indian mobile number in the form `+91XXXXXXXXXX`; `admin_name` is optional.
2. The admin opens the admin site and logs in with that phone (SMS OTP). The invite is claimed automatically.
3. In the admin site, add towers and flats.
4. Invite guards (by phone) and residents (by phone and flat). There is no self-signup: a person can only log in if an invite exists for their phone.
5. Residents and guards install the APK (or Play Store app) and log in with the same phone number and OTP.
6. **Battery settings, so alerts arrive.** Many Android phones kill background apps. On each resident's and guard's phone: allow notifications for Society Gate, set battery usage for the app to "Unrestricted" (Settings, Apps, Society Gate, Battery), and turn off any "auto-start / app sleeping" restriction (Xiaomi, Oppo, Vivo, Samsung "sleeping apps").

## Known limitations of v1

- Online only: no offline mode; the guard phone needs internet.
- One gate per society.
- A guard belongs to one society.
- English only.
- Android is the supported platform; iOS builds from the same code but is not published in v1.
