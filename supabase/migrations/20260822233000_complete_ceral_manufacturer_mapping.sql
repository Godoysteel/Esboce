-- Completa a separação entre fabricante Ceral e fornecedor O Mercador.
-- Inclui os dois SKUs oficiais deste lote e preserva os não verificados;
-- nenhuma oferta em product_offers é alterada.

update public.products as p
set manufacturer_id = ceral.id
from public.manufacturers as ceral,
     public.manufacturers as mercador
where ceral.nome = 'Ceral'
  and mercador.nome = 'O Mercador'
  and p.manufacturer_id = mercador.id
  and p.sku in (
    '000287', '000279',
    '000356', '000348', '000419',
    '000435', '000436', '000437', '000260'
  );
