# SPEC-005 — Pavimentos Empilhados, Coberturas Editáveis e Fechamentos Steel Frame

**Status:** Implementado na branch `codex/imagens-revestimentos-reais` (51 commits à frente de `main`); pendente de mesclagem, revisão manual e QA antes de entrar em produção.

**Data:** 26/08/2026

**Escopo:** três evoluções do editor de geometria, desenvolvidas em sequência na mesma branch e documentadas juntas por formarem uma cadeia única de causa e efeito — empilhar cômodos exige compor coberturas automaticamente; compor coberturas automaticamente exige presets editáveis e um telhado escalonado de verdade; e ter um telhado escalonado com faces novas (paredes de extensão, oitões, beiral, tabeira) é o que torna necessário um fluxo de fechamento técnico completo para Light Steel Frame.

Este documento formaliza retroativamente o que já foi implementado e testado, conforme ADR-003 (Documentação como Fonte da Verdade) — a documentação não antecedeu o código nesta branch, mas a divergência é resolvida agora, antes da mesclagem a `main`.

## 1. Visão

O Esboce já permitia ático/chalé configurável por nível e coberturas compostas (ADR-005). Esta etapa estende isso em três direções que convergem: (a) qualquer cômodo pode subir para um pavimento superior sem duplicar geometria e ganhando laje de base automaticamente; (b) a cobertura deixa de depender de um botão manual de "gerar telhado" e passa a se compor sozinha a partir de presets editáveis, incluindo um preset de telhado escalonado (cumeeiras em níveis diferentes); e (c) o sistema construtivo Light Steel Frame ganha um fluxo guiado que obriga a especificação técnica de cada face da construção antes de liberar o quantitativo, apoiado num catálogo comercial real de um fornecedor (PlacLux/JoinSteel).

## 2. Fase A — Empilhamento de pavimentos e composição automática de cobertura

### 2.1 Experiência pretendida

- o usuário seleciona um cômodo e aciona "Subir" (`data-action="raiseRoom"`); as mesmas paredes são movidas para o pavimento de cima, sem criar cópias;
- o cômodo elevado ganha uma laje de base automaticamente, sem exigir o botão manual "Gerar Laje" (que continua existindo para os demais casos e ignora cômodos que já têm laje automática);
- um cômodo desenhado diretamente num pavimento superior (sem ter sido "subido") também nasce com laje de base;
- coberturas de telhados vizinhos com o mesmo eixo de cumeeira e proximidade de encontro se compõem sozinhas (`autoComposeCurrentRoofs`), sem o antigo botão manual de confirmação de encontro ("Encontro automático" substitui o fluxo anterior);
- gerar ático continua respeitando o tipo de cobertura já escolhido pelo usuário, em vez de forçar `duasAguas`;
- pavimentos superiores permanecem visíveis por padrão enquanto se edita um pavimento inferior (facilita ver o empilhamento), com uma opção explícita para escondê-los ("Mostrar níveis superiores", `niveisSuperiores` em `ProjectLayers`).

### 2.2 Modelo de dados e arquitetura

- `Store.commands.raiseRoom(wallIds): Wall[] | null` — remove as paredes do piso de origem e as reinsere no piso de destino (`target.walls.push(...selected)`), sem gerar novos ids;
- `Floor.roomBaseLajeGenerated: Record<string, boolean>` (novo campo em `types.ts`) — marca que aquele cômodo já tem laje automática de base, distinto de `roomLajeGenerated` (laje gerada manualmente pelo usuário); os dois fazem parte da mesma checagem de "já tem laje" em `generateLajeForCurrentFloor`;
- `FLOOR_STACK_HEIGHT = WALL_HEIGHT + LAJE_THICKNESS` (`Scene3DRenderer.ts`) — constante que define o deslocamento vertical entre pavimentos, usada tanto para posicionar a laje automática quanto a malha do pavimento;
- a visibilidade de pavimentos superiores durante a edição é controlada só na camada de renderização (`Scene3DRenderer.ts`: `if (!layers.niveisSuperiores && floorIdx > editingIdx) return`), nunca ocultando por padrão — o padrão é mostrar tudo.

## 3. Fase B — Presets de cobertura editáveis e varandas de contorno

### 3.1 Presets de cobertura

O botão único "Gerar telhado" foi substituído por presets manuais compostos e editáveis (`id="roofPresetExtension"`, `id="roofPresetParallel"`, com miniaturas em `public/ui/coberturas/`), incluindo o preset de **telhado escalonado** ("cumeeiras paralelas" em alturas diferentes, também chamado de split-level nos commits em inglês). Cada preset chama `Store.commands.createRoofCompositePreset(...)`, que:

- cria duas ou mais entidades `Roof` independentes (`floor.roofs.push(...roofs)`), nunca uma única malha fundida;
- no preset escalonado, a cobertura elevada nasce com `raised.steppedWallVolume = true` e altura de base `raisedBaseHeightM = Core.WALL_HEIGHT + 0.45` acima da cobertura inferior;
- **não** cria nenhuma `Wall` estrutural nova para o volume elevado (`floor.walls.push(divider)` explicitamente não acontece) — ver decisão 6.1 abaixo.

### 3.2 Telhado escalonado como volume visual independente

`buildSteppedRoofVisualVolume` (`Scene3DRenderer.ts`) constrói o fechamento vertical do telhado elevado como uma malha derivada e independente (`closure.userData.roofClosure = 'volume-visual'`), calculada a partir da própria geometria do `Roof` (`roof.steppedWallVolume || roof.steppedLowerRoofId`), nunca a partir de paredes estruturais. Isso preserva o mesmo princípio já estabelecido pela ADR-005 para coberturas compostas: a malha visível é derivada, o domínio é que guarda a relação real entre as peças.

A elevação de cada telhado escalonado é controlada por um slider dedicado (substituindo uma alça 3D pouco confiável — `f8bc4c2 Replace unreliable roof elevation handle with slider`), com captura de ponteiro e confirmação só ao soltar (mesmo padrão de desempenho já usado em outras operações de arraste do editor).

### 3.3 Varandas como módulos de contorno editáveis

Varandas deixaram de ser um retângulo fixo e passaram a ser um percurso de segmentos que acompanha o contorno das paredes externas do cômodo:

- `Core.varandaContourSegments(walls)` identifica os trechos de fachada externa disponíveis para receber uma varanda;
- `Core.snapVarandaSegmentToExteriorWalls(...)` só encaixa o módulo numa parede externa quando o usuário chega perto o suficiente (parâmetro de tolerância explícito), evitando encaixe acidental;
- `Core.extendVarandaAlongExteriorWalls(...)` permite estender a varanda "serpenteando" pelas quinas do contorno externo, acumulando `VarandaContourSegment[]`;
- `postMaterial: 'madeira' | 'concreto' | 'tijolo'` e `widthM`, `heightM`, `pitchDeg` tornam a varanda paramétrica (poste, largura, pé-direito livre e inclinação própria da cobertura de uma água);
- tudo isso é persistido em `ProjectPersistence` e coberto por `tests/contour-varanda.test.mjs`, incluindo round-trip de serialização.

## 4. Fase C — Fechamentos técnicos Steel Frame e catálogo comercial PlacLux

### 4.1 Experiência pretendida

Quando o projeto usa `constructionSystem === 'light_steel_frame'`, um painel guiado (`SteelFrameConfigurator.ts`) obriga o usuário a clicar em cada superfície da construção — face A/B de cada parede, isolamento de cavidade, oitões, extensão de parede da cumeeira em níveis, beiral, tabeira e, quando aplicável, as duas faces da platibanda — e escolher o sistema construtivo correspondente. O quantitativo específico de LSF só é liberado (`needsConfiguration()` retorna `false`) quando `steelFrameSpecificationIssues(project)` estiver vazio.

Características de UX relevantes:

- progresso por pavimento: o pavimento seguinte só libera a seleção de superfícies depois que o pavimento atual está 100% configurado;
- cada face já configurada recebe uma cor de identificação visual na cena 3D (`steelFrameAssemblyColorHex`), permitindo conferência visual rápida de quais sistemas foram escolhidos onde;
- clicar numa face já configurada não a reabre silenciosamente — mostra aviso explícito para o usuário escolher uma face pendente.

### 4.2 Catálogo técnico de composições (`SteelFrameAssemblies.ts`)

Define os sistemas construtivos disponíveis (EIFS, placa cimentícia com/sem OSB, Glasroc X e Glasroc X Therm, siding vinílico, drywall ST/RU/RF, beiral em placa cimentícia ou vinílico), cada um como uma lista de camadas (`AssemblyLayerDefinition`) com papel técnico (`finish`, `basecoat`, `mesh`, `external_insulation`, `water_barrier`, `structural_sheathing`, etc.), unidade, consumo por m² e percentual de perda. `quantityWithWaste(areaM2, layer)` é a função pura que converte área em quantidade de material — a mesma lógica usada pelo quantitativo. Este catálogo é técnico/paramétrico, não comercial: não tem preço nem fornecedor.

### 4.3 Catálogo comercial PlacLux (`PlacluxCatalog.ts`)

Catálogo de 23 produtos reais do fabricante PlacLux, com imagens oficiais hospedadas no Supabase Storage (bucket público `catalog-products`) e vínculo comercial com o fornecedor **JoinSteel** (Joinville/SC), declarado como `PLACLUX_SUPPLIER`. Este catálogo é **deliberadamente separado** do catálogo técnico de composições (4.2) — a mesma separação já estabelecida na ADR-007 entre especificação técnica e oferta comercial. Hoje o vínculo entre os dois catálogos é só por convenção de `id` (ex.: `placlux.profort-next-10mm` aparece como camada técnica em `cement-board-direct` e como produto comercial em `PlacluxCatalog`); ainda não existe uma entidade `Oferta`/`product_offers` formal para os produtos PlacLux, ao contrário do que a emenda de 22/08/2026 da ADR-007 já previu para o catálogo geral (ver decisão em aberto 8.3).

### 4.4 Importação de imagens do fornecedor

As migrations `20260826210000_create_placlux_product_storage.sql` e `20260826211000_close_placlux_product_upload.sql` seguem um padrão de janela temporária: a primeira cria o bucket público e libera escrita anônima **restrita à pasta `placlux/`**, só para permitir a importação inicial das imagens (`scripts/import-placlux-images.mjs`); a segunda, aplicada logo em seguida, revoga essa política de escrita anônima — leitura pública permanece, mas novos uploads passam a exigir credenciais administrativas. Ver decisão 6.4.

## 5. Testes automatizados relevantes

`tests/room-stacking-roof-composition.test.mjs`, `tests/roof-auto-generation.test.mjs`, `tests/roof-editor-controls.test.mjs`, `tests/contour-varanda.test.mjs`, `tests/wall-transparency.test.mjs`, `tests/steel-frame-assemblies.test.mjs`, `tests/steel-frame-surface-selection.test.mjs`, `tests/placlux-catalog.test.mjs`, além de ajustes em `tests/attic.test.mjs`, `tests/construction-system.test.mjs`, `tests/demolish-wall.test.mjs` e `tests/wall-geometry.test.mjs`.

## 6. Decisões arquiteturais

### 6.1 Telhado escalonado é volume visual derivado, nunca parede estrutural nova

**Decisão:** o fechamento vertical criado por um telhado escalonado (`steppedWallVolume`) é sempre uma malha derivada e independente, nunca uma nova `Wall` em `Floor.walls`.

**Motivo:** o mesmo já vale para coberturas compostas desde a ADR-005 — o domínio guarda a relação entre as peças (`steppedLowerRoofId`), e a geometria visível é recalculável a qualquer momento sem risco de perder informação. Criar uma parede estrutural de verdade duplicaria a fonte da verdade (a parede e o telhado discordariam sobre onde está o fechamento) e complicaria mover ou redimensionar o telhado depois.

**Alternativa rejeitada:** gerar uma `Wall` divisória de verdade no ponto de transição entre os dois níveis de cumeeira — rejeitada porque acopla uma decisão de cobertura à lista de paredes estruturais do pavimento, que tem suas próprias regras de snapping, colisão e quantitativo de alvenaria.

### 6.2 Configuração de fechamentos LSF é obrigatória, guiada e bloqueia o quantitativo

**Decisão:** quando o sistema construtivo é Light Steel Frame, o quantitativo específico de LSF fica bloqueado até que toda superfície relevante (paredes, oitões, extensões de cumeeira, beiral, tabeira, platibanda, isolamento de cavidade) tenha um sistema explicitamente escolhido pelo usuário.

**Motivo:** ao contrário de alvenaria (onde o quantitativo pode ser derivado só da geometria, com uma composição padrão razoável), Light Steel Frame tem dezenas de combinações de fechamento com consumo de material muito diferente entre si (ex.: EIFS vs. siding vinílico). Presumir um sistema padrão arriscaria um quantitativo tecnicamente incorreto sem o usuário perceber — o mesmo princípio de "premissas visíveis" já adotado na ADR-006 para orçamentos.

**Alternativa rejeitada:** aplicar um sistema padrão (ex.: sempre placa cimentícia sem OSB) e permitir troca posterior — rejeitada porque um quantitativo aparentemente completo, mas baseado numa suposição não confirmada pelo usuário, é pior do que um quantitativo explicitamente incompleto.

### 6.3 Catálogo técnico de composições e catálogo comercial PlacLux permanecem separados

**Decisão:** `SteelFrameAssemblies.ts` (o que existe, camadas, consumo, perda) e `PlacluxCatalog.ts` (o que se compra, de quem, com que foto) são módulos distintos, ligados só por convenção de `id`.

**Motivo:** consistente com a distinção Produto/Loja/Oferta já formalizada na ADR-007 — a composição técnica não deve depender de rede nem de qual fornecedor está disponível numa cidade; o catálogo comercial pode evoluir (novos fornecedores, preços, disponibilidade regional) sem exigir mudança na lógica de quantitativo.

### 6.4 Janela de escrita anônima no Storage é criada e fechada em migrations separadas e sequenciais

**Decisão:** a permissão de upload anônimo para importar as imagens do fornecedor foi concedida numa migration e revogada na migration imediatamente seguinte, em vez de uma migration só com limpeza manual posterior.

**Motivo:** garante que a janela de escrita aberta não dependa de alguém lembrar de fechá-la manualmente depois — o fechamento já está versionado e é aplicado automaticamente na mesma sequência de deploy.

## 7. Critérios de aceitação

1. Subir um cômodo não duplica paredes nem perde aberturas (portas/janelas) já posicionadas nelas.
2. Um cômodo com laje automática de base não aparece duas vezes na lista de "Gerar Laje".
3. Duas coberturas com o mesmo eixo de cumeeira e proximidade suficiente se compõem automaticamente, sem intervenção manual, preservando o tipo de telhado escolhido.
4. Um telhado escalonado pode ser elevado, redimensionado e reposicionado sem criar nem exigir nenhuma parede estrutural nova.
5. Uma varanda de contorno serializa e restaura corretamente percurso, largura, altura, inclinação e material do poste.
6. Com `constructionSystem = light_steel_frame`, o quantitativo de LSF não pode ser aberto enquanto `steelFrameSpecificationIssues` retornar itens pendentes.
7. Toda imagem de produto PlacLux carrega de uma URL pública do Supabase Storage; nenhum novo upload anônimo é aceito fora da janela já fechada.

## 8. Fora do escopo desta etapa

- laje de sistema para paredes em Light Steel Frame ("em implantação", citado no próprio painel guiado) — só as faces de fechamento estão cobertas por esta etapa;
- entidade formal de `Oferta`/`product_offers` para os produtos PlacLux (preço, cidade de atuação da JoinSteel, comparação entre fornecedores) — hoje é um catálogo só de especificação técnica e imagem, sem preço;
- telhados com três ou mais águas se encontrando (já registrado como evolução futura própria no Roadmap);
- suporte a mais de dois níveis de cumeeira escalonada no mesmo telhado.

## 9. Decisões em aberto

- se o painel guiado de fechamentos deve permitir "pular e voltar depois" em vez de bloquear o quantitativo por completo, para projetos muito grandes;
- como o catálogo PlacLux vai migrar para o modelo Produto/Loja/Oferta da ADR-007 sem quebrar os `id`s já referenciados pelas composições técnicas existentes;
- se telhados escalonados poderão ter mais de dois níveis, e como isso afetaria `steppedLowerRoofId` (hoje um vínculo simples de um para um);
- critério exato de "proximidade suficiente" para composição automática de coberturas em plantas muito irregulares.

## 10. Princípio final

Empilhar, compor e fechar uma casa não deveria exigir do usuário nenhuma etapa de contabilidade manual (mover parede por parede, lembrar de gerar laje, decidir manualmente cada encontro de telhado) quando a intenção é óbvia a partir da geometria — mas nunca deveria, também, entregar um quantitativo tecnicamente incompleto se fingindo de completo. As três frentes desta etapa seguem essa mesma régua: automatizar o que é inequívoco (empilhamento, composição de cobertura, laje de base) e exigir confirmação explícita só onde a escolha realmente muda o resultado técnico (sistema construtivo de cada face em Light Steel Frame).
