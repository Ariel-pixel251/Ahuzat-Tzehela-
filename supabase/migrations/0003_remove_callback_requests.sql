-- Removes the "call me back" feature (owner's request, 2026-10-22): the call-back requests table, and
-- the lines about it in the daily clean-up and in "delete everything about a person".
-- (0001_init.sql was rewritten without it; this brings databases made from the old 0001 to the same state.)

drop table if exists callback_requests;

-- Run daily by the cron route. Returns how many rows each rule removed.
create or replace function purge_old_data() returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_out jsonb := '{}';
  n int;
begin
  -- event registrations: 90 days after the event; cancelled ones after 30 days
  delete from event_registrations
   where event_date < current_date - 90 or (status = 'cancelled' and cancelled_at < now() - interval '30 days');
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('event_registrations', n);
  -- slots (with their bookings and volunteers): 90 days after the slot; cancelled slots after 30 days
  delete from digital_slots
   where slot_date < current_date - 90 or (status = 'cancelled' and cancelled_at < now() - interval '30 days');
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_slots', n);
  delete from digital_bookings where status = 'cancelled' and cancelled_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_bookings_cancelled', n);
  delete from digital_volunteers where status = 'cancelled' and cancelled_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_volunteers_cancelled', n);
  delete from digital_slot_series where until_date < current_date - 90;
  -- people who left the podcast: after 30 days
  delete from podcast_participants where not active and withdrawn_at < now() - interval '30 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_withdrawn', n);
  -- manual message queue: sent after 30 days, unsent after 90
  delete from outbound_messages
   where (status = 'sent' and sent_at < now() - interval '30 days') or created_at < now() - interval '90 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('outbound_messages', n);
  -- students who aren't signed in and have no place in a slot: 30 days after their last activity
  delete from students st
   where st.created_at < now() - interval '30 days'
     and not exists (select 1 from student_tokens t where t.student_id = st.id and t.expires_at > now())
     and not exists (select 1 from digital_volunteers v where v.student_id = st.id);
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('students_inactive', n);
  -- podcast sign-ups: one year after signing up
  delete from podcast_participants where created_at < now() - interval '365 days';
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_old', n);
  delete from problem_reports where created_at < now() - interval '365 days';
  delete from audit_log where at < now() - interval '730 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from student_tokens where expires_at < now();
  delete from code_lockouts where updated_at < now() - interval '1 day' and (locked_until is null or locked_until < now());
  return v_out;
end $$;

-- Admin: delete everything stored about one person, by phone and/or email. Returns counts.
create or replace function delete_person_data(p_phone text, p_email text) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_out jsonb := '{}';
  n int;
  v_email text := lower(nullif(trim(p_email), ''));
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_phone is null and v_email is null then return v_out; end if;
  delete from event_registrations where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('event_registrations', n);
  delete from digital_bookings where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('digital_bookings', n);
  delete from podcast_pairs where id in (
    select m.pair_id from podcast_pair_members m join podcast_participants p on p.id = m.participant_id
     where p.phone = v_phone or lower(p.email) = v_email);
  delete from podcast_participants where phone = v_phone or lower(email) = v_email;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('podcast_participants', n);
  delete from outbound_messages where to_phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('outbound_messages', n);
  delete from students where lower(email) = v_email or phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('students', n);
  -- the person as a student's parent or guardian: remove their details from that student
  update students set guardian_name = null, guardian_phone = null, guardian_confirmed_at = null, age_group = null
   where guardian_phone = v_phone;
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('guardian_details', n);
  -- reports where they left their contact (students type it freely, so match inside the text)
  delete from problem_reports
   where (v_email is not null and position(v_email in lower(coalesce(contact, ''))) > 0)
      or (v_phone is not null and position(v_phone in regexp_replace(coalesce(contact, ''), '[^0-9+]', '', 'g')) > 0);
  get diagnostics n = row_count; v_out := v_out || jsonb_build_object('problem_reports', n);
  delete from code_lockouts where phone = v_phone;
  return v_out;
end $$;

revoke execute on function purge_old_data(), delete_person_data(text, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function purge_old_data(), delete_person_data(text, text) from anon, authenticated';
  end if;
end $$;
