-- Round 3 notifications: polls, events, amenity bookings and SOS alerts post to the
-- notify Edge Function via public.notify_post (0013): pg_net + Vault, never blocking
-- the write. notify_round1_insert / notify_round2_update (0013 / 0016) are the generic
-- row posters; the Edge Function decides recipients and message copy.

create trigger polls_notify_insert after insert on public.polls
  for each row execute function public.notify_round1_insert();
-- The reminder cron (and any manual nudge) stamps last_reminded_at.
create trigger polls_notify_reminder after update of last_reminded_at on public.polls
  for each row when (old.last_reminded_at is distinct from new.last_reminded_at and new.last_reminded_at is not null)
  execute function public.notify_round2_update();

create trigger events_notify_insert after insert on public.events
  for each row execute function public.notify_round1_insert();

create trigger amenity_bookings_notify_insert after insert on public.amenity_bookings
  for each row when (new.status = 'pending')
  execute function public.notify_round1_insert();
create trigger amenity_bookings_notify_decided after update of status on public.amenity_bookings
  for each row when (old.status = 'pending' and new.status in ('confirmed', 'rejected'))
  execute function public.notify_round2_update();

create trigger sos_alerts_notify_insert after insert on public.sos_alerts
  for each row execute function public.notify_round1_insert();
create trigger sos_alerts_notify_update after update of status on public.sos_alerts
  for each row when (old.status is distinct from new.status and new.status in ('acknowledged', 'resolved'))
  execute function public.notify_round2_update();

-- Realtime: SOS banners, poll results and booking calendars update live (RLS still applies)
alter publication supabase_realtime add table public.sos_alerts, public.polls, public.amenity_bookings;
