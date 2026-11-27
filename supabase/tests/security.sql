\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;

insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into public.admin_profiles(id, authorized) values ('00000000-0000-0000-0000-000000000001', true);
insert into storage.objects(id, bucket_id, name) values ('40000000-0000-0000-0000-000000000001', 'private-media', 'original');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
select pg_temp.assert_true((select authorized from public.admin_profiles where id = auth.uid()), 'self profile readable before MFA');
select pg_temp.assert_true((select count(*) = 0 from public.content_items), 'aal1 cannot read private content');
do $$ begin
  begin
    insert into public.content_items(id, kind, slug) values ('10000000-0000-0000-0000-000000000001', 'property', 'test-home');
    raise exception 'aal1 write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.approve_revision('30000000-0000-0000-0000-000000000001');
    raise exception 'aal1 approval unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_property_draft('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 'new-test', 'en', 'sale', 'available', null, null, null, null, 'Location', 'Title', 'Body', 'Area', 'Type', null, null);
    raise exception 'aal1 draft creation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', '{"aal":"aal2","amr":[{"method":"phone"}]}', true);
select pg_temp.assert_true((select count(*) = 0 from public.content_items), 'aal2 without TOTP is not authorized');
select set_config('request.jwt.claims', '{"aal":"aal2","amr":[{"method":"totp"}]}', true);
select pg_temp.assert_true((select count(*) = 1 from storage.objects), 'admin can read private media');
do $$ begin
  begin
    perform public.create_property_draft('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 'new-test', 'en', 'sale', 'available', null, null, null, null, 'Location', '', 'Body', 'Area', 'Type', null, null);
    raise exception 'Invalid draft unexpectedly succeeded';
  exception when check_violation then null; end;
end $$;
select pg_temp.assert_true((select count(*) = 0 from public.content_items where id = '10000000-0000-0000-0000-000000000003'), 'failed atomic draft rolls back item and facts');
select public.create_property_draft('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', 'new-test', 'en', 'sale', 'available', null, null, null, null, 'Location', 'Title', 'Body', 'Area', 'Type', null, null);
select pg_temp.assert_true((select count(*) = 1 from public.content_revisions where id = '30000000-0000-0000-0000-000000000004'), 'atomic draft created');
do $$ begin
  begin
    insert into storage.objects(bucket_id, name) values ('private-media', 'unvalidated');
    raise exception 'Unvalidated upload unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  update storage.objects set name = 'replaced' where bucket_id = 'private-media';
  if found then raise exception 'Unvalidated replacement unexpectedly succeeded'; end if;
end $$;
insert into public.content_items(id, kind, slug) values
  ('10000000-0000-0000-0000-000000000001', 'property', 'test-home'),
  ('10000000-0000-0000-0000-000000000002', 'article', 'test-article');
insert into public.property_versions(id, item_id, transaction_type, availability, price_bhd, location_name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'sale', 'available', 99999999999.999, 'Test location'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'sale', 'sold', null, 'Test location');
insert into public.content_revisions(id, item_id, locale, property_version_id, title, body, area_name, property_type, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'en', '20000000-0000-0000-0000-000000000001', 'English first', 'Description', 'Area', 'Type', auth.uid()),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ar', '20000000-0000-0000-0000-000000000001', 'Arabic draft', 'Description', 'Area', 'Type', auth.uid()),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'en', '20000000-0000-0000-0000-000000000002', 'English draft', 'Description', 'Area', 'Type', auth.uid()),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'ar', '20000000-0000-0000-0000-000000000002', 'Arabic updated', 'Description', 'Area', 'Type', auth.uid());
do $$ begin
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000001', null);
    raise exception 'Unapproved publication unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Unapproved publication unexpectedly succeeded' then raise; end if;
  end;
  begin
    insert into public.content_revisions(item_id, locale, property_version_id, title, body, created_by)
    values ('10000000-0000-0000-0000-000000000002', 'en', '20000000-0000-0000-0000-000000000001', 'x', 'y', auth.uid());
    raise exception 'Cross-item property version unexpectedly accepted';
  exception when foreign_key_violation or raise_exception then
    if sqlerrm = 'Cross-item property version unexpectedly accepted' then raise; end if;
  end;
end $$;
select public.approve_revision('30000000-0000-0000-0000-000000000001');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000001', null);

set local role anon;
select pg_temp.assert_true((select count(*) = 1 from public.published_content), 'only approved locale is public');
select pg_temp.assert_true((select title = 'English first' and availability = 'available' from public.published_content), 'draft edits do not change public snapshot');
select pg_temp.assert_true((select price_bhd = '99999999999.999' and pg_typeof(price_bhd) = 'text'::regtype from public.published_content), 'price is exact text for JSON clients');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.content_revisions', 'select'), 'anonymous cannot select revisions');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.enquiries', 'select'), 'anonymous cannot select enquiries');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.enquiries', 'insert'), 'anonymous cannot submit directly');
select pg_temp.assert_true((select count(*) = 0 from storage.objects), 'anonymous cannot read private media');

set local role service_role;
insert into public.enquiries(locale, name, email, message, consent, consent_text)
  values ('en', 'Test', 'test@example.invalid', 'Test', true, 'Test consent');
insert into public.enquiries(locale, name, telephone, message, consent, consent_text)
  values ('ar', 'Test', '123', 'Test', true, 'Test consent');
do $$ begin
  begin
    insert into public.enquiries(locale, name, message, consent, consent_text)
      values ('en', 'Test', 'Test', true, 'Test consent');
    raise exception 'No contact unexpectedly accepted';
  exception when check_violation then null; end;
end $$;

set local role authenticated;
select pg_temp.assert_true((select count(*) = 2 from public.enquiries), 'admin can read submitted enquiries');
select public.approve_revision('30000000-0000-0000-0000-000000000002');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000002', null);
select public.approve_revision('30000000-0000-0000-0000-000000000003');
do $$ begin
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000003', null);
    raise exception 'CAS insert unexpectedly overwrote publication';
  exception when raise_exception then
    if sqlerrm = 'CAS insert unexpectedly overwrote publication' then raise; end if;
  end;
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002');
    raise exception 'Stale or wrong-locale CAS unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Stale or wrong-locale CAS unexpectedly succeeded' then raise; end if;
  end;
end $$;
do $$ begin
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001');
    raise exception 'Divergent property versions unexpectedly published';
  exception when raise_exception then
    if sqlerrm = 'Divergent property versions unexpectedly published' then raise; end if;
  end;
end $$;
select public.unpublish_content('10000000-0000-0000-0000-000000000001', 'ar');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001');
select public.approve_revision('30000000-0000-0000-0000-000000000005');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000005', null);
select pg_temp.assert_true((select count(*) = 2 from public.published_content), 'locales publish independently');
select pg_temp.assert_true((select title = 'English draft' and availability = 'sold' from public.published_content where locale = 'en'), 'published snapshot switches to exact approved revision');
do $$ begin
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003');
    raise exception 'Old facts unexpectedly republished alongside newer locale';
  exception when raise_exception then
    if sqlerrm = 'Old facts unexpectedly republished alongside newer locale' then raise; end if;
  end;
end $$;
select public.unpublish_content('10000000-0000-0000-0000-000000000001', 'en');
select pg_temp.assert_true((select count(*) = 1 from public.published_content where locale = 'ar'), 'unpublish affects one locale');
select pg_temp.assert_true((select count(*) >= 10 from private.audit_log), 'admin activity is audited');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true((select count(*) = 0 from public.admin_profiles), 'other profile hidden');
select pg_temp.assert_true((select count(*) = 0 from public.content_revisions), 'non-admin aal2 cannot read revisions');
select pg_temp.assert_true((select count(*) = 0 from private.audit_log), 'non-admin cannot read audit');
do $$ begin
  begin
    perform public.unpublish_content('10000000-0000-0000-0000-000000000001', 'ar');
    raise exception 'Non-admin unpublish unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  begin
    update public.content_revisions set title = 'changed' where id = '30000000-0000-0000-0000-000000000002';
    raise exception 'Revision mutation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Revision mutation unexpectedly succeeded' then raise; end if;
  end;
  begin
    update public.content_items set slug = 'changed' where id = '10000000-0000-0000-0000-000000000001';
    raise exception 'Slug mutation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Slug mutation unexpectedly succeeded' then raise; end if;
  end;
end $$;
select pg_temp.assert_true((select not public from storage.buckets where id = 'private-media'), 'private bucket is not public');
rollback;
