# DOM-002 — Catálogo Comercial Unificado

**Status:** Aprovado
**Data:** 22/08/2026

## Regra de experiência

Para o usuário existe um único catálogo comercial. Aparência, material
técnico e oferta são partes internas do mesmo produto e não catálogos
concorrentes.

## Agregados

Um Produto Comercial possui identidade estável e referencia:

- Aparência Visual: miniatura, mapas PBR, modelo e escala real;
- Especificação Técnica: dimensões, rendimento, embalagem, compatibilidade e perda;
- Oferta: fornecedor, SKU, preço, moeda, região, data, estoque e origem.

Vários fornecedores podem ofertar o mesmo produto sem duplicar aparência ou
especificação. O vínculo aplicado ao projeto é o ID do produto; a escolha de
oferta pertence ao projeto e pode mudar sem alterar o acabamento visual.

## Quantitativo e orçamento

Ao aplicar um produto, o projeto guarda um snapshot da oferta escolhida. O
quantitativo usa primeiro o preço desse snapshot e só recorre ao preço atual do
catálogo quando o elemento não possui oferta salva. Assim, uma atualização
posterior do catálogo não reescreve silenciosamente o orçamento do projeto.

O agrupamento comercial é feito por produto e oferta. Se o mesmo produto foi
aplicado com fornecedores diferentes, cada combinação permanece em uma linha
própria na planilha, no CSV e no PDF, identificada por fornecedor, região e data
do preço. A área visual resumida pode continuar agrupada apenas por produto.

## Intenção de aplicação

- `place`: adicionar ao projeto objetos posicionáveis;
- `apply_surface`: aplicar pisos, revestimentos, tintas e telhas;
- `use_in_construction`: material incorporado automaticamente pelo estimador.

## Referência Vórtice

Produto sem oferta oficial recebe uma oferta `market_reference` da Vórtice
Materiais. Ela deve registrar região, data, fonte, média e, quando disponível,
faixa de preço. Sua apresentação obrigatória é “Estimativa Vórtice — não
constitui oferta comercial”. Estoque, frete e prazo são “a confirmar”.

Neste papel, Vórtice não é fabricante e não declara vender o produto. Uma
oferta oficial futura é adicionada ao mesmo produto e não quebra projetos
existentes.

## Invariantes

1. Aparência visual não contém preço.
2. Produto não duplica especificação por fornecedor.
3. Preço sempre pertence a uma oferta rastreável.
4. Referência de mercado sempre contém região e data.
5. Oferta oficial e estimativa nunca recebem a mesma apresentação na interface.
6. Falha de rede não impede renderizar produtos já aplicados.
