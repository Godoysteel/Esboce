# H1 — Protótipo hidráulico procedural

## Objetivo desta fase

Validar dentro da viewport a arquitetura definida na SPEC-002 e no contrato H0, antes da implantação do roteamento automático completo, das conexões comerciais e das regras normativas.

## Entregue

- rede hidráulica persistente no documento do projeto;
- pontos classificados como origem, consumo, junção ou destino;
- segmentos com finalidade e diâmetro nominal;
- tubos 3D procedurais genéricos entre os pontos;
- cores provisórias distintas para água fria, esgoto sanitário, esgoto de cozinha e ventilação;
- controle **Hid.** com painel flutuante de ferramentas e opção para mostrar ou ocultar a camada;
- catálogo inicial de pontos independentes dos móveis: torneiras, alimentação de vaso, chuveiro, saídas de pia, vaso e lavatório, além de ralos;
- pontos de parede presos ao eixo da parede hospedeira e pontos de piso presos à grade técnica;
- marcadores esféricos permanentemente visíveis na face acabada, com identificação exibida somente durante a seleção;
- reposicionamento posterior dos pontos sem recriação: arraste lateral pela parede e arraste vertical entre 5 cm e 2,60 m;
- ocultação temporária da legenda durante o arraste para preservar a visualização e a interação;
- seleção de pontos existentes com prioridade mesmo quando uma ferramenta de inserção continua ativa;
- exclusão individual de pontos hidráulicos;
- escolha explícita da face visual em paredes compartilhadas pelo comando **Trocar lado** (`⇄`), preservada no documento do projeto;
- primeira geração de rede de água fria a partir dos pontos posicionados;
- caixa d'água genérica criada acima do último pavimento;
- ramais ortogonais entre a caixa d'água e todos os pontos de água fria, sem segmentos diagonais;
- recálculo da rede gerada após o reposicionamento de um ponto;
- primeiro circuito demonstrativo, da origem elevada até o ponto provisório da cozinha, com ramal superior, prumada e ramal baixo;
- gabarito técnico `kitchen_sink_generic`, independente do GLB, com conector que acompanha posição e rotação do móvel;
- vínculo persistente do nó com `equipmentId` e `connectorKey`, permitindo trocar o modelo visual sem romper a rede;
- migração segura de projetos antigos para `schemaVersion` 7;
- validação contra pontos duplicados, diâmetros inválidos, segmentos órfãos e valores inválidos para a face da parede.

## Comportamento em paredes compartilhadas

Uma parede entre dois ambientes possui duas faces internas igualmente válidas. Por isso, o Esboce não tenta decidir sozinho se um chuveiro, uma torneira ou outra saída pertence visualmente a um ou ao outro ambiente.

O ponto técnico permanece no eixo da parede. O marcador visual é deslocado para uma das faces e o usuário pode alterná-lo com **Trocar lado** (`⇄`). Essa escolha não desloca a tubulação, não altera a altura e não rompe o vínculo com a parede hospedeira.

## Limites conscientes

Esta fase ainda não:

- decide o caminho definitivo de toda a instalação;
- permite pontos-guia manuais para conduzir o percurso;
- escolhe e modela automaticamente joelhos, tês, registros e demais conexões;
- calcula pressão, vazão ou dimensionamento executivo;
- calcula declividade de esgoto;
- gera as redes completas de esgoto sanitário, cozinha e ventilação;
- aplica bloqueios ou recomendações normativas validadas por profissional habilitado;
- substitui projeto hidráulico executivo.

## Próxima fase recomendada

Implementar pontos-guia de percurso. O usuário indicará por onde a tubulação deve passar, enquanto o Esboce escolherá as conexões compatíveis com as mudanças de direção e derivações. Depois disso, deverão entrar regras técnicas versionadas, rede de esgoto, ventilação e quantitativos.
