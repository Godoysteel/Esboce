# Catálogo Bold ACM

**Status:** implementado como página de referência no catálogo do Esboce  
**Data da consulta:** 01/09/2026  
**Escopo:** descoberta e comparação; não é uma integração comercial oficial

## Objetivo

Disponibilizar no catálogo do Esboce uma página própria para chapas de ACM da Bold, útil durante a escolha preliminar de cores, acabamentos e dimensões para fachadas e comunicação visual.

## Experiência no produto

- A aba **Bold · ACM** aparece junto às demais categorias do catálogo.
- A abertura mostra uma apresentação curta da categoria, avisos de procedência e dez referências representativas.
- Cada cartão apresenta acabamento, linha, dimensões, espessura e preço público consultado, usando o próprio albedo PBR como amostra.
- O cartão carrega o ACM para aplicação em uma face externa ou bloco de volumetria; o link **Ver origem** abre separadamente o catálogo público da Bold.
- O rodapé oferece acesso ao catálogo completo e ao manual público de instalação.
- A página é navegável por teclado; `Enter` e `Espaço` abrem a origem do cartão focado.

## Fontes e procedência

- [Categoria Chapas de ACM — Bold](https://www.bold.net/BoldB2b/categoria/todos-os-departamentos/chapas-de-acm/0ZGN400000003u0OAA)
- [Manual de instalação de ACM — Bold](https://institucional.bold.net/wp-content/uploads/2025/10/BOLD_Manual_Instalacao_ACM_ALTERADO_SETEMBRO25.pdf)

Os preços foram transcritos da página pública em 01/09/2026 e armazenados em `src/core/BoldCatalog.ts`. O recorte contém dez variações da linha EasyBold +5, com formatos de 1.220 × 5.000 mm e 1.500 × 5.000 mm, todas apresentadas com espessura de 3 mm conforme a denominação pública consultada.

## Limites explícitos

- O Esboce não afirma parceria, representação ou vínculo oficial com a Bold.
- Os valores são referências públicas, não propostas comerciais; frete, impostos, estoque e condições de venda não são calculados.
- Cores e brilho em tela são aproximações digitais PBR e não substituem amostras físicas ou especificações oficiais.
- A aplicação grava o produto e a referência comercial no projeto. O quantitativo converte a área revestida em chapas inteiras de 6,10 m² ou 7,50 m² conforme o formato cadastrado.
- Antes de especificar ou comprar, o usuário deve confirmar dados, disponibilidade e preço na origem.

## Critério de evolução

Uma integração comercial futura deve ser tratada separadamente e exigir autorização da Bold, identificação estável de SKUs, política de atualização de preço/estoque, imagens licenciadas e regra explícita para aplicar cada acabamento ao modelo e ao orçamento.

## Materiais PBR

Existem sete conjuntos reutilizados pelas dez variações dimensionais: Azul Cobalto Fosco, Grafite Metálico, Laranja Brilho, Dourado Metálico, Branco Brilho, Madeira Clara e Cimento Queimado. Cada pasta em `public/textures/acm/bold/` contém:

- `albedo-source.png`: geração original preservada;
- `albedo.jpg`: cor/estampa otimizada para produção;
- `normal.jpg`: micro-relevo do coating ou estampa;
- `roughness.jpg`: resposta de brilho calibrada por acabamento;
- `metalness.jpg`: contribuição metálica do coating;
- `ao.jpg`: oclusão neutra, pois a chapa limpa não possui juntas ou cavidades.

Os albedos foram criados pelo modo integrado `image_gen`, com enquadramento ortográfico, repetição contínua e sem juntas, rebites, textos ou reflexos gravados. Os demais mapas são derivados de forma reproduzível pelo script `scripts/texturas/generate_bold_acm_pbr.py`.
