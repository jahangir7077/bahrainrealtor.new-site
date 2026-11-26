\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;

insert into auth.users(id) values ('00000000-0000-0000-0000-000000000071');
insert into public.admin_profiles(id, authorized)
values ('00000000-0000-0000-0000-000000000071', true);
insert into public.content_items(id, kind, slug)
values ('10000000-0000-0000-0000-000000000071', 'property', 'notification-test');
insert into public.property_versions(id, item_id, transaction_type, availability, price_bhd, location_name)
values ('20000000-0000-0000-0000-000000000071',
  '10000000-0000-0000-0000-000000000071', 'sale', 'available', 100000, 'Test location');
insert into public.content_revisions(
  id, item_id, locale, property_version_id, title, body, area_name, property_type, created_by
) values (
  '30000000-0000-0000-0000-000000000071',
  '10000000-0000-0000-0000-000000000071', 'en',
  '20000000-0000-0000-0000-000000000071', 'Test property', 'Verified test content',
  'Test area', 'Apartment', '00000000-0000-0000-0000-000000000071'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000071', true);
select set_config('request.jwt.claims', '{"aal":"aal2","amr":[{"method":"totp"}]}', true);
set local role authenticated;
select public.approve_revision('30000000-0000-0000-0000-000000000071');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000071', null);

set local role service_role;
insert into public.enquiries(
  property_item_id, locale, name, email, message, consent, consent_text
) values
  ('10000000-0000-0000-0000-000000000071', 'en', 'Test recipient', 'test@example.invalid',
    'First notification payload', true, 'Approved local-test consent text'),
  ('10000000-0000-0000-0000-000000000071', 'en', 'Test recipient', 'test@example.invalid',
    'Second notification payload', true, 'Approved local-test consent text');

reset role;
update public.enquiries
set created_at = case message
  when 'First notification payload' then '2026-01-01 00:00:00+00'::timestamptz
  else '2026-01-01 00:00:01+00'::timestamptz
end;
update public.enquiry_notifications n
set created_at = e.created_at
from public.enquiries e
where n.enquiry_id = e.id;

select pg_temp.assert_true(
  (select count(*) = 2 from public.enquiry_notifications),
  'each enquiry and its notification outbox row are created atomically'
);
select pg_temp.assert_true(
  (select bool_and(status = 'pending' and attempts = 0) from public.enquiry_notifications),
  'new notification rows begin pending without consuming an attempt'
);
set local role service_role;
select pg_temp.assert_true(
  (select bool_and(public.consume_enquiry_rate_limit(repeat('a', 64)))
    from generate_series(1, 5)),
  'the first five requests in one rate-limit window are accepted'
);
select pg_temp.assert_true(
  not public.consume_enquiry_rate_limit(repeat('a', 64)),
  'requests beyond the database-atomic rate limit are rejected'
);

do $$
declare claimed record;
begin
  select * into claimed from public.claim_enquiry_notifications(1);
  if claimed.enquiry_id is null or claimed.lease_token is null or claimed.message is null then
    raise exception 'Claim did not return the expected private enquiry payload';
  end if;
  if not public.finish_enquiry_notification(claimed.enquiry_id, claimed.lease_token, true, 202) then
    raise exception 'A valid delivery lease was not completed';
  end if;
end
$$;

do $$
declare claimed record;
begin
  select * into claimed from public.claim_enquiry_notifications(1);
  if claimed.enquiry_id is null or claimed.lease_token is null or claimed.message is null then
    raise exception 'The next pending notification was not claimable';
  end if;
  if public.finish_enquiry_notification(claimed.enquiry_id, gen_random_uuid(), true, 202) then
    raise exception 'A stale lease token completed a notification';
  end if;
  if not public.finish_enquiry_notification(claimed.enquiry_id, claimed.lease_token, false, 503) then
    raise exception 'A failed delivery did not release its valid lease';
  end if;
end
$$;

reset role;
select pg_temp.assert_true(
  (select status = 'delivered' and attempts = 1 and delivered_at is not null
    from public.enquiry_notifications where enquiry_id = (
      select id from public.enquiries order by created_at, id limit 1
    )),
  'successful notification delivery is recorded exactly once'
);
select pg_temp.assert_true(
  (select status = 'pending' and attempts = 1 and next_attempt_at > now()
    from public.enquiry_notifications where enquiry_id = (
      select id from public.enquiries order by created_at, id offset 1 limit 1
    )),
  'failed provider delivery schedules a bounded retry'
);

update public.enquiry_notifications
set status = 'pending', attempts = 7, next_attempt_at = now()
where enquiry_id = (
  select id from public.enquiries order by created_at, id offset 1 limit 1
);
set local role service_role;
do $$
declare claimed record;
begin
  select * into claimed from public.claim_enquiry_notifications(1);
  if claimed.enquiry_id is null then raise exception 'Final retry was not claimable'; end if;
  if not public.finish_enquiry_notification(claimed.enquiry_id, claimed.lease_token, false, null) then
    raise exception 'Final failed delivery was not recorded';
  end if;
end
$$;
reset role;
select pg_temp.assert_true(
  (select status = 'failed' and attempts = 8 and next_attempt_at is null
    from public.enquiry_notifications where enquiry_id = (
      select id from public.enquiries order by created_at, id offset 1 limit 1
    )),
  'delivery retries stop at the configured eight-attempt ceiling'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.enquiry_notifications', 'select') and
  not has_function_privilege('anon', 'public.claim_enquiry_notifications(integer)', 'execute') and
  not has_function_privilege('authenticated', 'public.claim_enquiry_notifications(integer)', 'execute'),
  'notification payloads and worker functions are unavailable to public and dashboard roles'
);
rollback;
