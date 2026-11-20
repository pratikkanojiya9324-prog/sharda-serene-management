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
   **Run this after every `db reset`**, because a reset wipes Vault.
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

**Test logins.** Local Supabase accepts fixed test phones with OTP `123456`: `919999999999` (the seeded admin) and `919888888888`. Invite the second one as a guard or resident from the admin site, then log in with it on the phone. No SMS is sent locally.

## Running tests

```
npm test --workspaces                       # shared, admin and mobile unit tests
npx supabase test db                        # database tests (needs the local stack running)
npx -y deno test supabase/functions/notify  # Edge Function tests (Deno is fetched on demand)
```

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
4. **Create the two Vault secrets** so the database can call the function. In the Supabase dashboard open the SQL editor and run:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify', 'notify_url');
   select vault.create_secret('<service-role-key>', 'service_role_key');
   ```
5. **Set up real SMS for phone login** (Authentication, Providers, Phone). Supabase supports Twilio, MessageBird, Textlocal and Vonage. SMS is billed per message by that provider, so budget for it. Keep **Confirm phone** turned ON: the app relies on a verified phone to claim invites.
6. **Point the apps at production:** set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (admin) to `https://<project-ref>.supabase.co` and the production anon key. Never put the service role key in either app.
7. **Deploy the admin site:**
   ```
   npm run build -w apps/admin
   ```
   Upload `apps/admin/dist` to any static host (Vercel, Netlify, Cloudflare Pages...). Set the two `VITE_` variables in the host before building there.

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
4. Push notifications on Android also need Firebase Cloud Messaging credentials; `eas build` walks you through them the first time (`npx eas credentials`).

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
