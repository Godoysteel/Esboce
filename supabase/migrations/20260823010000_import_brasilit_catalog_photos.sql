-- Fotos comerciais das variantes exatas da Telha Ondulada 6 mm Brasilit.
-- O Mercador continua sendo o fornecedor. Estes itens permanecem exclusivos
-- do catálogo e não ganham representação visual no editor.

insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'Brasilit', null, false
where not exists (
  select 1 from public.manufacturers where lower(nome) = 'brasilit'
);

with imported(sku, foto_url) as (
  values
    ('005661', '/produtos/brasilit/telha-ondulada-153x110cm-6mm-brasilit.jpg'),
    ('003761', '/produtos/brasilit/telha-ondulada-183x110cm-6mm-brasilit.jpg'),
    ('003649', '/produtos/brasilit/telha-ondulada-244x110cm-6mm-brasilit.jpg'),
    ('003768', '/produtos/brasilit/telha-ondulada-305x110cm-6mm-brasilit.jpg'),
    ('003769', '/produtos/brasilit/telha-ondulada-366x110cm-6mm-brasilit.jpg')
)
update public.products as product
set foto_url = imported.foto_url,
    manufacturer_id = manufacturer.id
from imported
join public.manufacturers as manufacturer
  on lower(manufacturer.nome) = 'brasilit'
where product.sku = imported.sku
  and product.foto_url is null;
