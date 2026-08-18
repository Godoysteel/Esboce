-- Preço médio de mercado (SEM fornecedor específico) pros materiais
-- estruturais que o quantitativo de orçamento usa e que "O Mercador"
-- não vende num formato compatível (ver DEC-88, DEC-100): cal
-- hidratada, areia média, concreto usinado, aço CA-50 e tijolo
-- cerâmico 9x19x19. Cadastrados no fabricante "Vórtice Materiais"
-- (o mesmo já usado pros produtos genéricos/demo existentes no
-- catálogo — origem 'generico'), pra que TODO material do
-- quantitativo sempre resolva pra um produto de catálogo de verdade,
-- nunca só um número fixo escondido no código (ver MaterialsPanel.ts,
-- VORTICE_MATERIAL_SKUS).
--
-- PREMISSAS (pesquisa de mercado nacional, agosto/2026 — fontes:
-- Leroy Merlin, Telhanorte, PainelConstru, Reforma & Construção,
-- Grupo Braço/BR Aço, Grupo Oiticica, Lar Pontual Engenharia,
-- Calculobra, Só Tijolo, Rede Construir):
--   • Cal hidratada 20kg .......... R$ 23,47/saco  (R$ 1,17/kg)
--   • Areia média (m³) ............ R$ 130,00/m³   (mantido — já era
--     pesquisa recente, sem número mais preciso e único disponível)
--   • Concreto usinado fck 25 (m³)  R$ 380,00/m³   (faixa nacional
--     pesquisada: R$ 210–680/m³ dependendo de fck/região; usado o
--     centro da faixa pra fck 25, a mais comum em residencial)
--   • Aço CA-50 (kg) ............... R$ 8,00/kg     (confirmado contra
--     vergalhão 3/8"/10mm — peso real 7,4kg/barra de 12m — preço real
--     de revenda ~R$ 7,98/kg, bem próximo do valor já usado)
--   • Tijolo cerâmico 9x19x19 (un) . R$ 1,70/un     (preço de venda
--     avulsa real, tamanho exato — atualizado do valor anterior de
--     R$ 1,20)
--
-- Estes são preços de REFERÊNCIA/MÉDIA, não cotação de um fornecedor
-- específico — rotulados como tal na interface (ver
-- MaterialsPanel.priceSourceLine: "... — preço médio de mercado").
-- Devem ser revisados periodicamente; não são um SLA de atualização
-- automática (ao contrário de um preço de fornecedor real, que a
-- própria loja mantém atualizado).

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, v.categoria, v.nome, v.sku, v.preco, v.unidade,
       jsonb_build_object('fonte', 'preço médio de mercado nacional, pesquisa ago/2026'), null, 'generico', true
from (values
  ('Cimento e Argamassa', 'Cal Hidratada 20kg (preço médio de mercado)', 'vortice-cal-20kg', 23.47, 'SC'),
  ('Areia, Brita e Agregados', 'Areia Média (preço médio de mercado, m³)', 'vortice-areia-m3', 130.00, 'M3'),
  ('Areia, Brita e Agregados', 'Concreto Usinado fck 25 (preço médio de mercado, m³)', 'vortice-concreto-usinado-m3', 380.00, 'M3'),
  ('Ferro e Aço', 'Aço CA-50 (preço médio de mercado, kg)', 'vortice-aco-ca50-kg', 8.00, 'KG'),
  ('Tijolos e Blocos', 'Tijolo Cerâmico 9x19x19 (preço médio de mercado)', 'vortice-tijolo-9x19x19-un', 1.70, 'UN')
) as v(categoria, nome, sku, preco, unidade)
cross join (select id from public.manufacturers where nome = 'Vórtice Materiais') as m
where not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = v.sku
);
