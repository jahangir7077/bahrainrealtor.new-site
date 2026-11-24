create table public.content_lifecycle (
  item_id uuid primary key references public.content_items(id) on delete restrict,
  status text not null check (status in ('active', 'archived')),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.content_lifecycle enable row level security;
revoke all on public.content_lifecycle from public, anon, authenticated, service_role;
grant select on public.content_lifecycle to authenticated;
create policy lifecycle_admin_read on public.content_lifecycle for select to authenticated
  using (private.is_admin());
create trigger audit_lifecycle after insert or update or delete on public.content_lifecycle
  for each row execute function private.audit_change();

create function public.archive_content(p_item_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.content_items where id = p_item_id for update;
  if not found then raise exception 'Content not found'; end if;
  insert into public.content_lifecycle(item_id, status, updated_by)
  values (p_item_id, 'archived', auth.uid())
  on conflict (item_id) do update set status = 'archived',
    updated_by = auth.uid(), updated_at = now();
end
$$;

create function public.unarchive_content(p_item_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.content_items where id = p_item_id for update;
  if not found then raise exception 'Content not found'; end if;
  update public.content_lifecycle set status = 'active',
    updated_by = auth.uid(), updated_at = now() where item_id = p_item_id;
end
$$;
revoke all on function public.archive_content(uuid), public.unarchive_content(uuid)
  from public, anon, authenticated;
grant execute on function public.archive_content(uuid), public.unarchive_content(uuid)
  to authenticated;

create function public.create_property_version_draft(
  p_item_id uuid, p_source_revision_id uuid, p_property_version_id uuid, p_revision_id uuid,
  p_transaction_type text, p_availability text, p_price_bhd numeric, p_bedrooms integer,
  p_bathrooms integer, p_size_square_meters numeric, p_location_name text
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  source public.content_revisions%rowtype;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.content_items where id = p_item_id and kind = 'property' for update;
  if not found then raise exception 'Property not found'; end if;
  if exists (select 1 from public.publications where item_id = p_item_id) then
    raise exception 'Unpublish every language before changing shared property facts';
  end if;
  select * into source from public.content_revisions
    where id = p_source_revision_id and item_id = p_item_id;
  if not found then raise exception 'Source revision not found'; end if;

  insert into public.property_versions(id, item_id, transaction_type, availability, price_bhd,
    bedrooms, bathrooms, size_square_meters, location_name)
  values (p_property_version_id, p_item_id, p_transaction_type, p_availability, p_price_bhd,
    p_bedrooms, p_bathrooms, p_size_square_meters, p_location_name);
  insert into public.content_revisions(id, item_id, locale, property_version_id, title, body,
    summary, area_name, property_type, author_name, seo_title, seo_description, created_by)
  values (p_revision_id, p_item_id, source.locale, p_property_version_id, source.title, source.body,
    source.summary, source.area_name, source.property_type, source.author_name, source.seo_title,
    source.seo_description, auth.uid());
end
$$;
revoke all on function public.create_property_version_draft(uuid, uuid, uuid, uuid, text, text, numeric, integer, integer, numeric, text)
  from public, anon, authenticated;
grant execute on function public.create_property_version_draft(uuid, uuid, uuid, uuid, text, text, numeric, integer, integer, numeric, text)
  to authenticated;

create or replace function public.publish_revision_if_current(p_revision_id uuid, p_expected_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  target_item uuid;
  target_locale text;
  target_kind text;
  target_property_version uuid;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select a.item_id, a.locale, i.kind, r.property_version_id
    into target_item, target_locale, target_kind, target_property_version
  from public.revision_approvals a
  join public.content_revisions r on r.id = a.revision_id
  join public.content_items i on i.id = a.item_id
  where a.revision_id = p_revision_id;
  if not found then raise exception 'Approval missing or publication changed'; end if;

  perform 1 from public.content_items where id = target_item for update;
  if exists (select 1 from public.content_lifecycle
    where item_id = target_item and status = 'archived') then
    raise exception 'Archived content cannot be published';
  end if;
  if target_kind = 'property' and exists (
    select 1 from public.publications p
    join public.content_revisions r on r.id = p.revision_id
    where p.item_id = target_item and p.locale <> target_locale
      and r.property_version_id is distinct from target_property_version
  ) then
    raise exception 'Other published locale uses different property facts';
  end if;
  if p_expected_revision_id is null then
    insert into public.publications(item_id, locale, revision_id, published_by)
    select item_id, locale, revision_id, auth.uid()
    from public.revision_approvals where revision_id = p_revision_id
    on conflict (item_id, locale) do nothing;
  else
    update public.publications p
    set revision_id = a.revision_id, published_by = auth.uid(), published_at = now()
    from public.revision_approvals a
    where a.revision_id = p_revision_id and p.item_id = a.item_id
      and p.locale = a.locale and p.revision_id = p_expected_revision_id;
  end if;
  if not found then raise exception 'Approval missing or publication changed'; end if;
end
$$;
revoke all on function public.publish_revision_if_current(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_revision_if_current(uuid, uuid) to authenticated;

create or replace function public.is_enquiry_property_published(p_item_id uuid, p_locale text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select p_locale in ('en', 'ar') and exists (
    select 1
    from public.content_items i
    join public.publications p on p.item_id = i.id and p.locale = p_locale
    join public.content_revisions r
      on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
    left join public.content_lifecycle l on l.item_id = i.id
    where i.id = p_item_id and i.kind = 'property'
      and coalesce(l.status, 'active') = 'active'
  )
$$;
revoke all on function public.is_enquiry_property_published(uuid, text)
  from public, anon, authenticated;
grant execute on function public.is_enquiry_property_published(uuid, text) to service_role;

create or replace function private.validate_enquiry()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare item_kind text;
begin
  if new.property_item_id is null then return new; end if;
  select kind into item_kind from public.content_items
    where id = new.property_item_id for share;
  if item_kind is distinct from 'property' then
    raise exception 'Enquiry property must be a property';
  end if;
  if not exists (
    select 1
    from public.publications p
    left join public.content_lifecycle l on l.item_id = p.item_id
    where p.item_id = new.property_item_id and p.locale = new.locale
      and coalesce(l.status, 'active') = 'active'
  ) then raise exception 'Enquiry property must be published in the selected language'; end if;
  return new;
end
$$;
revoke all on function private.validate_enquiry() from public, anon, authenticated;

create or replace view public.published_content with (security_barrier = true) as
select i.id, i.kind, i.slug, r.locale, r.id as revision_id, p.published_at,
  r.title, r.body, r.summary, r.area_name, r.property_type, r.author_name,
  r.seo_title, r.seo_description,
  v.transaction_type, v.availability, v.price_bhd::text as price_bhd, v.bedrooms, v.bathrooms,
  v.size_square_meters, v.location_name,
  v.price_bhd as price_bhd_numeric
from public.publications p
join public.content_revisions r on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
join public.content_items i on i.id = p.item_id
left join public.property_versions v on (v.id, v.item_id) = (r.property_version_id, r.item_id)
left join public.content_lifecycle l on l.item_id = i.id
where coalesce(l.status, 'active') = 'active';
revoke all on public.published_content from public, anon, authenticated;
grant select on public.published_content to anon, authenticated;

create or replace function private.published_media_object_path(p_object_path text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
begin
  return exists (
    select 1
    from public.content_media m
    join public.publications p on (p.item_id, p.locale, p.revision_id) =
      (m.item_id, m.locale, m.revision_id)
    left join public.content_lifecycle l on l.item_id = m.item_id
    where m.object_path = p_object_path
      and coalesce(l.status, 'active') = 'active'
  );
end
$$;
revoke all on function private.published_media_object_path(text) from public, anon, authenticated;
grant execute on function private.published_media_object_path(text) to anon, authenticated;

drop policy content_media_published_read on public.content_media;
create policy content_media_published_read on public.content_media for select to anon, authenticated
  using (private.published_media_object_path(content_media.object_path));
create or replace view public.published_content_media with (security_barrier = true) as
select m.id, m.item_id, m.revision_id, m.locale, m.alt_text, m.position,
  m.is_cover, m.mime_type, m.width, m.height
from public.content_media m
join public.publications p on (p.item_id, p.locale, p.revision_id) =
  (m.item_id, m.locale, m.revision_id)
left join public.content_lifecycle l on l.item_id = m.item_id
where coalesce(l.status, 'active') = 'active';
revoke all on public.published_content_media from public, anon, authenticated;
grant select on public.published_content_media to anon, authenticated;

drop policy private_media_published_select on storage.objects;
create policy private_media_published_select on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'private-media' and exists (
      select private.published_media_object_path(storage.objects.name)
    )
  );
drop policy private_media_restrict_select on storage.objects;
create policy private_media_restrict_select on storage.objects as restrictive for select to public
  using (
    bucket_id <> 'private-media' or private.is_admin()
      or private.published_media_object_path(storage.objects.name)
  );
drop policy private_media_anonymous_denied on storage.objects;
create policy private_media_anonymous_denied on storage.objects as restrictive for select to anon
  using (
    bucket_id <> 'private-media'
      or private.published_media_object_path(storage.objects.name)
  );
