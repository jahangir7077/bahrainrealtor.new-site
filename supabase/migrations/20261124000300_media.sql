-- Private media originals are exposed only through short-lived transformed URLs
-- after the exact revision has been approved and published.
update storage.buckets
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'private-media';

create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  revision_id uuid not null,
  locale text not null check (locale in ('en', 'ar')),
  object_path text not null unique
    check (
      object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
      and split_part(object_path, '/', 1) = item_id::text
      and split_part(object_path, '/', 2) = revision_id::text
    ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 8388608),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 500 and alt_text !~ '[[:cntrl:]]'),
  position integer not null check (position between 0 and 999),
  is_cover boolean not null default false,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (revision_id, item_id, locale)
    references public.content_revisions(id, item_id, locale),
  unique (revision_id, position) deferrable initially deferred,
  check (width::bigint * height::bigint <= 40000000),
  check (
    (mime_type = 'image/jpeg' and object_path like '%.jpg')
    or (mime_type = 'image/png' and object_path like '%.png')
    or (mime_type = 'image/webp' and object_path like '%.webp')
  )
);

create unique index content_media_one_cover_per_revision
  on public.content_media(revision_id) where is_cover;

create function private.published_media_object_path(p_object_path text)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
begin
  return exists (
    select 1
    from public.content_media m
    join public.publications p on (p.item_id, p.locale, p.revision_id) =
      (m.item_id, m.locale, m.revision_id)
    where m.object_path = p_object_path
  );
end
$$;
revoke all on function private.published_media_object_path(text) from public, anon, authenticated;
grant execute on function private.published_media_object_path(text) to anon, authenticated;

alter table public.content_media enable row level security;
revoke all on public.content_media from public, anon, authenticated, service_role;
grant select on public.content_media to anon, authenticated;
revoke insert on public.content_media from public, anon, authenticated, service_role;
grant update (alt_text, position, is_cover) on public.content_media to authenticated;
grant delete on public.content_media to authenticated;

create policy content_media_admin_read on public.content_media for select to authenticated
  using (private.is_admin());
create policy content_media_published_read on public.content_media for select to anon, authenticated
  using (private.published_media_object_path(content_media.object_path));
create policy content_media_admin_insert on public.content_media for insert to authenticated
  with check (private.is_admin() and uploaded_by = auth.uid());
create policy content_media_admin_update on public.content_media for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy content_media_admin_delete on public.content_media for delete to authenticated
  using (private.is_admin());

create view public.published_content_media with (security_barrier = true) as
select m.id, m.item_id, m.revision_id, m.locale, m.alt_text, m.position,
  m.is_cover, m.mime_type, m.width, m.height
from public.content_media m
join public.publications p on (p.item_id, p.locale, p.revision_id) =
  (m.item_id, m.locale, m.revision_id);
revoke all on public.published_content_media from public, anon, authenticated;
grant select on public.published_content_media to anon, authenticated;

create trigger audit_content_media after insert or update or delete on public.content_media
  for each row execute function private.audit_change();

create function public.create_content_media(
  p_item_id uuid, p_revision_id uuid, p_locale text, p_object_path text,
  p_mime_type text, p_byte_size bigint, p_width integer, p_height integer, p_alt_text text
) returns table(id uuid, created_position integer, is_cover boolean)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare linked_item uuid; linked_locale text; media_count bigint; next_position integer;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_locale not in ('en', 'ar') or p_alt_text is null
    or length(btrim(p_alt_text)) not between 1 and 500 or p_alt_text ~ '[[:cntrl:]]' then
    raise exception 'Invalid media metadata';
  end if;
  select item_id, locale into linked_item, linked_locale
    from public.content_revisions where id = p_revision_id;
  if not found or linked_item is distinct from p_item_id or linked_locale is distinct from p_locale then
    raise exception 'Revision not found';
  end if;
  perform 1 from public.content_items where id = p_item_id for update;
  if not found then raise exception 'Property not found'; end if;
  select count(*), coalesce(max(m.position) + 1, 0)
    into media_count, next_position
    from public.content_media m where m.revision_id = p_revision_id;
  if media_count >= 20 then
    raise exception 'Revision image limit reached' using errcode = '23514';
  end if;
  insert into public.content_media(item_id, revision_id, locale, object_path, mime_type,
    byte_size, width, height, alt_text, position, is_cover, uploaded_by)
  values (p_item_id, p_revision_id, p_locale, p_object_path, p_mime_type,
    p_byte_size, p_width, p_height, btrim(p_alt_text), next_position, media_count = 0, auth.uid())
  returning content_media.id, content_media.position, content_media.is_cover
    into id, created_position, is_cover;
  return next;
end
$$;
revoke all on function public.create_content_media(uuid, uuid, text, text, text, bigint, integer, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_content_media(uuid, uuid, text, text, text, bigint, integer, integer, text)
  to authenticated;

create function public.set_content_media_metadata(
  p_media_id uuid, p_alt_text text, p_position integer, p_is_cover boolean
) returns void language plpgsql security invoker
set search_path = pg_catalog, public, private
as $$
declare target_item uuid; target_revision uuid; current_position integer;
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_alt_text is null or length(btrim(p_alt_text)) not between 1 and 500
    or p_alt_text ~ '[[:cntrl:]]'
    or p_position is null or p_position not between 0 and 999 or p_is_cover is null then
    raise exception 'Invalid media metadata';
  end if;
  select item_id, revision_id, position into target_item, target_revision, current_position
    from public.content_media where id = p_media_id;
  if not found then raise exception 'Media not found'; end if;
  perform 1 from public.content_items where id = target_item for update;
  perform 1 from public.content_media where revision_id = target_revision order by position, id for update;
  select position into current_position from public.content_media where id = p_media_id;
  if p_position > current_position then
    update public.content_media set position = position - 1
      where revision_id = target_revision and position > current_position and position <= p_position;
  elsif p_position < current_position then
    update public.content_media set position = position + 1
      where revision_id = target_revision and position >= p_position and position < current_position;
  end if;
  if p_is_cover then
    update public.content_media set is_cover = false
      where revision_id = target_revision and is_cover and id <> p_media_id;
  end if;
  update public.content_media
    set alt_text = btrim(p_alt_text), position = p_position, is_cover = p_is_cover
    where id = p_media_id;
end
$$;
revoke all on function public.set_content_media_metadata(uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.set_content_media_metadata(uuid, text, integer, boolean) to authenticated;

-- Upload keys are generated by the server, immutable after upload, and namespaced
-- to an existing content revision. No client can replace a stored object.
create policy private_media_admin_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private-media' and private.is_admin()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );
drop policy private_media_restrict_insert on storage.objects;
create policy private_media_restrict_insert on storage.objects as restrictive for insert to public
  with check (
    bucket_id <> 'private-media' or (
      private.is_admin()
      and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  );

create policy private_media_published_select on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'private-media'
    and private.published_media_object_path(storage.objects.name)
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
