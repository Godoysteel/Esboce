-- Fotos oficiais de 13 variantes exatas de tanques Fortlev.
-- O Mercador permanece fornecedor; os itens continuam exclusivos do catálogo.

with imported(sku, foto_url) as (
  values
    ('002620', '/produtos/fortlev/tanque-polietileno-310l-fortlev.jpg'),
    ('003719', '/produtos/fortlev/tanque-polietileno-500l-fortlev.jpg'),
    ('002697', '/produtos/fortlev/tanque-polietileno-600l-slim-fortlev.jpg'),
    ('002663', '/produtos/fortlev/tanque-polietileno-1000l-fortlev.jpg'),
    ('003059', '/produtos/fortlev/tanque-polietileno-2000l-fortlev.jpg'),
    ('001122', '/produtos/fortlev/tanque-polietileno-3000l-fortlev.jpg'),
    ('002049', '/produtos/fortlev/tanque-polietileno-5000l-fortlev.jpg'),
    ('002210', '/produtos/fortlev/tanque-polietileno-10000l-fortlev.jpg'),
    ('006303', '/produtos/fortlev/tanque-polietileno-10000l-verde-fortlev.png'),
    ('002458', '/produtos/fortlev/tanque-polietileno-15000l-fortlev.jpg'),
    ('001973', '/produtos/fortlev/tanque-polietileno-20000l-fortlev.png'),
    ('005489', '/produtos/fortlev/tanque-polietileno-20000l-verde-fortlev.png'),
    ('005672', '/produtos/fortlev/tanque-polietileno-30000l-alto-fortlev.jpg')
)
update public.products as product
set foto_url = imported.foto_url,
    manufacturer_id = manufacturer.id
from imported
join public.manufacturers as manufacturer
  on lower(manufacturer.nome) = 'fortlev'
where product.sku = imported.sku
  and product.foto_url is null;
