begin;
select plan(2);

select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'helper_attendance'),
  'helper_attendance is in the realtime publication');
select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parcels'),
  'parcels is in the realtime publication');

select * from finish();
rollback;
