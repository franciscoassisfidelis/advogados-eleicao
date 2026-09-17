-- =====================================================================
-- 005_grants_and_delete_policy.sql
--
-- Duas correções aplicadas depois do setup inicial:
--
-- 1) GRANTs de tabela para anon/authenticated. Ao criar o projeto com a
--    opção "Automatically expose new tables" desmarcada (recomendado pela
--    própria Supabase para controle manual via RLS), as roles anon e
--    authenticated não recebem privilégio de SELECT/INSERT/UPDATE por
--    padrão — RLS sozinho não é suficiente, o GRANT de tabela também é
--    necessário. Sem isso, o formulário público falha com
--    "permission denied for table municipios_zonas" (42501).
--
-- 2) Política de DELETE em advogados, usada pelo botão "🗑" do dashboard
--    admin para remover cadastros de teste/duplicados.
-- =====================================================================

grant usage on schema public to anon, authenticated;

grant select on public.municipios_zonas to anon, authenticated;
grant insert, update, delete on public.municipios_zonas to authenticated;

grant select, insert on public.advogados to anon;
grant select, update, delete on public.advogados to authenticated;

drop policy if exists "advogados: admin exclui" on public.advogados;
create policy "advogados: admin exclui"
  on public.advogados
  for delete
  to authenticated
  using (true);
