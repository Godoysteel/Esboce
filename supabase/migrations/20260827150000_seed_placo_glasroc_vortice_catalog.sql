-- Componentes oficiais dos sistemas Glasroc X e Glasroc X Therm.
-- Placo é fabricante; Vórtice Materiais é o fornecedor da referência média.
insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'Placo', null, false
where not exists (select 1 from public.manufacturers where lower(nome) = 'placo');

with source(categoria, nome, sku, preco, unidade, foto_url, specs) as (
  values
    ('Vedação Externa', 'Placa Glasroc X 12,5 x 1200 x 2400 mm', 'placo-glasroc-x-12-5mm', 294.41, 'PC', '/produtos/placo/placa-glasroc-x-12-5mm.webp', jsonb_build_object('marca','Placo','area_m2',2.88)),
    ('Vedação Externa', 'Placoplast Basecoat 20 kg', 'placo-placoplast-basecoat-20kg', 124.10, 'SC', '/produtos/placo/placoplast-basecoat-20kg.webp', jsonb_build_object('marca','Placo','peso_kg',20,'rendimento_kg_m2_mm',1.25)),
    ('Vedação Externa', 'Malha GRX para Superfície 1 x 50 m', 'placo-malha-grx-superficie-1x50m', 499.99, 'RL', '/produtos/placo/malha-grx-superficie-1x50m.webp', jsonb_build_object('marca','Placo','area_m2',50)),
    ('Vedação Externa', 'Membrana Hidrófuga Tyvek HomeWrap 0,91 x 30,5 m', 'placo-tyvek-homewrap-0-91x30-5m', 286.56, 'RL', '/produtos/placo/membrana-tyvek-homewrap.webp', jsonb_build_object('marca','Tyvek','area_m2',27.8)),
    ('Vedação Externa', 'Parafuso Glasroc PB 25 mm caixa com 1.000', 'placo-parafuso-glasroc-pb-25mm-cx1000', 196.60, 'CX', '/produtos/placo/parafuso-glasroc-pb.webp', jsonb_build_object('marca','Placo','quantidade',1000,'comprimento_mm',25))
)
insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), manufacturer.id, source.categoria, source.nome, source.sku, source.preco, source.unidade,
       source.specs || jsonb_build_object('sistema','Glasroc X / Glasroc X Therm','fonte_preco','Média/mediana de mercado pesquisada em 27/08/2026','fontes',jsonb_build_array('Você Constrói','Mercado Livre','Artesana','DryStore','DryDepot','Serit','Fast Sistemas','Gesso 3 Mil','Fast Framing Brasil'),'data_preco','2026-08-27','regiao','Brasil'),
       source.foto_url, 'fornecedor', true
from source
cross join (select id from public.manufacturers where lower(nome) = 'placo' limit 1) manufacturer
where not exists (select 1 from public.products product where product.sku = source.sku);

-- O EPS do Therm não é fabricado pela Placo; fica como referência genérica.
insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), manufacturer.id, 'Vedação Externa', 'Placa EPS T7F para EIFS 30 mm (preço por m²)', 'vortice-eps-eifs-t7f-30mm-m2', 64.99, 'M2',
       jsonb_build_object('espessura_mm',30,'fonte_preco','Deville Kerr, consulta 27/08/2026','data_preco','2026-08-27','regiao','Brasil'), null, 'generico', true
from public.manufacturers manufacturer
where manufacturer.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products where sku = 'vortice-eps-eifs-t7f-30mm-m2');

insert into public.product_offers (product_id, supplier_id, supplier_sku, price, currency, region, price_date, kind, stock_status, source, is_official)
select product.id, supplier.id, product.sku, product.preco, 'BRL', 'Brasil', date '2026-08-27', 'market_reference', 'to_confirm',
       'Pesquisa de preços de mercado em 27/08/2026; consultar cotação Vórtice', false
from public.products product
cross join (select id from public.suppliers where nome = 'Vórtice Materiais' limit 1) supplier
where product.sku in ('placo-glasroc-x-12-5mm','placo-placoplast-basecoat-20kg','placo-malha-grx-superficie-1x50m','placo-tyvek-homewrap-0-91x30-5m','placo-parafuso-glasroc-pb-25mm-cx1000','vortice-eps-eifs-t7f-30mm-m2')
on conflict (product_id, supplier_id, region) do update set price = excluded.price, price_date = excluded.price_date, source = excluded.source, kind = excluded.kind, updated_at = now();
