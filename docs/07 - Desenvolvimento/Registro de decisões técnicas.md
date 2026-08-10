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
DEC-40  Fase 3 do redesign: barra inferior (Grid/Cotas/Ajustes/Visualização + estatísticas + zoom), remove a antiga faixa de ações e o menu "⋯" da toolbar
Sessão: 7
Contexto: Sequência da DEC-38/DEC-39 — fase 3 do plano de 4 fases. Referência visual: barra inferior com toggles (Grid/Cotas/Ajustes/Visualização), um card de estatísticas (Área do pavimento/Paredes) e um controle de zoom (−/100%/+/expandir). No caminho, achei duas coisas que já não faziam sentido: `.actions-row` — uma faixa escura contínua full-width (o MESMO padrão que já tínhamos eliminado do topo na DEC-38) com um texto estático que duplicava a dica dinâmica de `.viewport-hint` (TOOL_HINTS) sem nunca ter sido atualizada por código nenhum; e o menu "⋯" da toolbar, que ficaria com só um item visível (Diagnóstico, dev-only, sempre `hidden`) depois que Grid/Cotas saíssem — um menu que abre e mostra nada não serve pra ninguém.
Decisão: (1) `.actions-row` removida por completo (não só reestilizada) — texto estático redundante, sem função. (2) Nova `.bottom-bar`, mesmo princípio de ilhas flutuantes da DEC-38 (container transparente, `pointer-events:none`, pills com `pointer-events:auto`) — à esquerda um grupo de toggles (Grid/Cotas/Ajustes/Visualização), à direita a pill de estatísticas (Paredes/Área/Telhado — migrada de `#viewportStats`, que antes vivia solta dentro de `#viewport`; mesmos ids, `ViewportStats.ts` não mudou nada) e a pill de zoom. (3) Grid (`gridToggleBtn`) e Cotas (`dimensionsToggleBtn`) MIGRARAM do extinto menu "⋯" pra cá — mesmos ids, sem duplicar, comportamento idêntico (toggle + classe `.active`). (4) "Ajustes" — nada de configurações gerais existe no app hoje pra abrir; fica desabilitado com aviso "em breve", mesmo padrão dos outros placeholders (Escada, Piso, 2D, Medir etc.), em vez de um botão fingindo funcionar. (5) "Visualização" (`layersToggleBtn`) — reaproveita de VERDADE o menu de camadas que já existia (fundação/calçada/paredes/telhado/varanda etc, `#layersContextMenu`/`LayersPanel.ts`), até então só acessível por clique direito em área vazia, sem nenhum jeito descobrível de achar. Nova função exportada `ViewportController.toggleLayersMenuAtElement(anchor)` abre/fecha o MESMO menu, posicionado a partir do botão. (6) Zoom (−/100%/+) — três funções novas em `ViewportController` (`zoomIn`, `zoomOut`, `getZoomPercent`), usando `camDist` (a distância da câmera já existente) mapeada numa convenção própria: `camDist` igual ao padrão de `resetCamera` (13) = "100%"; menos distância = zoom maior = percentual maior. `setOnZoomChanged(cb)` dispara a cada `updateCam()` (arraste, roda do mouse, pinch OU clique nos botões — todos passam pela mesma função), então o rótulo acompanha em tempo real mesmo quando o zoom muda por gesto direto no viewport, não só pelos botões novos. (7) "⤢" (expandir) — Fullscreen API padrão do navegador (`requestFullscreen`/`exitFullscreen`), com fallback silencioso (só loga) se o navegador recusar. (8) Menu "⋯" (`moreToolsBtn`/`moreToolsMenu`) removido inteiro da toolbar — `#wallDiagnosticsToggleBtn` (dev-only, permanece sempre `hidden`, nunca teve um jeito de tirar esse hidden pela própria UI) continua existindo solto no DOM só pra `requireElement` não quebrar; sem pill/menu visível em volta, já que ninguém enxerga esse botão mesmo.
Alternativas descartadas:
    • Manter `.actions-row` só com fundo mais claro/pill, sem remover — descartada: o texto era 100% estático e redundante com `.viewport-hint`, que já é dinâmico e cobre o mesmo caso de uso; manter os dois é confuso, um deles tinha que sumir, e o estático foi o escolhido por não ter nenhuma lógica própria.
    • Deixar "Ajustes" e "Visualização" como um único botão combinado (já que "Ajustes" não faz nada ainda) — descartada: a referência visual mostra os dois separados, e colapsar agora só pra desfazer depois (quando Ajustes ganhar conteúdo de verdade) é retrabalho sem necessidade.
    • Calcular o "100%" do zoom a partir de MIN_DIST/MAX_DIST (ex.: percentual da faixa navegável) em vez de uma distância de referência fixa — descartada: a faixa MIN/MAX existe pra limitar o quanto dá pra afastar/aproximar, não representa "zoom padrão"; usar o mesmo valor de `resetCamera` (13) como "100%" mantém os dois conceitos (resetar câmera e zoom 100%) coerentes entre si.
Status: Ativo — fase 3 de 4 do redesign. Fase seguinte: 4) catálogo migrado do overlay pro sidebar (o botão de entrada já mora no sidebar desde a fase 2 — falta só o CONTEÚDO deixar de abrir como overlay full-screen e virar parte do painel lateral).
DEC-41  Fase 4 do redesign: catálogo deixa de ser modal centralizado com fundo escuro, vira painel ancorado ao lado do sidebar; CTA "+ Adicionar produto" separado da navegação
Sessão: 8
Contexto: Última fase do plano de 4 (toolbar → sidebar → barra inferior → catálogo). O botão de entrada ("🏬 Catálogo") já morava no sidebar desde a DEC-39 (fase 2) — faltava o CONTEÚDO em si: `#catalogOverlay` ainda era `position:fixed; inset:0` com fundo escuro (`rgba(44,44,42,0.6)`) cobrindo a tela inteira e um modal centralizado de até 920×720px — o único lugar do app que ainda usava esse padrão "modal bloqueia tudo", contrariando o princípio de ilhas flutuantes já estabelecido pro resto da UI desde a DEC-38. Depois de uma primeira entrega desta fase, pedido explícito de revisão: a referência original (mockup) tinha um "+ Adicionar produto" em destaque, SEPARADO dos itens de navegação (Catálogo/Todos os produtos) — o sidebar só tinha "Catálogo"/"Materiais" lado a lado, sem esse CTA distinto.
Decisão: (1) `#catalogOverlay` trocou de modal centralizado (fixed+backdrop) pra painel ANCORADO ao lado do `.tool-sidebar` — mesma referência de posição (`left: 104px` = 10 do sidebar + 84 de largura + 10 de vão; `top`/`bottom` iguais ao sidebar), largura `min(400px, calc(100vw - 124px))`, SEM fundo escuro — a viewport 3D continua visível e orbitável à direita do painel enquanto ele está aberto. (2) `.catalog-modal` passou a preencher 100% do novo `#catalogOverlay` em vez de ter dimensões relativas ao viewport inteiro — só isso já resolveu o essencial, SEM tocar a lógica de dados/render (`openCatalog`, `renderCatalogTabs`, `renderCatalogGrid`, `openCatalogDetail`, o fluxo de "🔁 Trocar"). (3) `.catalog-grid` teve as colunas encolhidas (`minmax(190px,1fr)` → `minmax(150px,1fr)`) pra caber melhor num painel de ~400px. (4) Novo botão `#addProductBtn` ("+ Adicionar produto"), classe nova `.ts-btn-cta` (roxo cheio, mesmo formato ícone+label empilhados do resto do sidebar) — inserido ACIMA do grupo "Catálogo" no supergrupo "Produtos", visualmente destacado dos itens de navegação normais. Leva pro MESMO painel que "Catálogo" — não existe hoje um fluxo de "adicionar produto ao projeto" tecnicamente distinto de "navegar o catálogo" (o comentário already no código já dizia: "só navegação por enquanto, 'usar esse material' fica pra uma próxima rodada") — então os dois caminhos convergem pro mesmo destino; a diferença é só de destaque/hierarquia visual, igual a referência (CTA cheio vs. item de lista comum). (5) Botões de entrada do catálogo viraram GAVETA — clicar em qualquer um dos dois (Catálogo OU Adicionar produto) com o painel já aberto FECHA, em vez de recarregar; novo helper `setCatalogEntryButtonsActive(active)` sobe/desce o estado `.active` dos DOIS botões juntos (não importa qual foi clicado, ou se foi o fluxo de "🔁 Trocar"), já que os dois representam o mesmo painel.
Alternativas descartadas:
    • Fazer "+ Adicionar produto" abrir um fluxo/tela DIFERENTE de "Catálogo" (ex.: direto num formulário de cadastro, ou pulando pra tela de departamentos em vez do último departamento visto) — descartada por ora: não existe ainda a peça de "adicionar ao projeto" que justificaria uma jornada distinta; forçar uma diferença de fluxo sem substância real seria só complexidade decorativa. Quando essa peça existir, a decisão de rotas separadas pode ser revisitada.
    • Reduzir o catálogo pra caber DENTRO do próprio `.tool-sidebar` (84px de largura) — descartada: impossível mostrar foto+nome+preço+fabricante de um jeito legível em 84px.
    • Manter o fundo escuro atrás do painel, só encolhendo o modal — descartada: bloquearia clique na viewport à direita do painel, contrariando o resto da UI.
Status: Ativo — fase 4 de 4 do redesign concluída. Com isso as 4 fases planejadas na DEC-38 estão implementadas: toolbar compacta em ilhas flutuantes, sidebar Construir/Produtos + painel de visualização, barra inferior com toggles/estatísticas/zoom, e catálogo como painel ancorado com entrada em dois níveis (CTA + navegação). Pendências que ficaram registradas ao longo do caminho (redo de verdade, câmera 2D ortográfica, ferramenta de medir, painel de "Ajustes", fluxo de "adicionar produto" tecnicamente distinto de "navegar") continuam em aberto pra uma rodada futura, fora deste plano de 4 fases.
Revisão (sessão seguinte, depois de ir pro ar): dois problemas relatados depois da fase 4 aplicada. (1) BUG real de posicionamento — `.bottom-bar` (Grid/Cotas/Ajustes/Visualização) começava em `left:0`, então a primeira pill ficava sobreposta ao rodapé do `.tool-sidebar` (que vai de `left:10px` até `bottom:10px`, os dois terminando perto do fundo da tela). Corrigido: `.bottom-bar` passou a começar em `left:104px` — mesma folga que o painel do catálogo já usava desde a DEC-41 (10 do sidebar + 84 de largura + 10 de vão) — eliminando a sobreposição em qualquer largura de tela (o `.tool-sidebar` não tem override de posição em media query nenhuma, então a folga fixa de 104px é válida sempre). (2) Descoberta ao investigar o relato de "não encontrei o Catálogo/Adicionar produto": não era só o bug do overlap — o sidebar tem MUITO conteúdo antes da seção Produtos (Cômodos 7 itens + Cobertura 3 + Aberturas ~4 + Avançado 6, cada botão `.ts-btn` com ~60-66px de altura), passando de 1000px de conteúdo pra rolar numa coluna de 84px de largura antes de chegar em Produtos — inviável de ver sem rolar bastante na maioria das telas. Pedido explícito de resolver: ordem dos supergrupos invertida — "Produtos" (CTA Adicionar produto, Catálogo, Materiais, Acabamentos, Mobiliário) agora vem PRIMEIRO no sidebar, "Construir" (Cômodos, Cobertura, Aberturas, Avançado) depois. Reordenação pura de blocos HTML (os dois blocos internos inteiros trocaram de posição, mantendo tudo dentro de cada um intacto) — nenhum id, listener ou CSS precisou mudar; `.ts-supergroup-label:first-child` (que remove a borda superior do primeiro supergrupo) passou a se aplicar a "Produtos" automaticamente, por ser seletor de posição no DOM, não algo craniado por nome.
Alternativas descartadas (revisão):
    • Manter a ordem Construir→Produtos e só adicionar um atalho/âncora que rola até Produtos — descartada: opção oferecida, mas a pessoa preferiu resolver na raiz (ordem), não mascarar com um atalho.
    • Deixar como estava, só corrigindo o overlap — descartada pelo mesmo motivo: o overlap era só metade do problema; sem a reordenação, Produtos continuaria de difícil acesso mesmo sem sobreposição visual.
2ª correção (mesma revisão, achada por print de tela): "CONSTRUIR"/"PRODUTOS" apareciam cortados ("CONSTRU") no rótulo de supergrupo. Causa: `.tool-sidebar` tem `overflow-y: auto` sem `overflow-x` definido — por regra do spec do CSS, quando só um eixo tem overflow diferente de `visible`, o outro eixo É FORÇADO a computar como `auto` também (não fica `visible`). Como "CONSTRUIR"/"PRODUTOS" são palavras únicas (sem espaço pra quebrar linha) mais largas que os ~68px disponíveis, e o eixo X passou a cortar (`auto`) em vez de deixar transbordar visivelmente, o final da palavra ficava inacessível sem rolar horizontalmente — o que ninguém faria numa coluna de 84px. Corrigido com `overflow-wrap: break-word; word-break: break-word;` em `.ts-supergroup-label` e `.ts-group-label` (pra qualquer rótulo futuro correr o mesmo risco também ficar protegido) — agora quebra em duas linhas em vez de cortar. `letter-spacing` do supergrupo também reduzido de `.06em` pra `.03em`, ganhando alguma folga extra pra reduzir a chance de precisar quebrar linha.
2ª revisão (mesma sessão seguinte, novo print de tela): "ACABAMENTOS" também aparecia cortado ("ACABAMENT"), e o pedido, olhando de novo pra esses grupos, foi outro: Piso/Revestimento/Iluminação (grupo "Acabamentos") e Móveis (grupo "Mobiliário") são botões `.ts-disabled` — SEMPRE desabilitados, sem listener nenhum, "em breve" desde que foram criados na fase 2 — e são exatamente o tipo de coisa que o catálogo (painel ao lado, com departamentos/produtos reais vindos do Supabase) já resolve de verdade. Manter esses 4 botões mortos no sidebar, competindo por espaço com Construir, não tinha mais função nenhuma além de ocupar espaço e ainda cortar texto.
Decisão (2ª revisão): grupos "Acabamentos" (Piso/Revestimento/Iluminação) e "Mobiliário" (Móveis) REMOVIDOS por completo do `.tool-sidebar` — não migrados/escondidos, removidos mesmo, já que eram só placeholder estático sem nenhuma lógica associada (confirmado: nenhum id desses botões era referenciado em `EsboceApplication.ts`, então a remoção não quebrou wiring nenhum). O supergrupo "Produtos" no sidebar fica só com o grupo "Catálogo" (botões Catálogo + Materiais) e o CTA "+ Adicionar produto" — navegar por categoria tipo Piso/Iluminação/Móveis agora é responsabilidade exclusiva do PAINEL do catálogo (suas abas de departamento, que já são dados reais do Supabase), não mais duplicado como placeholder morto no sidebar.
Alternativas descartadas (2ª revisão):
    • Manter os botões, só reabilitando quando o catálogo tiver as categorias equivalentes — descartada: mesmo reabilitados, seriam um segundo caminho REDUNDANTE pra chegar no mesmo lugar que os departamentos do catálogo já cobrem; dois caminhos pro mesmo destino sem diferença de função (como só aconteceu de propósito com o CTA "+ Adicionar produto" vs "Catálogo", que tem justificativa de destaque visual) não se justifica aqui.
    • Mover os 4 botões pra dentro do painel do catálogo como atalhos fixos, além dos departamentos dinâmicos — descartada: o catálogo já resolve isso via suas próprias abas de departamento (dado real, carregado do Supabase); duplicar como atalho estático seria a mesma dívida técnica só que num lugar novo.
Status: Ativo.
DEC-42  Quantitativo de materiais passa a contar Laje (volume de concreto + aço) — elemento que existia na cena mas nunca entrava no orçamento
Sessão: 9
Contexto: Sessão de discussão (sem código) sobre a calculadora de materiais/quantitativo (`MaterialsPanel.ts`) — que já é bem mais robusta do que aparentava por fora: alvenaria com referência SINAPI (códigos de composição citados), aço estrutural pela regra "Números Mágicos das Estruturas de Concreto", fundação (baldrame/radier), pilaretes e viga de cinta estimados a partir da própria geometria de parede. Revisão pontual identificou uma lacuna real: a entidade `Laje` (polígono livre, arrastável, por pavimento — ver types.ts) nunca era lida em lugar nenhum de `MaterialsPanel.ts`, então qualquer Laje colocada na cena (piso superior, terraço, varanda descoberta) era 100% invisível no quantitativo — nem área, nem concreto, nem aço.
Decisão: (1) Nova função exportada `Core.polygonAreaModelUnits(pts)` — extraída da closure `signedArea` que já existia DENTRO de `detectRooms` (usada ali pra área de cômodo) — agora reaproveitada também pra área de Laje, sem duplicar a fórmula do shoelace em dois lugares; `detectRooms` foi atualizada pra chamar a função exportada em vez de manter sua cópia local. (2) Novo getter `Scene3DRenderer.LAJE_THICKNESS_GETTER()` (mesmo padrão já usado pra `WALL_HEIGHT_GETTER`/`BALDRAME_WIDTH_GETTER`/etc.) — expõe a espessura real que o 3D já usa pra desenhar a Laje (0,15m), assim o quantitativo lê o mesmo valor em vez de guardar uma constante solta que pode dessincronizar. (3) `MaterialsPanel.compute()` ganhou uma seção `laje: { count, areaM2, volumeM3, steelKg }` — volume = soma das áreas × espessura; aço numa taxa PRÓPRIA (`STEEL_RATE_LAJE_KG_M3 = 90`, decidida nesta sessão — mais baixa que a taxa de viga/pilar já existente de 100 kg/m³, porque armação de laje maciça é mais distribuída/malha, menos concentrada). (4) Explicitamente SEM somar uma viga própria por Laje — a viga de cinta/amarração que já existe roda por cima de TODA parede do projeto e estruturalmente já cumpre o papel de apoio da laje; uma viga adicional aqui duplicaria essa mesma peça. (5) Vão de Laje sem apoio intermediário (polígono grande sem parede/pilar no meio) fica FORA de escopo — mesmo tratamento que pilarete em parede já dá pro vão grande (>3m): é decisão de projeto estrutural posterior, não do Esboce. (6) Exibição adicionada nos três lugares que já existiam pra outros itens: painel (`render()`, seção própria com a taxa de aço no rótulo — mesmo padrão de "premissas visíveis" já usado na fundação/alvenaria), planilha/CSV (`buildRows()`) e detalhe elemento-a-elemento (`buildDetailRows()`, uma linha "Laje N" por laje). (7) Dois testes novos (`polygonAreaModelUnits` num retângulo simples e num contorno em L, reaproveitando os mesmos helpers `createLajeEntity`/`rectPoints` que os testes de `lajeBounds` já usavam) — 50/50 testes passando.
Alternativas descartadas:
    • Dar à Laje sua própria taxa de aço igual à de viga/pilar (100 kg/m³), por simplicidade de ter um valor só — descartada a pedido explícito: laje maciça de verdade roda um pouco mais baixo nas referências de pré-dimensionamento; 90 kg/m³ foi a escolha entre manter simplicidade (uma taxa só) e ganhar alguma precisão (taxa própria).
    • Somar uma viga de sustentação própria pra cada Laje, além da cinta já existente — descartada explicitamente: duplicaria a mesma peça estrutural (a cinta já é o apoio da laje na prática construtiva real).
    • Tratar vão de Laje sem apoio intermediário agora (adicionar pilarete automático dentro do polígono da laje, igual já existe pra parede) — descartada por ora: registrado como pendência explícita pro projeto estrutural, fora do escopo desta rodada.
Status: Ativo. Pendências que seguem em aberto da mesma discussão (não implementadas nesta sessão): verga (reforço estrutural por abertura — porta/janela/arco — hoje só desenhada visualmente, nunca contada como concreto/aço); fundação pra Laje fora do contorno de parede (depende de decisão de produto: laje representa piso superior apoiado ou laje solta no térreo?); telhado com 3+ águas na mesma junção (a dedução de sobreposição existente foi verificada só pra pares, não testada pra junção tripla/formato U ou +).
DEC-43  Quantitativo de materiais passa a contar verga (reforço acima de qualquer vão) — concreto + aço
Sessão: 9 (continuação)
Contexto: Segundo item da fila que ficou registrada na DEC-42 (verga → fundação de Laje → telhado com 3+ águas, nessa ordem). Vergas são o reforço estrutural acima de QUALQUER abertura em alvenaria (porta, janela ou arco — arco é vão estrutural puro, sem porta/janela instalada, mas ainda precisa de verga, ver DEC-36) — hoje o renderer 3D só desenha a continuação visual da textura de parede acima do vão (rótulo "verga" nos comentários do Scene3DRenderer), sem nenhuma geometria/dimensão estrutural própria — então, ao contrário de pilarete/cinta (que reaproveitam constantes que o 3D já usa pra desenhar), não havia nenhum valor 3D existente pra puxar.
Decisão: Nova constante `VERGA_BEARING_M = 0.20` (apoio de cada lado da verga sobre a alvenaria, valor comum de obra residencial — regra usual cita mínimo de ~20cm). Volume por abertura = (largura do vão + 2 × apoio) × espessura da parede (`Core.WALL_THICK`) × `BEAM_HEIGHT_M` — REAPROVEITANDO a mesma altura de seção que a cinta já usa (0,10m), em vez de criar uma terceira constante de altura só pra isso. Aço pela MESMA taxa de superestrutura que pilarete/cinta já usam (100 kg/m³, não a taxa de 90 kg/m³ que a Laje ganhou na DEC-42 — verga é elemento concentrado tipo viga, não malha distribuída tipo laje). Contagem/soma acumulada durante o mesmo loop que já contava porta/janela/arco (`totals.vergaCount`, `totals.vergaSpanM`), volume/aço calculados junto de pilarete/cinta no fim de `compute()`. Exibido nos dois lugares que pilarete/cinta já aparecem (painel `render()` e planilha/CSV `buildRows()`) — sem linha própria em `buildDetailRows()` (elemento a elemento), mesmo tratamento que pilarete/cinta já recebem (só agregado, não item por item).
Alternativas descartadas:
    • Criar uma constante de altura própria pra verga em vez de reaproveitar BEAM_HEIGHT_M — descartada por simplicidade: verga e cinta são a mesma família de elemento (viga rasa de amarração), sem motivo pra ter duas alturas de referência diferentes sem dado nenhum sustentando a diferença.
    • Usar a taxa de aço de 90 kg/m³ da Laje (DEC-42) por já ser "a mais recente" — descartada: laje é elemento distribuído (malha), verga é elemento concentrado como viga/pilar — a taxa de 100 kg/m³ (superestrutura) é a categoria certa, não a de laje.
    • Linha individual por abertura em buildDetailRows() (ex.: "Verga — Porta 1") — descartada por ora: pilarete/cinta, a mesma família de elemento estimado (não desenhado), também não têm linha individual, só agregado; manter consistência em vez de abrir exceção só pra verga.
Status: Ativo. Pendências que seguem em aberto (fila original da DEC-42): fundação pra Laje fora do contorno de parede; telhado com 3+ águas na mesma junção.
DEC-44  Laje é sempre entrepiso — nunca gera fundação; laje em contato com o solo é responsabilidade do tipo de fundação "radier", já existente
Sessão: 9 (continuação)
Contexto: Pendência registrada na DEC-42/DEC-43 (fila: verga → fundação de Laje → telhado 3+ águas): faltava decidir se a entidade Laje representa piso superior apoiado (entrepiso) ou também podia representar laje solta em contato com o solo — a resposta muda se ela deveria ou não gerar quantitativo de fundação própria.
Decisão: Definição explícita de produto — **Laje é exclusivamente entrepiso** (piso superior, apoiado na cinta/parede de baixo, nunca em contato direto com o solo). Qualquer necessidade de "laje no chão" (fundação em placa única, cobrindo toda a área térrea) já é coberta pelo tipo de fundação **radier**, que já existe (`project.foundationType`, selecionável via menu de contexto — ver `ViewportController.ts`, `addTypeOption('Radier', ...)`) e já é calculado só pro térreo em `MaterialsPanel.compute()`. Com essa definição, o código ATUAL já está correto e não precisa de nenhuma mudança: o loop de Laje (`floor.lajes`) e o bloco de fundação nunca se cruzavam mesmo antes desta decisão — Laje nunca lia geometria de fundação, e fundação nunca lia `floor.lajes`. A pendência fecha só com esta definição registrada, sem alteração de código.
Alternativas descartadas:
    • Permitir que uma Laje sozinha, se desenhada sem nenhuma parede embaixo em `project.floors[0]`, fosse tratada automaticamente como equivalente a radier — descartada: mistura dois conceitos por trás de uma coincidência de posição (estar no térreo), em vez de ser uma escolha explícita da pessoa via o seletor de fundação que já existe. Radier continua sendo uma decisão de projeto tomada uma vez (tipo de fundação do projeto inteiro), não inferida elemento a elemento.
Status: Ativo — pendência de fundação pra Laje fechada. Só falta o último item da fila: telhado com 3+ águas na mesma junção.
DEC-45  Quantitativo de materiais passa a contar madeiramento de telhado (ripa, caibro, terça) — ref. SINAPI 92539
Sessão: 9 (continuação)
Contexto: Antes de tratar a última pendência da fila (telhado com 3+ águas — que a pessoa vai testar manualmente, por isso ficou pra depois), pergunta direta sobre se o quantitativo já cobria a estrutura de madeira do telhado (madeiramento), não só a telha. Busca no código confirmou que não: nenhuma menção a caibro/ripa/terça/tesoura em `MaterialsPanel.ts`, e a única ocorrência de "cumeeira" no `Scene3DRenderer.ts` é sobre a TELHA de cumeeira (peça decorativa que fecha o encontro das águas), não uma viga estrutural — o telhado é modelado só como plano sólido com textura de telha, sem nenhuma peça de madeira desenhada ou contada.
Decisão: Nova referência `ROOF_TIMBER_REF`, citando a composição real **SINAPI 92539** ("TRAMA DE MADEIRA COMPOSTA POR RIPAS, CAIBROS E TERÇAS PARA TELHADOS DE ATÉ 2 ÁGUAS PARA TELHA CERÂMICA OU DE CONCRETO, INCLUSO TRANSPORTE VERTICAL", AF_10/2025 — confirmada em múltiplas fontes independentes: orcamentador.com.br, orcamentor.com, editais públicos). A composição documenta ESPAÇAMENTO e SEÇÃO de cada peça (ripa 1,5×5cm a cada 0,32m; caibro 5×6cm a cada 0,55m; terça 6×12cm a cada 1,5–2,0m — usado o meio da faixa, 1,75m), não uma tabela pronta de "m³ por m²" — os metros lineares por m² são DERIVADOS do espaçamento (1 ÷ espaçamento), mesma lógica que qualquer orçamentista aplicaria com esse dado; volume = metros lineares × seção transversal de cada peça. Perda de 10%, mesma taxa mínima já usada em `MASONRY_REF`. Aplicado uniformemente a QUALQUER telhado com água (duasAguas/quatroAguas/umaAgua) — mesma simplificação já aceita pra alvenaria (traço único pra toda parede); existe uma composição SINAPI própria pra "mais de 2 águas" (92542, espaçamento de caibro mais apertado), mas o modelo de dados do Roof não guarda hoje informação suficiente pra diferenciar os casos com segurança. Platibanda (laje plana, sem água) NÃO entra — é laje de concreto, sem madeiramento nenhum. Soma acumulada durante o mesmo loop que já calculava área de telhado (`totals.roofTimberAreaM2`), volume/metros derivados no fim de `compute()`, exibidos nos dois lugares que outros itens estruturais já aparecem (painel `render()`, planilha/CSV `buildRows()`) — SEM custo estimado (linhas saem com `—`, não um preço inventado): não encontrei referência de mercado confiável o bastante pra madeira serrada bruta pra entrar em `REFERENCE_PRICES` com o mesmo padrão de qualidade das outras entradas (que citam fonte nomeada — Calculobra/SINAPI/Lar Pontual).
Alternativas descartadas:
    • Buscar/estimar um preço de madeira mesmo sem fonte sólida, só pra ter uma linha de custo — descartada: contraria o princípio já estabelecido no próprio código ("linhas sem base de preço mostram '—' em vez de inventar um número") e o pedido explícito desta sessão de ser assertivo SEM se comprometer.
    • Diferenciar duasAguas/umaAgua (composição "até 2 águas") de quatroAguas (composição "mais de 2 águas", 92542) usando referências SINAPI diferentes pra cada tipo — descartada por ora: os espaçamentos das duas composições são próximos o bastante, e o ganho de precisão não compensa a complexidade extra sem um motivo prático que já tenha aparecido (registrado como possível refinamento futuro, não uma decisão errada).
    • Calcular tesoura (treliça) e frechal nesta mesma rodada — descartada: tesoura (SINAPI 92548) é cobrada por peça/vão, depende de decisão de engenharia sobre quando é necessária (vãos maiores); frechal cumpre o mesmo papel estrutural que a viga de cinta já calculada em `structure` — somar os dois duplicaria a peça, mesmo raciocínio já usado pra não somar viga própria de Laje (DEC-42).
Status: Ativo. Pendências que ficam registradas desta rodada: tesoura (treliça pra vãos maiores) e frechal (avaliar se algum dia precisa ser distinto da viga de cinta) fora de escopo; preço de madeira serrada sem referência de mercado confiável pra entrar em REFERENCE_PRICES; distinção SINAPI "até 2 águas" vs "mais de 2 águas" não implementada. Fila original da DEC-42 encerrada — resta só telhado com 3+ águas na mesma junção, que a pessoa vai testar manualmente antes de decidir o que fazer.
DEC-46  Aviso de responsabilidade técnica (ADR-006) exibido ao abrir o app — card centralizado sobre a viewport, paleta própria, explica pra que o Esboce serve
Sessão: 10
Contexto: A ADR-006 (seções 13-15) já exigia um aviso geral de responsabilidade técnica visível — "não deve ficar escondido", "aparecer contextualizado em pontos relevantes" — mas isso nunca tinha sido implementado na UI; só existia como texto normativo no documento. Pedido explícito: um card de texto centralizado sobre a viewport, ao iniciar o Esboce, com visual moderno numa paleta "tipo barroco". Revisão pontual: o primeiro texto só dizia o que o Esboce NÃO é (não substitui arquiteto/engenheiro) — pedido explícito de completar com o que ele SE PROPÕE a fazer.
Decisão: Novo `#disclaimerOverlay` (dentro de `#viewport`, mesmo container de outros elementos flutuantes como o painel de visualização) — aparece centralizado com um backdrop leve (`rgba(30,12,18,0.45)`, não um preto opaco — a viewport 3D continua reconhecível ao redor) na primeira carga de cada navegador/perfil, e exige um clique consciente em "Entendi" pra fechar (não fecha sozinho, não fecha no clique fora — coerente com "não deve ficar escondido"). Uma vez fechado, a escolha fica em `localStorage` (chave `esboce_disclaimer_dismissed_v1`, não `sessionStorage` — de propósito, pra aparecer uma vez por navegador, não a cada aba nova) — se `localStorage` estiver bloqueado/indisponível (modo privado restrito, por exemplo), o app não trava: só o aviso volta a aparecer na próxima carga, registrado com `console.warn`. Texto em dois parágrafos: o primeiro explica a PROPOSTA do Esboce (desenhar a casa em 3D, escolher acabamento/produto de fornecedor real, receber quantitativo de material e estimativa de orçamento — só o que já existe de verdade hoje, sem prometer o fluxo de orçamento por loja da ADR-007, que ainda não está implementado); o segundo é o aviso adaptado da seção 14 da ADR-006 (não substitui profissional habilitado, é complemento). Paleta deliberadamente DIFERENTE do resto do app (que é roxo/branco/creme) — vermelho-vinho escuro (`#5C1B2E`/`#7A2438`) com dourado (`#D4AF37`/`#C9A227`), pedido explícito ("cor tipo barroco"), pra esse aviso se destacar visualmente de qualquer outro elemento da UI, e não ser confundido com um card comum.
Alternativas descartadas:
    • Sem persistência nenhuma (aparecer em toda carga de página) — descartada: a ADR pede visibilidade, não repetição cansativa; uma vez reconhecido, não precisa reaparecer toda hora pra continuar cumprindo o objetivo (transparência sobre a natureza da informação, não bloqueio constante).
    • `sessionStorage` em vez de `localStorage` — descartada: apareceria de novo a cada aba nova, o que é mais chato que útil; a intenção é "uma vez que a pessoa já viu, já viu" por navegador/perfil, não por sessão de aba.
    • Fundo opaco/preto cobrindo a viewport inteira (modal bloqueante) — descartada: contraria o princípio já estabelecido desde a DEC-38 de nenhum elemento tampar a viewport 3D por completo; um backdrop leve com card centralizado já cumpre o objetivo de "não ficar escondido" sem essa regressão.
    • Prometer no texto o fluxo de orçamento por loja/fornecedor (ADR-007) — descartada: essa peça ainda não está implementada; o card descreve só recursos que já existem de verdade hoje (quantitativo de materiais, estimativa de custo total), pra não criar expectativa que o app ainda não entrega.
Status: Ativo.
Pendências e limitações conhecidas
    • Laje: textura de reboco aplicada de forma uniforme na caixa inteira (topo/fundo/lados usam o mesmo material, calculado pro tamanho das bordas) — face de topo/fundo pode ficar com a textura meio esticada em lajes muito grandes; aceito como a mesma simplificação já usada no parapeito da platibanda (ver DEC-31).
    • Trava de parede/cômodo sem laje (DEC-35) checa só no clique do botão da ferramenta — se a pessoa já estiver com a ferramenta ativa e a laje for excluída durante o desenho, a trava não interrompe no meio do gesto.
    • Rastro automático em topologias de 3+ cômodos convergindo no mesmo canto — comportamento inesperado, escopo não decidido (ver DEC-17).
    • Escada — ainda sem implementação, apenas botão visual desabilitado. Porta, Janela e Varanda já estão implementadas e não pertencem mais a esta lista.
    • Cotas (mostrar/editar medida de parede já existente fora do momento de colocação) não portadas para a vista unificada.
    • Arrastar o corpo de uma parede já existente não avisa paredes vizinhas que compartilhavam o canto.
    • Corner de 3+ paredes sem nenhum par colinear (convergência genuína, não disfarçada de T) — só uma parede "vence" e estica; não resolvido.
    • Piso interior/exterior verdadeiro — face A/B são só "os dois lados", sem significado arquitetônico ainda.
    • Marco (vazado sem produto aplicado, ponta de parede livre, topo no encontro com o telhado) — conceito decidido em conversa, ainda não implementado.
    • Atualizar o Índice Mestre para incluir o CAW e refletir as fusões de documentos já concluídas.
    • Aplicar no Documento de Arquitetura a mesma troca "Motor Financeiro" → Budget Engine já feita na Atualização v2.1 do Domínio.
    • Madeiramento de telhado (ver DEC-45) hoje só cobre telha cerâmica/concreto (SINAPI 92539). Telha metálica/fibrocimento precisa de referência própria (SINAPI 92543 — trama só com terças, sem ripa/caibro, já que a chapa vence o vão direto entre terças) e telha shingle precisa de um sistema totalmente diferente (deck contínuo de OSB/compensado cobrindo o telhado inteiro, mais próximo da lógica de Light Steel Frame já prevista na ADR-006 do que da alvenaria convencional) — nenhum dos dois implementado ainda.
Ferramentas de depuração disponíveis
Deixadas no protótipo de propósito, úteis para investigações futuras direto do console do navegador:

| Ferramenta | Uso |
| --- | --- |
| `window.Store` / `window.Core` | Acesso direto ao estado, comandos e regras geométricas pelo console do navegador. |
| `Store.commands.pruneDegenerateWalls()` | Remove paredes de comprimento zero existentes no modelo. |
| `wallDiagnosticsToggleBtn` | Aciona o painel técnico de diagnóstico; permanece oculto na interface comum e é destinado ao desenvolvimento. |

As antigas ferramentas `window.__DEBUG__`, "Cor por ID", `dumpWallFace`, `listRoomKeys`, `dumpRoomFloor` e "Esconder chão/grade" não existem na implementação atual e foram removidas desta lista para evitar orientação incorreta.

DEC-47  Persistência versionada, validação única e backup de projetos
Sessão: 11
Contexto: O editor já salvava projetos no Supabase, mas o conteúdo persistido não tinha versão explícita nem uma fronteira única de validação. Isso tornava perigoso abrir documentos antigos, corrompidos ou produzidos por uma versão futura. O mesmo risco existia ao importar arquivos locais.
Decisão: `ProjectPersistence.ts` passa a ser a fronteira obrigatória para salvar, carregar, exportar e importar. O documento recebe `schemaVersion`; a leitura valida estrutura, tipos, tamanho, identificadores duplicados e referências órfãs, normaliza campos compatíveis e identifica migrações. Versões futuras incompatíveis são recusadas. O backup JSON usa o mesmo envelope do Supabase. A geometria de quantitativos foi extraída para `QuantityGeometry.ts`, evitando implementações divergentes entre editor e painel.
Alternativas descartadas:
    • Confiar que todo JSON vindo do banco foi produzido pela versão atual — rejeitada porque banco, links antigos e backups sobrevivem a releases.
    • Manter validações separadas para Supabase e backup — rejeitada porque as regras inevitavelmente divergiriam.
Status: Ativo. Coberto por testes de ida e volta, migração, versão futura, IDs duplicados e referências órfãs.

DEC-48  Baseline pré-comercial de conta, conformidade e proteção antiabuso
Sessão: 12
Contexto: Para testar o produto com usuários reais, salvar projetos exigia um ciclo de conta completo, transparência jurídica e entrega confiável de e-mails. O SMTP padrão do Supabase tinha limite reduzido e os fluxos públicos estavam expostos a automação.
Decisão: (1) Termos e Privacidade públicos, versionados e com aceite separado persistido em `legal_acceptances`; nova versão exige novo aceite. (2) Ciclo de conta cobre cadastro, confirmação, login, recuperação, redefinição, troca de senha, reautenticação e exclusão dos dados associados. (3) Senha mínima de oito caracteres no cliente e no Supabase. (4) Resend configurado como SMTP próprio, domínio verificado e remetente `nao-responda@esboce.com.br`; modelos essenciais em português. (5) Cloudflare Turnstile protege cadastro, login, recuperação e reautenticação; somente a site key é pública e a secret key permanece no Supabase. (6) Exclusão no servidor deriva o usuário de `auth.uid()`.
Alternativas descartadas:
    • Adiar Termos e Privacidade até a abertura formal da empresa — rejeitada para o piloto; os documentos identificam o operador atual e deverão ser revistos quando a empresa for formalizada.
    • Continuar usando o SMTP compartilhado do Supabase — rejeitada por limite e baixa adequação operacional.
    • Colocar segredos do Resend ou Turnstile no frontend — rejeitada por segurança.
Status: Ativo. MFA administrativo fica obrigatório antes da divulgação pública ampla, não para o piloto atual.

DEC-49  Monitoramento mínimo de erros em produção
Sessão: 13
Contexto: Testes automatizados não revelam todos os erros de navegador, dispositivo e fluxo real. Era necessário detectar falhas do piloto sem introduzir rastreamento invasivo nem coletar o conteúdo dos projetos.
Decisão: Sentry é iniciado somente em `esboce.com.br`. `sendDefaultPii`, replay, tracing, logs e breadcrumbs ficam desativados. Antes do envio, o evento remove usuário, extras, contextos, e-mails, parâmetros de consulta e outros campos potencialmente sensíveis. A Política de Privacidade identifica o serviço e a finalidade. Source maps e evolução de observabilidade ficam para uma etapa separada.
Alternativas descartadas:
    • Ativar Session Replay para facilitar diagnóstico — rejeitada pelo risco de capturar conteúdo visual do projeto.
    • Monitorar também localhost e prévias — rejeitada para não misturar erros de desenvolvimento com produção.
    • Operar sem monitoramento até o lançamento — rejeitada porque o piloto é justamente a fase de descobrir falhas reais.
Status: Ativo. Evento sintético de produção recebido com sucesso na implantação inicial.

DEC-50  Céu procedural e terreno contínuo no viewport
Sessão: 14
Contexto: O fundo azul uniforme e a borda próxima do plano de grama deixavam o viewport visualmente plano. A melhoria precisava preservar o caráter técnico do editor, sem panorama fotográfico, assets pesados ou distrações.
Decisão: O fundo passa a ser um degradê vertical gerado em `CanvasTexture`; a cena usa iluminação hemisférica e luz direcional levemente aquecida. O plano do terreno aumenta de 30×30 para 120×120 unidades e mantém a densidade da textura por repetição proporcional. Uma névoa linear chegou a ser testada, mas foi removida antes da aprovação porque produzia uma faixa esbranquiçada artificial no chão.
Alternativas descartadas:
    • Panorama fotográfico, nuvens, montanhas ou árvores — rejeitados nesta fase por distração, peso e conflito com a leitura técnica.
    • Manter a névoa para esconder totalmente o horizonte — rejeitada após teste visual do usuário.
Status: Ativo e publicado após prévia isolada e aprovação visual.

DEC-51  Sistema construtivo como decisão inicial persistida
Sessão: 15
Contexto: A geometria da casa pode ser comum a diferentes métodos de construção, mas os insumos e custos derivados não são intercambiáveis. Iniciar o desenho sem registrar essa intenção permitiria apresentar uma composição de alvenaria cerâmica para uma casa concebida em bloco estrutural ou Light Steel Frame.
Decisão: Todo projeto novo exige a escolha visual entre Tijolos, Bloco estrutural e Steel Frame antes da edição. Depois da escolha, um indicador permanente na barra superior mantém o sistema atual visível e acompanha criação, abertura e importação. O valor passa a integrar `Project`, o envelope persistido, os backups e os links compartilhados. O schema sobe para a versão 2; projetos legados recebem `ceramic_masonry`, preservando o comportamento histórico. O quantitativo continua mostrando geometria e itens comuns, mas oculta composição cerâmica, pilaretes, cintas e vergas estimadas quando outro sistema está selecionado, exibindo a pendência de sua composição específica.
Alternativas descartadas:
    • Usar a escolha apenas como tela decorativa — rejeitada porque não orientaria persistência nem quantitativos.
    • Reaproveitar temporariamente a composição cerâmica nos três sistemas — rejeitada por produzir números tecnicamente enganosos.
    • Bloquear todo o quantitativo nos sistemas ainda incompletos — rejeitada porque áreas, acabamentos, fundação, laje e cobertura continuam sendo informações úteis e explicitamente separáveis.
Status: Ativo. Composições próprias de bloco estrutural e Light Steel Frame permanecem no roadmap do piloto controlado.
