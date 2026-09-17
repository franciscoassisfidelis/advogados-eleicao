-- =====================================================================
-- 003_storage.sql — bucket privado para a carteira da OAB
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'oab-documentos',
  'oab-documentos',
  false, -- bucket privado: nunca acessível por URL pública direta
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Visitante anônimo pode enviar (upload) o arquivo da carteira da OAB,
-- mas só dentro da pasta "pendentes/" — não pode ler, listar, sobrescrever
-- ou apagar nada (inclusive o que ele mesmo acabou de enviar).
drop policy if exists "oab-documentos: upload público restrito" on storage.objects;
create policy "oab-documentos: upload público restrito"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'oab-documentos'
    and (storage.foldername(name))[1] = 'pendentes'
  );

-- Só o admin autenticado pode ler (visualizar/baixar) os documentos.
drop policy if exists "oab-documentos: leitura restrita ao admin" on storage.objects;
create policy "oab-documentos: leitura restrita ao admin"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'oab-documentos');

-- Admin pode reorganizar/remover documentos se necessário (ex.: duplicidade).
drop policy if exists "oab-documentos: admin gerencia" on storage.objects;
create policy "oab-documentos: admin gerencia"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'oab-documentos')
  with check (bucket_id = 'oab-documentos');
