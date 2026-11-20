// Bootstrap a staff account (guard/admin) with the service role, e.g. the first admin.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   npm run staff:create -- --society <id> --username admin --name "Demo Admin" --role admin --password Admin@123
// Never commit the service role key; pass it through the environment only.
import { createClient } from '@supabase/supabase-js';

import { isValidUsername, staffEmail } from '../packages/shared/src/flatLabel.ts';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const society = arg('society');
const username = arg('username');
const name = arg('name');
const role = arg('role');
const password = arg('password');

const usage =
  'Usage: npm run staff:create -- --society <id> --username <u> --name <name> --role guard|admin --password <pw>\n' +
  'Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY';
function die(msg) {
  console.error(`${msg}\n${usage}`);
  process.exit(1);
}

if (!url || !key) die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
if (!society || !username || !name || !role || !password) die('Missing argument.');
if (!isValidUsername(username)) die('username must match [a-z0-9_.-]{3,30}.');
if (role !== 'guard' && role !== 'admin') die('role must be guard or admin.');
if (password.length < 6) die('password must be at least 6 characters.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: soc, error: socErr } = await db.from('societies').select('id').eq('id', society).maybeSingle();
if (socErr || !soc) die(`Society ${society} not found${socErr ? `: ${socErr.message}` : ''}.`);

const { data, error } = await db.auth.admin.createUser({
  email: staffEmail(username, society),
  password,
  email_confirm: true,
});
if (error) {
  console.error(/already|registered|exists/i.test(error.message) ? `Username "${username}" is already taken.` : error.message);
  process.exit(1);
}
const id = data.user.id;
for (const [table, row] of [
  ['profiles', { id, name, phone: null }],
  ['memberships', { profile_id: id, society_id: society, role }],
]) {
  const { error: e } = await db.from(table).insert(row);
  if (e) {
    await db.auth.admin.deleteUser(id);
    console.error(`Failed to create ${table} row (rolled back): ${e.message}`);
    process.exit(1);
  }
}
console.log(`Created ${role} "${username}" (${name}) for society ${society}; user id ${id}.`);
