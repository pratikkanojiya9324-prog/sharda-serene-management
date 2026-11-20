-- Production: create your first society and its first admin invite.
-- Run once:
--   psql "$DB_URL" -v society_name='Green Park Society' -v admin_phone='+919812345678' \
--     [-v admin_name='Your Name'] -f supabase/setup-society.sql
-- The admin then logs in to the admin site with that phone (OTP) and the invite is claimed.
\set ON_ERROR_STOP on
\if :{?admin_name}
\else
  \set admin_name 'Admin'
\endif

-- psql variables are not expanded inside $$ blocks, so pass the phone via a setting.
select set_config('sg.admin_phone', :'admin_phone', false);
do $$
begin
  if current_setting('sg.admin_phone') !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'admin_phone must look like +919876543210 (got %)', current_setting('sg.admin_phone');
  end if;
end $$;

with s as (
  insert into societies (name) values (:'society_name') returning id
)
insert into invites (society_id, phone, name, role)
select id, :'admin_phone', :'admin_name', 'admin' from s;

select s.name as society, i.phone, i.role
from invites i join societies s on s.id = i.society_id
where i.phone = :'admin_phone' order by i.created_at desc limit 1;
