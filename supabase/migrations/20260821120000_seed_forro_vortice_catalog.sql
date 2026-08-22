-- Preço médio de mercado (SEM fornecedor específico) pros materiais do
-- forro de drywall procedural (placa RU/RF/cimentícia, perfil F530,
-- tabica de perímetro, pendural) — até agora nenhum desses insumos
-- tinha preço cadastrado (nível 2, "todo material sempre resolve pra
-- um produto de catálogo de verdade", mesmo padrão das demais
-- migrations Vórtice). Placa ST usa fornecedor real (O Mercador, ver
-- 20260816160000_seed_mercador_catalog.sql — PLACA GESSO ST BR 12,5 X
-- 1200 X 1800MM) como nível 1, mas ganha aqui uma entrada Vórtice
-- também, de resiliência (mesmo espírito do cimento).
--
-- PREMISSA (estimativa de mercado, ago/2026): RU/RF pesquisadas na
-- MetalPerfil (R$54,90 e R$59,00/chapa 1,20x1,80m) saíram ABAIXO do
-- preço já seedado da ST no Mercador (R$90,30/chapa) — inconsistente
-- pra um material especial custar menos que o padrão. Ajustado por
-- proporção sobre a ST em vez do valor cru pesquisado (RU +20%, RF
-- +25%). Cimentícia baseada na Serit (R$297,59/chapa 1,20x2,40m,
-- 2,88m² ≈ R$103/m², arredondado). F530 (Temfer, R$26,90/barra 3m) e
-- tabica (Comercial Apoio, R$8,95/barra 3m) direto por metro linear.
-- Pendural = regulador (Disfoil, R$1,05/un) + arame galvanizado
-- proporcional (MetalPerfil, R$18,90/kg ≈ R$1,35/m). Revisar quando
-- houver cotação de fornecedor real ou pesquisa mais precisa
-- disponível.

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Placa ST (preço médio de mercado, m²)', 'vortice-forro-placa-st-m2', 41.81, 'M2',
       jsonb_build_object('fonte', 'derivado do preço real O Mercador (PLACA GESSO ST BR 12,5x1200x1800mm) / 2,16m² — entrada de resiliência, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-placa-st-m2');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Placa RU — resistente à umidade (preço médio de mercado, m²)', 'vortice-forro-placa-ru-m2', 50.00, 'M2',
       jsonb_build_object('fonte', 'MetalPerfil R$54,90/chapa 1,20x1,80m ajustado +20% sobre a ST seedada, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-placa-ru-m2');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Placa RF — resistente ao fogo (preço médio de mercado, m²)', 'vortice-forro-placa-rf-m2', 52.00, 'M2',
       jsonb_build_object('fonte', 'MetalPerfil R$59,00/chapa 1,20x1,80m ajustado +25% sobre a ST seedada, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-placa-rf-m2');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Placa cimentícia (preço médio de mercado, m²)', 'vortice-forro-placa-cimenticia-m2', 100.00, 'M2',
       jsonb_build_object('fonte', 'Serit R$297,59/chapa 1,20x2,40m (2,88m²) ≈ R$103/m², arredondado, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-placa-cimenticia-m2');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Perfil F530 (preço médio de mercado, metro linear)', 'vortice-forro-perfil-f530-m', 9.00, 'M',
       jsonb_build_object('fonte', 'Temfer R$26,90/barra 3m, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-perfil-f530-m');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Tabica/cantoneira de perímetro 25x30mm (preço médio de mercado, metro linear)', 'vortice-forro-tabica-m', 3.00, 'M',
       jsonb_build_object('fonte', 'Comercial Apoio R$8,95/barra 3m, ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-tabica-m');

insert into public.products (id, manufacturer_id, categoria, nome, sku, preco, unidade, specs, foto_url, origem, ativo)
select gen_random_uuid(), m.id, 'Forro de Drywall', 'Pendural — arame galvanizado e regulador (preço médio de mercado, unidade)', 'vortice-forro-pendural-un', 1.75, 'UN',
       jsonb_build_object('fonte', 'Disfoil R$1,05/regulador + arame proporcional (MetalPerfil R$18,90/kg ≈ R$1,35/m), ago/2026'), null, 'generico', true
from public.manufacturers m
where m.nome = 'Vórtice Materiais'
and not exists (select 1 from public.products p where p.manufacturer_id = m.id and p.sku = 'vortice-forro-pendural-un');
