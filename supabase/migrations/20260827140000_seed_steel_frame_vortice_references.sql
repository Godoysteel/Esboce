-- Preço médio de mercado (SEM fornecedor específico) pros primeiros
-- itens de Steel Frame que ainda não tinham NENHUM produto de catálogo
-- por trás (EIFS, substrato OSB/Compensado, Glasroc X, pingadeira) —
-- mesmo padrão das demais migrations Vórtice (nível 2: preenche
-- qualquer material que um fornecedor real ainda não resolveu, ver
-- MaterialsPanel.ts VORTICE_MATERIAL_SKUS/STEEL_FRAME_PRICE_KEY_BY_LAYER_ID).
--
-- PREMISSAS (preços reais consultados pelo Product Owner na loja
-- Espaço Smart, maior rede de construção a seco do Brasil, 27/08/2026):
--   • Pacote com 100 Arruelas para Sistema EIFS ... R$ 47,92/pacote
--     (R$ 0,4792/arruela) — fixação mecânica do EPS/XPS quando o
--     substrato é madeira (OSB/Compensado).
--   • Pingadeira PVC 2,50m ......................... R$ 101,88/peça —
--     arremate de base, cobre o perímetro das paredes (DEC-156).
--   • Placa de Gesso Glasroc X 12,5 x 1200 x 2400mm . R$ 219,90/placa
--     (2,88m² ≈ R$ 76,35/m²) — mesma linha British Gypsum/Placo/Gyproc/
--     Rigips (Saint-Gobain) já sinalizada como referência futura da
--     composição Glasroc.
--   • Placa OSB Home Plus MDI 11,1 x 1200 x 2400mm .. R$ 200,00/placa
--     (2,88m² ≈ R$ 69,44/m²) — substrato de madeira compartilhado por
--     "Placa cimentícia com substrato" e "EIFS sobre substrato de
--     madeira" (mesmo produto físico, id 'osb'/'cement-board-substrate'
--     no quantitativo).
--
-- São preços de REFERÊNCIA/MÉDIA de uma loja específica, não cotação
-- vinculada a uma oferta rastreável por SKU do lojista — rotulados como
-- estimativa Vórtice na interface (MaterialsPanel.priceSourceLine).
-- Devem ser revisados quando houver fornecedor real cadastrado pra
-- esses itens.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, v.categoria, v.nome, v.sku, v.preco, v.unidade,
       jsonb_build_object('fonte', 'Espaço Smart, consulta 27/08/2026', 'regiao', 'Brasil', 'data_preco', '2026-08-27'),
       null, 'generico', true
from (values
  ('Steel Frame', 'Pacote com 100 Arruelas para Sistema EIFS (Espaço Smart)', 'vortice-eifs-arandela-pct100', 47.92, 'PCT'),
  ('Steel Frame', 'Pingadeira PVC 2,50m (Espaço Smart)', 'vortice-pingadeira-pvc-2-5m', 101.88, 'PC'),
  ('Vedação Externa', 'Placa de Gesso Glasroc X 12,5 x 1200 x 2400mm (Espaço Smart)', 'vortice-glasroc-x-12-5mm', 219.90, 'PC'),
  ('Vedação Externa', 'Placa OSB Home Plus MDI 11,1 x 1200 x 2400mm 2,88m² (Espaço Smart)', 'vortice-osb-11-1mm', 200.00, 'PC')
) as v(categoria, nome, sku, preco, unidade)
cross join (select id from public.manufacturers where nome = 'Vórtice Materiais') as m
where not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = v.sku
);

insert into public.product_offers (
  product_id, supplier_id, supplier_sku, price, currency, region, price_date,
  kind, stock_status, source, is_official
)
select p.id, s.id, p.sku, p.preco, 'BRL', 'Brasil', date '2026-08-27',
       'market_reference', 'to_confirm',
       'Espaço Smart, consulta 27/08/2026', false
from public.products p
join public.manufacturers m on m.id = p.manufacturer_id and m.nome = 'Vórtice Materiais'
join public.suppliers s on s.nome = 'Vórtice Materiais'
where p.sku in (
  'vortice-eifs-arandela-pct100', 'vortice-pingadeira-pvc-2-5m',
  'vortice-glasroc-x-12-5mm', 'vortice-osb-11-1mm'
)
on conflict (product_id, supplier_id, region) do update set
  price = excluded.price,
  price_date = excluded.price_date,
  source = excluded.source,
  updated_at = now();
