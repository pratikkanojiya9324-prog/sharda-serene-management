-- DEV seed: applied automatically by `supabase db reset`. Do NOT use in production
-- (use supabase/setup-society.sql instead).
-- Log in locally as the admin with test phone +919999999999 (OTP 123456).
with s as (
  insert into societies (name) values ('Demo Society') returning id
), t as (
  insert into towers (society_id, name) select id, 'A' from s returning id, society_id
), f as (
  insert into flats (society_id, tower_id, number)
  select society_id, id, n from t, (values ('A-101'), ('A-102')) as v(n)
  returning id
)
insert into invites (society_id, phone, name, role)
select id, '+919999999999', 'Demo Admin', 'admin' from s;
