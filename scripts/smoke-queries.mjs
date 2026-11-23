// LOCAL ONLY: reads the local stack from `npx supabase status` and creates a
// visit with the demo guard - never point it at the test or production project.
//
// Smoke test: run every select string the apps use against the LOCAL Supabase
// stack, signed in with the demo accounts, and fail on any error (e.g. PGRST201
// "more than one relationship was found" when an embed lacks its FK hint).
//
// Needs: `npx supabase start` and the demo data (`npm run seed:demo` against the
// local stack). Logs in with password, exactly like the apps:
//   flat  Building 1 / A / 101  Sharda@1A101  (flatEmail(flat_id))
//   staff admin / Admin@123, guard1 / Guard@123  (staffEmail(username, society_id))
// Every exported constant of packages/shared/src/selects.ts and
// apps/admin/src/lib/selects.ts must be exercised here, or the run fails.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

import { flatEmail, staffEmail } from '../packages/shared/src/flatLabel.ts';
import * as S from '../packages/shared/src/selects.ts';
import * as A from '../apps/admin/src/lib/selects.ts';

const SOCIETY_NAME = 'Sharda Serene';

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
const used = new Set();
/** Marks the select constant(s) as exercised and returns the string. */
function sel(name, value) {
  used.add(name);
  return value;
}
function check(label, { error, data, count }, expectRows = false) {
  if (error) {
    failures++;
    console.error(`FAIL ${label}: ${error.code ?? ''} ${error.message}`);
  } else if (expectRows && (!data || (Array.isArray(data) && data.length === 0))) {
    failures++;
    console.error(`FAIL ${label}: expected rows, got none`);
  } else {
    passes++;
    const n = count ?? (Array.isArray(data) ? data.length : 1);
    console.log(`ok   ${label} (${n} row(s))`);
  }
  return data;
}
function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function signIn(email, password, who) {
  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  const { session } = must(await client.auth.signInWithPassword({ email, password }), `sign in ${who}`);
  return { client, userId: session.user.id };
}

// --- setup --------------------------------------------------------------------
const society = must(
  await service.from('societies').select('id').eq('name', SOCIETY_NAME).limit(1).maybeSingle(),
  `find ${SOCIETY_NAME}`,
);
if (!society) throw new Error(`${SOCIETY_NAME} not found - run \`npm run seed:demo\` against the local stack first.`);
const societyId = society.id;

// The flat login, like the app: anon login directory -> flat id -> synthetic email.
const anon = createClient(env.API_URL, env.ANON_KEY, opts);
const directory = must(await anon.rpc('login_directory', { p_society_id: societyId }), 'login_directory');
const flat101 = directory.find((d) => d.building === 'Building 1' && d.wing === 'A' && d.flat_number === '101');
if (!flat101) throw new Error('Building 1 / A / 101 not in the login directory - run `npm run seed:demo`.');
const flatId = flat101.flat_id;

const admin = await signIn(staffEmail('admin', societyId), 'Admin@123', 'admin');
const guard = await signIn(staffEmail('guard1', societyId), 'Guard@123', 'guard1');
const resident = await signIn(flatEmail(flatId), 'Sharda@1A101', 'flat B1-A-101');

// --- admin website --------------------------------------------------------------
// Paged lists run exactly as the site's fetchAll() pages them (.order('id').range()).
const ac = admin.client;
check(
  'admin  App        memberships ADMIN_SOCIETIES_SELECT',
  await ac
    .from('memberships')
    .select(sel('ADMIN_SOCIETIES_SELECT', S.ADMIN_SOCIETIES_SELECT))
    .eq('profile_id', admin.userId)
    .eq('society_id', societyId)
    .eq('role', 'admin'),
  true,
);
check('admin  App        profiles name', await ac.from('profiles').select('name').eq('id', admin.userId), true);
const labels = check(
  'admin  Flats      flats ADMIN_FLAT_LABELS_SELECT',
  await ac.from('flats').select(sel('ADMIN_FLAT_LABELS_SELECT', A.ADMIN_FLAT_LABELS_SELECT)).eq('society_id', societyId).order('id').range(0, 999),
  true,
);
if (labels?.length && !labels[0].towers?.building) {
  failures++;
  console.error('FAIL admin  Flats: embedded towers.building missing');
}
check(
  'admin  Flats      flat_residents ADMIN_FLAT_ACCOUNTS_SELECT',
  await ac.from('flat_residents').select(sel('ADMIN_FLAT_ACCOUNTS_SELECT', A.ADMIN_FLAT_ACCOUNTS_SELECT)).eq('flats.society_id', societyId).order('id').range(0, 999),
  true,
);
check(
  'admin  Flats      family_members ADMIN_FAMILY_SELECT',
  await ac.from('family_members').select(sel('ADMIN_FAMILY_SELECT', A.ADMIN_FAMILY_SELECT)).eq('society_id', societyId).order('created_at').order('id').range(0, 999),
  true,
);
const staff = check(
  'admin  Staff      memberships ADMIN_STAFF_SELECT',
  await ac.from('memberships').select(sel('ADMIN_STAFF_SELECT', A.ADMIN_STAFF_SELECT)).eq('society_id', societyId).in('role', ['guard', 'admin']),
  true,
);
if (staff?.length && !staff[0].profiles?.name) {
  failures++;
  console.error('FAIL admin  Staff: embedded profiles.name missing');
}
check(
  'admin  Notices    notices ADMIN_NOTICES_SELECT',
  await ac
    .from('notices')
    .select(sel('ADMIN_NOTICES_SELECT', A.ADMIN_NOTICES_SELECT))
    .eq('society_id', societyId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false }),
  true,
);
const complaints = check(
  'admin  Complaints complaints ADMIN_COMPLAINTS_SELECT',
  await ac.from('complaints').select(sel('ADMIN_COMPLAINTS_SELECT', A.ADMIN_COMPLAINTS_SELECT)).eq('society_id', societyId).order('created_at', { ascending: false }),
  true,
);
if (complaints?.length) {
  check(
    'admin  Complaints complaint_comments ADMIN_COMPLAINT_COMMENTS_SELECT',
    await ac
      .from('complaint_comments')
      .select(sel('ADMIN_COMPLAINT_COMMENTS_SELECT', A.ADMIN_COMPLAINT_COMMENTS_SELECT))
      .eq('complaint_id', complaints[0].id)
      .order('created_at'),
  );
}
check(
  'admin  Bills      bills ADMIN_BILLS_SELECT',
  await ac.from('bills').select(sel('ADMIN_BILLS_SELECT', A.ADMIN_BILLS_SELECT)).eq('society_id', societyId).order('id').range(0, 999),
  true,
);
check(
  'admin  Dashboard  complaints count',
  await ac.from('complaints').select('id', { count: 'exact', head: true }).eq('society_id', societyId).neq('status', 'resolved'),
);
check('admin  Dashboard  bills amount,status', await ac.from('bills').select('amount, status').eq('society_id', societyId));
// Older shared constants: run while they are still exported (the coverage check
// below fails for any exported constant that is not run).
if ('ADMIN_FLATS_SELECT' in S) {
  check(
    'admin  (shared)   flats ADMIN_FLATS_SELECT',
    await ac.from('flats').select(sel('ADMIN_FLATS_SELECT', S.ADMIN_FLATS_SELECT)).eq('society_id', societyId),
    true,
  );
}
if ('ADMIN_MEMBERS_SELECT' in S) {
  check(
    'admin  (shared)   memberships ADMIN_MEMBERS_SELECT',
    await ac.from('memberships').select(sel('ADMIN_MEMBERS_SELECT', S.ADMIN_MEMBERS_SELECT)).eq('society_id', societyId),
    true,
  );
}
if ('ADMIN_FLAT_LINKS_SELECT' in S) {
  check(
    'admin  (shared)   flat_residents ADMIN_FLAT_LINKS_SELECT',
    await ac.from('flat_residents').select(sel('ADMIN_FLAT_LINKS_SELECT', S.ADMIN_FLAT_LINKS_SELECT)).eq('flats.society_id', societyId),
    true,
  );
}

// --- guard (mobile) -------------------------------------------------------------
must(
  await guard.client.rpc('create_visit', {
    p_flat_id: flatId,
    p_name: 'Smoke Visitor',
    p_phone: null,
    p_purpose: 'guest',
    p_photo_path: null,
  }),
  'guard create_visit',
);
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
const today = check(
  'guard  Today      visits GUARD_TODAY_VISITS_SELECT',
  await guard.client
    .from('visits')
    .select(sel('GUARD_TODAY_VISITS_SELECT', S.GUARD_TODAY_VISITS_SELECT))
    .eq('society_id', societyId)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false }),
  true,
);
if (today?.[0] && (!today[0].flats?.towers?.name || !today[0].flats?.towers?.building)) {
  failures++;
  console.error('FAIL guard  Today: embedded flats.towers.name/building missing');
}
// Flat picker (guard) and flat labels (in-app admin) page like the apps' fetchAll().
for (const [who, client] of [
  ['guard ', guard.client],
  ['admin ', ac],
]) {
  const dir = check(
    `${who} FlatPick   flats FLAT_DIRECTORY_SELECT`,
    await client
      .from('flats')
      .select(sel('FLAT_DIRECTORY_SELECT', S.FLAT_DIRECTORY_SELECT))
      .eq('society_id', societyId)
      .order('id')
      .range(0, 999),
    true,
  );
  if (dir?.length && (!dir[0].towers?.building || !dir[0].towers?.name)) {
    failures++;
    console.error(`FAIL ${who} FlatPick: embedded towers.building/name missing`);
  }
}

// --- flat account (mobile) ------------------------------------------------------
check(
  'flat   FlatCtx    flat_residents RESIDENT_FLATS_SELECT',
  await resident.client
    .from('flat_residents')
    .select(sel('RESIDENT_FLATS_SELECT', S.RESIDENT_FLATS_SELECT))
    .eq('profile_id', resident.userId)
    .order('created_at'),
  true,
);
if ('HOUSEHOLD_MEMBERS_SELECT' in S) {
  check(
    'flat   Household  flat_residents HOUSEHOLD_MEMBERS_SELECT',
    await resident.client.from('flat_residents').select(sel('HOUSEHOLD_MEMBERS_SELECT', S.HOUSEHOLD_MEMBERS_SELECT)).eq('flat_id', flatId).order('created_at'),
    true,
  );
}

// --- admin visitor log (after the guard created a visit) ------------------------
check(
  'admin  VisitorLog visits ADMIN_VISIT_LOG_SELECT',
  await ac.from('visits').select(sel('ADMIN_VISIT_LOG_SELECT', S.ADMIN_VISIT_LOG_SELECT)).eq('society_id', societyId).limit(200),
  true,
);

// --- admin daily help + parcels (Round 2) ---------------------------------------
check(
  'admin  DailyHelp  helpers HELPER_GUARD_SELECT (today attendance)',
  await ac
    .from('helpers')
    .select(sel('HELPER_GUARD_SELECT', S.HELPER_GUARD_SELECT))
    .eq('society_id', societyId)
    .gte('helper_attendance.entry_at', startOfDay.toISOString())
    .order('name')
    .order('id'),
);
check(
  'flat   DailyHelp  helpers HELPER_RESIDENT_SELECT (month attendance)',
  await resident.client
    .from('helpers')
    .select(sel('HELPER_RESIDENT_SELECT', S.HELPER_RESIDENT_SELECT))
    .gte('helper_attendance.entry_at', new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1).toISOString())
    .order('name'),
  true,
);
check(
  'flat   Parcels    parcels PARCEL_SELECT',
  await resident.client.from('parcels').select(sel('PARCEL_SELECT', S.PARCEL_SELECT)).eq('flat_id', flatId).order('created_at', { ascending: false }),
);
check(
  'admin  Parcels    parcels PARCEL_SELECT',
  await ac.from('parcels').select(sel('PARCEL_SELECT', S.PARCEL_SELECT)).eq('society_id', societyId).order('created_at', { ascending: false }).limit(500),
);

// --- coverage: every exported select constant must have been run ----------------
for (const name of [...Object.keys(S), ...Object.keys(A)]) {
  if (!name.endsWith('_SELECT')) continue;
  if (!used.has(name)) {
    failures++;
    console.error(`FAIL coverage: ${name} is exported but not exercised by scripts/smoke-queries.mjs`);
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
