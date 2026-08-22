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

O orçamento apresenta também subtotais por fornecedor para as ofertas salvas.
Itens sem uma escolha explícita continuam compondo o total geral, mas não são
atribuídos a uma loja. Referências Vórtice podem ter subtotal próprio desde que
permaneçam identificadas como estimativa, sem aparência de proposta comercial.

O usuário pode gerar um artefato isolado por fornecedor. Esse documento contém
somente as linhas vinculadas às ofertas daquele fornecedor e seu subtotal; não
inclui itens genéricos nem valores atribuídos a outros fornecedores. Quando o
grupo for Vórtice, o título também deve declarar que se trata de estimativa.

Materiais derivados da geometria seguem a mesma regra. Quando o preço foi
resolvido por um produto compatível do catálogo, a linha herda fornecedor,
região, data e natureza oficial ou `market_reference`, participando do subtotal
e do PDF correspondente. Valores fixos usados apenas como fallback de
emergência não recebem fornecedor, pois não constituem uma oferta rastreável.

Referências recorrentes usadas por elementos genéricos também devem existir no
catálogo e em `product_offers`; não basta manter uma constante anônima no
cliente. Rodapés, soleiras, portas genéricas, envidraçamentos, varanda,
volumetria, escada e caixas hidráulicas seguem essa regra, com fallback local
apenas para indisponibilidade de rede.

Tubos e conexões hidráulicas são produtos comerciais distintos por linha,
diâmetro e tipo de peça. Na ausência de oferta oficial, cada combinação resolve
uma Referência Vórtice regional e datada; a tabela embutida no cliente é apenas
contingência offline e não recebe fornecedor nem participa de subtotal por loja.

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
