\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'Assertion failed: %', message; end if;
end $$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000012');
insert into public.admin_profiles(id, authorized)
values ('00000000-0000-0000-0000-000000000011', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
do $$ begin
  begin
    perform public.create_editorial_category(
      '10000000-0000-0000-0000-000000000011', 'article', 'guides', 'Guides', 'أدلة'
    );
    raise exception 'AAL1 category mutation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_site_content_draft(
      '40000000-0000-0000-0000-000000000011',
      '50000000-0000-0000-0000-000000000011',
      'area', 'amwaj-island', 'en', 'Amwaj Islands', 'Draft area notes', null, null, null
    );
    raise exception 'AAL1 site content mutation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims', '{"aal":"aal2","amr":[{"method":"totp"}]}', true);

select public.create_editorial_category(
  '10000000-0000-0000-0000-000000000011', 'article', 'guides', 'Guides', 'أدلة'
);
select public.create_editorial_category(
  '10000000-0000-0000-0000-000000000012', 'faq', 'questions', 'Questions', 'أسئلة'
);
select public.create_site_content_draft(
  '40000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000011',
  'area', 'amwaj-island', 'en', 'Amwaj Islands', 'Draft area notes', null, null, null
);
select public.revise_site_content_draft(
  '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012',
  'area', 'ar', 'جزر أمواج', 'ملاحظات المنطقة', null, null, null
);
select public.create_site_content_draft(
  '40000000-0000-0000-0000-000000000012',
  '50000000-0000-0000-0000-000000000013',
  'project', 'verified-project', 'en', 'Verified project', 'Private project notes', null, null, null
);
select public.create_site_content_draft(
  '40000000-0000-0000-0000-000000000013',
  '50000000-0000-0000-0000-000000000014',
  'setting', 'site-title', 'en', 'Site title', 'Private site title', null, null, null
);
select public.create_routed_site_content_draft(
  '40000000-0000-0000-0000-000000000014',
  '50000000-0000-0000-0000-000000000015',
  'area', 'buy-property-amwaj-island', '/buy-property/amwaj-island/',
  'en', 'Amwaj property', 'Verified English area content', 'Reviewed summary', 'SEO title', 'SEO description'
);
select public.revise_site_content_draft(
  '50000000-0000-0000-0000-000000000015',
  '50000000-0000-0000-0000-000000000016',
  'area', 'ar', 'عقارات أمواج', 'محتوى عربي تمت مراجعته', 'ملخص تمت مراجعته', 'عنوان SEO', 'وصف SEO'
);
select public.approve_site_content_revision('50000000-0000-0000-0000-000000000015');
select public.publish_site_content_revision('50000000-0000-0000-0000-000000000015', null);
select public.approve_site_content_revision('50000000-0000-0000-0000-000000000016');
do $$ begin
  begin
    perform public.publish_site_content_revision('50000000-0000-0000-0000-000000000016', null);
    raise exception 'Unreviewed Arabic site content unexpectedly published';
  exception when raise_exception then
    if sqlerrm = 'Unreviewed Arabic site content unexpectedly published' then raise; end if;
  end;
end $$;
select public.review_site_content_revision('50000000-0000-0000-0000-000000000016');
select public.publish_site_content_revision('50000000-0000-0000-0000-000000000016', null);
select public.set_site_content_archived('40000000-0000-0000-0000-000000000011', false, true);
do $$ begin
  begin
    perform public.set_site_content_archived('40000000-0000-0000-0000-000000000011', false, true);
    raise exception 'Stale site content archive unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Stale site content archive unexpectedly succeeded' then raise; end if;
  end;
end $$;
select public.set_site_content_archived('40000000-0000-0000-0000-000000000011', true, false);
select public.create_editorial_draft(
  '20000000-0000-0000-0000-000000000011',
  '30000000-0000-0000-0000-000000000011',
  'property-guide', 'article', 'en',
  '10000000-0000-0000-0000-000000000011',
  'Property guide', 'Reviewed body', 'Useful summary', 'Editorial team', 'SEO title', 'SEO description'
);
select public.revise_editorial_draft(
  '30000000-0000-0000-0000-000000000011',
  '30000000-0000-0000-0000-000000000012',
  'ar', '10000000-0000-0000-0000-000000000011',
  'دليل العقارات', 'محتوى تمت مراجعته', 'ملخص مفيد', 'فريق التحرير', null, null
);
select public.create_editorial_draft(
  '20000000-0000-0000-0000-000000000012',
  '30000000-0000-0000-0000-000000000013',
  'common-question', 'faq', 'ar',
  '10000000-0000-0000-0000-000000000012',
  'سؤال شائع', 'إجابة تمت مراجعتها', null, null, null, null
);

select pg_temp.assert_true(
  (select count(*) = 3 from public.editorial_revision_metadata),
  'article and FAQ revisions capture immutable category snapshots'
);
select pg_temp.assert_true(
  (select count(*) = 4 from public.site_content_revisions),
  'area, project and site setting edits create localized immutable revisions'
);
do $$ begin
  begin
    update public.editorial_revision_metadata
      set category_id = '10000000-0000-0000-0000-000000000012'
      where revision_id = '30000000-0000-0000-0000-000000000011';
    raise exception 'Editorial metadata mutation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  when raise_exception then
    if sqlerrm = 'Editorial metadata mutation unexpectedly succeeded' then raise; end if;
  end;
end $$;

select public.approve_revision('30000000-0000-0000-0000-000000000011');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000011', null);
select public.approve_revision('30000000-0000-0000-0000-000000000012');
do $$ begin
  begin
    perform public.publish_revision_if_current('30000000-0000-0000-0000-000000000012', null);
    raise exception 'Unreviewed Arabic editorial revision unexpectedly published';
  exception when raise_exception then
    if sqlerrm = 'Unreviewed Arabic editorial revision unexpectedly published' then raise; end if;
  end;
end $$;
select public.review_editorial_revision('30000000-0000-0000-0000-000000000012');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000012', null);
select public.review_editorial_revision('30000000-0000-0000-0000-000000000013');
select public.approve_revision('30000000-0000-0000-0000-000000000013');
select public.publish_revision_if_current('30000000-0000-0000-0000-000000000013', null);

set local role anon;
select pg_temp.assert_true(
  (select count(*) = 3 from public.published_editorial),
  'only independently approved and reviewed editorial revisions are public'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.published_editorial where locale = 'ar'),
  'Arabic article and FAQ content appear only after exact-revision review'
);
select pg_temp.assert_true(
  (select count(*) = 2 from public.published_site_content
    where route_path = '/buy-property/amwaj-island/'),
  'only independently approved English and human-reviewed Arabic site content is public'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.content_revisions', 'select') and
  not has_table_privilege('anon', 'public.editorial_revision_metadata', 'select'),
  'anonymous readers cannot inspect revisions or editorial metadata tables'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.site_content_publications', 'select') and
  not has_table_privilege('anon', 'public.site_content_approvals', 'select') and
  not has_table_privilege('anon', 'public.site_content_reviews', 'select'),
  'anonymous readers can access only the published site-content view'
);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.site_content_items', 'select') and
  not has_table_privilege('anon', 'public.site_content_revisions', 'select'),
  'area, project and settings drafts are never exposed through public reads'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select public.unpublish_editorial_content(
  '20000000-0000-0000-0000-000000000011', 'ar', '30000000-0000-0000-0000-000000000012'
);
select public.unpublish_site_content(
  '40000000-0000-0000-0000-000000000014', 'ar', '50000000-0000-0000-0000-000000000016'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.published_site_content
    where route_path = '/buy-property/amwaj-island/'),
  'unpublishing Arabic site content preserves its English counterpart'
);
do $$ begin
  begin
    perform public.unpublish_editorial_content(
      '20000000-0000-0000-0000-000000000011', 'en', '30000000-0000-0000-0000-000000000012'
    );
    raise exception 'Stale editorial unpublish unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Stale editorial unpublish unexpectedly succeeded' then raise; end if;
  end;
end $$;
select pg_temp.assert_true(
  (select count(*) = 1 from public.publications where item_id = '20000000-0000-0000-0000-000000000011'),
  'unpublishing one locale does not remove its independent counterpart'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.editorial_categories),
  'non-admin users cannot read editorial administration data'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.site_content_items) and
  (select count(*) = 0 from public.site_content_revisions),
  'non-admin users cannot read site content administration data'
);
do $$ begin
  begin
    perform public.unpublish_editorial_content(
      '20000000-0000-0000-0000-000000000012', 'ar', '30000000-0000-0000-0000-000000000013'
    );
    raise exception 'Non-admin editorial mutation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_site_content_archived('40000000-0000-0000-0000-000000000012', false, true);
    raise exception 'Non-admin site content mutation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
