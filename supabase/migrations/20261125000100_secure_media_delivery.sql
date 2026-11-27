-- Public media delivery is mediated by the application, which re-encodes
-- approved images. Never grant anonymous access to original Storage objects.
revoke select on public.content_media from anon;
drop policy content_media_published_read on public.content_media;

drop policy private_media_published_select on storage.objects;
drop policy private_media_restrict_select on storage.objects;
create policy private_media_restrict_select on storage.objects as restrictive for select to public
  using (bucket_id <> 'private-media' or private.is_admin());

drop policy private_media_anonymous_denied on storage.objects;
create policy private_media_anonymous_denied on storage.objects as restrictive for select to anon
  using (bucket_id <> 'private-media');
