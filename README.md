# Society Gate

Visitor management for housing societies. A guard logs a visitor at the gate, the flat's residents get a push notification and approve or deny, and the guard sees the answer. Residents can also create pass codes for expected guests. One backend can serve many societies.

**Login model.** There is no OTP and no SMS. Each **flat** is one account (Building, Wing, Flat, then a shared family password) and each **guard/admin** is a staff account (username + password). Under the hood these are Supabase Auth email/password users with synthetic emails (`flat-<flat_id>@login.societygate.app`, `<username>@staff.<society_id>.societygate.app`) that nobody ever sees. Accounts are created only by an admin (the `accounts` Edge Function, the admin website) or by the scripts below; self-signup is disabled.

## What's in the repo

| Path | What it is |
| --- | --- |
| `supabase/` | The backend: database migrations (`migrations/`), database tests (`tests/`), the `notify` and `accounts` Edge Functions (`functions/`), an empty `seed.sql` (demo data comes from `npm run seed:demo`) and the legacy first-society script (`setup-society.sql`, invite based, not used by the flat-login model). |
| `apps/mobile` | The Expo / React Native app (guards and residents). Routes live in `apps/mobile/src/app`. |
| `apps/admin` | The Vite web admin panel (society admins manage flats, guards and residents). |
| `packages/shared` | TypeScript code shared by both apps (types, helpers). |
| `scripts/dev-secrets.sh` | Local helper that sets the Vault secrets the push-notification trigger needs. |
| `scripts/seed-demo.mjs` | `npm run seed:demo`: idempotent demo society "Sharda Serene" (service role). |
| `scripts/create-staff.mjs` | `npm run staff:create`: creates a guard/admin account (service role), e.g. the first admin. |

Everything is TypeScript. This is an npm workspaces monorepo: run `npm install` once at the root.

## Prerequisites

- **Node.js** (v20 or newer; developed on Node 24) and npm.
- **Docker Desktop**, running. The local Supabase stack runs in containers.
- **Supabase CLI**: nothing to install, use it as `npx supabase ...` (it is a dev dependency).
- **Expo account** (free) at expo.dev, for building the Android app.
- **An Android phone** to test with.
- Bash (Git Bash on Windows) for `scripts/dev-secrets.sh`.
- Node 22.6 or newer for the `scripts/*.mjs` helpers (they import the shared `.ts` helpers directly; developed on Node 24).

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
3. Load the schema (`seed.sql` is intentionally empty):
   ```
   npx supabase db reset
   ```
4. Create the local Vault secrets the notify trigger reads:
   ```
   npm run dev:secrets
   ```
   This stores `notify_url` and a fresh random `notify_secret` in Vault and writes the same secret to `supabase/functions/.env` as `NOTIFY_SECRET` (gitignored), which the function checks. **Run this after every `db reset`**, because a reset wipes Vault, and restart `functions serve` afterwards.
5. Serve the Edge Functions (leave it running in its own terminal):
   ```
   npx supabase functions serve
   ```
   This serves both `notify` and `accounts`. If you ever change `supabase/config.toml`, run `npx supabase stop && npx supabase start` so the auth settings apply.
   Then create the demo data (Sharda Serene: 2 buildings x wings A/B x 42 flats, a flat account per flat, demo family members, 3 notices, 4 complaints, this month's bills, plus staff accounts). It is idempotent: run it again any time and nothing is duplicated (existing passwords are not reset). From Git Bash:
   ```
   eval "$(npx supabase status -o env)"
   SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run seed:demo
   ```
   It prints the society id (needed for `EXPO_PUBLIC_SOCIETY_ID`) and the demo logins. Run it again after every `db reset`.
   Demo family members have **no phone numbers** by default, so no real person's number is ever stored. To test calls or phone display, set `SEED_TEST_PHONES="9876543210,9123456789"` (your own numbers) when running the seed: they are saved as `+91...` and assigned round-robin to the members of B1-A-101 and B1-A-102 only (only for members that do not exist yet; `db reset` first to re-seed).
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

**Demo logins** (created by `npm run seed:demo`):

| Who | Login | Password |
| --- | --- | --- |
| Flat (any) | pick Building, Wing, Flat | `Sharda@<building><wing><flat>`, e.g. Building 1 / A / 101 is `Sharda@1A101`, Building 2 / B / 704 is `Sharda@2B704` |
| Admin | "Guard / Admin login", username `admin` | `Admin@123` |
| Guard | "Guard / Admin login", username `guard1` | `Guard@123` |

Create more staff accounts with `npm run staff:create -- --society <society-id> --username <u> --name "<Name>" --role guard|admin --password <pw>` (needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment), or from the admin website once logged in as an admin. Usernames are lowercase `[a-z0-9_.-]{3,30}`, passwords at least 6 characters.

## Running tests

```
npm test --workspaces                       # shared, admin and mobile unit tests
npx supabase test db                        # database tests (needs the local stack running)
npx -y deno test supabase/functions         # Edge Function tests (Deno is fetched on demand)
npm run smoke                               # runs every app query that embeds related tables against the local stack
```

`npm run smoke` signs in locally as the demo flat and staff logins (run `npm run seed:demo` first; it only works against the local stack) and runs the select strings from `packages/shared/src/selects.ts` (which both apps use). It catches errors the unit tests cannot, such as PostgREST `PGRST201` ("more than one relationship was found") when a new foreign key makes an embed ambiguous. Run it after `db reset` and after any schema change.

## Going live

1. **Create a Supabase project** at supabase.com. Note the project ref (the `abcdxyz` in `https://abcdxyz.supabase.co`), the anon key and the service role key (Project Settings, API). Keep the service role key secret.
2. **Link and push the database:**
   ```
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Do not run `seed.sql` in production; it is dev data only.
3. **Deploy the Edge Functions:**
   ```
   npx supabase functions deploy notify
   npx supabase functions deploy accounts
   ```
   `accounts` keeps the gateway JWT check on (`verify_jwt = true`); it also re-checks inside that the caller is an admin of the target society.
   `supabase/config.toml` turns the gateway JWT check off for `notify` (`[functions.notify] verify_jwt = false`) because the database calls it with a shared secret instead. If you deploy some other way, pass `--no-verify-jwt`.
4. **Create the notify shared secret** so the database can call the function. Do this **after** any `npx supabase db reset --linked` (see "Setting up your society"): a reset wipes Vault, so secrets created earlier are lost. Generate one long random value (for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and store the **same value** in two places:
   - as the function's secret:
     ```
     npx supabase secrets set NOTIFY_SECRET=<the-random-value>
     ```
   - in Vault, together with the function URL (dashboard → SQL editor):
     ```sql
     select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify', 'notify_url');
     select vault.create_secret('<the-random-value>', 'notify_secret');
     ```
   Check that both exist: `select name from vault.secrets;` must list `notify_url` and `notify_secret`.
   To rotate it later, set the new value in both places (`select vault.update_secret((select id from vault.secrets where name = 'notify_secret'), '<new-value>');`). The function reads the database with the auto-provided `SUPABASE_SERVICE_ROLE_KEY`; you do not store that key anywhere.
5. **Auth settings** (Authentication in the dashboard): turn the **Phone** provider off, keep **Email** on, turn **Allow new users to sign up** off and **Confirm email** off (accounts are created only through the `accounts` function and the scripts, with confirmed synthetic emails). Locally this is already set in `supabase/config.toml`. Supabase's default auth rate limits are accepted for now.
6. **Point the apps at production:** set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile) and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (admin) to `https://<project-ref>.supabase.co` and the production anon key, and set `EXPO_PUBLIC_ADMIN_URL` (mobile, optional) to the admin site's address so admin-only users see it in the app. Also set `EXPO_PUBLIC_SOCIETY_ID` (mobile) to the society's id. Never put the service role key in either app.
7. **Deploy the admin site:**
   ```
   npm run build -w apps/admin
   ```
   Upload `apps/admin/dist` to any static host (Vercel, Netlify, Cloudflare Pages...). Set the two `VITE_` variables in the host before building there.

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

1. **Wipe the test project (test environment only).** The test project still holds the old phone-OTP users, invites, visits and passes. Reset it before loading the new model: `npx supabase db reset --linked` destroys ALL data in the linked project and re-applies every migration, so only ever run it against the test project. (Old auth users are not removed by a database reset; delete them in the dashboard under Authentication, Users.) **A reset also wipes Vault**, so create the notify Vault secrets (Going live, step 4) after it, never before, and confirm with `select name from vault.secrets;`.
2. **Load demo data** against the project, with the service role key from Project Settings, API (never commit it):
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:demo
   ```
   For a real society instead, create the society row (Table editor or SQL), then its first admin:
   ```
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run staff:create -- --society <society-id> --username admin --name "Your Name" --role admin --password <strong-password>
   ```
3. The admin logs in on the admin site with that username and password. Flats, family members, passwords and staff are then managed there (bulk CSV import, set/reset passwords, staff accounts), all through the `accounts` function.
4. Residents install the APK and log in with Building, Wing, Flat and the flat's password; guards and admins use "Guard / Admin login".
5. **Battery settings, so alerts arrive.** Many Android phones kill background apps. On each resident's and guard's phone: allow notifications for Society Gate, set battery usage for the app to "Unrestricted" (Settings, Apps, Society Gate, Battery), and turn off any "auto-start / app sleeping" restriction (Xiaomi, Oppo, Vivo, Samsung "sleeping apps").

### The accounts function

`POST /functions/v1/accounts` with the admin's session token (`Authorization: Bearer <access token>`) and a JSON body `{ "action": ..., ... }`:

| action | fields | notes |
| --- | --- | --- |
| `create_flat_account` | `flat_id`, `password` | 409 `account_exists` if the flat already has one |
| `set_password` | `flat_id` or `user_id`, `password` | by `flat_id` you must administer the flat's society; by `user_id` you must administer every society the user belongs to |
| `create_staff` | `society_id`, `username`, `name`, `role` (guard/admin), `password` | 409 `username_taken` |
| `list_staff` | `society_id` | admins of that society only; returns `[{user_id, name, role, username, disabled}]` (the username is kept in the account's metadata; `create_staff` also returns it) |
| `disable_staff` | `user_id` | removes the target's staff memberships in societies you administer; bans the login only if no membership remains anywhere (else 409 `still_member_elsewhere`); not yourself |
| `bulk_import` | `society_id`, `rows`: `[{building, wing, flat, password?, member_name?, member_phone?, relation?}]` | upsert by building/wing/flat (missing building, wing or flat is created); blank password keeps the current one, and a new account without one gets a random 8-character password returned as `generated_password`; a flat whose rows name members has its family replaced wholesale; one result per row; a flat with any invalid row is skipped entirely; building names match existing ones case-insensitively; **at most 200 rows per call** (the admin site sends chunks of 200; larger requests get 400 `too_many_rows`); `generated_password` is also returned on a failed row if the account was created before the failure |

Anyone who is not an admin of the target society gets 403 `{"error":"not_authorized"}`.

## Known limitations of v1

- Online only: no offline mode; the guard phone needs internet.
- One gate per society.
- A guard belongs to one society.
- One shared password per flat: everyone in the family can act as the flat (the app asks "who is using this phone?" only to label actions).
- English only.
- Android is the supported platform; iOS builds from the same code but is not published in v1.
