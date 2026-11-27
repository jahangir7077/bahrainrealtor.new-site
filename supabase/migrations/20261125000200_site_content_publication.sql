alter table public.site_content_items drop constraint site_content_items_kind_check;
alter table public.site_content_items add constraint site_content_items_kind_check
  check (kind in ('area', 'project', 'setting', 'landing'));
alter table public.site_content_revisions drop constraint site_content_revisions_kind_check;
alter table public.site_content_revisions add constraint site_content_revisions_kind_check
  check (kind in ('area', 'project', 'setting', 'landing'));

create table public.site_content_route_allowlist (
  route_path text primary key,
  kind text not null check (kind in ('area', 'project', 'landing'))
);
insert into public.site_content_route_allowlist(route_path, kind) values
  ('/buy-property/apartments-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/apartments-for-sale-in-bahrain-bay/', 'area'),
  ('/buy-property/apartments-for-sale-in-bahrain-marina/', 'area'),
  ('/buy-property/apartments-for-sale-in-bahrain/', 'area'),
  ('/buy-property/apartments-for-sale-in-busaiteen/', 'area'),
  ('/buy-property/apartments-for-sale-in-dilmunia/', 'area'),
  ('/buy-property/apartments-for-sale-in-diyar-al-muharraq/', 'area'),
  ('/buy-property/apartments-for-sale-in-hidd/', 'area'),
  ('/buy-property/apartments-for-sale-in-juffair/', 'area'),
  ('/buy-property/apartments-for-sale-in-marassi/', 'area'),
  ('/buy-property/apartments-for-sale-in-reef-island/', 'area'),
  ('/buy-property/apartments-for-sale-in-riffa/', 'area'),
  ('/buy-property/apartments-for-sale-in-seef/', 'area'),
  ('/buy-property/apartments-for-sale-in-tala-island/', 'area'),
  ('/buy-property/buildings-for-sale-in-bahrain/', 'area'),
  ('/buy-property/commercial-property-for-sale-in-bahrain/', 'area'),
  ('/buy-property/freehold-property-for-sale-in-bahrain/', 'area'),
  ('/buy-property/houses-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/houses-for-sale-in-bahrain/', 'area'),
  ('/buy-property/houses-for-sale-in-busaiteen/', 'area'),
  ('/buy-property/houses-for-sale-in-hidd/', 'area'),
  ('/buy-property/houses-for-sale-in-isa-town/', 'area'),
  ('/buy-property/houses-for-sale-in-muharraq/', 'area'),
  ('/buy-property/houses-for-sale-in-riffa/', 'area'),
  ('/buy-property/houses-for-sale-in-saar/', 'area'),
  ('/buy-property/investment-properties-for-sale-in-bahrain/', 'area'),
  ('/buy-property/land-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/land-for-sale-in-bahrain/', 'area'),
  ('/buy-property/land-for-sale-in-diyar-al-muharraq/', 'area'),
  ('/buy-property/land-for-sale-in-hamala/', 'area'),
  ('/buy-property/property-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/property-for-sale-in-bahrain-bay/', 'area'),
  ('/buy-property/property-for-sale-in-bahrain/', 'area'),
  ('/buy-property/property-for-sale-in-dilmunia/', 'area'),
  ('/buy-property/property-for-sale-in-diyar-al-muharraq/', 'area'),
  ('/buy-property/property-for-sale-in-hidd/', 'area'),
  ('/buy-property/property-for-sale-in-janabiya/', 'area'),
  ('/buy-property/property-for-sale-in-juffair/', 'area'),
  ('/buy-property/property-for-sale-in-marassi/', 'area'),
  ('/buy-property/property-for-sale-in-muharraq/', 'area'),
  ('/buy-property/property-for-sale-in-reef-island/', 'area'),
  ('/buy-property/property-for-sale-in-riffa/', 'area'),
  ('/buy-property/property-for-sale-in-seef/', 'area'),
  ('/buy-property/property-for-sale-in-tala-island/', 'area'),
  ('/buy-property/property-for-sale-in-tubli/', 'area'),
  ('/buy-property/specialty-residential-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/specialty-residential-property-for-sale-in-bahrain/', 'area'),
  ('/buy-property/villas-for-sale-in-amwaj-islands/', 'area'),
  ('/buy-property/villas-for-sale-in-bahrain/', 'area'),
  ('/buy-property/villas-for-sale-in-diyar-al-muharraq/', 'area'),
  ('/buy-property/villas-for-sale-in-durrat-al-bahrain/', 'area'),
  ('/buy-property/villas-for-sale-in-hamala/', 'area'),
  ('/buy-property/villas-for-sale-in-hidd/', 'area'),
  ('/buy-property/villas-for-sale-in-janabiya/', 'area'),
  ('/buy-property/villas-for-sale-in-marassi/', 'area'),
  ('/buy-property/villas-for-sale-in-riffa/', 'area'),
  ('/buy-property/villas-for-sale-in-saar/', 'area'),
  ('/buy-property/villas-for-sale-in-tala-island/', 'area'),
  ('/buy-property/', 'landing'),
  ('/buy-property/amwaj-island/', 'area'),
  ('/buy-property/tala-island/', 'area'),
  ('/buy-property/marassi-al-bahrain/', 'area'),
  ('/buy-property/diyar-al-muharraq/', 'area'),
  ('/buy-property/dilmunia-island/', 'area'),
  ('/buy-property/manama-capital/', 'area'),
  ('/rent-property/', 'landing'),
  ('/rent-property/amwaj-island/', 'area'),
  ('/rent-property/tala-island/', 'area'),
  ('/rent-property/marassi-al-bahrain/', 'area'),
  ('/rent-property/diyar-al-muharraq/', 'area'),
  ('/rent-property/dilmunia-island/', 'area'),
  ('/rent-property/manama-capital/', 'area'),
  ('/projects/', 'project'),
  ('/bahrain-residency/', 'landing'),
  ('/bahrain-residency/golden-visa-bahrain/', 'landing'),
  ('/bahrain-residency/self-sponsorship-visa/', 'landing');
revoke all on public.site_content_route_allowlist from public, anon, authenticated, service_role;

alter table public.site_content_items add column route_path text
  references public.site_content_route_allowlist(route_path);
create unique index site_content_route_path_unique
  on public.site_content_items(route_path) where route_path is not null;

create table public.site_content_reviews (
  revision_id uuid primary key,
  item_id uuid not null,
  locale text not null check (locale = 'ar'),
  reviewed_by uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  foreign key (revision_id, item_id, locale)
    references public.site_content_revisions(id, item_id, locale)
);

create table public.site_content_approvals (
  revision_id uuid primary key,
  item_id uuid not null,
  locale text not null check (locale in ('en', 'ar')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  foreign key (revision_id, item_id, locale)
    references public.site_content_revisions(id, item_id, locale)
);

create table public.site_content_publications (
  item_id uuid not null,
  locale text not null check (locale in ('en', 'ar')),
  revision_id uuid not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key (item_id, locale),
  foreign key (revision_id, item_id, locale)
    references public.site_content_revisions(id, item_id, locale)
);

alter table public.site_content_reviews enable row level security;
alter table public.site_content_approvals enable row level security;
alter table public.site_content_publications enable row level security;
revoke all on public.site_content_reviews, public.site_content_approvals,
  public.site_content_publications from public, anon, authenticated, service_role;
grant select on public.site_content_reviews, public.site_content_approvals,
  public.site_content_publications to authenticated;

create policy site_content_reviews_admin_read on public.site_content_reviews
  for select to authenticated using (private.is_admin());
create policy site_content_approvals_admin_read on public.site_content_approvals
  for select to authenticated using (private.is_admin());
create policy site_content_publications_admin_read on public.site_content_publications
  for select to authenticated using (private.is_admin());

create trigger immutable_site_content_reviews before update or delete on public.site_content_reviews
  for each row execute function private.prevent_mutation();
create trigger immutable_site_content_approvals before update or delete on public.site_content_approvals
  for each row execute function private.prevent_mutation();
create trigger audit_site_content_reviews after insert or update or delete on public.site_content_reviews
  for each row execute function private.audit_change();
create trigger audit_site_content_approvals after insert or update or delete on public.site_content_approvals
  for each row execute function private.audit_change();
create trigger audit_site_content_publications after insert or update or delete on public.site_content_publications
  for each row execute function private.audit_change();

create function public.create_routed_site_content_draft(
  p_item_id uuid, p_revision_id uuid, p_kind text, p_slug text, p_route_path text,
  p_locale text, p_title text, p_body text, p_summary text, p_seo_title text, p_seo_description text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare expected_kind text;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select kind into expected_kind from public.site_content_route_allowlist
    where route_path = p_route_path;
  if expected_kind is null or p_kind <> expected_kind then raise exception 'Invalid public route'; end if;
  if
     p_slug <> replace(trim(both '/' from p_route_path), '/', '-') then
    raise exception 'Route does not match content type';
  end if;
  insert into public.site_content_items(id, kind, slug, route_path)
    values (p_item_id, p_kind, p_slug, p_route_path);
  insert into public.site_content_revisions(
    id, item_id, kind, locale, title, body, summary, seo_title, seo_description, created_by
  ) values (
    p_revision_id, p_item_id, p_kind, p_locale, p_title, p_body,
    p_summary, p_seo_title, p_seo_description, auth.uid()
  );
  return p_revision_id;
end
$$;
revoke all on function public.create_routed_site_content_draft(uuid, uuid, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_routed_site_content_draft(uuid, uuid, text, text, text, text, text, text, text, text, text)
  to authenticated;

create function public.review_site_content_revision(p_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare target_item uuid; target_locale text;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select item_id, locale into target_item, target_locale from public.site_content_revisions
    where id = p_revision_id;
  if not found or target_locale <> 'ar' then raise exception 'Arabic revision not found'; end if;
  insert into public.site_content_reviews(revision_id, item_id, locale, reviewed_by)
    values (p_revision_id, target_item, target_locale, auth.uid());
end
$$;
revoke all on function public.review_site_content_revision(uuid) from public, anon, authenticated;
grant execute on function public.review_site_content_revision(uuid) to authenticated;

create function public.approve_site_content_revision(p_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare target_item uuid; target_locale text;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select item_id, locale into target_item, target_locale from public.site_content_revisions
    where id = p_revision_id;
  if not found then raise exception 'Site content revision not found'; end if;
  insert into public.site_content_approvals(revision_id, item_id, locale, approved_by)
    values (p_revision_id, target_item, target_locale, auth.uid());
end
$$;
revoke all on function public.approve_site_content_revision(uuid) from public, anon, authenticated;
grant execute on function public.approve_site_content_revision(uuid) to authenticated;

create function public.publish_site_content_revision(
  p_revision_id uuid, p_expected_revision_id uuid
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare target_item uuid; target_locale text; current_revision uuid;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select r.item_id, r.locale into target_item, target_locale
    from public.site_content_revisions r
    join public.site_content_items i on i.id = r.item_id and i.archived_at is null
    join public.site_content_approvals a on a.revision_id = r.id and a.item_id = r.item_id and a.locale = r.locale
    where r.id = p_revision_id and i.route_path is not null;
  if not found then raise exception 'Approved routed revision not found'; end if;
  if target_locale = 'ar' and not exists (
    select 1 from public.site_content_reviews where revision_id = p_revision_id and item_id = target_item
  ) then raise exception 'Exact Arabic revision requires human review'; end if;
  perform 1 from public.site_content_items where id = target_item for update;
  select revision_id into current_revision from public.site_content_publications
    where item_id = target_item and locale = target_locale;
  if current_revision is distinct from p_expected_revision_id then
    raise exception 'Publication changed; reload before retrying';
  end if;
  insert into public.site_content_publications(item_id, locale, revision_id, published_by)
    values (target_item, target_locale, p_revision_id, auth.uid())
    on conflict (item_id, locale) do update set
      revision_id = excluded.revision_id, published_by = excluded.published_by, published_at = now();
end
$$;
revoke all on function public.publish_site_content_revision(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_site_content_revision(uuid, uuid) to authenticated;

create function public.unpublish_site_content(p_item_id uuid, p_locale text, p_expected_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_locale not in ('en', 'ar') or p_expected_revision_id is null then raise exception 'Invalid publication'; end if;
  perform 1 from public.site_content_items where id = p_item_id for update;
  if not found then raise exception 'Site content item not found'; end if;
  delete from public.site_content_publications
    where item_id = p_item_id and locale = p_locale and revision_id = p_expected_revision_id;
  if not found then raise exception 'Publication changed or not found'; end if;
end
$$;
revoke all on function public.unpublish_site_content(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.unpublish_site_content(uuid, text, uuid) to authenticated;

create view public.published_site_content with (security_barrier = true) as
select i.id, i.kind, i.slug, i.route_path, r.locale, r.id as revision_id,
  p.published_at, r.title, r.body, r.summary, r.seo_title, r.seo_description
from public.site_content_publications p
join public.site_content_revisions r
  on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
join public.site_content_items i on i.id = p.item_id and i.archived_at is null
join public.site_content_approvals a
  on (a.revision_id, a.item_id, a.locale) = (r.id, r.item_id, r.locale)
left join public.site_content_reviews h
  on (h.revision_id, h.item_id, h.locale) = (r.id, r.item_id, r.locale)
where i.route_path is not null and i.kind in ('area', 'project', 'landing')
  and (r.locale = 'en' or h.revision_id = r.id);
revoke all on public.published_site_content from public, anon, authenticated;
grant select on public.published_site_content to anon, authenticated;
