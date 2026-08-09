# Changelog

Todas as alterações relevantes do Esboce serão registradas neste arquivo.

---

# v0.1.0-engineering-baseline

Data: 2026

## Primeiro marco oficial

Incluído:

- Estrutura inicial do repositório;
- Documentação Atlas;
- Modelo de Domínio;
- Arquitetura;
- Plataforma;
- Motores Inteligentes;
- Organização da documentação oficial.

## Governança

Criada a primeira baseline de engenharia do projeto.

---

# Não lançado — consolidação v19

## Documentação

- criada a SPEC-001 com o comportamento validado do editor v19;
- registrada a decisão de coberturas compostas e engaste explícito na ADR-005;
- registrado o experimento rejeitado de snapping em 100 mm na ADR-R001;
- atualizados arquitetura, modelo de domínio, índice oficial e roadmap de migração.

---

# Não lançado

## Alterado (toolbar)

- Toolbar (barra superior) reorganizada e compactada, e deixa de ser uma faixa contínua de fundo sólido — cada grupo de controles (marca, menu **"📁 Arquivo"**, pavimento, undo/redo, menu "⋯", conta) agora flutua como uma ilha independente direto sobre a viewport 3D, com vão transparente e clicável (orbit/pan) entre elas. Menu "📁 Arquivo" empilha Novo projeto, Salvar, Compartilhar, Meus projetos e Limpar pavimento atual (igual ao menu Arquivo do SketchUp); menu "⋯" ficou só com as ações de visualização/produto (Grid, Cotas, Materiais, Catálogo). Avatar de conta (iniciais) substitui o botão de texto "Entrar"/e-mail completo. Botão "Refazer" aparece mas fica desabilitado — o Store ainda não tem pilha de redo de verdade. Ilhas passaram por uma rodada de enxugamento: marca e "Arquivo" perderam o rótulo de texto (só ícone), e o pavimento — antes lista de abas sempre visível + botão "+ Pavimento" separado — virou uma única pill "Térreo ▾" com a lista de andares e "+ Novo pavimento" dentro do menu suspenso. A barra também trocou o scroll horizontal (que aparecia em telas mais estreitas) por quebra de linha simples. Fase 1 de um redesign visual maior (toolbar → sidebar → barra inferior → catálogo). Ver DEC-38 no Registro de Decisões Técnicas.

## Corrigido

- Platibanda (telhado): laje ganhou um caimento sutil (2°) — antes era 100% plana, sem nenhuma queda visível; parapeito passou a usar a mesma textura de reboco e a mesma cor de acabamento predominante das paredes da casa (antes um bege fixo sem textura); altura do parapeito agora é ajustável por uma alça própria na seleção do telhado (0,2–1,2 m, padrão 0,5 m). Ver DEC-31 no Registro de Decisões Técnicas.

## Adicionado

- Laje vira objeto colocável de verdade (botão "Laje", ao lado de Telhado/Varanda) — não é mais gerada automaticamente entre pavimentos. Nasce cobrindo o pavimento atual (paredes + varanda), redimensiona pelas bordas sem travar em contorno de parede nenhum (dá pra criar balanço/sacada arrastando pra fora, ou um vão aberto encolhendo), funde automaticamente com outra laje que encoste, e usa a mesma textura de reboco das paredes. Parede/cômodo num pavimento acima do térreo agora exige a laje do pavimento de baixo já colocada. Ver DEC-35 no Registro de Decisões Técnicas.

## Corrigido (laje)

- Não dava pra selecionar nem excluir uma laje depois de colocada — a lógica de clique excluía qualquer objeto marcado com a categoria visual "laje" do hit-test, herdado de quando essa categoria só existia pra piso/soleira/laje automática (nunca clicáveis de propósito).
- A lateral da laje nascia no eixo da parede em vez da face — cortando por dentro dela ou deixando um vão de fora.
- Criar uma segunda laje sobre uma já existente não fundia — ficavam duas peças sobrepostas em vez de virar uma só.
- Correção da seleção acima foi incompleta — outro portão (isEditableMesh) ainda bloqueava o clique no corpo da laje, mesmo já enxergando ela no hit-test. As bordas continuavam arrastáveis (caminho separado), mas selecionar/excluir depois de posicionar continuava impossível. Agora corrigido de vez.
- Arrastar a borda da laje perto de uma parede podia parar no eixo dela (linha central) em vez da face — sem nenhum "ímã" puxando pro lugar certo, só o grid genérico. Agora gruda na face da parede mais próxima automaticamente, dentro de um raio de captura.
- Fusão de laje agora também é checada ao clicar fora pra sair da seleção, não só ao soltar o arraste de uma borda — mesmo padrão já usado pra cômodo isolado.

## Removido

- Formato de topo curvo (arco/raio) de abertura — nunca chegou a ser implementado no renderer, e o campo que reservava essa possibilidade (Opening.shape) era código morto, sem nenhum leitor. Abertura do tipo "Arco" (vão livre, sem porta/janela) continua existindo normalmente, sempre com topo reto. Ver DEC-36 no Registro de Decisões Técnicas.

## Alterado

- Fusão de laje agora produz o contorno REAL da união — antes só calculava o retângulo delimitador, então duas lajes formando um "L" de verdade viravam um retângulo cheio errado (preenchendo o vão vazio). Laje passa a ser um polígono retilíneo (reto em todos os cantos), com cada aresta do contorno resultante arrastável individualmente — permite continuar remodelando um "L" (ou formas mais complexas) aresta por aresta depois de fundido. Ver DEC-37 no Registro de Decisões Técnicas.

## Corrigido (laje, poligonal)

- Laje nascia enterrada dentro do topo da parede em vez de apoiada em cima dela — a técnica de extrusão copiada do piso usa a convenção oposta ("topo da superfície, extrude pra baixo"), sem ajuste pro sentido certo de laje ("apoio embaixo, extrude pra cima").
- Clicar em "Laje" de novo com uma já existente sempre recriava cobrindo o mesmo contorno, e a fusão automática devolvia o retângulo original — apagando qualquer "L" ou remodelagem manual já feita. Agora a nova laje nasce ao lado, não sobrepondo, pra pessoa arrastar até encostar quando quiser fundir de propósito.

## Alterado (revisão — laje não funde mais)

- Fusão automática de laje foi removida por completo (pedido explícito, revisão da decisão anterior). Duas lajes encostadas não viram mais um objeto só — cada uma continua independente, selecionável/arrastável/excluível sozinha. Em troca: laje ganhou arraste de CORPO INTEIRO (clicar no meio da peça e mover ela sem mudar o formato, mesmo padrão de coluna/móvel), com um ímã que gruda automaticamente numa laje vizinha quando fica perto o bastante — sem sobrepor, sem fundir. O mesmo ímã de arrastar uma aresta individual (pra ajustar o formato) agora também considera bordas de outras lajes, não só de parede. Ver DEC-37 (revisão) no Registro de Decisões Técnicas.