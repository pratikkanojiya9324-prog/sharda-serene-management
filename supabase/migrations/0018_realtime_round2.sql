-- Realtime: guard screens subscribe to attendance and parcel changes (RLS still applies)
alter publication supabase_realtime add table public.helper_attendance, public.parcels;
