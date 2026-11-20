// Smoke test: run every embed select string the apps use against the LOCAL
// Supabase stack, signed in as admin, guard and resident, and fail on any error
// (e.g. PGRST201 "more than one relationship was found").
//
// Needs: `npx supabase start`, `npx supabase db reset` (dev seed). Uses the local
// test OTP phones from supabase/config.toml (OTP 123456):
//   +919999999999 admin (seed invite), +919888888888 guard, +919777777777 resident.
// Missing guard/resident invites are created in "Demo Society" with the service role.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

import * as S from '../packages/shared/src/selects.ts';

const OTP = '123456';
const ADMIN_PHONE = '+919999999999';
const GUARD_PHONE = '+919888888888';
const RESIDENT_PHONE = '+919777777777';

function localEnv() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const env = {};
  for (const line of out.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error('Could not read the local stack from `npx supabase status` - is it running?');
  }
  return env;
}

const env = localEnv();
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);

let failures = 0;
let passes = 0;
function check(label, { error, data }, expectRows = false) {
  if (error) {
    failures++;
    console.error(`FAIL ${label}: ${error.code ?? ''} ${error.message}`);
  } else if (expectRows && (!data || (Array.isArray(data) && data.length === 0))) {
    failures++;
    console.error(`FAIL ${label}: expected rows, got none`);
  } else {
    passes++;
    console.log(`ok   ${label} (${Array.isArray(data) ? data.length : 1} row(s))`);
  }
}
function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function ensureInvite(societyId, phone, name, role, flatId = null) {
  const existing = must(
    await service.from('invites').select('id').eq('society_id', societyId).eq('phone', phone).eq('role', role),
    `read ${role} invite`,
  );
  if (existing.length) return;
  must(
    await service.from('invites').insert({ society_id: societyId, phone, name, role, flat_id: flatId }),
    `create ${role} invite`,
  );
}

async function signIn(phone) {
  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  // Local auth allows one OTP request per phone every few seconds (auth.sms.max_frequency).
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.auth.signInWithOtp({ phone });
    if (!error) break;
    const wait = /after (\d+) seconds?/.exec(error.message);
    if (!wait || attempt >= 3) throw new Error(`send OTP to ${phone}: ${error.message}`);
    await new Promise((r) => setTimeout(r, (Number(wait[1]) + 1) * 1000));
  }
  const { session } = must(await client.auth.verifyOtp({ phone, token: OTP, type: 'sms' }), `verify OTP ${phone}`);
  must(await client.rpc('claim_invites'), `claim invites ${phone}`);
  return { client, userId: session.user.id };
}

// --- setup (service role) -----------------------------------------------------
const society = must(
  await service.from('societies').select('id').eq('name', 'Demo Society').limit(1).maybeSingle(),
  'find Demo Society',
);
if (!society) throw new Error('Demo Society not found - run `npx supabase db reset` (dev seed) first.');
const flat = must(
  await service.from('flats').select('id').eq('society_id', society.id).order('number').limit(1).single(),
  'find a flat',
);
await ensureInvite(society.id, GUARD_PHONE, 'Smoke Guard', 'guard');
await ensureInvite(society.id, RESIDENT_PHONE, 'Smoke Resident', 'resident', flat.id);

// --- admin (web admin panel) -------------------------------------------------
const admin = await signIn(ADMIN_PHONE);
check(
  'admin  App        memberships ADMIN_SOCIETIES_SELECT',
  await admin.client.from('memberships').select(S.ADMIN_SOCIETIES_SELECT).eq('profile_id', admin.userId).eq('role', 'admin'),
  true,
);
check(
  'admin  People     flats ADMIN_FLATS_SELECT',
  await admin.client.from('flats').select(S.ADMIN_FLATS_SELECT).eq('society_id', society.id),
  true,
);
check(
  'admin  People     memberships ADMIN_MEMBERS_SELECT',
  await admin.client.from('memberships').select(S.ADMIN_MEMBERS_SELECT).eq('society_id', society.id),
  true,
);
check(
  'admin  People     flat_residents ADMIN_FLAT_LINKS_SELECT',
  await admin.client.from('flat_residents').select(S.ADMIN_FLAT_LINKS_SELECT).eq('flats.society_id', society.id),
);

// --- guard (mobile) -----------------------------------------------------------
const guard = await signIn(GUARD_PHONE);
must(
  await guard.client.rpc('create_visit', {
    p_flat_id: flat.id,
    p_name: 'Smoke Visitor',
    p_phone: null,
    p_purpose: 'guest',
    p_photo_path: null,
  }),
  'guard create_visit',
);
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
const today = await guard.client
  .from('visits')
  .select(S.GUARD_TODAY_VISITS_SELECT)
  .eq('society_id', society.id)
  .gte('created_at', startOfDay.toISOString())
  .order('created_at', { ascending: false });
check('guard  Today      visits GUARD_TODAY_VISITS_SELECT', today, true);
if (!today.error && today.data?.[0] && !today.data[0].flats?.towers?.name) {
  failures++;
  console.error('FAIL guard  Today: embedded flats.towers.name missing');
}

// --- resident (mobile) --------------------------------------------------------
const resident = await signIn(RESIDENT_PHONE);
check(
  'res    FlatCtx    flat_residents RESIDENT_FLATS_SELECT',
  await resident.client.from('flat_residents').select(S.RESIDENT_FLATS_SELECT).eq('profile_id', resident.userId).order('created_at'),
  true,
);
check(
  'res    Household  flat_residents HOUSEHOLD_MEMBERS_SELECT',
  await resident.client.from('flat_residents').select(S.HOUSEHOLD_MEMBERS_SELECT).eq('flat_id', flat.id).order('created_at'),
  true,
);

// --- admin visitor log (after the guard created a visit) ----------------------
check(
  'admin  VisitorLog visits ADMIN_VISIT_LOG_SELECT',
  await admin.client.from('visits').select(S.ADMIN_VISIT_LOG_SELECT).eq('society_id', society.id).limit(200),
  true,
);

console.log(`\n${passes} passed, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
