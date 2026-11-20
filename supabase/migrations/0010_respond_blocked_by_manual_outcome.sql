-- Once the guard has recorded a manual outcome (allowed / sent back), the
-- residents can no longer answer the request: it raises already_responded.
create or replace function public.respond_to_visit(p_visit_id uuid, p_response public.visit_status)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_flat uuid;
  v_status public.visit_status;
  v_visit public.visits;
begin
  select flat_id into v_flat from public.visits where id = p_visit_id;
  if v_flat is null or not public.is_flat_resident(v_flat) then
    raise exception 'not_authorized';
  end if;
  if p_response not in ('approved', 'denied', 'leave_at_gate') then
    raise exception 'invalid_response';
  end if;

  update public.visits
     set status = p_response, responded_by = auth.uid(), responded_at = now()
   where id = p_visit_id and status = 'pending' and manual_outcome is null
  returning * into v_visit;

  if not found then
    select status into v_status from public.visits where id = p_visit_id;
    if v_status = 'expired' then
      raise exception 'visit_expired';
    end if;
    raise exception 'already_responded';
  end if;
  return v_visit;
end;
$$;

revoke execute on function public.respond_to_visit(uuid, public.visit_status) from public, anon, authenticated;
grant execute on function public.respond_to_visit(uuid, public.visit_status) to authenticated;
