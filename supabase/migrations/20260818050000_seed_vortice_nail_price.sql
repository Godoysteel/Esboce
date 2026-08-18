-- Preço médio de mercado (SEM fornecedor específico) pro prego usado no
-- madeiramento de telhado (ripa+caibro+terça, SINAPI 92539: 0,03kg do
-- 22x48 + 0,05kg do 19x36 + 0,07kg do 15x15 = 0,15kg/m² de telhado) —
-- até agora esse insumo não tinha preço nenhum cadastrado. Mesmo
-- padrão das demais migrations Vórtice (nível 2, "todo material sempre
-- resolve pra um produto de catálogo de verdade").
--
-- PREMISSA (estimativa de mercado, ago/2026): não foi possível obter
-- cotação de varejo com preço visível nas fontes consultadas (Leroy
-- Merlin/Telhanorte bloqueiam acesso automatizado ao preço da página) —
-- usado R$14,00/kg como estimativa de mercado pra prego comum/
-- galvanizado em embalagem pequena (1kg), consistente com a faixa
-- usual de varejo pra esse tipo de insumo. Revisar quando houver
-- cotação de fornecedor real ou pesquisa mais precisa disponível.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Ferragens', 'Prego (preço médio de mercado, kg)', 'vortice-prego-kg', 14.00, 'KG',
       jsonb_build_object('fonte', 'estimativa de mercado nacional, pesquisa ago/2026 — sem cotação de varejo com preço visível disponível'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (
  select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-prego-kg'
);
