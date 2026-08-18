-- Preço médio de mercado (SEM fornecedor específico) pra Porta e Janela
-- — até agora essas duas apareciam no orçamento só como contagem ("4
-- un", "6 un"), nunca como custo (ver MaterialsPanel.ts, linhas
-- 'Portas'/'Janelas' na seção Geral, sempre com preço null). Contraria
-- o princípio "nenhum material fica sem preço" já aplicado a todo o
-- resto do quantitativo. Cadastradas no fabricante "Vórtice Materiais",
-- mesmo padrão da migration 20260818020000.
--
-- Preço por M², não por unidade: porta e janela no Esboce são esquadrias
-- de tamanho LIVRE (largura/altura ajustáveis por abertura, sem medida
-- fixa) — cobrar um valor fixo por unidade tratava uma janela de
-- 40x40cm igual a uma de 2x1,5m. MaterialsPanel usa a área real de cada
-- abertura (largura×altura) multiplicada por este preço/m².
--
-- PREMISSAS (pesquisa de mercado nacional, agosto/2026 — fontes:
-- Portal Alumínio, Leroy Merlin, daquidali.com.br, Cronoshare):
--   • Porta interna kit completo (folha + batente + fechadura/
--     dobradiça), SEM mão de obra ..... R$ 700,00/m²  (derivado dos
--     componentes reais pesquisados pra uma porta padrão ~0,80×2,10m =
--     1,68m²: folha MDF/HDF oca ~R$400 + kit batente/guarnição ~R$500 +
--     fechadura/dobradiça ~R$300 = R$1.200 ÷ 1,68m² ≈ R$714/m²,
--     arredondado. Mão de obra de instalação à parte, ~R$400/porta
--     adicional NÃO incluído aqui). Representa uma porta interna padrão
--     médio — o quantitativo hoje não distingue interna/externa.
--   • Janela de alumínio, SEM mão de obra ... R$ 150,00/m²  (fonte
--     específica "esquadria de alumínio preço m²": faixa nacional
--     R$70–200/m², podendo passar de R$300/m² em acabamento melhor;
--     alumínio é o padrão mais comum em construção residencial
--     brasileira, mesmo sistema construtivo já assumido em outras
--     partes do catálogo — usado valor no meio-alto da faixa).
--
-- Mesma ressalva das demais migrations Vórtice: preço de REFERÊNCIA/
-- MÉDIA, não cotação de um fornecedor específico, rotulado como tal na
-- interface (MaterialsPanel.priceSourceLine). Não substitui o preço de
-- um fornecedor real quando/se existir um catalogado futuramente — por
-- isso a unidade é 'M2': um fornecedor parceiro real (ex. vidro) pode
-- ser cadastrado com preço próprio em M2 também, e o Opening.productId
-- daquela abertura específica passa a valer sobre a média Vórtice
-- automaticamente (ver DEC-107).

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, v.categoria, v.nome, v.sku, v.preco, v.unidade,
       jsonb_build_object('fonte', 'preço médio de mercado nacional, pesquisa ago/2026'), null, 'generico', true
from (values
  ('Portas e Janelas', 'Porta Interna — Kit Completo (preço médio de mercado, m²)', 'vortice-porta-interna-kit-m2', 700.00, 'M2'),
  ('Portas e Janelas', 'Janela de Alumínio (preço médio de mercado, m²)', 'vortice-janela-aluminio-m2', 150.00, 'M2')
) as v(categoria, nome, sku, preco, unidade)
cross join (select id from public.manufacturers where nome = 'Vórtice Materiais') as m
where not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = v.sku
);
