-- Referências gerais que ainda eram constantes locais no MaterialsPanel.
-- São produtos de referência Vórtice, não ofertas comerciais. Região e data
-- ficam explícitas para rastreabilidade e para os PDFs por fornecedor.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, v.categoria, v.nome, v.sku, v.preco, v.unidade,
       jsonb_build_object(
         'fonte', 'preço médio de mercado nacional, pesquisa 2025-2026',
         'regiao', 'Brasil',
         'data_preco', '2026-08-22'
       ), null, 'generico', true
from (values
  ('Pisos e Revestimentos', 'Rodapé padrão (preço médio por metro)', 'vortice-rodape-m', 18.00, 'M'),
  ('Portas e Janelas', 'Porta de madeira padrão (preço médio por unidade)', 'vortice-porta-madeira-un', 450.00, 'UN'),
  ('Pisos e Revestimentos', 'Soleira de pedra (preço médio por metro)', 'vortice-soleira-m', 90.00, 'M'),
  ('Portas e Janelas', 'Pele de vidro (preço médio por m²)', 'vortice-pele-vidro-m2', 580.00, 'M2'),
  ('Portas e Janelas', 'Sacada de vidro (preço médio por metro)', 'vortice-sacada-vidro-m', 420.00, 'M'),
  ('Estrutura', 'Varanda — composição básica (preço médio por m²)', 'vortice-varanda-m2', 320.00, 'M2'),
  ('Estrutura', 'Volumetria sem acabamento (preço médio por m²)', 'vortice-volumetria-m2', 260.00, 'M2'),
  ('Estrutura', 'Escada residencial (preço médio por unidade)', 'vortice-escada-un', 3500.00, 'UN'),
  ('Hidráulica', 'Caixa hidráulica pré-moldada (preço médio por unidade)', 'vortice-caixa-hidraulica-un', 115.00, 'UN')
) as v(categoria, nome, sku, preco, unidade)
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
where p.sku in (
  'vortice-rodape-m', 'vortice-porta-madeira-un', 'vortice-soleira-m',
  'vortice-pele-vidro-m2', 'vortice-sacada-vidro-m', 'vortice-varanda-m2',
  'vortice-volumetria-m2', 'vortice-escada-un', 'vortice-caixa-hidraulica-un'
)
on conflict (product_id, supplier_id, region) do update set
  price = excluded.price,
  price_date = excluded.price_date,
  source = excluded.source,
  updated_at = now();
