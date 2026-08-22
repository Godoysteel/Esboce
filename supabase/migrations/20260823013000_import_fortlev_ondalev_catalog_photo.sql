-- Foto oficial da variante exata Telha PVC Leitosa Ondalev 2,44 x 0,50 m.
-- O Mercador permanece fornecedor e o produto continua exclusivo do catálogo.

insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'Fortlev', null, false
where not exists (
  select 1 from public.manufacturers where lower(nome) = 'fortlev'
);

update public.products as product
set foto_url = '/produtos/fortlev/telha-pvc-leitosa-ondalev-244x50cm-fortlev.jpg',
    manufacturer_id = manufacturer.id
from public.manufacturers as manufacturer
where product.sku = '000092'
  and lower(manufacturer.nome) = 'fortlev'
  and product.foto_url is null;
