\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000051'),
  ('00000000-0000-0000-0000-000000000052');
insert into public.admin_profiles(id, authorized) values ('00000000-0000-0000-0000-000000000051', true);
insert into public.content_items(id, kind, slug)
  values ('10000000-0000-0000-0000-000000000051', 'property', 'property-management-test');
insert into public.property_versions(id, item_id, transaction_type, availability, price_bhd, location_name)
  values ('20000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000051',
    'sale', 'available', 125000.125, 'Test location');
insert into public.content_revisions(id, item_id, locale, property_version_id, title, body,
  area_name, property_type, created_by)
  values ('30000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000051',
    'en', '20000000-0000-0000-0000-000000000051', 'Reviewed home', 'Reviewed description',
    'Test area', 'Apartment', '00000000-0000-0000-0000-000000000051');
insert into storage.objects(bucket_id, name) values
  ('private-media', '10000000-0000-0000-0000-000000000051/30000000-0000-0000-0000-000000000051/40000000-0000-0000-0000-000000000051.jpg');
insert into public.content_media(item_id, revision_id, locale, object_path, mime_type,
  byte_size, width, height, alt_text, position, is_cover, uploaded_by)
  values ('10000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051',
    'en', '10000000-0000-0000-0000-000000000051/30000000-0000-0000-0000-000000000051/40000000-0000-0000-0000-000000000051.jpg',
    'image/jpeg', 20, 1, 1, 'Reviewed image', 0, true, '00000000-0000-0000-0000-000000000051');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000051', true);
select set_config('request.jwt.claims', '{"aal":"aal2","amr":[{"method":"totp"}]}', true);
set local role authenticated;
select public.approve_revision('30000000-0000-0000-0000-000000000051');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000051', null);

set local role anon;
select pg_temp.assert_true(
  (select price_bhd = '125000.125' and price_bhd_numeric = 125000.125
    and pg_typeof(price_bhd_numeric) = 'numeric'::regtype
    from public.published_content where id = '10000000-0000-0000-0000-000000000051'),
  'public property prices retain exact display and numeric search values');
select pg_temp.assert_true(
  (select count(*) = 1 from public.published_content_media where item_id = '10000000-0000-0000-0000-000000000051')
  and not has_table_privilege('anon', 'public.content_media', 'select')
  and not exists (select 1 from storage.objects where bucket_id = 'private-media'),
  'published metadata is available through the safe view without exposing originals');

set local role authenticated;
set local role service_role;
select pg_temp.assert_true(
  public.is_enquiry_property_published('10000000-0000-0000-0000-000000000051', 'en'),
  'an active published property is eligible for an enquiry');
set local role authenticated;
select public.archive_content('10000000-0000-0000-0000-000000000051');
do $$ begin
  begin
    perform public.publish_revision_if_current(
      '30000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051');
    raise exception 'Archived content was republished';
  exception when raise_exception then
    if sqlerrm = 'Archived content was republished' then raise; end if;
  end;
end $$;
set local role anon;
select pg_temp.assert_true(
  not exists (select 1 from public.published_content where id = '10000000-0000-0000-0000-000000000051'),
  'archived content is not returned publicly');
select pg_temp.assert_true(
  not exists (select 1 from public.published_content_media where item_id = '10000000-0000-0000-0000-000000000051')
  and not exists (select 1 from storage.objects where bucket_id = 'private-media'),
  'archived media metadata and private originals are inaccessible');
set local role service_role;
select pg_temp.assert_true(
  not public.is_enquiry_property_published('10000000-0000-0000-0000-000000000051', 'en'),
  'an archived property is not eligible for an enquiry');
do $$ begin
  begin
    insert into public.enquiries(property_item_id, locale, name, email, message, consent, consent_text)
    values ('10000000-0000-0000-0000-000000000051', 'en', 'Test', 'test@example.invalid',
      'Test', true, 'Test');
    raise exception 'An enquiry for archived content was accepted';
  exception when raise_exception then
    if sqlerrm = 'An enquiry for archived content was accepted' then raise; end if;
  end;
end $$;
set local role authenticated;
set local role authenticated;
select public.unarchive_content('10000000-0000-0000-0000-000000000051');
set local role anon;
select pg_temp.assert_true(
  exists (select 1 from public.published_content where id = '10000000-0000-0000-0000-000000000051'),
  'unarchiving restores the exact still-published revision');

set local role authenticated;
do $$ begin
  begin
    perform public.create_property_version_draft(
      '10000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051',
      '20000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000052',
      'sale', 'sold', 125000.125, 2, 1, 100, 'Test location');
    raise exception 'Shared facts changed while a locale remained published';
  exception when raise_exception then
    if sqlerrm = 'Shared facts changed while a locale remained published' then raise; end if;
  end;
end $$;
select public.unpublish_content('10000000-0000-0000-0000-000000000051', 'en');
select public.create_property_version_draft(
  '10000000-0000-0000-0000-000000000051', '30000000-0000-0000-0000-000000000051',
  '20000000-0000-0000-0000-000000000052', '30000000-0000-0000-0000-000000000052',
  'sale', 'sold', 125000.125, 2, 1, 100, 'Test location');
select pg_temp.assert_true(
  (select body = 'Reviewed description' and property_version_id = '20000000-0000-0000-0000-000000000052'
    from public.content_revisions where id = '30000000-0000-0000-0000-000000000052'),
  'new facts create a new immutable revision while preserving the selected language text');
select public.approve_revision('30000000-0000-0000-0000-000000000052');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000052', null);
set local role anon;
select pg_temp.assert_true(
  (select availability = 'sold' and price_bhd = '125000.125' and price_bhd_numeric = 125000.125
    from public.published_content where id = '10000000-0000-0000-0000-000000000051'),
  'new approved status and exact price publish as one snapshot');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000052', true);
do $$ begin
  begin
    perform public.archive_content('10000000-0000-0000-0000-000000000051');
    raise exception 'Non-admin archived content';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
