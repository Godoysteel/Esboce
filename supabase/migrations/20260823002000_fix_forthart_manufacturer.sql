-- Separa o fabricante ForthArt do fornecedor O Mercador no SKU exato.
insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'ForthArt', null, false
where not exists (
  select 1 from public.manufacturers where lower(nome) = lower('ForthArt')
);

update public.products as p
set manufacturer_id = forthart.id
from public.manufacturers as forthart,
     public.manufacturers as mercador
where lower(forthart.nome) = lower('ForthArt')
  and lower(mercador.nome) = lower('O Mercador')
  and p.manufacturer_id = mercador.id
  and p.sku = '002884';
