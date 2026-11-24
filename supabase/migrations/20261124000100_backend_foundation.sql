-- No seed data or hosted execution. Public reads are limited to published snapshots.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  authorized boolean not null default false,
  created_at timestamptz not null default now()
);

create function private.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(auth.uid() is not null
    and auth.jwt()->>'aal' = 'aal2'
    and exists (select 1 from public.admin_profiles where id = auth.uid() and authorized), false)
$$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from public, anon, authenticated;
grant select (id, authorized) on public.admin_profiles to authenticated;
create policy admin_profile_self_read on public.admin_profiles for select to authenticated
  using (id = auth.uid());

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('property', 'article', 'faq')),
  -- The slug and ID are permanently bound, including after unpublishing.
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  unique (kind, slug),
  unique (id, kind)
);

create table public.property_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  kind text not null default 'property' check (kind = 'property'),
  transaction_type text not null check (transaction_type in ('sale', 'rent')),
  availability text not null check (availability in ('available', 'reserved', 'sold', 'rented', 'unavailable')),
  price_bhd numeric(14,3) check (price_bhd >= 0),
  bedrooms integer check (bedrooms >= 0),
  bathrooms integer check (bathrooms >= 0),
  size_square_meters numeric(12,2) check (size_square_meters > 0),
  location_name text not null check (length(btrim(location_name)) > 0),
  created_at timestamptz not null default now(),
  foreign key (item_id, kind) references public.content_items(id, kind),
  unique (id, item_id)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.content_items(id),
  locale text not null check (locale in ('en', 'ar')),
  property_version_id uuid,
  title text not null check (length(btrim(title)) > 0),
  body text not null check (length(btrim(body)) > 0),
  summary text,
  area_name text,
  property_type text,
  author_name text,
  seo_title text,
  seo_description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (property_version_id, item_id) references public.property_versions(id, item_id),
  unique (id, item_id, locale)
);

create table public.revision_approvals (
  revision_id uuid primary key,
  item_id uuid not null,
  locale text not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  foreign key (revision_id, item_id, locale)
    references public.content_revisions(id, item_id, locale),
  unique (revision_id, item_id, locale)
);

create table public.publications (
  item_id uuid not null,
  locale text not null,
  revision_id uuid not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key (item_id, locale),
  foreign key (revision_id, item_id, locale)
    references public.revision_approvals(revision_id, item_id, locale)
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_item_id uuid references public.content_items(id),
  locale text not null check (locale in ('en', 'ar')),
  name text not null check (length(btrim(name)) between 1 and 200),
  email text not null check (length(btrim(email)) between 3 and 320),
  telephone text not null check (length(btrim(telephone)) between 1 and 100),
  message text not null check (length(btrim(message)) between 1 and 10000),
  consent boolean not null check (consent),
  consent_text text not null check (length(btrim(consent_text)) > 0),
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now()
);

create table private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  operation text not null,
  table_name text not null,
  row_id text not null,
  occurred_at timestamptz not null default now()
);
alter table private.audit_log enable row level security;
revoke all on private.audit_log from public, anon, authenticated;
grant select on private.audit_log to authenticated;
create policy audit_admin_read on private.audit_log for select to authenticated
  using (private.is_admin());

create function private.audit_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, private
as $$
declare row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into private.audit_log(actor_id, operation, table_name, row_id)
  values (auth.uid(), tg_op, tg_table_schema || '.' || tg_table_name,
    coalesce(row_data->>'id', row_data->>'revision_id', row_data->>'item_id', row_data->>'user_id'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function private.audit_change() from public, anon, authenticated;

create function private.prevent_mutation()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin raise exception 'Immutable record'; end $$;
revoke all on function private.prevent_mutation() from public, anon, authenticated;

create trigger immutable_items before update or delete on public.content_items
  for each row execute function private.prevent_mutation();
create trigger immutable_property_versions before update or delete on public.property_versions
  for each row execute function private.prevent_mutation();
create trigger immutable_content_revisions before update or delete on public.content_revisions
  for each row execute function private.prevent_mutation();
create trigger immutable_approvals before update or delete on public.revision_approvals
  for each row execute function private.prevent_mutation();

create function private.validate_revision()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare item_kind text;
begin
  select kind into item_kind from public.content_items where id = new.item_id;
  if item_kind = 'property' then
    if new.property_version_id is null or nullif(btrim(new.area_name), '') is null
      or nullif(btrim(new.property_type), '') is null then
      raise exception 'Property revision requires a property version, area and type';
    end if;
  elsif new.property_version_id is not null then
    raise exception 'Only properties can reference a property version';
  end if;
  if item_kind = 'article' and (nullif(btrim(new.author_name), '') is null
    or nullif(btrim(new.summary), '') is null) then
    raise exception 'Article revision requires an author and summary';
  end if;
  return new;
end
$$;
revoke all on function private.validate_revision() from public, anon, authenticated;
create trigger validate_revision before insert on public.content_revisions
  for each row execute function private.validate_revision();

create function private.validate_enquiry()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.property_item_id is not null and not exists (
    select 1 from public.content_items where id = new.property_item_id and kind = 'property'
  ) then raise exception 'Enquiry property must be a property'; end if;
  return new;
end
$$;
revoke all on function private.validate_enquiry() from public, anon, authenticated;
create trigger validate_enquiry before insert or update of property_item_id on public.enquiries
  for each row execute function private.validate_enquiry();

create trigger audit_admin after insert or update or delete on public.admin_profiles
  for each row execute function private.audit_change();
create trigger audit_items after insert or update or delete on public.content_items
  for each row execute function private.audit_change();
create trigger audit_property_versions after insert or update or delete on public.property_versions
  for each row execute function private.audit_change();
create trigger audit_revisions after insert or update or delete on public.content_revisions
  for each row execute function private.audit_change();
create trigger audit_approvals after insert or update or delete on public.revision_approvals
  for each row execute function private.audit_change();
create trigger audit_publications after insert or update or delete on public.publications
  for each row execute function private.audit_change();
create trigger audit_enquiries after insert or update or delete on public.enquiries
  for each row execute function private.audit_change();

alter table public.content_items enable row level security;
alter table public.property_versions enable row level security;
alter table public.content_revisions enable row level security;
alter table public.revision_approvals enable row level security;
alter table public.publications enable row level security;
alter table public.enquiries enable row level security;

revoke all on public.content_items, public.property_versions, public.content_revisions,
  public.revision_approvals, public.publications, public.enquiries from public, anon, authenticated;

grant select, insert on public.content_items, public.property_versions, public.content_revisions to authenticated;
grant select on public.revision_approvals, public.publications, public.enquiries to authenticated;
grant update (status) on public.enquiries to authenticated;

create policy items_admin_read on public.content_items for select to authenticated using (private.is_admin());
create policy items_admin_insert on public.content_items for insert to authenticated with check (private.is_admin());
create policy property_versions_admin_read on public.property_versions for select to authenticated using (private.is_admin());
create policy property_versions_admin_insert on public.property_versions for insert to authenticated with check (private.is_admin());
create policy revisions_admin_read on public.content_revisions for select to authenticated using (private.is_admin());
create policy revisions_admin_insert on public.content_revisions for insert to authenticated
  with check (private.is_admin() and created_by = auth.uid());
create policy approvals_admin_read on public.revision_approvals for select to authenticated using (private.is_admin());
create policy publications_admin_read on public.publications for select to authenticated using (private.is_admin());
create policy enquiries_admin_read on public.enquiries for select to authenticated using (private.is_admin());
create policy enquiries_admin_status on public.enquiries for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- A trusted server may insert only after its own validation, consent and abuse controls.
grant insert on public.enquiries to service_role;

create function public.approve_revision(p_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.revision_approvals(revision_id, item_id, locale, approved_by)
  select id, item_id, locale, auth.uid() from public.content_revisions where id = p_revision_id;
  if not found then raise exception 'Revision not found'; end if;
end
$$;

create function public.publish_revision(p_revision_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.publications(item_id, locale, revision_id, published_by)
  select item_id, locale, revision_id, auth.uid()
  from public.revision_approvals where revision_id = p_revision_id
  on conflict (item_id, locale) do update
    set revision_id = excluded.revision_id, published_by = excluded.published_by, published_at = now();
  if not found then raise exception 'Approved revision not found'; end if;
end
$$;

create function public.unpublish_content(p_item_id uuid, p_locale text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.publications where item_id = p_item_id and locale = p_locale;
end
$$;
revoke all on function public.approve_revision(uuid), public.publish_revision(uuid),
  public.unpublish_content(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_revision(uuid), public.publish_revision(uuid),
  public.unpublish_content(uuid, text) to authenticated;

-- Owner-executed view intentionally bypasses underlying RLS, but only joins approved
-- immutable revisions. Never add private fields or use security_invoker here.
create view public.published_content with (security_barrier = true) as
select i.id, i.kind, i.slug, r.locale, r.id as revision_id, p.published_at,
  r.title, r.body, r.summary, r.area_name, r.property_type, r.author_name,
  r.seo_title, r.seo_description,
  v.transaction_type, v.availability, v.price_bhd, v.bedrooms, v.bathrooms,
  v.size_square_meters, v.location_name
from public.publications p
join public.content_revisions r on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
join public.content_items i on i.id = p.item_id
left join public.property_versions v on (v.id, v.item_id) = (r.property_version_id, r.item_id);
revoke all on public.published_content from public, anon, authenticated;
grant select on public.published_content to anon, authenticated;

-- Private originals only. Public image delivery needs a separately reviewed pipeline.
insert into storage.buckets (id, name, public) values ('private-media', 'private-media', false);
create policy private_media_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'private-media' and private.is_admin());
create policy private_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'private-media' and private.is_admin());
create policy private_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'private-media' and private.is_admin())
  with check (bucket_id = 'private-media' and private.is_admin());
create policy private_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and private.is_admin());
