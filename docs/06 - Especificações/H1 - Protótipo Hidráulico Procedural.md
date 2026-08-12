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
- migração segura de projetos antigos para `schemaVersion` 7;
- validação contra pontos duplicados, diâmetros inválidos e segmentos órfãos.

## Limites conscientes

Este protótipo ainda não decide o caminho da tubulação, não adiciona conexões curvas ou tês, não calcula declividade e não aplica regras normativas. O circuito demonstrativo existe para validar armazenamento, renderização, desempenho e legibilidade visual. A próxima fatia deve substituir a geração fixa por edição de pontos e roteamento ortogonal assistido.
