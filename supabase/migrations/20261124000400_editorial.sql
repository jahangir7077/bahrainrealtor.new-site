create table public.editorial_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('article', 'faq')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null check (length(btrim(name_en)) between 1 and 120),
  name_ar text not null check (length(btrim(name_ar)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (kind, slug),
  unique (id, kind)
);

create table public.editorial_revision_metadata (
  revision_id uuid primary key,
  item_id uuid not null,
  locale text not null check (locale in ('en', 'ar')),
  kind text not null check (kind in ('article', 'faq')),
  category_id uuid not null,
  foreign key (revision_id, item_id, locale)
    references public.content_revisions(id, item_id, locale),
  foreign key (item_id, kind) references public.content_items(id, kind),
  foreign key (category_id, kind) references public.editorial_categories(id, kind),
  unique (revision_id, item_id, locale, kind)
);

create table public.editorial_revision_reviews (
  revision_id uuid primary key,
  item_id uuid not null,
  locale text not null check (locale = 'ar'),
  reviewed_by uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  foreign key (revision_id, item_id, locale)
    references public.content_revisions(id, item_id, locale)
);

create table public.site_content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('area', 'project', 'setting')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, slug),
  unique (id, kind)
);

create table public.site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  kind text not null check (kind in ('area', 'project', 'setting')),
  locale text not null check (locale in ('en', 'ar')),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null check (length(btrim(body)) between 1 and 20000),
  summary text check (summary is null or length(btrim(summary)) <= 1000),
  seo_title text check (seo_title is null or length(btrim(seo_title)) <= 200),
  seo_description text check (seo_description is null or length(btrim(seo_description)) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (item_id, kind) references public.site_content_items(id, kind),
  unique (id, item_id, locale)
);

create index editorial_revisions_item_locale
  on public.editorial_revision_metadata(item_id, locale, revision_id);
create index editorial_categories_kind_slug
  on public.editorial_categories(kind, slug);
create index site_content_revisions_item_locale
  on public.site_content_revisions(item_id, locale, created_at desc);

alter table public.editorial_categories enable row level security;
alter table public.editorial_revision_metadata enable row level security;
alter table public.editorial_revision_reviews enable row level security;
alter table public.site_content_items enable row level security;
alter table public.site_content_revisions enable row level security;

revoke all on public.editorial_categories, public.editorial_revision_metadata,
  public.editorial_revision_reviews, public.site_content_items,
  public.site_content_revisions from public, anon, authenticated, service_role;
grant select on public.editorial_categories, public.editorial_revision_metadata,
  public.editorial_revision_reviews, public.site_content_items,
  public.site_content_revisions to authenticated;

create policy editorial_categories_admin_read on public.editorial_categories
  for select to authenticated using (private.is_admin());
create policy editorial_metadata_admin_read on public.editorial_revision_metadata
  for select to authenticated using (private.is_admin());
create policy editorial_reviews_admin_read on public.editorial_revision_reviews
  for select to authenticated using (private.is_admin());
create policy site_content_items_admin_read on public.site_content_items
  for select to authenticated using (private.is_admin());
create policy site_content_revisions_admin_read on public.site_content_revisions
  for select to authenticated using (private.is_admin());

create trigger immutable_editorial_categories before update or delete on public.editorial_categories
  for each row execute function private.prevent_mutation();
create trigger immutable_editorial_metadata before update or delete on public.editorial_revision_metadata
  for each row execute function private.prevent_mutation();
create trigger immutable_editorial_reviews before update or delete on public.editorial_revision_reviews
  for each row execute function private.prevent_mutation();
create trigger immutable_site_content_revisions before update or delete on public.site_content_revisions
  for each row execute function private.prevent_mutation();

create trigger audit_editorial_categories after insert or update or delete on public.editorial_categories
  for each row execute function private.audit_change();
create trigger audit_editorial_metadata after insert or update or delete on public.editorial_revision_metadata
  for each row execute function private.audit_change();
create trigger audit_editorial_reviews after insert or update or delete on public.editorial_revision_reviews
  for each row execute function private.audit_change();
create trigger audit_site_content_items after insert or update or delete on public.site_content_items
  for each row execute function private.audit_change();
create trigger audit_site_content_revisions after insert or update or delete on public.site_content_revisions
  for each row execute function private.audit_change();

create function public.create_site_content_draft(
  p_item_id uuid, p_revision_id uuid, p_kind text, p_slug text, p_locale text,
  p_title text, p_body text, p_summary text, p_seo_title text, p_seo_description text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.site_content_items(id, kind, slug)
  values (p_item_id, p_kind, p_slug);
  insert into public.site_content_revisions(
    id, item_id, kind, locale, title, body, summary, seo_title, seo_description, created_by
  ) values (
    p_revision_id, p_item_id, p_kind, p_locale, p_title, p_body,
    p_summary, p_seo_title, p_seo_description, auth.uid()
  );
  return p_revision_id;
end
$$;
revoke all on function public.create_site_content_draft(uuid, uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_site_content_draft(uuid, uuid, text, text, text, text, text, text, text, text)
  to authenticated;

create function public.revise_site_content_draft(
  p_source_revision_id uuid, p_revision_id uuid, p_expected_kind text, p_locale text,
  p_title text, p_body text, p_summary text, p_seo_title text, p_seo_description text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare source_item uuid; source_kind text; archived boolean;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select r.item_id, r.kind, i.archived_at is not null
    into source_item, source_kind, archived
  from public.site_content_revisions r
  join public.site_content_items i on i.id = r.item_id
  where r.id = p_source_revision_id
  for update of i;
  if not found then raise exception 'Site content revision not found'; end if;
  if source_kind <> p_expected_kind then raise exception 'Site content type changed'; end if;
  if archived then raise exception 'Restore archived content before editing'; end if;

  insert into public.site_content_revisions(
    id, item_id, kind, locale, title, body, summary, seo_title, seo_description, created_by
  ) values (
    p_revision_id, source_item, source_kind, p_locale, p_title, p_body,
    p_summary, p_seo_title, p_seo_description, auth.uid()
  );
  return p_revision_id;
end
$$;
revoke all on function public.revise_site_content_draft(uuid, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.revise_site_content_draft(uuid, uuid, text, text, text, text, text, text, text)
  to authenticated;

create function public.set_site_content_archived(
  p_item_id uuid, p_expected_archived boolean, p_archived boolean
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare current_archived boolean;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_expected_archived is null or p_archived is null or p_expected_archived = p_archived then
    raise exception 'Invalid archive transition';
  end if;
  select archived_at is not null into current_archived
  from public.site_content_items where id = p_item_id for update;
  if not found then raise exception 'Site content item not found'; end if;
  if current_archived is distinct from p_expected_archived then
    raise exception 'Site content changed; reload before retrying';
  end if;
  update public.site_content_items
  set archived_at = case when p_archived then now() else null end
  where id = p_item_id;
end
$$;
revoke all on function public.set_site_content_archived(uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.set_site_content_archived(uuid, boolean, boolean)
  to authenticated;

create function public.create_editorial_category(
  p_id uuid, p_kind text, p_slug text, p_name_en text, p_name_ar text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.editorial_categories(id, kind, slug, name_en, name_ar)
  values (p_id, p_kind, p_slug, p_name_en, p_name_ar);
  return p_id;
end
$$;
revoke all on function public.create_editorial_category(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_editorial_category(uuid, text, text, text, text)
  to authenticated;

create function public.create_editorial_draft(
  p_item_id uuid, p_revision_id uuid, p_slug text, p_kind text, p_locale text,
  p_category_id uuid, p_title text, p_body text, p_summary text, p_author_name text,
  p_seo_title text, p_seo_description text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_kind not in ('article', 'faq') then raise exception 'Invalid editorial kind'; end if;
  if not exists (
    select 1 from public.editorial_categories
    where id = p_category_id and kind = p_kind
  ) then raise exception 'Category not found'; end if;

  insert into public.content_items(id, kind, slug) values (p_item_id, p_kind, p_slug);
  insert into public.content_revisions(
    id, item_id, locale, title, body, summary, author_name,
    seo_title, seo_description, created_by
  ) values (
    p_revision_id, p_item_id, p_locale, p_title, p_body, p_summary, p_author_name,
    p_seo_title, p_seo_description, auth.uid()
  );
  insert into public.editorial_revision_metadata(revision_id, item_id, locale, kind, category_id)
  values (p_revision_id, p_item_id, p_locale, p_kind, p_category_id);
  return p_revision_id;
end
$$;
revoke all on function public.create_editorial_draft(uuid, uuid, text, text, text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_editorial_draft(uuid, uuid, text, text, text, uuid, text, text, text, text, text, text)
  to authenticated;

create function public.revise_editorial_draft(
  p_source_revision_id uuid, p_revision_id uuid, p_locale text, p_category_id uuid,
  p_title text, p_body text, p_summary text, p_author_name text,
  p_seo_title text, p_seo_description text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare source_item uuid; source_kind text;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select item_id, kind into source_item, source_kind
  from public.editorial_revision_metadata where revision_id = p_source_revision_id;
  if not found then raise exception 'Editorial revision not found'; end if;
  if not exists (
    select 1 from public.editorial_categories
    where id = p_category_id and kind = source_kind
  ) then raise exception 'Category not found'; end if;

  insert into public.content_revisions(
    id, item_id, locale, title, body, summary, author_name,
    seo_title, seo_description, created_by
  ) values (
    p_revision_id, source_item, p_locale, p_title, p_body, p_summary, p_author_name,
    p_seo_title, p_seo_description, auth.uid()
  );
  insert into public.editorial_revision_metadata(revision_id, item_id, locale, kind, category_id)
  values (p_revision_id, source_item, p_locale, source_kind, p_category_id);
  return p_revision_id;
end
$$;
revoke all on function public.revise_editorial_draft(uuid, uuid, text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.revise_editorial_draft(uuid, uuid, text, uuid, text, text, text, text, text, text)
  to authenticated;

create function public.review_editorial_revision(p_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.editorial_revision_reviews(revision_id, item_id, locale, reviewed_by)
  select m.revision_id, m.item_id, m.locale, auth.uid()
  from public.editorial_revision_metadata m
  where m.revision_id = p_revision_id and m.locale = 'ar';
  if not found then raise exception 'Arabic editorial revision not found'; end if;
end
$$;
revoke all on function public.review_editorial_revision(uuid) from public, anon, authenticated;
grant execute on function public.review_editorial_revision(uuid) to authenticated;

create function private.validate_editorial_publication()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare item_kind text;
begin
  select kind into item_kind from public.content_items where id = new.item_id;
  if item_kind in ('article', 'faq') then
    if not exists (
      select 1
      from public.revision_approvals a
      join public.editorial_revision_metadata m
        on (m.revision_id, m.item_id, m.locale) = (a.revision_id, a.item_id, a.locale)
      where a.revision_id = new.revision_id
        and a.item_id = new.item_id
        and a.locale = new.locale
        and m.kind = item_kind
    ) then
      raise exception 'Editorial revision approval or category is missing';
    end if;
    if new.locale = 'ar' and not exists (
      select 1 from public.editorial_revision_reviews r
      where r.revision_id = new.revision_id
        and r.item_id = new.item_id
        and r.locale = new.locale
    ) then
      raise exception 'Exact Arabic revision requires human review';
    end if;
  end if;
  return new;
end
$$;
revoke all on function private.validate_editorial_publication() from public, anon, authenticated;
create trigger validate_editorial_publication before insert or update on public.publications
  for each row execute function private.validate_editorial_publication();

create function public.unpublish_editorial_content(
  p_item_id uuid, p_locale text, p_expected_revision_id uuid
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_locale not in ('en', 'ar') or p_expected_revision_id is null then
    raise exception 'Invalid publication state';
  end if;
  perform 1 from public.content_items
  where id = p_item_id and kind in ('article', 'faq') for update;
  if not found then raise exception 'Editorial item not found'; end if;
  delete from public.publications
  where item_id = p_item_id and locale = p_locale and revision_id = p_expected_revision_id;
  if not found then raise exception 'Publication changed or not found'; end if;
end
$$;
revoke all on function public.unpublish_editorial_content(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.unpublish_editorial_content(uuid, text, uuid)
  to authenticated;

create view public.published_editorial with (security_barrier = true) as
select i.id, i.kind, i.slug, r.locale, r.id as revision_id, p.published_at,
  r.title, r.body, r.summary, r.author_name, r.seo_title, r.seo_description,
  c.slug as category_slug,
  case r.locale when 'ar' then c.name_ar else c.name_en end as category_name
from public.publications p
join public.content_revisions r
  on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
join public.content_items i on i.id = p.item_id
join public.editorial_revision_metadata m
  on (m.revision_id, m.item_id, m.locale) = (r.id, r.item_id, r.locale)
join public.editorial_categories c on (c.id, c.kind) = (m.category_id, m.kind)
where i.kind in ('article', 'faq');
revoke all on public.published_editorial from public, anon, authenticated;
grant select on public.published_editorial to anon, authenticated;
