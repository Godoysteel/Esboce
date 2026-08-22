-- SKU confirmado no catálogo técnico oficial Ceral (10x10 Azul Cobalto).
-- A oferta permanece ligada ao fornecedor O Mercador em product_offers.

update public.products as p
set manufacturer_id = ceral.id
from public.manufacturers as ceral,
     public.manufacturers as mercador
where ceral.nome = 'Ceral'
  and mercador.nome = 'O Mercador'
  and p.manufacturer_id = mercador.id
  and p.sku = '000280';
