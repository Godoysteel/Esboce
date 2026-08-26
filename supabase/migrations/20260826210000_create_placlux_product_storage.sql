-- Imagens oficiais do catálogo PlacLux. A escrita anônima é temporária e
-- limitada à pasta desta importação; uma migration posterior a remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-products', 'catalog-products', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Temporary PlacLux catalog upload" on storage.objects;
create policy "Temporary PlacLux catalog upload"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'catalog-products'
    and (storage.foldername(name))[1] = 'placlux'
  );

drop policy if exists "Public catalog product images" on storage.objects;
create policy "Public catalog product images"
  on storage.objects for select to public
  using (bucket_id = 'catalog-products');
