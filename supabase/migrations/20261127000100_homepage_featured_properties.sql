create table public.property_homepage_features (
  item_id uuid primary key references public.content_items(id) on delete restrict,
  selected_by uuid not null references auth.users(id),
  selected_at timestamptz not null default now()
);
alter table public.property_homepage_features enable row level security;
revoke all on public.property_homepage_features from public, anon, authenticated, service_role;
grant select on public.property_homepage_features to authenticated;
create policy homepage_features_admin_read on public.property_homepage_features
  for select to authenticated using (private.is_admin());
create trigger audit_homepage_features after insert or update or delete
  on public.property_homepage_features for each row execute function private.audit_change();

create function public.set_property_featured(p_item_id uuid, p_featured boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_featured is null then raise exception 'Invalid featured selection'; end if;
  perform pg_advisory_xact_lock(hashtextextended('property_homepage_features', 0));
  perform 1 from public.content_items where id = p_item_id and kind = 'property' for update;
  if not found then raise exception 'Property not found'; end if;
  if p_featured then
    if not exists (
      select 1 from public.property_homepage_features where item_id = p_item_id
    ) and (select count(*) from public.property_homepage_features) >= 6 then
      raise exception 'At most six properties may be featured';
    end if;
    insert into public.property_homepage_features(item_id, selected_by)
      values (p_item_id, auth.uid()) on conflict (item_id) do nothing;
  else
    delete from public.property_homepage_features where item_id = p_item_id;
  end if;
end
$$;
revoke all on function public.set_property_featured(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_property_featured(uuid, boolean) to authenticated;

create function public.is_property_featured(p_item_id uuid)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return exists (select 1 from public.property_homepage_features where item_id = p_item_id);
end
$$;
revoke all on function public.is_property_featured(uuid) from public, anon, authenticated;
grant execute on function public.is_property_featured(uuid) to authenticated;

create view public.published_featured_content with (security_barrier = true) as
select content.*
from public.published_content content
join public.content_items item on item.id = content.id
join public.property_homepage_features feature on feature.item_id = item.id
where content.kind = 'property'
  and content.locale = 'en'
  and content.availability in ('available', 'reserved');
revoke all on public.published_featured_content from public, anon, authenticated;
grant select on public.published_featured_content to anon, authenticated;
