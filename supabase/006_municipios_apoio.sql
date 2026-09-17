-- =====================================================================
-- 006_municipios_apoio.sql
--
-- O advogado continua designado a um único "município principal"
-- (coluna existente `municipio`, que já aciona o trigger de zona
-- eleitoral automática). Este script adiciona a possibilidade de
-- indicar municípios de apoio adicionais, sem zona eleitoral associada
-- (são só referência para a Coordenação Jurídica saber onde mais esse
-- advogado pode ajudar).
-- =====================================================================

alter table public.advogados
  add column if not exists municipios_apoio text[] not null default '{}';

comment on column public.advogados.municipio is
  'Município principal — designação única do dia da eleição, aciona o trigger de zona eleitoral.';
comment on column public.advogados.municipios_apoio is
  'Município(s) de apoio adicionais (opcional, múltipla escolha) — sem zona eleitoral calculada.';
