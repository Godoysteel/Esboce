-- Catálogo comercial unificado — Produto, Fornecedor e Oferta.
-- Mantém products.preco/manufacturer_id durante a transição para não quebrar
-- clientes publicados. Novos consumidores devem ler product_offers.

create table if not exists public.suppliers (
  id text primary key default gen_random_uuid()::text,
  nome text not null unique,
  kind text not null default 'official' check (kind in ('official', 'market_reference')),
  regions text[] not null default array['Brasil']::text[],
  contact jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_offers (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  supplier_id text not null references public.suppliers(id),
  supplier_sku text,
  price numeric(12,2) not null check (price >= 0),
  currency char(3) not null default 'BRL',
  region text not null,
  price_date date not null,
  price_min numeric(12,2),
  price_max numeric(12,2),
  kind text not null check (kind in ('official', 'market_reference')),
  stock_status text not null default 'to_confirm' check (stock_status in ('available', 'unavailable', 'to_confirm')),
  source text,
  is_official boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id, region)
);

create index if not exists product_offers_product_region_idx
  on public.product_offers (product_id, region) where active;

insert into public.suppliers (nome, kind, regions)
select distinct m.nome,
  case when m.nome = 'Vórtice Materiais' then 'market_reference' else 'official' end,
  array['Brasil']::text[]
from public.manufacturers m
on conflict (nome) do nothing;

insert into public.product_offers (
  product_id, supplier_id, supplier_sku, price, currency, region, price_date,
  price_min, price_max, kind, stock_status, source, is_official
)
select p.id, s.id, p.sku, p.preco, 'BRL',
  coalesce(nullif(p.specs->>'regiao', ''), 'Brasil'),
  coalesce(nullif(p.specs->>'data_preco', '')::date, date '2026-08-01'),
  nullif(p.specs->>'preco_min', '')::numeric,
  nullif(p.specs->>'preco_max', '')::numeric,
  case when p.origem = 'generico' then 'market_reference' else 'official' end,
  case when p.origem = 'generico' then 'to_confirm' else 'available' end,
  p.specs->>'fonte',
  p.origem <> 'generico'
from public.products p
join public.manufacturers m on m.id = p.manufacturer_id
join public.suppliers s on s.nome = m.nome
where p.ativo = true
on conflict (product_id, supplier_id, region) do nothing;

comment on table public.product_offers is
  'Ofertas oficiais ou referências regionais Vórtice. Referência Vórtice não constitui oferta comercial.';
