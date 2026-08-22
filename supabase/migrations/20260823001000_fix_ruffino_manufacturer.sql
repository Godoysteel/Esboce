-- Separa o fabricante Ruffino do fornecedor O Mercador no SKU exato R31031.
insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'Ruffino', null, false
where not exists (
  select 1 from public.manufacturers where lower(nome) = lower('Ruffino')
);

update public.products as p
set manufacturer_id = ruffino.id
from public.manufacturers as ruffino,
     public.manufacturers as mercador
where lower(ruffino.nome) = lower('Ruffino')
  and lower(mercador.nome) = lower('O Mercador')
  and p.manufacturer_id = mercador.id
  and p.sku = '000042';
