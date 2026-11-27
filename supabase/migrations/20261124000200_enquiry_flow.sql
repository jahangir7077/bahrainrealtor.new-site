-- Enquiry submission, database-atomic abuse controls and a private notification outbox.
-- Apply only through the separately approved migration process.

create table private.enquiry_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);
create index enquiry_rate_limits_expiry_idx on private.enquiry_rate_limits(window_started_at);
alter table private.enquiry_rate_limits enable row level security;
revoke all on private.enquiry_rate_limits from public, anon, authenticated, service_role;

create function public.consume_enquiry_rate_limit(p_bucket_key text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_count integer;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  insert into private.enquiry_rate_limits(bucket_key, window_started_at, request_count)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do update
  set window_started_at = case
        when private.enquiry_rate_limits.window_started_at <= now() - interval '15 minutes' then now()
        else private.enquiry_rate_limits.window_started_at
      end,
      request_count = case
        when private.enquiry_rate_limits.window_started_at <= now() - interval '15 minutes' then 1
        else private.enquiry_rate_limits.request_count + 1
      end
  returning request_count into current_count;

  delete from private.enquiry_rate_limits
  where bucket_key in (
    select bucket_key from private.enquiry_rate_limits
    where window_started_at < now() - interval '1 day'
    order by window_started_at
    limit 100
  );
  return current_count <= 5;
end
$$;
revoke all on function public.consume_enquiry_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_enquiry_rate_limit(text) to service_role;

create function public.is_enquiry_property_published(p_item_id uuid, p_locale text)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select p_locale in ('en', 'ar') and exists (
    select 1
    from public.content_items i
    join public.publications p on p.item_id = i.id and p.locale = p_locale
    join public.content_revisions r
      on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
    where i.id = p_item_id and i.kind = 'property'
  )
$$;
revoke all on function public.is_enquiry_property_published(uuid, text) from public, anon, authenticated;
grant execute on function public.is_enquiry_property_published(uuid, text) to service_role;

-- Serialize the eligibility check with publish/unpublish operations, which lock
-- the same content item before changing its publication rows.
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
    select 1 from public.publications p
    join public.content_revisions r
      on (r.id, r.item_id, r.locale) = (p.revision_id, p.item_id, p.locale)
    where p.item_id = new.property_item_id and p.locale = new.locale
  ) then raise exception 'Enquiry property must be published in the selected language'; end if;
  return new;
end
$$;
revoke all on function private.validate_enquiry() from public, anon, authenticated;

create table public.enquiry_notifications (
  enquiry_id uuid primary key references public.enquiries(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_http_status integer check (last_http_status between 100 and 599),
  lease_until timestamptz,
  lease_token uuid,
  check ((status = 'sending' and lease_until is not null and lease_token is not null)
      or (status <> 'sending' and lease_until is null and lease_token is null)),
  check ((status = 'delivered') = (delivered_at is not null))
);
create index enquiry_notifications_due_idx
  on public.enquiry_notifications(status, next_attempt_at, created_at);
alter table public.enquiry_notifications enable row level security;
revoke all on public.enquiry_notifications from public, anon, authenticated, service_role;
grant select on public.enquiry_notifications to authenticated;
create policy enquiry_notifications_admin_read on public.enquiry_notifications
  for select to authenticated using (private.is_admin());

create function private.enqueue_enquiry_notification()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.enquiry_notifications(enquiry_id) values (new.id);
  return new;
end
$$;
revoke all on function private.enqueue_enquiry_notification() from public, anon, authenticated;
create trigger enqueue_enquiry_notification after insert on public.enquiries
  for each row execute function private.enqueue_enquiry_notification();

create function public.claim_enquiry_notifications(p_limit integer default 10)
returns table (
  enquiry_id uuid, lease_token uuid, locale text, property_item_id uuid,
  name text, email text, telephone text, message text, created_at timestamptz
) language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  update public.enquiry_notifications n
    set status = 'failed', lease_until = null, lease_token = null,
        next_attempt_at = null, last_http_status = null
    where n.status = 'sending' and n.lease_until <= now() and n.attempts >= 8;

  return query
  with candidates as (
    select n.enquiry_id
    from public.enquiry_notifications n
    where (n.status = 'pending' and n.attempts < 8 and
           (n.next_attempt_at is null or n.next_attempt_at <= now()))
       or (n.status = 'sending' and n.lease_until <= now() and n.attempts < 8)
    order by coalesce(n.next_attempt_at, n.created_at), n.enquiry_id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 1), 1), 10)
  ), claimed as (
    update public.enquiry_notifications n
      set status = 'sending', attempts = n.attempts + 1,
          last_attempt_at = now(), lease_until = now() + interval '2 minutes',
          lease_token = gen_random_uuid()
      from candidates c
      where n.enquiry_id = c.enquiry_id
      returning n.enquiry_id, n.lease_token
  )
  select c.enquiry_id, c.lease_token, e.locale, e.property_item_id,
         e.name, e.email, e.telephone, e.message, e.created_at
  from claimed c join public.enquiries e on e.id = c.enquiry_id;
end
$$;
revoke all on function public.claim_enquiry_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_enquiry_notifications(integer) to service_role;

create function public.finish_enquiry_notification(
  p_enquiry_id uuid, p_lease_token uuid, p_success boolean, p_http_status integer
) returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  completed_count integer;
begin
  if p_success is null or
     (p_http_status is not null and (p_http_status < 100 or p_http_status > 599)) then
    raise exception 'Invalid notification result';
  end if;
  update public.enquiry_notifications n
  set status = case
        when p_success then 'delivered'
        when n.attempts >= 8 then 'failed'
        else 'pending'
      end,
      delivered_at = case when p_success then now() else null end,
      next_attempt_at = case
        when p_success or n.attempts >= 8 then null
        else now() + make_interval(secs => least(21600, (30 * power(2, n.attempts - 1))::integer))
      end,
      last_http_status = p_http_status,
      lease_until = null,
      lease_token = null
  where n.enquiry_id = p_enquiry_id and n.status = 'sending'
    and n.lease_token = p_lease_token;
  get diagnostics completed_count = row_count;
  return completed_count = 1;
end
$$;
revoke all on function public.finish_enquiry_notification(uuid, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.finish_enquiry_notification(uuid, uuid, boolean, integer) to service_role;

-- The trusted application is the only public-insert path; its trigger also
-- enqueues delivery atomically with the enquiry.
grant insert (property_item_id, locale, name, email, telephone, message, consent, consent_text)
  on public.enquiries to service_role;
