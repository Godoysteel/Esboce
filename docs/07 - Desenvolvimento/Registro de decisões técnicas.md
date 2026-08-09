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
Decisões (30)
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
DEC-30  Rebuild completo aceito no MVP, mas novas features devem evitar acoplamento que dificulte migração futura pra grafo de dependências
Sessão: 4
Contexto: Pesquisa comparativa (Sweet Home 3D, Blender, FreeCAD) sobre como ferramentas 3D interativas lidam com atualização de cena em modelos grandes. FreeCAD resolve isso com um grafo de dependências real entre objetos (App::Document, recompute() topológico) — a referência mais próxima da filosofia "Objetos Paramétricos" já adotada no Domínio. Blender e Sweet Home 3D usam padrões mais simples (snapshot completo / listener por objeto). O Esboce hoje reconstrói a cena inteira a cada mudança (Scene3DRenderer.rebuild()) — aceitável na escala atual (poucos cômodos), mas não escalável indefinidamente.
Decisão: Não adotar grafo de dependências agora — mesmo o FreeCAD levou anos pra chegar nesse ponto, e a otimização parcial só vale a pena quando há dor real medida, não hipotética (ver conversa sobre performance). Porém, dependências entre entidades introduzidas por features novas (ex.: um objeto cuja geometria depende de outro) devem ser mantidas explícitas e localizadas — evitar que o cálculo de uma entidade fique espalhado/misturado com o de outra sem necessidade, mesmo enquanto tudo continua sendo recalculado junto. Isso mantém a porta aberta para migrar por partes no futuro (como fizemos com o rodapé, cache de textura e o snap incremental — mudanças locais, uma de cada vez), em vez de exigir uma reescrita grande e arriscada de uma só vez.
Alternativas descartadas:
    • Implementar grafo de dependências completo agora, antecipando a escala futura (rejeitada — otimização prematura; o próprio FreeCAD só amadureceu essa parte com o tempo, não desde o início)
Status: Ativo — princípio orientador pra desenvolvimento futuro, não uma mudança de código
DEC-31  Platibanda: caimento sutil, cor/textura igual às paredes, altura ajustável
Sessão: 5
Contexto: Platibanda nasceu (DEC-04) como laje 100% plana + parapeito de altura fixa (0,5 m) numa cor bege fixa (GABLE_COLOR, sem textura nenhuma), destoando de qualquer casa pintada com outra cor e sem nenhum indício visual de escoamento de água.
Decisão: (1) A laje ganha um caimento sutil (2°, o mínimo usual pra laje impermeabilizada escoar) na direção do ridgeAxis do telhado — mesma técnica (extrudeSlopeDown) já usada nas águas de verdade; o botão de girar existente (rotateRoofAxis) agora também troca a direção do caimento. (2) O parapeito passa a usar a MESMA textura de reboco PBR das paredes de verdade (getWallPlasterMaps, com repeat ajustado por segmento) em vez de material liso sem mapa, e a cor por padrão acompanha o acabamento de tinta predominante já escolhido nas paredes do pavimento (computeWallMatchColor), caindo em GABLE_COLOR só quando nenhuma parede tem acabamento escolhido — o mesmo default que as próprias paredes usam. (3) Roof ganha o campo parapetHeight (padrão 0,5 m, 0,2–1,2 m), com alça 3D própria (handle 'roofParapetHeight') no lugar da alça de cumeeira quando type === 'platibanda', comandos setRoofParapetHeight/updateRoofParapetHeightLive (mesmo padrão de setRoofPitch/updateRoofPitchLive) e propagação em duplicateRoof.
Alternativas descartadas:
    • Cor fixa configurável só por um seletor dedicado de acabamento do parapeito (rejeitada por ora — mais UI nova pra manter; herdar da parede já resolve o caso comum sem exigir escolha extra da pessoa; pode virar um campo próprio (ex.: parapetFinishId) no futuro se o auto-match não bastar)
    • Caimento mais acentuado (5°+, mais realista pra chuva forte) — descartado por exigir parapeito mais alto por padrão pra não deixar a laje aparecer por cima; 2° já basta pra dar leitura visual de "não é plano" sem forçar outras mudanças
Status: Ativo
DEC-35  Laje vira objeto colocável de verdade — não é mais automática entre pavimentos
Sessão: 6
Contexto: Antes, a laje entre dois pavimentos era gerada automaticamente (um retângulo único cobrindo o contorno de parede+coluna do andar de baixo, sem textura — cor lisa cinza), sem nenhuma intervenção da pessoa e sem relação nenhuma com varanda (que fica de fora do contorno de parede, então nunca tinha cobertura própria — telhado, inclusive, também não conseguia ser colocado sobre ela, já que a ferramenta Telhado só reconhece cômodo fechado por parede). Pedido explícito: laje deixa de ser automática, vira objeto independente (mesmo status de telhado/varanda) — a pessoa coloca, redimensiona (inclusive além da parede, pra criar balanço/sacada, ou aquém dela, pra deixar um vão aberto), e o pavimento de cima só pode ganhar parede/cômodo depois que essa laje existir.
Decisão: (1) Nova entidade Laje (Floor.lajes), independente — x1..y2 sem relação obrigatória com parede nenhuma, mesmo padrão de Roof/Varanda. (2) Botão "Laje" na barra lateral (grupo Cobertura, ao lado de Telhado/Varanda) — clique único cria uma laje cobrindo o contorno de parede+varanda do pavimento atual (ponto de partida sensato, não uma trava); arraste livre nas 4 bordas depois, sem travar em nenhum contorno (Core.lajesCanFuse/updateLajeBoundsLive não conhecem parede nenhuma) — dá pra encolher (vão aberto, ex.: poço de escada) ou crescer além da parede (balanço/sacada). (3) Fusão ao encostar duas lajes do mesmo pavimento — mesma técnica de fuseRoofsIfTouching, mas mais permissiva (Core.lajesCanFuse só olha se encostam; laje não tem "tipo" nem inclinação que precisem bater). (4) Textura: MESMA textura de reboco das paredes (reaproveita buildParapetSegmentMaterial, já usado no parapeito da platibanda — DEC-31) em vez da cor lisa cinza de antes. (5) Renderização deixa de ser condicionada a floorIdx>0: cada pavimento renderiza as PRÓPRIAS lajes (Floor.lajes), na altura do topo das próprias paredes — o que também resolve "laje sobre o pavimento superior" (cobertura plana, alternativa ao telhado) sem precisar de nenhum caso especial, já que é o MESMO mecanismo em qualquer andar, inclusive o último. (6) Trava de fluxo: parede/cômodo (não telhado/varanda/laje — esses continuam sempre livres) num pavimento N>0 só é permitido depois que o pavimento N-1 tem pelo menos uma laje — checado no clique do botão da ferramenta/preset (requireLajeBelowOrHint), com mensagem explicando o que falta.
Alternativas descartadas:
    • Continuar com a laje automática, só trocando a textura — não resolveria o pedido central (colocar/redimensionar manualmente, cobrir varanda, criar balanço).
    • Travar a criação do PAVIMENTO em si até ter laje no de baixo — rejeitada: a pessoa precisa conseguir entrar no pavimento novo pra colocar a laje nele antes de mais nada; a trava certa é em parede/cômodo, não no pavimento.
    • Aplicar a mesma trava em telhado/varanda — rejeitada: telhado e varanda não dependem estruturalmente de laje nenhuma (telhado é cobertura, varanda é térrea por natureza); só parede/cômodo (que citam "chão" implícito) precisam da trava.
Status: Ativo
Correção pós-lançamento (mesma sessão): três bugs reportados logo depois de testar. (1) pickMesh (ViewportController) excluía TODA malha de categoria 'laje' do hit-test — herdado de quando 'laje' era só a superfície automática antiga (piso/soleira continuam usando essa mesma tag visual); a Laje de VERDADE (objeto colocável) ficou impossível de selecionar ou excluir depois de colocada. Corrigido: exclusão passa a valer só pra malha SEM lajeId marcado (piso/soleira), a Laje de verdade (com lajeId) agora entra no hit-test normalmente. (2) O retângulo padrão ao clicar "Laje" usava o EIXO da parede (w.x1/y1/x2/y2), não a face — a lateral da laje ficava cortando por dentro da parede ou deixando metade da espessura dela de fora. Corrigido: expande o contorno pela meia-espessura da parede (paredes são sempre 0°/90°, DEC-28, então dá pra fazer isso sem calcular footprint face a face). (3) Clicar em "Laje" de novo com uma já existente no pavimento criava uma segunda laje EXATAMENTE sobreposta à primeira, sem fundir (a fusão só rodava ao soltar arraste de borda, nunca na criação). Corrigido: chama a mesma checagem de fusão (fuseLajesIfTouching) logo depois de criar.
DEC-36  Removido o formato curvo (topo em arco) de abertura — vão sempre reto
Sessão: 6
Contexto: Opening.shape (OpeningShape: 'reta' | 'arco') existia desde o início como reserva pra um formato de topo curvo, pensado pra Fase 2 — mas a geometria nunca foi implementada no renderer, e todo Opening sempre nascia com shape 'reta' (o valor 'arco' nunca era realmente atribuído em lugar nenhum do código). Decisão explícita: aberturas nunca terão topo em arco/raio — só reto.
Decisão: Campo Opening.shape e o tipo OpeningShape removidos por completo do modelo (types.ts, Core.createOpeningEntity). Confirmado por busca no código inteiro que nenhum outro lugar lia esse campo — era 100% morto, só write sem nenhum read, então a remoção não teve nenhum efeito colateral (0 erros de tipo, 50/50 testes). Não confundir com OpeningKind 'arco', que continua existindo — é um TIPO de abertura (vão livre, sem porta/janela instalada), sem nenhuma relação com o formato do topo; um Opening kind='arco' agora é, e sempre foi na prática, um vão reto.
Alternativas descartadas:
    • Só deixar de usar o valor 'arco' de OpeningShape sem remover o campo/tipo — rejeitada: manter um campo e um tipo inteiro no ar só pra um único valor possível ('reta') não tem função nenhuma, é dívida técnica sem propósito.
Status: Ativo
DEC-38  Toolbar compactada (fase 1 do redesign visual) — sem overflow horizontal, ações secundárias num menu "⋯"

Nota: DEC-32/33/34 e DEC-37 não têm entrada nesta lista apesar de referenciados no CHANGELOG — lacuna de documentação pré-existente a esta sessão (decisões registradas só no CHANGELOG, sem a entrada correspondente aqui). Não preenchidas retroativamente agora pra não misturar reconstrução histórica com esta mudança; numeração desta entrada pula direto pra 38 pra não colidir com a referência já existente a DEC-37.
Sessão: 7
Contexto: A toolbar tinha 15 botões numa fileira só (floor tabs, +Novo pavimento, Limpar pavimento atual, Desfazer, Grid, Materiais, Cotas, Diagnóstico, Novo projeto, Salvar, Compartilhar, Meus projetos, Catálogo, Entrar/Sair), estourando a largura em telas comuns e exigindo scroll horizontal pra acessar qualquer botão da direita. Pedido explícito: usar duas telas de referência (mockup) como alvo visual — toolbar compacta (logo, seletor de pavimento, undo/redo, status, Salvar, Compartilhar, Meus projetos, avatar) e sidebar dividido em Construir/Produtos, entre outras mudanças maiores (catálogo migrado do overlay pra dentro do sidebar, barra inferior com toggles, painel de visualização 3D/2D/Orbit/Medir). Escopo grande demais pra uma tacada só — dividido em fases; esta decisão cobre só a fase 1 (toolbar).
Decisão: (1) Toolbar reorganizada visualmente em grupos: marca | seletor de pavimento (+ "+ Pavimento") | divisor | undo/redo (ícone) | espaçador flexível | Salvar (destacado, roxo) / Compartilhar / Meus projetos | menu "⋯" | avatar de conta. (2) Botões que nas referências passam a morar no sidebar (Materiais, Catálogo) ou na barra inferior (Grid, Cotas) — ainda não construídos nas próximas fases — foram movidos por ora pro menu "⋯", junto com Limpar pavimento atual, Novo projeto e Diagnóstico (dev-only, oculto), pra nenhuma funcionalidade sumir enquanto as fases 2–4 não rodam. (3) Botão "Refazer" (↷) adicionado visualmente (a referência mostra os dois ícones lado a lado) mas fica sempre desabilitado — o Store só tem pilha de undo (pop, sem redo stack de verdade); implementar redo de fato é uma feature própria, fora do escopo desta fase. (4) accountBtn/logoutBtn viram um avatar circular com iniciais (2 primeiras letras do e-mail, já que não há nome de perfil carregado no login hoje — ver ProfileFields.nome, capturado no cadastro mas não persistido em memória depois de logar) + botão de sair só-ícone, em vez do botão de texto completo. (5) `.top-overlay` deixa de ter overflow-x/white-space fixos — só reaparecem via media query abaixo de 760px, como rede de segurança, não como comportamento padrão.
Alternativas descartadas:
    • Implementar redo de verdade (pilha dupla undo/redo no Store) junto com essa mudança — descartada por ora: é uma mudança de modelo de dados (Store.ts), não só de UI, e a fase 1 é sobre reorganizar toolbar existente; entra como pendência.
    • Mover Grid/Cotas/Materiais/Catálogo direto pros destinos finais (barra inferior/sidebar) nesta mesma fase — descartada: esses destinos ainda não existem (fases 2–4), colocar os botões lá exigiria construir a barra inferior/sidebar inteiros junto, misturando o escopo das fases.
Status: Ativo — fase 1 de 4 do redesign (toolbar). Fases seguintes: 2) sidebar Construir/Produtos + painel de visualização; 3) barra inferior (Grid/Cotas/Ajustes/Visualização + Área/Paredes + zoom); 4) catálogo migrado do overlay pro sidebar.
Revisão (mesma sessão): pedido explícito de trocar Salvar/Compartilhar/Meus projetos/Novo projeto/Limpar pavimento atual — que na v1 desta fase ficavam soltos na toolbar (Salvar em destaque) ou dentro do menu "⋯" — por um menu "📁 Arquivo" próprio, empilhado, inspirado no menu Arquivo do SketchUp (botão único no canto esquerdo, ao lado da marca; clique abre a lista por cima do resto da barra). Critério de separação: "Arquivo" reúne o CICLO DE VIDA DO PROJETO (novo, salvar, compartilhar, listar, limpar); o menu "⋯" continua só com ações de visualização/produto (Grid, Cotas, Materiais, Catálogo, Diagnóstico) — os dois menus se fecham um ao outro ao abrir (nunca os dois abertos juntos). "Salvar" deixa de ser um botão roxo em destaque na barra e passa a ser só mais um item de lista dentro do menu — o feedback textual dele (Salvando.../✅ Salvo/⚠️ Falhou) continua funcionando do mesmo jeito, só que agora dentro do item do menu, e o menu fecha no clique (quem quiser ver o feedback de novo abre e roda outra vez — trade-off aceito pela simplicidade, mesma lógica dos outros itens do menu).
2ª revisão (mesma sessão): pedido explícito de remover o cabeçalho como faixa contínua — toda a UI deve flutuar direto sobre a viewport 3D, sem uma barra de fundo sólido separando "topo" do "resto da tela". `.top-overlay` perdeu fundo/borda/sombra/blur próprios e virou só um CONTAINER de layout (flex row invisível, `pointer-events: none`); cada grupo (marca, Arquivo, pavimento, undo/redo, "⋯", conta) virou uma "ilha" independente (classe `.tb-pill`, com o visual — fundo/blur/borda/sombra — que antes era só da barra inteira), com `pointer-events: auto` restaurado nos filhos diretos do container pra cada ilha continuar clicável mesmo com o container "vazado". O vão transparente entre ilhas deixa orbitar/arrastar a câmera 3D por baixo normalmente. O divisor vertical (│) entre pavimento e undo/redo foi removido — não fazia sentido flutuando sozinho no vão transparente entre duas ilhas já visualmente separadas. `--top-overlay-h` continua sendo medido do `.top-overlay` inteiro (offsetHeight da linha), então os painéis que dependem dessa variável pra não sobrepor o topo (tool-picker, navGizmo, sidebar) não precisaram de nenhum ajuste.
3ª revisão (mesma sessão): mesmo com as ilhas, a fileira ainda ficava larga demais e caía no fallback de scroll horizontal (`overflow-x: auto` abaixo de 760px) — visualmente feio, pedido explícito pra eliminar. (1) Marca perdeu o texto "Esboce"/tagline na barra — só o ícone permanece (título "Esboce" no atributo `title` da pill, pra acessibilidade). (2) Botão "Arquivo" perdeu o rótulo de texto — só ícone + seta (mesmo padrão visual dos outros botões só-ícone da barra: undo/redo, "⋯", avatar). (3) Seletor de pavimento deixou de ser DUAS pills (lista de abas sempre visível + "+ Pavimento" separado) e virou UMA pill-gatilho ("Térreo ▾", rótulo dinâmico via `FloorTabsController` — novo `labelEl`/`#floorMenuLabel`), com a lista de andares E o "+ Novo pavimento" dentro do menu suspenso — também resolve de raiz um problema que ia aparecer mais cedo ou tarde: a lista de abas sempre visível cresceria sem limite conforme mais pavimentos fossem criados. (4) `.top-overlay` trocou `overflow-x: auto` (scroll) por `flex-wrap: wrap` como comportamento padrão (não só abaixo de 760px) — em telas muito estreitas as pills quebram pra uma segunda linha em vez de exigir scroll horizontal; com as pills agora bem menores, isso deve ser raro na prática.
DEC-39  Fase 2 do redesign: sidebar dividido em Construir/Produtos + painel de visualização (3D/2D/Orbit/Medir)
Sessão: 7
Contexto: Sequência da DEC-38 — fase 2 do plano de 4 fases (toolbar → sidebar → barra inferior → catálogo). Referência visual: sidebar da imagem de mockup dividido em duas seções rotuladas ("Construir" com Parede/Cômodos/Portas/Janelas/Cobertura; "Produtos" com catálogo e categorias de material) e um painel flutuante no canto direito com 4 botões de modo de visualização (3D/2D/Orbit/Medir).
Decisão: (1) `#toolSidebar` ganhou dois rótulos de SUPERGRUPO (`.ts-supergroup-label`, visualmente mais fortes que `.ts-group-label`) — "Construir" no topo, cobrindo os grupos já existentes Cômodos/Cobertura/Aberturas, e o grupo "Avançado" (Parede livre, Cômodo livre, Coluna, Quebrar parede, Pintar) — que antes vinha depois de Acabamentos/Mobiliário — foi movido pra dentro de "Construir", logo após Aberturas, por ser claramente uma ferramenta estrutural, não um produto. "Produtos" cobre um grupo NOVO ("Catálogo", com os botões 🏬 Catálogo e 📦 Materiais) seguido dos grupos já existentes Acabamentos e Mobiliário (ambos ainda 100% "em breve" — nenhum produto de verdade neles, só placeholder). (2) Os botões "Catálogo" (`catalogBtn`) e "Materiais" (`materialsToggleBtn`) — que na fase 1 moravam dentro do menu "⋯" da toolbar — foram MOVIDOS (mesmos ids, sem duplicar, sem precisar tocar no JS que já escuta esses ids em EsboceApplication.ts e MaterialsPanel.ts) pro novo grupo "Catálogo" do sidebar, restilizados como `.ts-btn` (ícone + label, mesmo padrão visual do resto do sidebar) em vez do item de lista de texto que eram no menu. O menu "⋯" da toolbar fica só com Grid/Cotas/Diagnóstico. (3) Painel de visualização novo (`.tb-viewmode-panel`), canto direito, abaixo da casinha de orientação (navGizmoCanvas) — 4 botões empilhados: "3D" (sempre marcado ativo — é o único modo que o motor tem), "2D" (desabilitado, "em breve" — trocar a câmera pra ortográfica de cima é feature nova, fora do escopo desta fase), "Orbit" (funcional de verdade: `ViewportController.resetCamera()`, nova função que volta ângulo/distância/alvo da câmera pro enquadramento padrão — não é uma troca de MODO de navegação, já que orbitar com botão direito+arraste sempre esteve disponível a qualquer momento; é só um "recentralizar"), "Medir" (desabilitado, "em breve" — ferramenta de medição por clique não existe no motor ainda). Os dois botões desabilitados seguem o MESMO padrão já usado pros outros "em breve" do sidebar (Escada, Piso, Revestimento, Iluminação, Móveis) — desabilitados de verdade com tooltip explicando, não botões fingindo funcionar.
Alternativas descartadas:
    • Implementar troca de câmera pra ortográfica (2D) e uma ferramenta de medir de verdade nesta mesma fase — descartada por ora: são duas features novas de interação (não só UI), cada uma merece sua própria decisão de escopo/UX; entram como pendência.
    • Deixar "Catálogo"/"Materiais" duplicados (um botão no sidebar, outro ainda no menu "⋯") "pra não quebrar o hábito" — descartada: duplicar ação em dois lugares diferentes da UI é confuso, e mover (não duplicar) já foi possível sem custo nenhum de JS por reaproveitar os mesmos ids.
Status: Ativo — fase 2 de 4 do redesign. Fases seguintes: 3) barra inferior (Grid/Cotas/Ajustes/Visualização + Área/Paredes + zoom); 4) catálogo migrado do overlay pro sidebar (ainda abre como overlay full-screen ao clicar em "Catálogo" — só o BOTÃO de entrada mudou de lugar nesta fase, o modal em si é tarefa da fase 4).
Pendências e limitações conhecidas
    • Laje: textura de reboco aplicada de forma uniforme na caixa inteira (topo/fundo/lados usam o mesmo material, calculado pro tamanho das bordas) — face de topo/fundo pode ficar com a textura meio esticada em lajes muito grandes; aceito como a mesma simplificação já usada no parapeito da platibanda (ver DEC-31).
    • Trava de parede/cômodo sem laje (DEC-35) checa só no clique do botão da ferramenta — se a pessoa já estiver com a ferramenta ativa e a laje for excluída durante o desenho, a trava não interrompe no meio do gesto.
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