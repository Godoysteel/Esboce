-- Separa a marca dos produtos Ceral da loja que os comercializa.
-- As ofertas existentes em product_offers continuam vinculadas ao fornecedor
-- "O Mercador"; somente products.manufacturer_id passa a apontar para Ceral.

insert into public.manufacturers (id, nome, logo_url, is_demo)
select gen_random_uuid(), 'Ceral', null, false
where not exists (
  select 1 from public.manufacturers where nome = 'Ceral'
);

update public.products as p
set manufacturer_id = ceral.id
from public.manufacturers as ceral,
     public.manufacturers as mercador
where ceral.nome = 'Ceral'
  and mercador.nome = 'O Mercador'
  and p.manufacturer_id = mercador.id
  and p.sku in (
    '003230', -- Arizona BG 43x43
    '003231', -- Tec Silver 43x43
    '003229', -- 4335 43x43
    '000317', -- 10x20 Cinza
    '000291', -- 10x10 NTLD Branco
    '000300', -- 10x10 NTLD Preto
    '000290', -- Ventura BG HD RET 60x60 (não verificado)
    '003135', -- Gávea HD 61x61 (não verificado)
    '000852'  -- Romano Bege 27,5x30,5 (não verificado)
  );

