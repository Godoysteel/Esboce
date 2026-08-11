# ADR-008 — Terreno Opcional e Muros de Perímetro por Lado

**Status:** Aceita

**Data:** 11/08/2026

**Responsáveis:** Product Owner e Arquitetura de Software

**Tema:** Entidade `Terreno` (tamanho do lote) e muros de perímetro gerados a partir da marcação de lados pelo usuário.

---

## 1. Contexto

O Modelo de Domínio (seção 5) já previa `Terreno` como entidade própria, filha de `Projeto` e irmã de `Casa`, com `largura`/`comprimento` e "Muros" listado como evolução futura. Até esta decisão, nada disso existia no código — não havia tipo, UI nem persistência de terreno.

O pedido de produto: o usuário digita o tamanho do lote (ex.: `25x10`), o app desenha um retângulo em vista de topo representando o terreno, e o usuário clica em cada lado do retângulo pra alternar se aquele lado tem muro. Se só um lado for marcado, só aquele lado gera muro — não os quatro.

## 2. Terreno é opcional, a qualquer momento

Diferente de outros passos do editor (que dependem de já existir ao menos um pavimento), definir o terreno **não é obrigatório na criação de um projeto**. Um `Project` pode não ter `terreno` — nesse caso, o editor se comporta exatamente como hoje. O usuário pode definir (ou redefinir) o terreno a qualquer momento, inclusive depois de já ter modelado parte da casa.

## 3. Muro de terreno é uma parede completa, mas vive fora de `Floor.walls`

Decisão explícita de produto: o muro gerado deve aceitar portão/porta e acabamento por face — ou seja, se comportar como uma parede completa, reaproveitando o sistema de `Opening` e `finishA`/`finishB` que já existe pra `Wall`.

Por isso, `Terreno.muros` é tipado como `Wall[]` — mesma entidade, mesmos campos, mesmo suporte a abertura. A diferença é **onde ele vive**: fica em `Terreno.muros`, não em `Floor.walls`. Motivo: `Core.detectRooms` e a validação de topologia operam sobre `Floor.walls` pra derivar cômodos da casa; um muro de terreno normalmente não fecha com as paredes da casa (é o perímetro do lote, não um cômodo), e misturá-lo na mesma lista arriscaria contaminar essa detecção. Manter as duas listas separadas evita esse acoplamento sem duplicar nenhuma lógica de abertura/acabamento — `Opening.wallId` funciona igual, apontando pra um id de `Terreno.muros` ou de `Floor.walls` conforme o caso.

Consequência prática: o muro tem um campo próprio `Wall.heightM` (opcional), usado só por muros de terreno, com valor padrão de 1,8 m — deliberadamente mais baixo que a altura fixa da parede da casa (`Core.WALL_HEIGHT`, 2,7 m). Paredes de `Floor.walls` continuam ignorando esse campo e usando a altura global fixa; não há intenção, nesta decisão, de tornar a altura de parede da casa variável por unidade.

## 4. Um muro por lado, id determinístico

O terreno é sempre um retângulo com origem em `(0,0)`: `larguraM` no eixo X, `comprimentoM` no eixo Z (mesma convenção de `Wall`/`Varanda`, onde o campo chamado `y` no plano 2D corresponde ao eixo Z na cena 3D). Os quatro lados são identificados por `TerrenoMuroSide` (`'minX' | 'maxX' | 'minZ' | 'maxZ'`), mesma nomenclatura já usada por `VarandaFrontSide`.

Cada muro nasce com id determinístico (`terreno_muro_<side>`) — não um id sequencial genérico. Isso simplifica o comando de alternância (clique no lado → existe? remove : cria) pra uma busca por id em vez de precisar rastrear geometria, e garante no máximo um muro por lado por construção, sem precisar de validação adicional pra essa invariante.

## 5. Redefinir o tamanho do terreno preserva os lados marcados

Se o usuário já marcou muros e depois muda o tamanho do terreno (`25x10` → `30x12`, por exemplo), os lados que tinham muro continuam tendo muro — recalculado no novo tamanho, não mantido no tamanho antigo. Isso evita que o usuário perca a marcação por ter digitado o tamanho errado da primeira vez, mas também evita muros com comprimento desatualizado em relação ao novo retângulo.

## 6. Persistência: schemaVersion 5 → 6

`Project.terreno` é campo opcional novo — bump de versão pra `6`. Documentos v5 (e anteriores, via migração já existente) continuam abrindo normalmente sem terreno definido; nada em `terreno` é obrigatório pra um documento ser válido. A validação rejeita: largura/comprimento não positivos, muros com id fora do padrão `terreno_muro_<side>` esperado, e ids duplicados — mesma disciplina de validação estrita já aplicada ao resto do documento em `ProjectPersistence.ts`.

## 7. Fora de escopo desta decisão (registrado como pendência)

- **UI de clique nos lados do retângulo e renderização do terreno na cena** — esta ADR cobre o modelo de dados e os comandos (`Store.setTerreno`, `Store.toggleTerrenoMuroSide`), que já estão implementados e testados. A integração em `ViewportController.ts` (detecção de clique nos quatro lados) e `Scene3DRenderer.ts` (desenho do retângulo em vista de topo e extrusão dos muros com `heightM` próprio) fica como próxima etapa de implementação — são arquivos grandes, com uma máquina de estados de arraste (`dragMode`) já intrincada, que merecem atenção dedicada em vez de uma integração apressada.
- **Posicionamento da casa dentro do terreno** — hoje a casa e o terreno compartilham a mesma origem `(0,0)`; mover a casa livremente dentro do retângulo do terreno (drag do conjunto de paredes) não faz parte desta decisão.
- **Materiais/acabamento padrão do muro** — o muro nasce sem `finishA`/`finishB` definidos (mesmo comportamento de uma parede nova da casa); não foi definido um material "padrão de muro" diferente do padrão de parede.

---

## Decisão

**ACEITO**

`Terreno` passa a existir como campo opcional de `Project`, com `larguraM`, `comprimentoM` e `muros: Wall[]`. Definir o terreno é opcional e disponível a qualquer momento do projeto. Cada um dos quatro lados do retângulo pode ter no máximo um muro, identificado por id determinístico (`terreno_muro_<side>`); o muro reaproveita o tipo `Wall` (aceita `Opening` e acabamento por face), mas vive fora de `Floor.walls` para não interferir na detecção de cômodos da casa. Muros de terreno têm altura própria (`Wall.heightM`, padrão 1,8 m), diferente da altura fixa da parede da casa. `Project.schemaVersion` avança de 5 para 6.
