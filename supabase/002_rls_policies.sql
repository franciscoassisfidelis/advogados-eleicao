-- =====================================================================
-- 002_rls_policies.sql — Row Level Security
--
-- Modelo de acesso:
--   - anon (formulário público): pode INSERIR em advogados e LER
--     municipios_zonas (para popular o <select> e mostrar a zona).
--     Não pode ler/editar/apagar advogados.
--   - authenticated (coordenador jurídico — único usuário, criado
--     manualmente no Supabase Auth; cadastro público (signup) deve
--     ficar DESATIVADO em Authentication > Settings para que
--     "authenticated" equivalha a "admin"): pode ler/atualizar status
--     em advogados, e ler/gerenciar municipios_zonas.
--   - service_role (usado só nas Netlify Functions, nunca no browser):
--     acesso irrestrito, usado para exportar Excel e sincronizar Drive.
-- =====================================================================

alter table public.municipios_zonas enable row level security;
alter table public.advogados enable row level security;

-- ---------------------------------------------------------------------
-- municipios_zonas
-- ---------------------------------------------------------------------

drop policy if exists "municipios_zonas: leitura pública" on public.municipios_zonas;
create policy "municipios_zonas: leitura pública"
  on public.municipios_zonas
  for select
  to anon, authenticated
  using (true);

drop policy if exists "municipios_zonas: admin gerencia" on public.municipios_zonas;
create policy "municipios_zonas: admin gerencia"
  on public.municipios_zonas
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- advogados
-- ---------------------------------------------------------------------

-- Cadastro público: qualquer visitante pode inserir seu próprio registro,
-- desde que marque o consentimento LGPD e não tente definir campos que
-- só o sistema deve controlar (status, zonas_eleitorais são sobrescritos
-- pelo trigger/definidos por padrão; aqui garantimos que o status inicial
-- seja sempre 'pendente').
drop policy if exists "advogados: cadastro público" on public.advogados;
create policy "advogados: cadastro público"
  on public.advogados
  for insert
  to anon
  with check (
    consentimento_lgpd = true
    and status = 'pendente'
  );

-- Ninguém além do admin pode ler a lista (CPF, documentos, contato).
drop policy if exists "advogados: leitura restrita ao admin" on public.advogados;
create policy "advogados: leitura restrita ao admin"
  on public.advogados
  for select
  to authenticated
  using (true);

-- Admin pode atualizar (ex.: status pendente -> confirmado).
drop policy if exists "advogados: admin atualiza" on public.advogados;
create policy "advogados: admin atualiza"
  on public.advogados
  for update
  to authenticated
  using (true)
  with check (true);

-- Sem policy de DELETE: exclusões, se necessárias, feitas via
-- service_role (dashboard do Supabase ou função administrativa), nunca
-- pelo cliente autenticado comum.
