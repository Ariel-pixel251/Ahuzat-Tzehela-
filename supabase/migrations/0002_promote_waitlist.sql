-- Move people up from the waiting list while they fit the event's capacity.
-- Run by the daily job for every upcoming event with a capacity, so promotions also happen when a
-- cancellation came in while the calendar was unreachable, or when the capacity is raised in the calendar.
-- Returns the ids that were promoted to 'confirmed'.
create function promote_waitlist(p_key text, p_capacity int) returns setof uuid
language plpgsql as $$
declare
  v_taken int;
  w record;
begin
  if p_capacity is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('event:' || p_key));
  select coalesce(sum(attendees), 0) into v_taken
    from event_registrations where event_key = p_key and status = 'confirmed';
  for w in select id, attendees from event_registrations
            where event_key = p_key and status = 'waitlist' order by created_at loop
    if v_taken + w.attendees <= p_capacity then
      update event_registrations set status = 'confirmed' where id = w.id;
      v_taken := v_taken + w.attendees;
      return next w.id;
    end if;
  end loop;
end $$;

-- same lock-down as 0001_init.sql
revoke execute on function promote_waitlist(text, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function promote_waitlist(text, int) from anon, authenticated';
  end if;
end $$;
