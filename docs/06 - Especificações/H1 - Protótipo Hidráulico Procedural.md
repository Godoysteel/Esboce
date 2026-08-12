# H1 — Protótipo hidráulico procedural

## Objetivo desta fatia

Validar dentro da viewport a arquitetura definida na SPEC-002 e no contrato H0, antes da implantação do roteamento automático e dos componentes comerciais.

## Entregue

- rede hidráulica persistente no documento do projeto;
- pontos classificados como origem, consumo, junção ou destino;
- segmentos com finalidade e diâmetro nominal;
- tubos 3D procedurais genéricos entre os pontos;
- cores provisórias distintas para água fria, esgoto sanitário, esgoto de cozinha e ventilação;
- controle **Hid.** para gerar um circuito demonstrativo e mostrar/ocultar a camada;
- primeiro circuito ortogonal funcional, da origem elevada até o ponto provisório da cozinha, com ramal superior, prumada e ramal baixo sem segmentos diagonais;
- associação provisória do armário de cozinha como ponto de pia, até existir um equipamento de pia com conectores próprios;
- gabarito técnico `kitchen_sink_generic`, independente do GLB, com conector de água fria que acompanha posição e rotação do móvel;
- vínculo persistente do nó com `equipmentId` e `connectorKey`, permitindo trocar o modelo visual sem romper a rede;
- catálogo inicial de pontos hidráulicos independentes de móveis, classificados para encaixe em parede ou piso;
- snap de pontos de água e saídas elevadas no eixo da parede, preservando tipo, altura técnica, pavimento e parede hospedeira;
- snap de vaso e ralos na grade do piso;
- migração segura de projetos antigos para `schemaVersion` 7;
- validação contra pontos duplicados, diâmetros inválidos e segmentos órfãos.

## Limites conscientes

Este protótipo ainda não decide o caminho definitivo da tubulação, não adiciona conexões curvas ou tês, não calcula declividade e não aplica regras normativas. O circuito demonstrativo existe para validar armazenamento, renderização, desempenho e legibilidade visual. Os pontos já podem ser posicionados; a próxima fatia deve permitir selecionar, mover e excluir esses pontos antes do roteamento ortogonal assistido.
