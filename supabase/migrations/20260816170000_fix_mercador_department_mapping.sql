-- Correção pós-carga do catálogo "O Mercador" (DEC-85 / migration 20260816160000).
--
-- Duas coisas confirmadas depois de olhar o catálogo pelo app (print do Product
-- Owner): já existiam departamentos com nomes/organização diferente dos que a
-- migration original assumiu, sem acesso de rede pra checar antes.
--
-- 1) DUPLICATA: já existia departamento "Tintas" (id 'tintas', com produtos
--    genéricos Vórtice Materiais) — a migration original criou um segundo,
--    "Tintas e Vernizes", só pros produtos do Mercador, fragmentando em duas abas.
--    Fusão: reclassifica os produtos do Mercador pra categoria 'Tintas' (a que já
--    existia) e remove o departamento/vínculo extra criados à toa.
--
-- 2) RECLASSIFICAÇÃO: já existia departamento "Louças e Metais" — a migration
--    original colocou vaso sanitário/bacia, torneira, chuveiro, ducha, cuba,
--    tanque, caixa acoplada etc. dentro de "Hidráulica" (junto com tubo/conexão/
--    registro), por não ter esse departamento no radar. Move esses 152 produtos
--    (identificados por código do fornecedor, mesma lista já conferida por
--    amostragem com o Product Owner) pra 'Louças e Metais'.

-- 1) Funde 'Tintas e Vernizes' em 'Tintas'
update public.products
set categoria = 'Tintas'
where categoria = 'Tintas e Vernizes'
  and manufacturer_id = (select id from public.manufacturers where nome = 'O Mercador');

delete from public.category_departments where categoria = 'Tintas e Vernizes';
delete from public.departments where nome = 'Tintas e Vernizes';

-- 2) Move louças/metais de 'Hidráulica' pra 'Louças e Metais' (152 produtos,
--    identificados pelo código do fornecedor em products.sku)
update public.products
set categoria = 'Louças e Metais'
where manufacturer_id = (select id from public.manufacturers where nome = 'O Mercador')
  and categoria = 'Hidráulica'
  and sku in (
    '000010',
    '000051',
    '000313',
    '000466',
    '000531',
    '000572',
    '000580',
    '000646',
    '000648',
    '000665',
    '000673',
    '000676',
    '000678',
    '000679',
    '000680',
    '000690',
    '000692',
    '000693',
    '000695',
    '000696',
    '000697',
    '000698',
    '000701',
    '000704',
    '000706',
    '000709',
    '000710',
    '000711',
    '000712',
    '000714',
    '000715',
    '000722',
    '000726',
    '000727',
    '000729',
    '000734',
    '000736',
    '000738',
    '000739',
    '000740',
    '000744',
    '000745',
    '000747',
    '000748',
    '000749',
    '000751',
    '000753',
    '000754',
    '000755',
    '000756',
    '000757',
    '000758',
    '000769',
    '000770',
    '000772',
    '000777',
    '000778',
    '000787',
    '000788',
    '000791',
    '000792',
    '000794',
    '000795',
    '000800',
    '000801',
    '000804',
    '000805',
    '000806',
    '000807',
    '000811',
    '000812',
    '000813',
    '000814',
    '000818',
    '000819',
    '000822',
    '000824',
    '000825',
    '000900',
    '001122',
    '001190',
    '001319',
    '001328',
    '001365',
    '001367',
    '001368',
    '001369',
    '001370',
    '001544',
    '001729',
    '001797',
    '001951',
    '001953',
    '001956',
    '001973',
    '001994',
    '002008',
    '002049',
    '002185',
    '002210',
    '002358',
    '002370',
    '002446',
    '002458',
    '002568',
    '002620',
    '002663',
    '002697',
    '002900',
    '002901',
    '002902',
    '003024',
    '003031',
    '003049',
    '003059',
    '003099',
    '003197',
    '003271',
    '003309',
    '003327',
    '003565',
    '003719',
    '004194',
    '004383',
    '004454',
    '004457',
    '004584',
    '004645',
    '004822',
    '005117',
    '005367',
    '005489',
    '005672',
    '005709',
    '005888',
    '005916',
    '005942',
    '006117',
    '006118',
    '006156',
    '006159',
    '006187',
    '006256',
    '006303',
    '006314',
    '006372',
    '006450',
    '006572',
    '006706',
    '006711',
    '006756',
    '007084'
  );

-- Conferência (rodar depois): totais por departamento devem bater com o print
-- revisado — 'Tintas e Vernizes' não deve mais existir, e 'Louças e Metais' deve
-- aparecer com 152 produtos do Mercador.