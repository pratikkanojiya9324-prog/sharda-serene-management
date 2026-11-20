-- Migration 0012: notices, complaints, bills (RPC-only writes).
begin;
select plan(48);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '102'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', '101');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'adminb@staff.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'Admin B');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102');

-- ---------------------------------------------------------------- schema
select is((select short_code from societies where id = 'aaaaaaaa-0000-0000-0000-000000000000'), 'SS', 'societies.short_code defaults to SS');
select is((select count(*)::int from storage.buckets where id in ('notices', 'complaint-photos') and not public), 2, 'both buckets exist and are private');
select ok(
  (select with_check ilike '%case%' from pg_policies where tablename = 'objects' and policyname = 'notices_admin_insert'),
  'notices insert policy uses CASE');

-- ---------------------------------------------------------------- notices (admin)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select lives_ok($$select create_notice('Water cut', 'Tomorrow 10-12', null, null, false)$$, 'admin creates notice');
select is((select pinned from create_notice('Pinned', 'Body', 'aaaaaaaa-0000-0000-0000-000000000000/n.pdf', 'pdf', true)), true, 'admin creates pinned notice with attachment');
select throws_ok($$select create_notice('X', 'Y', 'bbbbbbbb-0000-0000-0000-000000000000/n.pdf', 'pdf', false)$$,
  'P0001', 'invalid_attachment', 'attachment must live in own society folder');
select throws_ok($$select create_notice('  ', 'Y')$$, 'P0001', 'invalid_title', 'blank title rejected');
select lives_ok($$select set_notice_pinned((select id from notices where title = 'Water cut'), true)$$, 'admin pins notice');
select is((select pinned from notices where title = 'Water cut'), true, 'notice is pinned');
select lives_ok($$select delete_notice((select id from notices where title = 'Pinned'))$$, 'admin deletes notice');
select is((select count(*)::int from notices), 1, 'one notice left');

-- direct writes revoked
select throws_ok($$insert into notices (society_id, title, body) values ('aaaaaaaa-0000-0000-0000-000000000000', 'x', 'y')$$,
  '42501', null, 'admin cannot insert notices directly');
select throws_ok($$update bills set amount = 1$$, '42501', null, 'admin cannot update bills directly');

-- ---------------------------------------------------------------- notices (resident)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from notices), 1, 'resident reads society notices');
select throws_ok($$select create_notice('Hi', 'There')$$, 'P0001', 'not_authorized', 'resident cannot create_notice');
select throws_ok($$select set_notice_pinned((select id from notices limit 1), false)$$, 'P0001', 'not_authorized', 'resident cannot pin');
select throws_ok($$select delete_notice((select id from notices limit 1))$$, 'P0001', 'not_authorized', 'resident cannot delete notice');
select throws_ok($$select delete_notice('00000000-0000-0000-0000-000000000099')$$, 'P0001', 'not_authorized', 'unknown notice id is not_authorized');

-- ---------------------------------------------------------------- complaints
select lives_ok($$select create_complaint('aaaaaaaa-0000-0000-0000-0000000000f1', 'plumbing', 'Leak in kitchen', null, '  Rahul ')$$,
  'resident creates complaint for own flat');
select is((select created_by_name from complaints limit 1), 'Rahul', 'actor name trimmed and stored');
select throws_ok($$select create_complaint('aaaaaaaa-0000-0000-0000-0000000000f2', 'lift', 'Stuck')$$,
  'P0001', 'not_authorized', 'cannot complain for another flat');
select throws_ok($$select set_complaint_status((select id from complaints limit 1), 'resolved')$$,
  'P0001', 'not_authorized', 'resident cannot set status');
select lives_ok($$select add_complaint_comment((select id from complaints limit 1), 'Please hurry', 'Rahul')$$,
  'resident comments on own complaint');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select lives_ok($$select create_complaint('aaaaaaaa-0000-0000-0000-0000000000f2', 'lift', 'Lift stuck')$$, 'flat 2 creates complaint');
select is((select count(*)::int from complaints), 1, 'flat 2 sees only own complaint');
select is((select count(*)::int from complaint_comments), 0, 'flat 2 sees none of flat 1 comments');
select throws_ok($$select add_complaint_comment((select id from complaints where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 'hi')$$,
  'P0001', 'not_authorized', 'comment on another flat complaint is not_authorized');
-- flat 1 complaint is invisible to flat 2, so look it up as postgres for the id
reset role;
create temp table c1 as select id from complaints where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
grant select on c1 to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok($$select add_complaint_comment((select id from c1), 'hi')$$,
  'P0001', 'not_authorized', 'flat 2 cannot comment on flat 1 complaint (real id)');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is((select count(*)::int from complaints), 2, 'admin sees all complaints');
select lives_ok($$select add_complaint_comment((select id from c1), 'On it', 'Admin')$$, 'admin comments');
select is((select status::text from set_complaint_status((select id from c1), 'in_progress')), 'in_progress', 'admin sets status');
select ok((select updated_at > created_at from complaints where id = (select id from c1)), 'status change bumps updated_at');

-- ---------------------------------------------------------------- bills
select is(generate_bills('2026-11-01', 1500, '2026-11-10'), 2, 'generate_bills creates a bill per flat');
select is(generate_bills('2026-11-01', 1500, '2026-11-10'), 0, 'second generate_bills for same period creates none');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from bills), 1, 'flat 1 sees only its own bill');
select throws_ok($$select generate_bills('2026-12-01', 1, '2026-12-10')$$, 'P0001', 'not_authorized', 'resident cannot generate_bills');
select throws_ok($$select mark_bill_paid((select id from bills limit 1), 'cash')$$, 'P0001', 'not_authorized', 'resident cannot mark_bill_paid');

-- ---------------------------------------------------------------- receipts
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is(
  (select receipt_no from mark_bill_paid((select id from bills where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 'upi', 'REF1')),
  'SS-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') || '-0001', 'first receipt number');
select is(
  (select receipt_no from mark_bill_paid((select id from bills where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f2'), 'cash')),
  'SS-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') || '-0002', 'second receipt number');
select throws_ok($$select mark_bill_paid((select id from bills where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 'cash')$$,
  'P0001', 'already_paid', 'paying a paid bill raises already_paid');
select is(generate_bills_custom('2026-12-01', '2026-12-10',
  '[{"flat_id":"aaaaaaaa-0000-0000-0000-0000000000f1","amount":900}]'::jsonb), 1, 'custom bills create listed rows');
select throws_ok($$select generate_bills_custom('2026-12-01', '2026-12-10',
  '[{"flat_id":"bbbbbbbb-0000-0000-0000-0000000000f1","amount":900}]'::jsonb)$$,
  'P0001', 'not_authorized', 'custom bills reject a flat of another society');

-- ---------------------------------------------------------------- storage
select lives_ok($$insert into storage.objects (bucket_id, name) values ('notices', 'aaaaaaaa-0000-0000-0000-000000000000/n.png')$$,
  'admin uploads to notices');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('notices', 'aaaaaaaa-0000-0000-0000-000000000000/n2.png')$$,
  '42501', null, 'resident cannot upload to notices');
select is((select count(*)::int from storage.objects where bucket_id = 'notices'), 1, 'resident can read notice objects');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('complaint-photos', 'aaaaaaaa-0000-0000-0000-000000000000/c.jpg')$$,
  'resident uploads complaint photo');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('complaint-photos', 'bbbbbbbb-0000-0000-0000-000000000000/c.jpg')$$,
  '42501', null, 'resident cannot upload complaint photo to another society');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('complaint-photos', 'nope/c.jpg')$$,
  '42501', null, 'non-uuid folder denied without cast error');

select * from finish();
rollback;
