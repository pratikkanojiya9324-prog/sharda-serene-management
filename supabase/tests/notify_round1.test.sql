-- Migration 0013: notices/complaints/comments/bills notify triggers never block and
-- only queue a webhook when Vault secrets exist (admin-authored comments only).
begin;
select plan(10);

insert into societies (id, name) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('bbbbbbbb-0000-0000-0000-0000000000a0', 'bbbbbbbb-0000-0000-0000-000000000000', 'TB');
insert into flats (id, society_id, tower_id, number) values
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000a0', 'B1');
insert into auth.users (id, phone) values
  ('bbbbbbbb-0000-0000-0000-00000000ad01', '910000000012'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', '910000000013');
insert into profiles (id, name, phone) values
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'Admin B',      '+910000000012'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'Resident B1',  '+910000000013');
insert into memberships (profile_id, society_id, role) values
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'bbbbbbbb-0000-0000-0000-000000000000', 'resident');

delete from vault.secrets where name in ('notify_url', 'notify_secret', 'service_role_key');

-- 1-6: with Vault secrets absent every write still succeeds and queues nothing
select lives_ok($$insert into notices (id, society_id, title, body) values
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Water cut', 'Tomorrow')$$,
  'notice insert succeeds without secrets');
select lives_ok($$insert into complaints (id, society_id, flat_id, category, description) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'plumbing', 'Leak')$$,
  'complaint insert succeeds without secrets');
select lives_ok($$update complaints set status = 'in_progress' where id = 'bbbbbbbb-0000-0000-0000-0000000000c1'$$,
  'complaint status update succeeds without secrets');
select lives_ok($$insert into complaint_comments (complaint_id, society_id, author_id, body) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000ad01', 'On it')$$,
  'comment insert succeeds without secrets');
select lives_ok($$insert into bills (id, society_id, flat_id, period, amount, due_date) values
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', '2026-11-01', 2500, '2026-12-10')$$,
  'bill insert succeeds without secrets');
select lives_ok($$update bills set status = 'paid', paid_at = now(), receipt_no = 'SS-2026-11-0001'
  where id = 'bbbbbbbb-0000-0000-0000-0000000000d1'$$, 'bill paid update succeeds without secrets');

select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round1'), 0,
  'nothing queued without secrets');

-- with secrets: each event queues exactly one webhook; resident comments none
select vault.create_secret('http://test.invalid/round1', 'notify_url');
select vault.create_secret('r1-secret', 'notify_secret');

insert into notices (society_id, title, body) values ('bbbbbbbb-0000-0000-0000-000000000000', 'N2', 'b');
insert into complaints (id, society_id, flat_id, category, description) values
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'lift', 'Stuck');
update complaints set status = 'resolved' where id = 'bbbbbbbb-0000-0000-0000-0000000000c2';
update complaints set description = 'Stuck again' where id = 'bbbbbbbb-0000-0000-0000-0000000000c2';
insert into complaint_comments (complaint_id, society_id, author_id, body) values
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000ad01', 'admin reply');
insert into complaint_comments (complaint_id, society_id, author_id, body) values
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000e101', 'resident reply');
insert into bills (id, society_id, flat_id, period, amount, due_date) values
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', '2026-12-01', 3000, '2027-01-10');
update bills set status = 'paid', paid_at = now(), receipt_no = 'SS-2026-12-0001'
  where id = 'bbbbbbbb-0000-0000-0000-0000000000d2';

select is(
  (select array_agg(b->>'table' || ':' || (b->>'type') order by b->>'table', b->>'type')
   from (select convert_from(body, 'utf8')::jsonb b from net.http_request_queue where url = 'http://test.invalid/round1') q),
  array['bills:INSERT','bills:UPDATE','complaint_comments:INSERT','complaints:INSERT','complaints:UPDATE','notices:INSERT'],
  'one webhook per event; resident comment and non-status update queue nothing');

select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round1'), 6,
  'exactly six calls queued');
select is(
  (select headers->>'Authorization' from net.http_request_queue where url = 'http://test.invalid/round1' limit 1),
  'Bearer r1-secret', 'webhook sends Bearer <notify_secret>');

select * from finish();
rollback;
