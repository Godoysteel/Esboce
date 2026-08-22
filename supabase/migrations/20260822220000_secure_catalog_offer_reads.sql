-- Catálogo é público para leitura, mas somente processos administrativos
-- podem cadastrar ou alterar fornecedores e ofertas.

alter table public.suppliers enable row level security;
alter table public.product_offers enable row level security;

drop policy if exists "Public can read active suppliers" on public.suppliers;
create policy "Public can read active suppliers"
  on public.suppliers for select
  using (active = true);

drop policy if exists "Public can read active product offers" on public.product_offers;
create policy "Public can read active product offers"
  on public.product_offers for select
  using (active = true);
