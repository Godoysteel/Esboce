# Catálogo Glasroc X e Glasroc X Therm

## Escopo

Esta especificação registra os componentes, preços de referência e regras de quantitativo dos revestimentos Glasroc X e Glasroc X Therm disponíveis no configurador de Light Steel Frame.

## Fontes técnicas

- Sistema Glasroc X Therm: https://www.placo.com.br/solucoes/sistema-glasroc-x-therm
- Placa Glasroc X 12,5 mm: https://www.placo.com.br/produtos/clima/placa-glasroc-x-125-mm
- Placoplast Basecoat: https://www.placo.com.br/produtos/placoplast-basecoat
- Malha GRX para Superfície: https://www.placo.com.br/produtos/malha-grx-para-superficie
- Membrana Hidrófuga Tyvek: https://www.placo.com.br/produtos/membrana-hidrofuga-tyvek
- Parafuso Glasroc PB: https://www.placo.com.br/produtos/parafuso-glasroc-pb

Consulta realizada em 27/08/2026. As imagens de Placa Glasroc X, Basecoat, Malha GRX, Tyvek e Parafuso PB foram baixadas das páginas oficiais da Placo.

## Composições

### Glasroc X

1. Membrana Hidrófuga Tyvek HomeWrap.
2. Placa Glasroc X 12,5 mm.
3. Parafuso Glasroc PB 25 mm.
4. Placoplast Basecoat, consumo preliminar de 5 kg/m².
5. Malha GRX para Superfície.
6. Acabamento final compatível definido pelo projeto.

### Glasroc X Therm

1. Membrana Hidrófuga Tyvek HomeWrap.
2. Placa Glasroc X 12,5 mm.
3. Parafuso Glasroc PB 25 mm.
4. Placa EPS T7F para EIFS, referência inicial de 30 mm.
5. Placoplast Basecoat para colagem e revestimento.
6. Malha GRX para Superfície.
7. Acabamento final compatível definido pelo projeto.

O EPS é colado diretamente ao substrato. O quantitativo não adiciona fixadores mecânicos específicos ao Therm.

## Preços de referência Vórtice

| Produto | Embalagem | Referência em 27/08/2026 |
| --- | ---: | ---: |
| Placa Glasroc X 12,5 × 1200 × 2400 mm | 2,88 m² | R$ 294,41 |
| Placoplast Basecoat | saco 20 kg | R$ 124,10 |
| Malha GRX para Superfície | rolo 1 × 50 m | R$ 499,99 |
| Tyvek HomeWrap | rolo 0,91 × 30,5 m | R$ 286,56 |
| Parafuso Glasroc PB 25 mm | caixa 1.000 un. | R$ 196,60 |
| EPS T7F para EIFS 30 mm | m² | R$ 64,99 |

Os preços resultam de média ou mediana de anúncios de Você Constrói, Mercado Livre, Artesana, DryStore, DryDepot, Serit, Fast Sistemas, Gesso 3 Mil, Fast Framing Brasil e Deville Kerr. São estimativas nacionais sem frete e devem ser confirmadas em cotação com a Vórtice.

## Modelo comercial

- Fabricante dos componentes oficiais: Placo; Tyvek é preservada como marca da membrana.
- Fornecedor da referência de mercado: Vórtice Materiais.
- Tipo da oferta: `market_reference`.
- Região: Brasil.
- Data-base: 27/08/2026.
- O EPS é genérico porque não é fabricado pela Placo e não recebe imagem oficial da fabricante.

## Implementação

- Navegação visual: a aba `Construção a seco` reúne uma seção Placo — Glasroc X e Glasroc X Therm e uma seção PlacLux. Os cinco produtos Placo com foto são selecionados por SKU controlado, independentemente do mapeamento genérico de departamentos do catálogo.
- Composições: `src/core/SteelFrameAssemblies.ts`.
- Resolução de preços: `src/core/MaterialsPanel.ts`.
- Cadastro e ofertas: `supabase/migrations/20260827150000_seed_placo_glasroc_vortice_catalog.sql`.
- Imagens: `public/produtos/placo/`.
- Importador reproduzível: `scripts/import-placo-glasroc-images.mjs`.
