Registro de Decisões Técnicas — Compacto
Construtor de Casas Online — protótipo · substitui Sessões 1, 2 e 3
Como usar este documento
Este documento substitui os três Registros de Decisões Técnicas (Sessões 1, 2 e 3), que passam a poder ser excluídos do projeto.
Formato: uma entrada por decisão real (não por sessão inteira). Cada entrada tem contexto de uma linha, a decisão tomada, e — quando existirem — as alternativas tentadas e descartadas, com o motivo em poucas palavras. Isso é o que evita retrabalho; o resto (a narrativa de como se chegou lá) não precisa ser preservado com esse nível de detalhe.
Como documentar a próxima sessão
    • Registre a decisão, não a jornada. "Decidido: X, porque Y" vale mais que três parágrafos de como o raciocínio evoluiu.
    • Toda alternativa descartada merece uma linha, não um parágrafo. Basta o suficiente para não tentá-la de novo sem saber por quê.
    • Só crie uma entrada nova quando algo foi de fato decidido ou descartado. Passos intermediários do debugging não precisam virar registro.
    • Uma entrada por decisão, não por sessão. Se uma sessão gerou 8 decisões, são 8 entradas curtas — não um documento corrido.
    • Prefira números e nomes de função/constante exatos (ex.: Core.COINCIDENCE_TOL = 0,15 m) a descrições aproximadas — é o que faz a entrada ser útil tempos depois.
    • Separe 'decisão fechada' de 'limitação conhecida em aberto' — são duas seções diferentes, não misturar no meio do texto.
    • Sem contexto de produto, sem motivação, sem estado emocional da sessão. Isso é conversa, não decisão — fica no histórico do chat, não aqui.
Modelo de entrada
[DEC-XX] Título curto da decisão
Sessão: número ou data
Contexto: uma linha — qual problema motivou a decisão
Decisão: o que foi escolhido, com nomes exatos de função/constante quando existirem
Alternativas descartadas: lista curta, cada uma com o motivo entre parênteses
Status: Ativo / Limitação conhecida / Pendente
Decisões (29)
DEC-01  Vista unificada 3D substitui o editor 2D/3D dividido
Sessão: 1
Contexto: Objetivo de tornar a ferramenta fácil o bastante para uma criança usar; referência: Sims 4.
Decisão: Desenhar direto na cena 3D via raycasting no plano do pavimento; Core e Store não mudaram, só renderização e interação.
Alternativas descartadas:
    • Manter vista dividida 2D/3D (exige tradução mental mapa→3D, alto custo cognitivo)
Status: Ativo
DEC-02  Modelo de interação clique-clique (não arrastar)
Sessão: 1
Contexto: Padrão de desenho precisava ser mais controlável e consistente entre ferramentas.
Decisão: Primeiro clique marca início, prévia acompanha o mouse, segundo clique confirma. Aplicado a Cômodo, Parede e Coluna. Esc cancela.
Alternativas descartadas:
    • Pressionar/mover/soltar (arrastar) — padrão antigo do editor 2D
Status: Ativo
DEC-03  Fundação/calçada/laje geradas por cômodo, não por retângulo geral
Sessão: 1
Contexto: Bounding box de todas as paredes preenchia o recuo entre cômodos desalinhados (casa em L virava quadrado).
Decisão: Detectar cômodos individualmente (Core.detectRooms) e gerar uma peça por cômodo; peças vizinhas se sobrepõem levemente, sem fusão geométrica.
Status: Ativo
DEC-04  Telhado como objeto independente e colocável manualmente
Sessão: 1
Contexto: Telhado automático por cômodo gerava cruzamento de beirais entre cômodos vizinhos.
Decisão: Telhado deixa de ser gerado por camada; vira objeto com o mesmo status de parede/coluna — colocado, redimensionado e ajustado à mão, com 4 tipos trocáveis (Uma água, Duas águas, Quatro águas, Platibanda). Confirmado por pesquisa direta: o próprio Sims 4 também não resolve vales automaticamente para formas complexas.
Alternativas descartadas:
    • Telhado automático por cômodo (tentativa 1 — cruzava beirais entre vizinhos)
    • Suprimir beiral perto de vizinho (tentativa 2 — remendo, sem vale geométrico real)
    • Algoritmo de straight skeleton para vales automáticos (fora do escopo atual)
Status: Ativo
DEC-05  Telhados vizinhos não se fundem geometricamente
Sessão: 1
Contexto: Consequência direta da DEC-04.
Decisão: Ausência de vale automático entre telhados de cômodos diferentes é decisão consciente de escopo, não falha do sistema — usuário ajusta manualmente, como no Sims 4.
Status: Limitação conhecida
DEC-06  Oitão reconstruído em formato de "casinha" para bater inclinação exata
Sessão: 1
Contexto: Triângulo do oitão tinha inclinação mais íngreme que a água ao lado (28° configurado saía como ~31,6°).
Decisão: Oitão passa a subir até a altura que a própria água alcançaria naquele ponto (mesmo avanço do beiral) antes de virar triângulo até a cumeeira — inclinação bate por construção.
Status: Ativo
DEC-07  Direção da cumeeira (ridgeAxis) fixa na criação
Sessão: 1
Contexto: Redimensionar às vezes virava o telhado inteiro 90° sozinho.
Decisão: Direção deixa de ser recalculada a cada mudança de tamanho; vira propriedade fixa, só alterável pelos botões de girar do menu.
Status: Ativo
DEC-08  Pé-direito único e constante (2,7 m) para a casa inteira
Sessão: 1
Contexto: Escopo do MVP.
Decisão: Não configurável por pavimento nem por parede nesta fase.
Status: Limitação conhecida
DEC-09  Consolidação de documentação de produto/UX e certificação
Sessão: 2
Contexto: Quatro/dois pares de documentos com sobreposição de conteúdo.
Decisão: Manifesto de UX + UXP + checklist do Product Principles fundidos em "Princípios de Produto e UX". DRC fundido dentro de DBP como seção "Certificação e Avaliação para Terceiros" (DBP como documento pai).
Status: Ativo
DEC-10  Barra lateral visual substitui barra de texto/emoji
Sessão: 2
Contexto: Ferramenta antiga (texto/emoji) pouco descobrível; ferramenta "Parede" ativa por padrão desenhava sem querer.
Decisão: Ícones ilustrativos por ambiente (Banheiro/Cozinha/Quarto/Sala = criação instantânea); ferramentas técnicas (Parede livre, Cômodo livre, Coluna) rebaixadas para fileira "Avançado". Nenhuma ferramenta fica ativa por padrão.
Status: Ativo
DEC-11  Movimentação de cômodo com colisão real (SAT/OBB + MTV)
Sessão: 2
Contexto: Pesquisa direta no Sims 4: mover é livre (pode sobrepor durante o arraste), redimensionar é sempre travado por handle, fundir é sempre ação explícita.
Decisão: Cada parede tratada como retângulo orientado; SAT detecta sobreposição em qualquer ângulo, resolução por MTV empurra o cômodo pra fora (até 6 passos/frame). Validado numericamente com 4 casos antes de integrar.
Alternativas descartadas:
    • Travar o arraste até a posição ficar válida (rejeitada — não é como o Sims funciona)
Status: Ativo
DEC-12  Fusão de paredes: sobreposição generosa + polygonOffset por id
Sessão: 2
Contexto: Fundir dois cômodos que se encostam foi a parte mais iterada da sessão (4 tentativas).
Decisão: Toda parede se estica igual e simetricamente dos dois lados, sem cálculo de ângulo, podendo sobrepor a vizinha de propósito; polygonOffset com valor derivado do id resolve qual face vence, sem z-fighting.
Alternativas descartadas:
    • Colar pelas pontas mais próximas (deformava o cômodo maior quando os comprimentos eram diferentes)
    • Corte em pedaços / splitting (resolvia a deformação, mas exigia sobreposição quase perfeita durante o arraste)
    • Meia-esquadria nos cantos (matemática validada, mas bug resistente a 3 correções; abandonada após pesquisa confirmar que o próprio Sims não faz esquadria geométrica)
    • Poste de canto — cubo independente cobrindo o encontro (cria terceira entidade com textura própria)
    • Cômodo como peça única com furo (mais robusto, mas destrói seleção/arraste por parede individual)
Status: Ativo
DEC-13  Tolerância de coincidência de pontos unificada em Core.COINCIDENCE_TOL
Sessão: 2
Contexto: Bug do piso sumindo: tolerância de 0,5 m (GRID*0,5) tratava as duas pontas de uma parede residual de 0,5 m como o mesmo ponto, corrompendo o grafo planar.
Decisão: Tolerância reduzida para 0,15 m e unificada numa única constante, substituindo 4 ocorrências soltas e inconsistentes no código (junção em T, detecção de cômodo, mapeamento de paredes, redimensionar).
Status: Ativo
DEC-14  Grafo de paredes mantido genérico (qualquer polígono)
Sessão: 2
Contexto: Consequência da DEC-13.
Decisão: Decisão explícita: manter flexibilidade total (inclusive pentágonos) em vez de restringir a retângulos, mesmo aceitando uma categoria de bug mais difícil de testar exaustivamente.
Alternativas descartadas:
    • Restringir o algoritmo a retângulos (mais simples de testar, mas reduz flexibilidade do produto)
Status: Ativo
DEC-15  Redimensionar parede: handle visível + regra de vizinho nunca arrastado
Sessão: 2
Contexto: Redimensionar via duplo clique já existia, mas era pouco descobrível.
Decisão: Alças visíveis adicionadas (mesmo estilo da cumeeira). Regra: redimensionar nunca arrasta parede de cômodo vizinho; quando a parede é compartilhada, a direção do empurrão decide qual cômodo cresce.
Status: Ativo
DEC-16  Regra geral: nunca mover parede existente, sempre criar "rastro"
Sessão: 2
Contexto: Exemplos do usuário mostraram pontas ficando desconectadas ao empurrar paredes livres ou compartilhadas.
Decisão: Sempre que um movimento deixaria uma ponta desconectada, o sistema cria um segmento novo (rastro) ligando posição antiga à atual, em vez de mover a parede existente.
Status: Ativo — validado só no caso simples (2 elementos se tocando)
DEC-17  Rastro automático em topologias de 3+ cômodos no mesmo canto
Sessão: 2
Contexto: Consequência da DEC-16.
Decisão: Comportamento inesperado observado (arrasta parede diferente da selecionada). Escopo ainda não decidido ao fim da sessão.
Status: Pendente
DEC-18  Navegação de câmera estilo Blender
Sessão: 2
Contexto: Precisava de deslocamento livre da câmera além de girar.
Decisão: Botão direito/meio + arrastar gira; com Shift segurado, desloca livremente. Scroll continua fazendo zoom.
Alternativas descartadas:
    • Shift + scroll para deslocar (abandonada — só um eixo de movimento por vez)
Status: Ativo
DEC-19  Acabamento por face (finishA/finishB) substitui cor única por parede
Sessão: 3
Contexto: Pedido de produto: catálogo de materiais próprio para a Fase 1.
Decisão: Parede vira caixa de referência invisível (opacity 0, sem depth write), com preenchimento translúcido só quando selecionada. Cada face (A/B) pintável independentemente via Store.commands.setWallFinishFace.
Status: Ativo
DEC-20  Catálogo fictício no formato do SDK real
Sessão: 3
Contexto: Precisava de dados de teste sem comprometer a estrutura futura.
Decisão: Marca de teste "Vórtice Materiais", id = fabricante.categoria.nome, campos assets.colorHex (usado hoje) e assets.textureUrl (gancho para depois) — evolui para o catálogo real da Fase 4 sem trocar estrutura.
Status: Ativo
DEC-21  Canto de 2 paredes: regra de rotação (direita de quem chega, esquerda de quem sai)
Sessão: 3
Contexto: Faces de cores diferentes expuseram a sobreposição de canto herdada da DEC-12; 4 tentativas até a solução definitiva.
Decisão: Regra baseada em rotação, não distância: o lado direito de quem chega no canto sempre encontra o lado esquerdo de quem sai. Nunca empata, validado em múltiplos ângulos (90°, 45°, sala fechada de 4 paredes, dados reais).
Alternativas descartadas:
    • Só uma parede estica por canto (deixava buraco real quando a parede virou face fina, sem volume)
    • Interseção de reta por face, escolhida por distância mais próxima (empata sempre em canto de 90°, resultado imprevisível)
Status: Ativo
DEC-22  Tampa de ponta de parede passa a ser condicional
Sessão: 3
Contexto: Consequência da DEC-21 — canto fechando sem sobreposição de volume.
Decisão: Tampa só é desenhada em ponta livre ou na parede que efetivamente estica para preencher o canto — evita faixas finas visíveis por redundância dentro do volume da vizinha.
Status: Ativo
DEC-23  Junção em T disfarçada de 3 vias: extensão até face próxima
Sessão: 3
Contexto: Padrão comum após fusão/redimensionamento: 3 paredes convergem, 2 delas são uma reta contínua dividida.
Decisão: Detecta por direções opostas exatas; a terceira parede avança só até a face mais próxima da reta contínua, nunca a ultrapassa.
Alternativas descartadas:
    • Interseção de reta por face contra o pedaço certo da reta dividida — implementada, testada, e descartada por dar resultado idêntico e mais complexo (documentado para não repetir o retrabalho)
Status: Ativo
DEC-24  Fusão de cômodos em loop, busca contra todo o modelo
Sessão: 3
Contexto: Cômodo espremido entre 2 vizinhos só fundia de um lado; busca restrita ao grupo não enxergava um par específico de paredes.
Decisão: Fusão roda em loop até não sobrar candidato; busca agora contra todas as paredes do modelo (não só as de fora do grupo); só dispara com movimento real (>0,5 unidade), evitando fusão acidental num clique de seleção.
Status: Ativo
DEC-25  Parede degenerada (comprimento zero) descartada na origem
Sessão: 3
Contexto: Parede com x1=x2, y1=y2 sobrando de corte/fusão anterior.
Decisão: fuseOverlappingWalls descarta pedaços cortados abaixo de 1 unidade; comando Store.commands.pruneDegenerateWalls() disponível para limpeza pontual do que já existir.
Status: Ativo
DEC-26  Piso alinhado à face real da parede (não ao eixo)
Sessão: 3
Contexto: Piso sempre usou room.points (cruzamento do eixo das paredes), ficando meia-espessura curto da face real.
Decisão: Piso recalculado usando a face real (A ou B) voltada para dentro do cômodo, mesma matemática de computeWallFootprints. Espessura fixada em 30 mm; base no mesmo yOffset da parede em qualquer pavimento.
Status: Ativo
DEC-27  Z-fighting resolvido na origem (depth buffer logarítmico)
Sessão: 3
Contexto: Efeito visual de "faces duplicadas"/frestas persistiu por dezenas de mensagens; 3 hipóteses testadas e descartadas antes da causa real.
Decisão: polygonOffset aplicado no piso (mesma técnica já usada entre paredes) + logarithmicDepthBuffer: true no WebGLRenderer — resolve a precisão de profundidade em qualquer distância de câmera, sem deslocamentos artesanais pontuais.
Alternativas descartadas:
    • Sobreposição de volume no canto (parcialmente relevante, mas não a causa remanescente)
    • Ilusão de ótica em ângulo raso (explicava só parte dos casos)
    • Gap real entre parede e piso / junção em T (números sempre fechavam em zero — descartada)
Status: Ativo
DEC-28  Girar parede restrito a 90° por vez
Sessão: 2–3
Contexto: Era 15° originalmente.
Decisão: Mantido em 90°: ângulo livre quebraria a premissa de eixo-alinhado que toda a matemática de canto (DEC-21, DEC-23) assume.
DEC-29  Garagem/Lavanderia/Escritório sem móveis no MVP
Sessão: 4
Contexto: Preenchimento automático de móveis (ROOM_DEFAULT_FURNITURE) já cobre Quarto, Sala, Cozinha e Banheiro, cada um com peças testadas e calibradas na 3D.
Decisão: Garagem, Lavanderia e Escritório ficam sem catálogo de móveis nesta fase — mobiliário real desses ambientes (vaga, portão, tanque, estante etc.) só entra quando as lojas parceiras integrarem suas bibliotecas BIM/catálogo à plataforma. MVP segue só com os quatro exemplos calibrados.
Status: Ativo
Pendências e limitações conhecidas
    • Rastro automático em topologias de 3+ cômodos convergindo no mesmo canto — comportamento inesperado, escopo não decidido (ver DEC-17).
    • Porta, Janela, Escada e Varanda — sem nenhuma implementação, só botão visual desabilitado na barra lateral.
    • Cotas (mostrar/editar medida de parede já existente fora do momento de colocação) não portadas para a vista unificada.
    • Arrastar o corpo de uma parede já existente não avisa paredes vizinhas que compartilhavam o canto.
    • Corner de 3+ paredes sem nenhum par colinear (convergência genuína, não disfarçada de T) — só uma parede "vence" e estica; não resolvido.
    • Piso interior/exterior verdadeiro — face A/B são só "os dois lados", sem significado arquitetônico ainda.
    • Marco (vazado sem produto aplicado, ponta de parede livre, topo no encontro com o telhado) — conceito decidido em conversa, ainda não implementado.
    • Atualizar o Índice Mestre para incluir o CAW e refletir as fusões de documentos já concluídas.
    • Aplicar no Documento de Arquitetura a mesma troca "Motor Financeiro" → Budget Engine já feita na Atualização v2.1 do Domínio.
Ferramentas de depuração disponíveis
Deixadas no protótipo de propósito, úteis para investigações futuras direto do console do navegador:

Ferramenta	Uso
window.__DEBUG__ = { Core, Store }	Acesso direto ao modelo/comandos pelo console do navegador.
Modo "Cor por ID" (checkbox Debug)	Cada face/piso ganha cor derivada de hash do id — sobreposições ficam visíveis.
Clique com debug ligado	Mostra o id da entidade selecionada na barra de dica.
dumpWallFace(wallId)	Lista os vértices reais da malha 3D de uma parede, direto da cena.
listRoomKeys() / dumpRoomFloor(roomKey)	Mesmo princípio, para o piso (em espaço de mundo).
Store.commands.pruneDegenerateWalls()	Remove paredes de comprimento zero existentes no modelo.
Checkbox "Esconder chão/grade"	Isola a estrutura das paredes para inspeção visual.
Isola a estrutura das paredes para inspeção visual.