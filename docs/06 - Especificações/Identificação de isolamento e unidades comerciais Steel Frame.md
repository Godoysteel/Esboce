# Identificação de isolamento e unidades comerciais Steel Frame

## Objetivo

Permitir a conferência imediata das paredes que receberam isolamento térmico/acústico e apresentar o quantitativo na mesma unidade em que cada produto é comprado.

## Identificação visual

- Toda parede de Light Steel Frame cujo núcleo tenha um isolamento diferente de `Sem isolamento` recebe uma faixa turquesa no topo.
- A faixa permanece visível sem seleção e não interfere no clique, na geometria, nas aberturas ou no quantitativo.
- A opção `Sem isolamento` continua sendo uma escolha explícita válida e não recebe o marcador.
- A legenda do configurador explica o significado da faixa.

## Quantitativo comercial

O consumo continua sendo calculado tecnicamente pela área, comprimento, massa ou número de fixadores. Somente depois da agregação e das perdas ele é arredondado para a embalagem comercial:

| Produto | Unidade exibida | Conversão adotada |
| --- | --- | --- |
| Chapa drywall ST, RU ou RF | placa | 1,20 × 1,80 m (2,16 m²) |
| Massa PlacLux para drywall | balde | 25 kg |
| Base Coat ProFort / Placoplast Basecoat | saco | peso publicado no catálogo (20 kg) |
| Pingadeira PVC | barra | 2,5 m |
| Parafusos e fixadores | unidade | arredondamento para inteiro |

A quantidade técnica é preservada separadamente para valorar itens cujo preço de referência está cadastrado por m², kg ou metro. Isso evita multiplicar, por exemplo, o preço por kg pela quantidade de sacos.

## Fontes de embalagem

- Catálogo digital PlacLux 2025: Massa para Drywall em 25 kg e 6 kg; o orçamento usa a embalagem maior de 25 kg.
- Manual Glasroc X 2026 da Placo: Placoplast Basecoat em saco de 20 kg.
- Catálogo comercial já integrado ao Esboce: chapa drywall 1,20 × 1,80 m e pingadeira PVC de 2,5 m.
