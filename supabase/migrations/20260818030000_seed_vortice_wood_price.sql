-- Correção pós-lançamento nº2 da DEC-100: madeira serrada (ripa/caibro/
-- terça do madeiramento de telhado) ficava sem preço nenhum — era o
-- único material do quantitativo que nunca teve NEM referência
-- genérica de código (ver comentário original em MaterialsPanel.ts:
-- "não tem uma referência de mercado confiável o bastante"). Pedido do
-- Product Owner reforça: nenhum material fica sem preço.
--
-- PREMISSA (pesquisa de mercado, agosto/2026 — fontes: Cecon Madeiras,
-- Faumar, Léo Oliveira Madeiras, MFRural — preço de VAREJO por peça/
-- metro linear, convertido pra R$/m³ pela seção transversal de cada
-- peça, já que é assim que ripa/caibro/terça são vendidos de verdade):
--   • Ripa tratada ~2x5–2x7cm: R$5,63–9,90/m → ~R$5.600–7.100/m³
--   • Caibro tratado ~5x5–5x6cm: R$11,25–13,04/m → ~R$4.300–4.500/m³
--   • Viga/terça ~5x10cm: R$18,00/m → ~R$3.600/m³
-- Preço de varejo (peça cortada) é bem mais caro por m³ que madeira em
-- prancha/bruta vendida a granel (mesmo padrão já visto no aço:
-- vergalhão cortado por barra custa mais por kg que compra a granel).
-- Usado um valor central da faixa: R$5.000,00/m³, aplicado sobre o
-- volume total já calculado pelo quantitativo (soma de ripa+caibro+
-- terça convertida em m³, ver ROOF_TIMBER_REF em MaterialsPanel.ts).
-- Rotulado como preço médio de mercado, não cotação de fornecedor
-- específico — mesmo tratamento dos demais produtos Vórtice.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Madeiras', 'Madeira Serrada Tratada — Ripa/Caibro/Terça (preço médio de mercado, m³)', 'vortice-madeira-telhado-m3', 5000.00, 'M3',
       jsonb_build_object('fonte', 'preço médio de mercado nacional (varejo, convertido de R$/m linear), pesquisa ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-madeira-telhado-m3'
);
