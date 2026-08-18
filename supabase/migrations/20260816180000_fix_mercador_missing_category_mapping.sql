-- Correção nº2 pós-carga do catálogo "O Mercador" (DEC-85). Executada
-- direto no SQL Editor do Supabase durante a sessão (sem passar por
-- arquivo de migration na hora) — reconstruída aqui agora pra o
-- repositório refletir o que já está em produção. Ver Registro de
-- decisões técnicas.md, DEC-85, "Correção pós-lançamento nº2".
--
-- A correção nº1 (20260816170000) reclassificou produtos do Mercador
-- pra categoria = 'Tintas'/'Louças e Metais' (nome de exibição dos
-- departamentos que já existiam), mas nunca criou o vínculo
-- correspondente em category_departments — os departamentos "Tintas"
-- e "Louças e Metais" pré-existentes usam códigos internos em inglês
-- ('paint', 'faucet', 'toilet', 'sink', 'shower_box', 'shower_head'),
-- não o nome em português. Produtos ficaram sem departamento (não
-- apareciam em lugar nenhum do catálogo). Mesma técnica que a
-- migration original (20260816160000) já tinha usado com sucesso pra
-- "Cobertura"/"Hidráulica"/"Pisos e Revestimentos" — um vínculo A
-- MAIS, com o nome em português, apontando pro mesmo departamento que
-- o código em inglês já apontava.

insert into public.category_departments (categoria, department_id)
select 'Tintas', d.id from public.departments d where d.nome = 'Tintas'
and not exists (select 1 from public.category_departments where categoria = 'Tintas');

insert into public.category_departments (categoria, department_id)
select 'Louças e Metais', d.id from public.departments d where d.nome = 'Louças e Metais'
and not exists (select 1 from public.category_departments where categoria = 'Louças e Metais');
