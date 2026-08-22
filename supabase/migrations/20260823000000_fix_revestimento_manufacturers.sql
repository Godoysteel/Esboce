-- O Mercador é fornecedor, não fabricante. Corrige somente SKUs cujo
-- fabricante já foi identificado no levantamento de revestimentos.
-- As ofertas comerciais permanecem vinculadas ao fornecedor O Mercador.

insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), name, null, false
from (values ('Eucafloor'), ('Savane')) as verified(name)
where not exists (
  select 1 from public.manufacturers where lower(nome) = lower(verified.name)
);

update public.products as p
set manufacturer_id = manufacturer.id
from public.manufacturers as manufacturer,
     public.manufacturers as mercador
where lower(manufacturer.nome) = lower('Eucafloor')
  and lower(mercador.nome) = lower('O Mercador')
  and p.manufacturer_id = mercador.id
  and p.sku in (
    '003712', '000359', '003193', '003423', '003898',
    '005813', '006316', '001142', '003064', '002890',
    '001803', '001601', '006114', '004015', '001949',
    '003870', '006441', '001927', '003869'
  );

update public.products as p
set manufacturer_id = manufacturer.id
from public.manufacturers as manufacturer,
     public.manufacturers as mercador
where lower(manufacturer.nome) = lower('Savane')
  and lower(mercador.nome) = lower('O Mercador')
  and p.manufacturer_id = mercador.id
  and p.sku in (
    '000333', '000253', '006558', '000265', '000243', '006617'
  );
