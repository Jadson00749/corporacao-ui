-- ============================================================
-- 20 — Storage: organizer pode excluir assets da própria Loja
--
-- JÁ APLICADO no Supabase de produção.
-- Arquivo no repo somente para sincronizar Git ↔ banco.
-- NÃO executar novamente.
-- ============================================================

begin;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname='Organizers can delete own store product assets'
  ) then
    create policy "Organizers can delete own store product assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'corporacao-bucket'
        and name like 'events/store-products/%'
        and owner_id = auth.uid()::text
        and public.has_role(auth.uid(), 'organizer'::public.app_role)
      );
  end if;
end $$;

commit;
