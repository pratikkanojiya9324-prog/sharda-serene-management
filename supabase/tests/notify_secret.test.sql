-- Migration 0008: the notify trigger authenticates with Vault secret notify_secret.
begin;
select plan(3);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'TA');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A1');
insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',     '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1', '+910000000003');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101');

delete from vault.secrets where name in ('notify_url', 'notify_secret', 'service_role_key');
select vault.create_secret('http://test.invalid/notify', 'notify_url');
select vault.create_secret('legacy-key', 'service_role_key');

insert into visits (society_id, flat_id, name, purpose, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'NoSecret', 'guest',
   'aaaaaaaa-0000-0000-0000-00000000a901');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/notify'), 0,
  'no call without notify_secret (service_role_key is no longer used)');

select vault.create_secret('s3cret-value', 'notify_secret');
insert into visits (society_id, flat_id, name, purpose, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'WithSecret', 'guest',
   'aaaaaaaa-0000-0000-0000-00000000a901');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/notify'), 1,
  'one webhook call queued once notify_secret exists');
select is(
  (select headers->>'Authorization' from net.http_request_queue where url = 'http://test.invalid/notify'),
  'Bearer s3cret-value', 'webhook sends Bearer <notify_secret>');

select * from finish();
rollback;
