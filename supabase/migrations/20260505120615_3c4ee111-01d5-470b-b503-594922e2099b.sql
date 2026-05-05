insert into storage.buckets (id, name, public) values ('lead-magnet-assets', 'lead-magnet-assets', true) on conflict (id) do update set public = true;

drop policy if exists "Public read lead magnet assets" on storage.objects;
create policy "Public read lead magnet assets"
on storage.objects for select
using (bucket_id = 'lead-magnet-assets');