-- =====================================================================
-- Cadastro de Advogados — Dia da Eleição
-- Campanha Lucas Ribeiro — Governador — Eleições 2026 (Paraíba)
-- 001_schema.sql — tabelas, trigger de zona eleitoral automática
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabela de referência: município -> zona(s) eleitoral(is)
-- Populada a partir do documento oficial da Coordenação Jurídica
-- ("Municipios_PB_Completo_Zonas_Advogados_Telefones", TRE-PB, com
-- checagem cruzada na planilha da Polícia Militar). Ver seed_municipios_zonas.sql.
-- ---------------------------------------------------------------------
create table if not exists public.municipios_zonas (
  municipio  text primary key,
  zonas      text[] not null default '{}',  -- ex.: {'2','3'} para Santa Rita. Vazio = zona não localizada, requer confirmação manual.
  updated_at timestamptz not null default now()
);

comment on table public.municipios_zonas is
  'Referência município -> zona(s) eleitoral(is) da Paraíba, fonte TRE-PB (compilada pela Coordenação Jurídica). Consultada automaticamente no cadastro de advogados.';
comment on column public.municipios_zonas.zonas is
  'Array de zonas eleitorais (apenas o número, sem "ª"). Array vazio = zona ainda não localizada/confirmada.';

-- ---------------------------------------------------------------------
-- Tabela principal: advogados cadastrados para o dia da eleição
-- ---------------------------------------------------------------------
create table if not exists public.advogados (
  id                  uuid primary key default gen_random_uuid(),

  nome_completo       text not null check (char_length(trim(nome_completo)) >= 3),
  cpf                 text not null unique check (cpf ~ '^\d{11}$'),
  oab_numero          text not null check (char_length(trim(oab_numero)) > 0),
  oab_seccional       text not null default 'PB' check (char_length(trim(oab_seccional)) > 0),
  telefone            text not null check (char_length(trim(telefone)) >= 10),
  email               text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  municipio           text not null references public.municipios_zonas(municipio),
  zonas_eleitorais    text[] not null default '{}', -- preenchido automaticamente via trigger, a partir de municipios_zonas

  documento_oab_path  text not null,                -- caminho no bucket privado 'oab-documentos'

  consentimento_lgpd  boolean not null default false check (consentimento_lgpd = true),

  status              text not null default 'pendente' check (status in ('pendente', 'confirmado')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.advogados is
  'Advogados cadastrados para apoio jurídico no dia da eleição, um por município. Dados sensíveis (CPF etc.) só visíveis ao admin autenticado.';
comment on column public.advogados.zonas_eleitorais is
  'Preenchido automaticamente pelo trigger trg_advogados_set_zonas a partir de municipios_zonas.zonas — não deve ser definido pelo cliente.';
comment on column public.advogados.documento_oab_path is
  'Caminho do arquivo no bucket privado oab-documentos (imagem ou PDF da carteira da OAB).';

create index if not exists idx_advogados_municipio on public.advogados (municipio);
create index if not exists idx_advogados_status on public.advogados (status);
create index if not exists idx_advogados_created_at on public.advogados (created_at desc);

-- ---------------------------------------------------------------------
-- Trigger: preenche zonas_eleitorais automaticamente a partir do
-- município selecionado. security definer para funcionar mesmo que o
-- usuário anônimo não tenha select direto em municipios_zonas.
-- ---------------------------------------------------------------------
create or replace function public.set_zonas_eleitorais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select zonas into new.zonas_eleitorais
  from public.municipios_zonas
  where municipio = new.municipio;

  if new.zonas_eleitorais is null then
    new.zonas_eleitorais := '{}';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_advogados_set_zonas on public.advogados;
create trigger trg_advogados_set_zonas
  before insert or update of municipio on public.advogados
  for each row execute function public.set_zonas_eleitorais();

-- updated_at automático em qualquer update (ex.: mudança de status pelo admin)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_advogados_touch_updated_at on public.advogados;
create trigger trg_advogados_touch_updated_at
  before update on public.advogados
  for each row execute function public.touch_updated_at();
