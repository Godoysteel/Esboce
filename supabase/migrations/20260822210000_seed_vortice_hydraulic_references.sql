-- Tubos e conexões contabilizados pela rede de esgoto/pluvial.
-- Cada item recebe uma referência Vórtice regional e datada; os valores
-- locais do aplicativo permanecem apenas como fallback offline.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid()::text, m.id, 'Hidráulica', v.nome, v.sku, v.preco, 'UN',
       jsonb_build_object(
         'fonte', 'preço médio de mercado nacional, pesquisa 2025-2026',
         'regiao', 'Brasil',
         'data_preco', '2026-08-22'
       ), null, 'generico', true
from (values
  ('Tubo PVC esgoto 40mm — barra 6m', 'vortice-tubo-esgoto-40mm-6m', 70.00),
  ('Tubo PVC esgoto 50mm — barra 6m', 'vortice-tubo-esgoto-50mm-6m', 95.00),
  ('Tubo PVC esgoto 75mm — barra 6m', 'vortice-tubo-esgoto-75mm-6m', 206.00),
  ('Tubo PVC esgoto 100mm — barra 6m', 'vortice-tubo-esgoto-100mm-6m', 280.00),
  ('Tubo PVC pluvial 75mm — barra 6m', 'vortice-tubo-pluvial-75mm-6m', 180.00),
  ('Joelho 90° PVC esgoto 40mm', 'vortice-conexao-esgoto-40mm-joelho90', 8.00),
  ('Joelho 45° PVC esgoto 40mm', 'vortice-conexao-esgoto-40mm-joelho45', 7.00),
  ('Tê PVC esgoto 40mm', 'vortice-conexao-esgoto-40mm-te', 14.00),
  ('Cruzeta PVC esgoto 40mm', 'vortice-conexao-esgoto-40mm-cruzeta', 22.00),
  ('Joelho 90° PVC esgoto 50mm', 'vortice-conexao-esgoto-50mm-joelho90', 10.00),
  ('Joelho 45° PVC esgoto 50mm', 'vortice-conexao-esgoto-50mm-joelho45', 9.00),
  ('Tê PVC esgoto 50mm', 'vortice-conexao-esgoto-50mm-te', 18.00),
  ('Cruzeta PVC esgoto 50mm', 'vortice-conexao-esgoto-50mm-cruzeta', 28.00),
  ('Joelho 90° PVC esgoto 75mm', 'vortice-conexao-esgoto-75mm-joelho90', 22.00),
  ('Joelho 45° PVC esgoto 75mm', 'vortice-conexao-esgoto-75mm-joelho45', 19.00),
  ('Tê PVC esgoto 75mm', 'vortice-conexao-esgoto-75mm-te', 38.00),
  ('Cruzeta PVC esgoto 75mm', 'vortice-conexao-esgoto-75mm-cruzeta', 55.00),
  ('Joelho 90° PVC esgoto 100mm', 'vortice-conexao-esgoto-100mm-joelho90', 32.00),
  ('Joelho 45° PVC esgoto 100mm', 'vortice-conexao-esgoto-100mm-joelho45', 28.00),
  ('Tê PVC esgoto 100mm', 'vortice-conexao-esgoto-100mm-te', 55.00),
  ('Cruzeta PVC esgoto 100mm', 'vortice-conexao-esgoto-100mm-cruzeta', 80.00),
  ('Joelho 90° PVC pluvial 75mm', 'vortice-conexao-pluvial-75mm-joelho90', 20.00),
  ('Joelho 45° PVC pluvial 75mm', 'vortice-conexao-pluvial-75mm-joelho45', 17.00),
  ('Tê PVC pluvial 75mm', 'vortice-conexao-pluvial-75mm-te', 34.00),
  ('Cruzeta PVC pluvial 75mm', 'vortice-conexao-pluvial-75mm-cruzeta', 50.00)
) as v(nome, sku, preco)
cross join (select id from public.manufacturers where nome = 'Vórtice Materiais') as m
where not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = v.sku
);

insert into public.product_offers (
  product_id, supplier_id, supplier_sku, price, currency, region, price_date,
  kind, stock_status, source, is_official
)
select p.id, s.id, p.sku, p.preco, 'BRL', 'Brasil', date '2026-08-22',
       'market_reference', 'to_confirm',
       'preço médio de mercado nacional, pesquisa 2025-2026', false
from public.products p
join public.manufacturers m on m.id = p.manufacturer_id and m.nome = 'Vórtice Materiais'
join public.suppliers s on s.nome = 'Vórtice Materiais'
where p.sku like 'vortice-tubo-esgoto-%'
   or p.sku like 'vortice-tubo-pluvial-%'
   or p.sku like 'vortice-conexao-esgoto-%'
   or p.sku like 'vortice-conexao-pluvial-%'
on conflict (product_id, supplier_id, region) do update set
  price = excluded.price,
  price_date = excluded.price_date,
  source = excluded.source,
  updated_at = now();
