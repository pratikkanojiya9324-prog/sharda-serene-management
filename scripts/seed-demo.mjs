// Idempotent demo data for "Sharda Serene" (service role). Safe to run repeatedly:
// existing society/towers/flats/accounts are kept (passwords are NOT reset), and
// family, notices, complaints and bills are only created where none exist yet.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
// Optional: SEED_TEST_PHONES="9876543210,9123456789" gives those numbers to B1-A-101 / B1-A-102 members.
// Local stack:  eval "$(npx supabase status -o env)"
//               SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run seed:demo
import { createClient } from '@supabase/supabase-js';

import { flatEmail, flatLabel, staffEmail } from '../packages/shared/src/flatLabel.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SOCIETY_NAME = 'Sharda Serene';
const BUILDINGS = ['Building 1', 'Building 2'];
const WINGS = ['A', 'B'];
const FLAT_NUMBERS = [];
for (let floor = 1; floor <= 7; floor++) for (let k = 1; k <= 6; k++) FLAT_NUMBERS.push(`${floor}0${k}`);

const STAFF = [
  { username: 'admin', name: 'Demo Admin', role: 'admin', password: 'Admin@123' },
  { username: 'guard1', name: 'Gate Guard 1', role: 'guard', password: 'Guard@123' },
];

async function ok(p) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

// Runs fn over items, `size` at a time (keeps auth admin calls polite).
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

// ---- society, towers, flats -------------------------------------------------
let society = (await ok(db.from('societies').select('id').eq('name', SOCIETY_NAME).limit(1)))[0];
if (!society) {
  society = await ok(
    db.from('societies').insert({ name: SOCIETY_NAME, address: 'Sharda Serene, Demo Road', short_code: 'SS' }).select('id').single(),
  );
}
const societyId = society.id;

const towers = await ok(db.from('towers').select('id, building, name').eq('society_id', societyId));
const towerKey = (b, w) => `${b}|${w}`;
const towerId = new Map(towers.map((t) => [towerKey(t.building, t.name), t.id]));
for (const building of BUILDINGS) {
  for (const wing of WINGS) {
    if (towerId.has(towerKey(building, wing))) continue;
    const t = await ok(db.from('towers').insert({ society_id: societyId, building, name: wing }).select('id').single());
    towerId.set(towerKey(building, wing), t.id);
  }
}

const existingFlats = await ok(db.from('flats').select('id, tower_id, number').eq('society_id', societyId));
const flatId = new Map(existingFlats.map((f) => [`${f.tower_id}|${f.number}`, f.id]));
const missing = [];
for (const [bi, building] of BUILDINGS.entries()) {
  for (const wing of WINGS) {
    const tid = towerId.get(towerKey(building, wing));
    for (const number of FLAT_NUMBERS) if (!flatId.has(`${tid}|${number}`)) missing.push({ society_id: societyId, tower_id: tid, number });
  }
}
if (missing.length) {
  for (const f of await ok(db.from('flats').insert(missing).select('id, tower_id, number'))) flatId.set(`${f.tower_id}|${f.number}`, f.id);
}

// Flat list with labels and demo passwords, in a stable order.
const flats = [];
for (const [bi, building] of BUILDINGS.entries()) {
  for (const wing of WINGS) {
    for (const number of FLAT_NUMBERS) {
      flats.push({
        id: flatId.get(`${towerId.get(towerKey(building, wing))}|${number}`),
        label: flatLabel(building, wing, number),
        password: `Sharda@${bi + 1}${wing}${number}`,
      });
    }
  }
}

// ---- auth users (flat accounts + staff) ------------------------------------
const userByEmail = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(error.message);
  for (const u of data.users) userByEmail.set(u.email, u.id);
  if (data.users.length < 1000) break;
}

async function ensureUser(email, password, metadata) {
  let id = userByEmail.get(email);
  let created = false;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, ...(metadata ? { user_metadata: metadata } : {}) });
    if (error) throw new Error(`${email}: ${error.message}`);
    id = data.user.id;
    userByEmail.set(email, id);
    created = true;
  }
  return { id, created };
}

let newFlatAccounts = 0;
await inBatches(flats, 8, async (f) => {
  const { id, created } = await ensureUser(flatEmail(f.id), f.password);
  if (created) newFlatAccounts++;
  f.userId = id;
  await ok(db.from('profiles').upsert({ id, name: f.label, phone: null }, { onConflict: 'id', ignoreDuplicates: true }));
  await ok(
    db.from('memberships').upsert({ profile_id: id, society_id: societyId, role: 'resident' }, {
      onConflict: 'profile_id,society_id,role',
      ignoreDuplicates: true,
    }),
  );
  await ok(db.from('flat_residents').upsert({ flat_id: f.id, profile_id: id }, { onConflict: 'flat_id,profile_id', ignoreDuplicates: true }));
});

const staffIds = {};
for (const s of STAFF) {
  const { id } = await ensureUser(staffEmail(s.username, societyId), s.password, { username: s.username });
  staffIds[s.username] = id;
  await ok(db.from('profiles').upsert({ id, name: s.name, phone: null }, { onConflict: 'id', ignoreDuplicates: true }));
  await ok(
    db.from('memberships').upsert({ profile_id: id, society_id: societyId, role: s.role }, {
      onConflict: 'profile_id,society_id,role',
      ignoreDuplicates: true,
    }),
  );
}

// ---- family members (every other flat, 1-4 members, only where none exist) --
const FIRST = ['Rahul', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Neha', 'Arjun', 'Kavita', 'Rohan', 'Meera', 'Sanjay', 'Anjali'];
const LAST = ['Sharma', 'Patel', 'Deshmukh', 'Iyer', 'Singh', 'Kulkarni', 'Mehta', 'Joshi'];
const RELATIONS = ['Self', 'Spouse', 'Son', 'Daughter', 'Mother', 'Father'];
const withFamily = new Set((await ok(db.from('family_members').select('flat_id').eq('society_id', societyId).limit(1000))).map((r) => r.flat_id));
// Family phones are NULL by default so no real person's number is ever seeded. For push/phone
// tests, SEED_TEST_PHONES="9876543210,9123456789" assigns those numbers (as +91...) round-robin
// to the members of B1-A-101 and B1-A-102 only.
const testPhones = (process.env.SEED_TEST_PHONES ?? '')
  .split(',')
  .map((p) => p.replace(/D/g, '').slice(-10))
  .filter((p) => p.length === 10)
  .map((p) => `+91${p}`);
const PHONE_FLATS = new Set(['B1-A-101', 'B1-A-102']);
let phoneIdx = 0;
const familyRows = [];
flats.forEach((f, i) => {
  if (withFamily.has(f.id) || (i % 2 !== 0 && !(testPhones.length && PHONE_FLATS.has(f.label)))) return;
  const count = (i % 4) + 1;
  const last = LAST[i % LAST.length];
  for (let m = 0; m < count; m++) {
    familyRows.push({
      society_id: societyId,
      flat_id: f.id,
      name: `${FIRST[(i + m * 5) % FIRST.length]} ${last}`,
      phone: testPhones.length && PHONE_FLATS.has(f.label) ? testPhones[phoneIdx++ % testPhones.length] : null,
      relation: RELATIONS[m],
    });
  }
});
if (familyRows.length) await ok(db.from('family_members').insert(familyRows));

// ---- notices, complaints, bills (only if none yet) -------------------------
const adminId = staffIds.admin;
const noticeCount = (await ok(db.from('notices').select('id').eq('society_id', societyId).limit(1))).length;
let newNotices = 0;
if (!noticeCount) {
  const notices = [
    { title: 'Water supply interruption', body: 'Water supply will be off on Sunday from 10 am to 2 pm for tank cleaning. Please store water in advance.', pinned: true },
    { title: 'Annual general meeting', body: 'The AGM will be held in the clubhouse on the last Saturday of this month at 6 pm. All members are requested to attend.', pinned: false },
    { title: 'Diwali celebration', body: 'Join us for rangoli, sweets and fireworks (green crackers only) in the central garden. Volunteers welcome.', pinned: false },
  ].map((n) => ({ ...n, society_id: societyId, created_by: adminId }));
  await ok(db.from('notices').insert(notices));
  newNotices = notices.length;
}

const complaintCount = (await ok(db.from('complaints').select('id').eq('society_id', societyId).limit(1))).length;
let newComplaints = 0;
if (!complaintCount) {
  const samples = [
    { i: 0, category: 'plumbing', description: 'Kitchen tap is leaking continuously.', status: 'open' },
    { i: 7, category: 'lift', description: 'Lift in the wing is making a loud noise between floors 3 and 4.', status: 'in_progress' },
    { i: 15, category: 'cleaning', description: 'Garbage not collected from the 5th floor for two days.', status: 'resolved' },
    { i: 22, category: 'parking', description: 'An unknown vehicle is parked in our reserved slot.', status: 'open' },
  ];
  for (const s of samples) {
    const f = flats[s.i];
    const c = await ok(
      db.from('complaints').insert({
        society_id: societyId, flat_id: f.id, category: s.category, description: s.description,
        status: s.status, created_by: f.userId, created_by_name: 'Demo resident',
      }).select('id').single(),
    );
    if (s.status !== 'open') {
      await ok(
        db.from('complaint_comments').insert({
          complaint_id: c.id, society_id: societyId, author_id: adminId, author_name: 'Demo Admin',
          body: s.status === 'resolved' ? 'Fixed today. Please confirm.' : 'Technician has been informed and will visit tomorrow.',
        }),
      );
    }
    newComplaints++;
  }
}

// Bills for the current month for every flat without one; a few are marked paid with receipts.
const now = new Date();
const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10)).toISOString().slice(0, 10);
const haveBill = new Set((await ok(db.from('bills').select('flat_id').eq('society_id', societyId).eq('period', period).limit(1000))).map((b) => b.flat_id));
const newBills = flats.filter((f) => !haveBill.has(f.id)).map((f) => ({
  society_id: societyId, flat_id: f.id, period, amount: 2500, due_date: due,
}));
let paidBills = 0;
if (newBills.length) {
  const inserted = await ok(db.from('bills').insert(newBills).select('id'));
  const counter = (await ok(db.from('receipt_counters').select('last').eq('society_id', societyId).eq('month', period)))[0];
  let last = counter?.last ?? 0;
  const modes = ['cash', 'upi', 'cheque', 'other', 'upi'];
  for (const [n, b] of inserted.slice(0, 5).entries()) {
    last++;
    await ok(
      db.from('bills').update({
        status: 'paid', paid_at: new Date().toISOString(), payment_mode: modes[n],
        payment_reference: modes[n] === 'cash' ? null : `DEMO-${1000 + n}`,
        receipt_no: `SS-${period.slice(0, 7)}-${String(last).padStart(4, '0')}`,
      }).eq('id', b.id),
    );
    paidBills++;
  }
  await ok(db.from('receipt_counters').upsert({ society_id: societyId, month: period, last }, { onConflict: 'society_id,month' }));
}

// ---- daily help + a parcel (Round 2) -----------------------------------------
// Fixed demo entry codes so testers can try the guard keypad: 111111, 222222, 333333.
const flatByLabel = new Map(flats.map((f) => [f.label, f.id]));
const HELPERS = [
  { name: 'Sunita', phone: '+919800000001', type: 'maid', entry_code: '111111', flats: ['B1-A-101', 'B1-A-102'] },
  { name: 'Ramesh', phone: '+919800000002', type: 'driver', entry_code: '222222', flats: ['B1-A-101'] },
  { name: 'Meena', phone: '+919800000003', type: 'cook', entry_code: '333333', flats: ['B2-A-301'] },
];
let newHelpers = 0;
for (const h of HELPERS) {
  let row = (await ok(db.from('helpers').select('id').eq('society_id', societyId).eq('phone', h.phone).limit(1)))[0];
  if (!row) {
    row = await ok(
      db.from('helpers')
        .insert({ society_id: societyId, name: h.name, phone: h.phone, type: h.type, entry_code: h.entry_code })
        .select('id')
        .single(),
    );
    newHelpers++;
  }
  const links = h.flats.map((label) => ({ helper_id: row.id, flat_id: flatByLabel.get(label), society_id: societyId }));
  await ok(db.from('helper_flats').upsert(links, { onConflict: 'helper_id,flat_id', ignoreDuplicates: true }));
}

const parcelCount = (await ok(db.from('parcels').select('id').eq('society_id', societyId).limit(1))).length;
if (!parcelCount) {
  await ok(
    db.from('parcels').insert({
      society_id: societyId,
      flat_id: flatByLabel.get('B1-A-101'),
      courier: 'Amazon',
      note: 'Medium box',
      logged_by: staffIds.guard1,
    }),
  );
}

// ---- summary ---------------------------------------------------------------
const count = async (table) => (await db.from(table).select('id', { count: 'exact', head: true }).eq('society_id', societyId)).count;
console.log(`Society: ${SOCIETY_NAME}  id=${societyId}`);
console.log(`Flats: ${flats.length} (new flat accounts this run: ${newFlatAccounts})`);
console.log(`Family members: ${await count('family_members')}  Notices: ${await count('notices')} (+${newNotices})  Complaints: ${await count('complaints')} (+${newComplaints})`);
console.log(`Bills: ${await count('bills')} (new this run: ${newBills.length}, marked paid: ${paidBills}, period ${period})`);
console.log(`Daily help: ${await count('helpers')} (+${newHelpers}, codes 111111/222222/333333)  Parcels: ${await count('parcels')}`);
console.log('Demo logins:');
console.log(`  Flat Building 1 / A / 101 -> password ${flats[0].password}  (pattern Sharda@<building><wing><flat>)`);
for (const s of STAFF) console.log(`  Staff ${s.role}: username ${s.username} / ${s.password}`);
