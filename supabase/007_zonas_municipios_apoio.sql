-- =====================================================================
-- 007_zonas_municipios_apoio.sql
--
-- Adiciona a zona eleitoral de cada município de apoio, seguindo o
-- mesmo princípio do município principal: calculada pelo trigger (não
-- enviada pelo cliente), para não poder ser manipulada.
--
-- Formato: jsonb, um array de objetos {"municipio": "...", "zonas": [...]}.
-- Ex.: [{"municipio": "Bayeux", "zonas": ["61"]}, {"municipio": "Santa Rita", "zonas": ["2","3"]}]
-- =====================================================================

alter table public.advogados
  add column if not exists municipios_apoio_zonas jsonb not null default '[]';

comment on column public.advogados.municipios_apoio_zonas is
  'Zona(s) eleitoral(is) de cada município de apoio, calculada automaticamente pelo trigger a partir de municipios_apoio — não deve ser definida pelo cliente.';

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

  select coalesce(jsonb_agg(jsonb_build_object('municipio', mz.municipio, 'zonas', mz.zonas)), '[]'::jsonb)
    into new.municipios_apoio_zonas
  from unnest(coalesce(new.municipios_apoio, '{}')) as apoio_municipio
  join public.municipios_zonas mz on mz.municipio = apoio_municipio;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_advogados_set_zonas on public.advogados;
create trigger trg_advogados_set_zonas
  before insert or update of municipio, municipios_apoio on public.advogados
  for each row execute function public.set_zonas_eleitorais();
