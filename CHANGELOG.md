# Changelog

## Alterado — 01/09/2026

- O Bloco de Volumetria virou **Cubo mágico**: agora pode ser marcado com o elemento estrutural que representa (parede, marquise, pilar, cobertura) e o material que o compõe, entrando no quantitativo por esse material em vez de cair sempre no preço genérico. A escolha do material acontece já no clique do botão que cria o cubo, por uma lista. Ver DEC-175, DEC-179.
- O Cubo mágico nasce com formato de cubo (1×1×1 m, antes era achatado) e cor amarelo-gema de destaque, pra ficar fácil de identificar na cena.
- Simplificadas as alças de moldagem do Cubo mágico: só restou o puxar por FACE (empurra/estica aquela face na direção normal). As alças de canto e aresta, que ficavam confusas e se sobrepunham, foram removidas — e a correção revelou um bug real de escala que travava o arraste de face quando o cubo já tinha sido movido da origem. Ver DEC-176.
- ACM saiu da lista de material estrutural do Cubo mágico: é sempre revestimento/acabamento (chapa), nunca a estrutura em si — a estrutura equivalente (perfil de alumínio/metalon) já é representada pelo material "Metalão". Ver DEC-180.
- Cubo mágico com material "Metalão" agora renderiza como um esqueleto tubular procedural nas 12 arestas (perfis metálicos), em vez de um bloco sólido colorido — mais fiel ao que esse material realmente representa. Ver DEC-181.
- A Lata de tinta no Cubo mágico agora pinta só a face clicada (ex.: aplicar um ACM do catálogo Bold numa única face), em vez do bloco inteiro de uma vez — as outras faces continuam com o acabamento/material que já tinham. Ver DEC-182.
- Cubo mágico com material "Metalão": quando o bloco é esticado na largura, o esqueleto agora repete um perfil vertical intermediário a cada 1200mm (no máximo), em vez de só os 2 perfis das pontas — mais fiel a uma subestrutura de fachada real. Ver DEC-183.
- O Cubo mágico agora pode subir/descer: segurando Shift enquanto arrasta o corpo, o arraste vertical do mouse ajusta a altura em vez de mover no plano do chão. Ao soltar um arraste normal perto de uma parede alinhada ao mundo, a posição agora encosta exatamente na face dela (sem girar o bloco). Ver DEC-184.

## Alterado — 28/08/2026

- Corrigido: a soleira que fecha o piso onde ficava uma parede interna (ao apagar a parede ou colocar um arco entre dois cômodos) sempre usava o piso padrão do catálogo, mesmo depois do usuário escolher outro piso em Materiais. Agora usa o piso real de um dos cômodos ligados. Ver DEC-173.

- Estúdio de Fachadas: ao usar uma construção existente, o usuário agora seleciona uma ou mais paredes diretamente no modelo; após confirmar, somente elas permanecem visíveis e são alinhadas lado a lado em uma vista paralela para composição.
- Estúdio de Fachadas: primeiro elemento próprio com letreiro em letras-caixa, edição de texto, dimensões, elevação, cores, iluminação frontal/interna/halo, exclusão, persistência e comparação dia/noite.
- Iniciado o Estúdio de Fachadas: nova entrada dedicada com dois caminhos — enquadrar a construção atual ou criar um plano de fachada vazio de 10 m. A primeira entrega abre uma vista frontal vinculada ao mesmo modelo 3D, reaproveita a ferramenta funcional de pele de vidro e apresenta, sem fingir disponibilidade, os próximos grupos de letreiros, marquises, brises, ripados/vazados e visualização dia/noite. Ver ADR-010.
- Operação: ativado o Cloudflare Web Analytics no domínio oficial para acompanhar visitas, páginas, origens, países, navegadores e dispositivos de forma agregada e sem cookies de análise. A Política de Privacidade foi versionada como `2026-08-28.1`, passou a identificar esse tratamento e o aceite jurídico acompanha a nova versão.
- Corrigido: telhado em L com duas coberturas quatro-águas ainda podia sobrar um pedaço de espigão visível na junção — a cumeeira central de um telhado maior, quando só encosta PARCIALMENTE na pegada de um telhado menor (uma ponta dentro, a outra de fato fora), agora é aparada na fronteira real, em vez de sobreviver inteira. Ver DEC-165.
- Corrigido (regressão da correção acima): telhados em nível/ático (mesmo conjunto, mesma cumeeira) não devem mais disputar espigão/cumeeira entre si — evita que a cumeeira legítima que liga os dois níveis seja apagada por engano. Ver DEC-166.
- Nova ferramenta: com "Apagar" selecionada, clicar numa peça de espigão/cumeeira do telhado (em vez de uma parede) esconde só aquela peça — não mexe na geometria de verdade, só na exibição — e clicar de novo na mesma peça restaura. Útil pra remover na hora qualquer sobra que as regras automáticas ainda não cobrem. Ver DEC-166.
- Corrigido (achado com os dados reais do usuário): quando dois telhados em L compartilham exatamente o mesmo canto de beiral (a quina do L), os dois espigões de canto sobreviviam ali, duplicados — agora só o telhado de id menor mantém a peça. Ver DEC-166.
- Corrigido: espigão de canto que cai bem em cima da ARESTA reta do telhado vizinho (não do canto dele) também sobrava — agora é omitido sempre, sem exceção. Ver DEC-167.
- Corrigido (causa real da cumeeira que sumia desde a correção da DEC-165): a cumeeira central só deve ser cortada quando o telhado vizinho é realmente mais alto ali — quando os dois picos são iguais (composição em L comum), a malha fica inteira e o recorte por pixel já existente decide sozinho quem aparece em cada ponto da área compartilhada. Ver DEC-167.
- Telhado duas-águas: o forro do beiral deixa de ser em nível (plano) e passa a acompanhar a inclinação da própria água; o beirão do oitão, que ficava aberto, agora também fecha com o mesmo forro. O beiral do oitão passa a ter a mesma distância da parede que o beiral da lateral (0,4m para os dois). Ver DEC-168.
- Corrigido: no encontro em L de dois telhados duas-águas, a parede do oitão perdia um pedaço da própria forma ("face apagada") — o corte de malha usado pra cortar a água nesse tipo de encontro estava sendo aplicado também na parede, que é vertical e não deveria passar por esse corte. Ver DEC-169.
- Corrigido (mesmo encontro em L de duas-águas): a tabeira (faixa de acabamento do beiral) continuava passando reto, com uma fresta, mesmo depois da correção acima — dois mecanismos de corte diferentes disputavam a mesma peça com critérios levemente distintos. Agora só um deles atua em cada caso, e o corte da tabeira segue uma diagonal de vale coerente. Ver DEC-169.
- Corrigido: o indicador de Sistema Construtivo na barra superior mudava de largura (80 a 129px, conforme "Tijolos"/"Steel Frame"/"Bloco estrutural") assim que o projeto carregava, reorganizando a quebra de linha da barra e empurrando os painéis flutuantes — causa real medida de parte do CLS (layout shift) reportado pelo Cloudflare Web Analytics. Agora reserva o espaço do texto mais longo desde o primeiro render. Ver DEC-172.
- Corrigido: na quina EXTERNA do L (longe do vão), o beiral de um telhado duas-águas avançava bem além de onde a parede do oitão do vizinho termina, ficando "flutuando" no ar na frente dela — agora é cortado exatamente no plano da parede alheia. Ver DEC-170.
- Corrigido: as ferramentas Porta, Janela e Arco agora desarmam sozinhas depois de inserir uma abertura, voltando pro modo seleção — evita criar uma abertura sem querer ao esquecer a ferramenta ainda ativa e tentar arrastar uma parede ou cômodo em seguida. Ver DEC-171.
- Corrigido (efeito colateral da correção da soleira acima): ao apagar uma parede interna, a soleira que fecha o vão podia brigar de altura com o piso dos dois cômodos (z-fighting), ficando mais visível justamente depois da soleira passar a usar a cor real do piso. A soleira agora fica 3mm abaixo do nível do piso, funcionando como uma rede de segurança — some por baixo onde o piso já fecha sozinho e continua visível onde não fecha. Ver DEC-173.
- Corrigido: a face de uma parede sem acabamento escolhido aparecia num tom cinza-azulado em vez de branca, por causa da mistura das luzes coloridas da cena (céu, chão e preenchimento) incidindo sobre o material. Agora essa face recebe um leve reforço de branco por cima da iluminação normal, o suficiente pra corrigir o tom sem ficar chapada/sem sombra — acabamentos reais (cerâmica, textura, Steel Frame) continuam exatamente como antes. Ver DEC-174.

## Alterado — 27/08/2026

- A identificação visual do isolamento em paredes Steel Frame foi reforçada com uma hachura diagonal semitransparente sobre a cor do sistema aplicado. A hachura acompanha os recortes de portas e janelas e complementa a faixa turquesa no topo.
- Paredes de Light Steel Frame com isolamento térmico/acústico aplicado agora recebem uma faixa turquesa persistente no topo. Assim, o usuário confere visualmente quais paredes estão isoladas sem precisar selecionar uma por uma; a legenda do configurador explica o marcador.
- O quantitativo de Steel Frame passa a apresentar unidades reais de compra: chapas de drywall em placas, massa para juntas em baldes de 25 kg, Basecoat em sacos de 20 kg, pingadeira em barras de 2,5 m e parafusos em unidades. A quantidade técnica original continua preservada internamente para o cálculo dos preços por m², kg ou metro.
- Corrigido: os cinco componentes Placo/Glasroc cadastrados no banco agora aparecem também na vitrine visual. A antiga aba exclusiva "PlacLux" passa a se chamar "Construção a seco" e reúne, em seções separadas, Placo Glasroc X/Therm e PlacLux, exibindo foto, fabricante, fornecedor Vórtice e preço de referência.
- Os sistemas Glasroc X e Glasroc X Therm passam a usar a composição oficial pesquisada na Placo: Placa Glasroc X 12,5 mm, Placoplast Basecoat, Malha GRX para Superfície, Membrana Hidrófuga Tyvek HomeWrap e Parafuso Glasroc PB; o Therm acrescenta placa EPS para EIFS. Cinco imagens oficiais da Placo foram incorporadas ao catálogo.
- Placo permanece identificada como fabricante e Vórtice Materiais como fornecedora da referência de preço médio. Os valores são regionais, datados em 27/08/2026 e apresentados como estimativa, não como oferta comercial.
- O consumo do Placoplast Basecoat foi corrigido para 5 kg/m² na camada de revestimento. O fixador mecânico de EPS foi removido do Glasroc X Therm porque a especificação oficial consultada determina a colagem do EPS diretamente ao substrato.
- No configurador de Light Steel Frame, o revestimento do forro do beiral e o material da tabeira passam a ser escolhas globais: uma seleção é aplicada a toda a construção, sem clicar em cada telhado. A tabeira agora oferece opções próprias de placa cimentícia e madeira. Projetos antigos reaproveitam automaticamente a primeira configuração de cobertura já salva.
- A estimativa preliminar da estrutura engenheirada de Light Steel Frame passa a usar o parâmetro de orçamento de 30 kg/m², mantendo 5% de perda calculados separadamente e o caráter preliminar explícito no quantitativo e no PDF.
- As composições de Light Steel Frame passam a incluir os complementos antes ausentes: Base Coat, fita, tela Fiberglass e cantoneira PVC telada nas placas cimentícias; massa e fita telada nas chapas de drywall; e manta asfáltica sob a guia inferior. O quantitativo agora preserva as unidades corretas de cada insumo (kg, metro linear, m² e unidade).
- Todo projeto Light Steel Frame passa a contabilizar Pingadeira de base cobrindo o perímetro inteiro das paredes (mesma base de cálculo da manta asfáltica sob a guia inferior), com 10% de perda — não é mais uma camada de uma composição de face específica. As duas composições de placa cimentícia (com e sem OSB) continuam levando Membrana Hidrófuga.
- A composição "OSB + placa cimentícia" passa a se chamar "Placa cimentícia com substrato (OSB ou Compensado)", com parafusos próprios de fixação do painel do substrato. Em qualquer composição, a Membrana Hidrófuga deixa de descontar aberturas de esquadrias (sempre calculada pela face total da parede) e, quando a composição tem substrato, ganha 0,6 m de folga por metro de parede pra envolver a base do painel e impedir entrada de umidade.
- EIFS ganhou duas variantes de substrato: sobre placa cimentícia (EPS/XPS colado com Basecoat ProFort) e sobre OSB/Compensado (EPS/XPS parafusado com arandela). As duas levam EPS/XPS 50mm (densidade ≥ 18 kg/m³), tela de fibra, cantoneira telada e Membrana Hidrófuga — herdando a mesma regra de face total + folga de 0,6m/m.
- Primeiros itens de Steel Frame com preço real: painel do substrato OSB/Compensado, parafuso com arandela do EPS/XPS, placa Glasroc X e pingadeira de base — preços pesquisados na Espaço Smart. O restante do quantitativo Steel Frame continua sem preço, sem nenhum número inventado.
- O quantitativo de Steel Frame agora converte placas, rolos e sacos para a quantidade comercial (ex.: "62 placas (1200 x 2400 x 12,5 mm)", "29 sc(20kg)", "5 rolos (50m)") sempre que o catálogo PlacLux já publica o rendimento do produto, em vez de mostrar só m²/m/kg técnico.
- Novo PDF isolado do quantitativo de Steel Frame (menu "Quantitativo" → "Steel Frame"), em formato de tabela com bordas (Produto/Quantidade/Preço/Valor total) — mesmo padrão visual de calculadoras de fabricante (ex.: Trevo Drywall).
- Corrigido (retomando DEC-150/151/152): telhado em L ainda tinha um espigão sobreposto que não devia — era a cumeeira central/contínua, que nunca tinha recebido a marcação usada pra omitir espigões de canto. Ver DEC-160.
- Auditoria de orçamento: muros de terreno confirmados agora entram na alvenaria/pintura (antes ficavam de fora do quantitativo, mesmo sendo geometria real e renderizada) — sem entrar na viga de cinta da casa, que não se aplica a eles. A exportação em PDF/CSV também ganhou o aviso de "blocos estruturais indisponível" que já existia só na tela. Ver DEC-161.
- Novo sistema de drywall como divisória interna: qualquer parede com cômodo dos dois lados pode virar divisória em drywall, independente do sistema construtivo do projeto (alvenaria, bloco estrutural ou Steel Frame) — nova ferramenta na categoria Paredes. O quantitativo aparece numa seção própria, sempre que existir alguma parede marcada. Ver DEC-162.
- Bloco de Volumetria agora pode ser moldado puxando canto ou face (topologia sempre fixa — 8 cantos, 6 faces), em vez de só redimensionar reto por largura/profundidade/altura. Ainda ajustando a usabilidade das alças (relatos de que ficavam confusas/sobrepostas) — ver DEC-163 e DEC-164.

## Em desenvolvimento — catálogo comercial unificado

- Formalizado o catálogo único para o usuário, mantendo aparência PBR,
  especificação técnica, fornecedores e ofertas separados internamente.
- Criado o contrato de ofertas oficiais e referências regionais Vórtice,
  sempre datadas e identificadas como estimativa, não como venda.
- Mantida compatibilidade temporária com os preços legados de `products`.
- O painel agora carrega as ofertas separadamente, mostra fabricante e
  fornecedor nos papéis corretos e lista todas as alternativas na mesma ficha.
- A ficha ativa a ação compatível: aplicar acabamento, posicionar abertura ou
  adicionar móvel; materiais construtivos permanecem vinculados ao quantitativo.
- A oferta escolhida passa a ser salva como snapshot no projeto, incluindo
  fornecedor, preço, moeda, região e data, sem depender de consultas futuras.
- Quantitativos, planilha, CSV e PDF passam a consumir esse snapshot: o preço
  escolhido prevalece sobre o catálogo atual, ofertas diferentes do mesmo
  produto ficam em linhas separadas e exibem fornecedor, região e data.
- O orçamento passa a exibir subtotais por fornecedor para as ofertas
  escolhidas, distinguindo explicitamente referências Vórtice de ofertas
  comerciais e preservando o total geral dos demais itens estimados.
- Cada fornecedor com oferta aplicada ganha um PDF isolado contendo somente
  seus itens e subtotal; a Referência Vórtice mantém identificação explícita
  de estimativa também nesse artefato.
- Materiais derivados automaticamente pelo quantitativo passam a carregar os
  metadados comerciais do preço resolvido. Cimento/placa com correspondência
  oficial entram em O Mercador; os demais entram na Referência Vórtice com
  região e data. O fallback de emergência continua sem fornecedor.
- Nove estimativas gerais antes mantidas apenas no código — rodapé, porta de
  madeira, soleira, pele/sacada de vidro, varanda, volumetria, escada e caixa
  hidráulica — passam a ter produtos e ofertas `market_reference` Vórtice no
  banco, com região Brasil e data da pesquisa.

> Corrigido: espigão de canto do hip (telha decorativa arredondada da quina, telhado quatro-águas) que caía dentro da pegada de outro telhado sobreposto no mesmo grupo agora é omitido da cena — sobra só o espigão que fica de fato sobre a quina externa. Product Owner testou ao vivo e reportou que o espigão marcado no print ainda continua aparecendo depois desta correção; causa raiz ainda não confirmada, investigação segue na próxima sessão. Ver DEC-152 (em aberto).

> Corrigido: telhado-vs-telhado sobreposto (dois quatro-águas, ou qualquer par que já se sobrepõe de verdade) tinha o espigão sobrevivendo onde devia sumir e z-fighting (piscar) na área de sobreposição — a comparação usava a altura literal de cada peça renderizada (água, tabeira, espigão) em vez da superfície real do próprio telhado, e um empate exato de altura entre dois telhados deixava os dois lados visíveis ao mesmo tempo. Agora cada telhado compara a PRÓPRIA superfície real contra o vizinho (peças de acabamento acompanham a água, não flutuam soltas) e um desempate mínimo e estável (5mm) garante que um empate exato sempre resolve pro mesmo lado, sem risco de sumir os dois. Ver DEC-151.

> Corrigido: dois telhados quatro-águas do mesmo grupo composto (perpendiculares entre si — par de "asas" de uma Cumeeira em níveis/Extensão lateral) apagavam tudo (água e tabeira) numa faixa reta exatamente onde os beirais se encostam, em vez de simplesmente sobrepor com sombreamento. Causa: um mecanismo antigo de corte de malha, construído só pra telhados duas-águas, era acionado por engano também pra quatro-águas sem saber calcular o plano de corte certo, apagando um retângulo inteiro sem seguir a inclinação. Restrito de volta só a pares duas-águas — quatro-águas passa a ser resolvido inteiramente pelo sombreamento por pixel já existente. Ver DEC-150.

> Corrigido: Escada — mesmo com a fresta fina eliminada (correção anterior), ainda restava uma faixa de laje atravessando o vão em certos casos. Causa: o corte gerava vários retângulos de lance que se TOCAM entre si (bordas adjacentes), cada um como um furo separado — e o motor de triangulação (earcut) não garante que furos vizinhos que só se tocam virem uma única região aberta, podendo deixar uma costura sólida na aresta compartilhada. Agora cada escada gera UM furo só, traçado pelo contorno real da união dos lances (formato L/U exato), sem furos vizinhos se tocando. Ver DEC-148 (8ª correção pós-lançamento da DEC-140).

> Corrigido: Escada — descartar a fresta fina do corte na laje (correção anterior) resolvia a malha quebrada mas literalmente deixava aquele pedaço de laje intocado, aparecendo como uma faixa sólida atravessando o vão da escada. Agora as bordas quase-coincidentes de lances vizinhos (L/U) são unidas ANTES do recorte, em vez de descartadas depois — elimina a fresta na origem sem perder nenhuma área do corte. Ver DEC-147 (7ª correção pós-lançamento da DEC-140).

> Corrigido: Escada — causa raiz da malha quebrada da laje do L/U confirmada com dados exatos: em certas posições/rotações, a decomposição dos retângulos de corte gerava uma fresta residual de milímetros de altura por metros de comprimento (resíduo de ponto flutuante entre bordas de lances vizinhos quase coincidentes) — esse tipo de hole quase-degenerado confunde a triangulação sem gerar erro de console. Frestas menores que 2cm agora são descartadas antes de virar furo. Granito passa a cobrir também a face frontal (espelho) do degrau, não só topo e laterais. Ver DEC-146 (6ª correção pós-lançamento da DEC-140).

> Corrigido: Escada — o corte na laje do L/U estava gerando uma malha quebrada (triângulos longos cruzando a laje inteira) porque os retângulos de lances vizinhos se sobrepunham de propósito na virada, e isso quebra a triangulação; agora cada retângulo é recortado contra os anteriores antes de virar furo, sem sobreposição, cobrindo a mesma área de antes. Escada desce mais um pouco (20mm) pra acabar de vez com o Z-fighting na laje. Ver DEC-145 (5ª correção pós-lançamento da DEC-140).

> Alterado/Corrigido: Escada — o corte na laje do L/U agora acompanha o formato REAL da escada (um retângulo por lance, encostados na quina da virada), não mais um retângulo único cobrindo todo o giro (que sobrava área no vão de dentro da curva). Granito passa a cobrir também as laterais dos degraus, não só a pisada. Corrigido Z-fighting entre o topo do último degrau e a laje (a malha visível desce alguns milímetros). Ver DEC-144 (4ª correção pós-lançamento da DEC-140).

> Corrigido: Escada em U estava sem textura de granito nenhuma (a malha desse arquivo específico precisa da normal em espaço mundo, não local, pra saber quais faces são "de cima") e tinha a viga de apoio escondida por engano em vez dos pés do patamar — a viga volta a aparecer, e agora só os pés (identificados pela geometria de verdade — tocam o chão) ficam de fora. Ver DEC-143 (3ª correção pós-lançamento da DEC-140).

> Corrigido: Escada em U ainda saía pequena e desproporcional — a causa raiz era o cálculo do bounding box do modelo (usa um modo aproximado que não lida bem com a rotação composta específica do arquivo do U). Granito passa a se aplicar só na pisada/patamar (face de cima), não mais no espelho vertical do degrau. Removidos os 4 pés de apoio do patamar da escada em U, a pedido. Ver DEC-142 (2ª correção pós-lançamento da DEC-140).

> Corrigido: Escada (modelos 3D, ver abaixo) — a pedra de granito estava caindo na viga de apoio em vez das pisadas, o corte na laje passava do limite do último degrau, e a escada em L saía achatada (a alça de largura, que só faz sentido no modelo reto, estava distorcendo o L inteiro). Ver DEC-141 (correção pós-lançamento da DEC-140).

> Alterado: Escada — a geometria procedural (blocos sólidos empilhados) dá lugar a 3 modelos 3D reais (reto/L/U), escalados automaticamente pro pé-direito do pavimento. Pisada em pedra de granito (mesma textura da soleira externa); corpo/espelho continua recolorível por acabamento. O corte na laje agora usa o contorno real do modelo carregado — fica exatamente no limite do último degrau, não mais uma fórmula solta. Formato (reto/L/U) escolhido depois de posicionar, num painel próprio ao lado do gizmo. Ver DEC-140.

> Adicionado: Escada (modelo reto) — posição e largura livres (arraste), rotação em passos de 90° (mesmo padrão de móvel/Bloco de Volumetria). Ao posicionar, fura automaticamente o buraco retangular na laje do pavimento; malha em degraus sólidos vencendo exatamente o pé-direito do pavimento (regra de Blondel). Aviso no rodapé (sem travar) se a base ficar longe de uma parede ou coluna. Entra no quantitativo como item posicionado, com preço de referência de mercado. Ver DEC-139.

> Alterado: traçado automático de esgoto/pluvial — o canto entre os dois trechos horizontais deixa de ser um cotovelo reto de 90° e vira um corte de duas curvas de 45°, como a NBR 8160 exige pra desvios de coletor/subcoletor (esgoto/pluvial, redes por gravidade). Água fria (pressurizada) continua com cotovelo de 90°, sem essa exigência normativa. Inclinação/declividade continua fora de escopo (decisão já tomada). Ver DEC-138.

> Corrigido: painéis flutuantes do telhado (mover/girar, tipo de água, cor da telha) ficavam sobrepostos ao selecionar um telhado — agora se empilham lado a lado, encostados sem sobrepor, usando a largura real de cada painel. Ver DEC-104.

> Adicionado: link de WhatsApp pra parceiros comerciais entrarem em contato, no menu Arquivo ("🤝 Seja um parceiro"). Ver DEC-103.

> Corrigido: logo do marcador de hover (ver abaixo) ficava apagada sobre a grama — ganhou fundo branco, traço mais grosso e mais escuro. Ver DEC-102 (correção pós-lançamento).
> Alterado: marcador de "onde o desenho vai começar" (a haste que aparece ao passar o mouse com uma ferramenta ativa) — o cubo verde no topo virou a logo do Esboce. Ver DEC-102.
> Adicionado: botão de exportar o orçamento em PDF, no painel de quantitativo (📄) — lista organizada por seção de categoria, total destacado, aviso de responsabilidade técnica e rodapé "Orçamento gerado por esboce.com.br". Ver DEC-101.
> Corrigido: quantitativo de orçamento — madeira do madeiramento de telhado (ripas/caibros/terças) ficava sem preço nenhum, era o único material que não tinha nem estimativa genérica. Passa a usar preço médio de mercado (varejo, R$/m³ sobre o volume total já calculado). Ver DEC-100 (correção pós-lançamento nº2).
> Alterado: quantitativo de orçamento (painel de materiais) — nenhum material fica mais sem preço de catálogo. Cimento usa o preço real do fornecedor "O Mercador"; cal, areia, concreto, aço e tijolo passam a usar preço médio de mercado pesquisado, cadastrado como produto de catálogo (fabricante "Vórtice Materiais") em vez de valor fixo escondido no código. Ver DEC-100 (correção pós-lançamento).
> Alterado: quantitativo de orçamento (painel de materiais) passa a usar o preço real do cimento do catálogo do fornecedor "O Mercador" (R$/kg calculado a partir do saco de 50kg à venda), em vez da referência genérica de mercado nacional — quando disponível, aparece rotulado como preço real, com o nome do produto de origem. Demais materiais estruturais (cal, areia, concreto, aço, bloco) continuam na referência genérica por ora — nenhum produto do catálogo hoje representa a mesma coisa que o quantitativo assume com segurança suficiente. Ver DEC-100.
> Alterado: reflexo do vidro das esquadrias (porta/janela) reduzido — ficava espelhado demais numa folha pequena, com a mesma calibração usada na fachada de vidro grande (Envidraçamento). O vidro da fachada continua igual. Ver DEC-99.

> Adicionado: parede (e oitão) agora também pode usar textura real (foto + relevo + rugosidade) — mesma melhoria do piso (ver abaixo), agora na ferramenta Pintar > Paredes. Primeiro produto disponível: pedra empilhada (teste). Ver DEC-98.

> Adicionado: piso agora pode usar textura real (foto + relevo + rugosidade), com o padrão físico mantido em tamanho real de metros — antes todo piso usava só um padrão de cerâmica desenhado (cor sólida + linha de rejunte), mesmo quando o produto escolhido tinha uma textura de verdade cadastrada. Primeiro produto disponível: piso laminado (teste). Ver DEC-97.

> Alterado: arrastar uma parede pra empurrá-la agora permite chegar até encostar numa parede paralela e fundir as duas (o trecho compartilhado vira uma parede só), em vez de parar meio metro antes dela sem nunca conseguir fundir. Continua não sendo possível atravessar a parede pro outro lado. Vale nas duas visualizações (3D e 2D). Ver DEC-96.

> Corrigido: telhado/parapeito que tocava a parede compartilhada de um cômodo mais alto, mas tinha o centro em um cômodo mais baixo, ficava com a parede "furando" por cima (dava pra ver através, por cima do parapeito). Agora o telhado nunca fica mais baixo que a parede compartilhada mais alta que ele toca, mesmo com o centro caindo no cômodo baixo. Ver DEC-95.

> Adicionado: o telhado (tanto o fantasma da ferramenta quanto o já colocado) agora acompanha a altura PRÓPRIA do cômodo embaixo dele — passe o mouse sobre um cômodo mais alto (altura individual, ver DEC-88) e o telhado fantasma sobe sozinho pra ficar sobre ele, em vez de ficar preso na altura padrão do pavimento inteiro. Ver DEC-94.

> Corrigido: uma junção em T ainda podia mostrar uma rachadura fina (linha do chão ao teto) bem no meio da face de uma parede vizinha, mesmo com o volume da parede já fechado por completo — a linha de contorno era desenhada num ponto que não é uma aresta de verdade. Ver DEC-93.

> Corrigido: parede compartilhada entre um cômodo alto e um cômodo baixo podia ficar "esquecida" na altura antiga (não só no canto — na extensão inteira dela) depois de uma mudança de topologia posterior ao arraste que levantou o cômodo. A altura de cada parede agora é recalculada sempre a partir dos cômodos que ela fecha, então fica correta não importa a ordem das edições. Ver DEC-92.

> Corrigido: canto entre duas paredes de alturas diferentes (altura de cômodo individual, ver DEC-88) podia ficar aberto — sem "tampinha" fechando a quina — depois de arrastar uma parede próxima e reconstruir o encontro entre elas. A parede mais alta agora ganha uma tampa extra cobrindo exatamente a faixa acima da altura da vizinha mais baixa. Ver DEC-91.

> Alterado: laje deixa de ser automática — cômodo nasce sem laje visível nem contabilizada no orçamento. Novo botão "Gerar Laje" (grupo Cobertura, na barra lateral) cobre de uma vez todos os cômodos fechados do pavimento atual; cada laje continua sendo uma peça individual do próprio cômodo, não uma peça única fundida. A laje agora cobre o cômodo inteiro rente à face EXTERNA da parede (antes parava na face interna, igual o piso). Um cômodo criado depois de clicar o botão nasce sem laje de novo — clique outra vez pra cobrir ele também. Ver DEC-90.

> Corrigido: dois bugs da altura de cômodo individual. (1) A laje do cômodo VIZINHO estava subindo junto quando só um cômodo era levantado — a parede compartilhada, corretamente elevada pra acompanhar o cômodo mais alto, fazia o vizinho achar que também precisava de teto mais alto; agora cada cômodo calcula sua própria altura só pelas paredes exclusivas dele. (2) Arrastar uma parede perto de um cômodo com altura customizada podia "abrir um buraco" nela — dividir/fundir parede em uma junção não copiava a altura customizada pro pedaço novo, que caía pra altura padrão no meio do caminho. Ver DEC-89.

> Adicionado: altura de CÔMODO individual — selecione uma parede e arraste a nova alça roxa (acima dela) pra cima/baixo pra aumentar ou diminuir o pé-direito só daquele cômodo (ex.: uma sala com teto mais alto). Parede compartilhada entre dois cômodos de alturas diferentes sempre fica com a altura do cômodo mais alto, nunca deixa o vizinho sem parede no lugar certo. A laje automática do cômodo acompanha sozinha. Ver DEC-88.

> Melhorado: arrastar uma parede (empurrar/redimensionar) agora move uma prévia translúcida em vez de reconstruir a casa inteira a cada movimento do mouse — a parede de verdade só regenera ao soltar, mesmo princípio já usado no arraste de cômodo, telhado, envidraçamento e bloco de volumetria. Deixa o arraste bem mais fluido, principalmente em projetos maiores. Ver DEC-87.

> Alterado: laje de entrepiso deixa de ser um objeto colocável manualmente (arrastar/redimensionar) e passa a nascer automática, uma por cômodo fechado, dentro do contorno de parede — exatamente como o piso já funciona, inclusive acompanhando a parede quando ela é arrastada. Varanda, balanço/sacada e vão aberto (ex.: poço de escada) deixam de ter cobertura automática de laje por enquanto. Ver DEC-86.

> Corrigido: catálogo de produtos — a busca de produtos não tinha paginação e ficava sujeita ao limite de "Max Rows" do Supabase (1000 por padrão), cortando produtos de departamentos inteiros silenciosamente sempre que o catálogo passasse desse total. Agora busca em páginas, sem depender de configurar esse limite manualmente. Ver DEC-85 (correção pós-lançamento nº3).

> Corrigido: catálogo do fornecedor "O Mercador" — os produtos reclassificados pra "Tintas" e "Louças e Metais" (departamentos que já existiam) tinham ficado sem vínculo nenhum de departamento, então sumiam do catálogo por completo. Ver DEC-85 (correção pós-lançamento nº2).

> Corrigido: catálogo do fornecedor "O Mercador" — as tintas do Mercador estavam numa aba separada ("Tintas e Vernizes") da aba "Tintas" que já existia com produtos genéricos, e vaso sanitário/torneira/chuveiro/cuba (152 produtos) estavam dentro de "Hidráulica" em vez do departamento "Louças e Metais" que já existia pra isso. Ver DEC-85 (correção pós-lançamento nº1).

> Adicionado: catálogo do fornecedor "O Mercador" — 2.119 produtos triados (de um catálogo de origem com 6.081 itens) com relação direta com orçamento de obra: Hidráulica, Elétrica, Tintas e Vernizes, Pisos e Revestimentos, Cimento e Argamassa, Cobertura, Esquadrias e Ferragens, Impermeabilização, Ferro e Aço, Tijolos e Blocos, Areia/Brita/Agregados e Madeiras. Ferramentas, abrasivos, EPI, fixação avulsa e itens sem relação com construção ficaram de fora. Ver DEC-85.

> Corrigido: uma das duas linhas de risco na parede colinear ainda aparecia depois da correção anterior — faltava zerar `extended`, não só `free`. Ver DEC-83 (emenda à correção nº5).

> Corrigido: bug de fundo em `Core.computeWallFootprints` — uma parede reta dividida em dois pedaços (por causa de uma junção em T) ganhava linhas de aresta/tampa no meio dela, sem canto nenhum ali, sempre que sobrava só 1 vizinho colinear (ex.: depois de demolir a parede perpendicular que fazia a junção). Corrigido sem afetar o caso de dobra rasa de verdade, que continua se comportando igual. Ver DEC-83 (correção pós-lançamento nº5).

> Corrigido: "Quebrar parede" — sobrava um buraco no piso do tamanho da espessura da parede quebrada (a mesma "fresta" que a soleira do arco já resolvia, mas nunca era acionada pra uma parede inteira demolida). Agora ganha soleira igual arco/porta — interna (entre dois cômodos) ou externa (parede de fora), cobrindo o comprimento todo. Ver DEC-83 (correção pós-lançamento nº4).

> Corrigido: "Quebrar parede" — a ponta livre da parede vizinha (esquina, inclusive externa) tinha o canto certo mas nenhuma superfície fechando de verdade (dava pra ver através dela). Agora tem uma tampa visível de material igual ao resto da parede. Ver DEC-83 (correção pós-lançamento nº3).

> Corrigido: "Quebrar parede" — o rodapé (e o contorno preto do piso) continuava desenhado ao longo de uma parede já quebrada, dos dois lados. Confirmado também que a esquina fecha certo em paredes externas, não só internas. Ver DEC-83 (correção pós-lançamento nº2).

> Corrigido: "Quebrar parede" — a parede vizinha ficava com um entalhe/fresta aberta na esquina em vez de uma ponta reta fechada. Ver DEC-83 (correção pós-lançamento).

> Adicionado: camada "Paredes transparentes" no menu de Camadas visíveis — deixa as paredes vazadas (só a opacidade, continuam clicáveis) pra comparar melhor com uma Planta Baixa importada no chão. Ver DEC-84.

> Corrigido: "Quebrar parede" — antes apagava a parede de verdade, o que desfazia o fechamento do cômodo e sumia o piso inteiro daquele ambiente. Agora só marca a parede como demolida: ela some da vista 2D/3D e para de contar no quantitativo de materiais/orçamento, mas continua "por baixo" fechando o cômodo — o piso não desaparece mais. Ver DEC-83.

> Corrigido: Planta Baixa importada — o menu de mover/girar/escalar só aparecia um instante depois de importar e sumia pra sempre no primeiro clique em outro lugar (o uso normal, desenhar parede em cima). Agora o botão "Importar planta" vira "Editar planta" e reabre o menu a qualquer momento. Corrigido também um `types.ts` que tinha ficado de fora do commit anterior e quebrava o build de Produção.

> Adicionado: importar planta baixa (imagem ou PDF) como referência visual no chão do pavimento na vista 3D — clique em "Importar planta", solte a imagem/PDF, e ela aparece deitada no chão, pronta pra desenhar as paredes por cima. Mover/girar/escalar (mantendo a proporção) pelo menu que aparece depois de importar. Ver DEC-82.

> Corrigido: Volumetria — o encosto na parede tinha tolerância apertada (1m) e nenhum aviso de sucesso/falha, o que fazia parecer que não funcionava; aumentada pra 1,5m e agora avisa no rodapé se encostou ou não. Também corrigido um bug que zerava a seleção do volume a cada mudança no modelo.

> Adicionado: gizmo próprio do volume (Volumetria) com botões de subir/descer (altura em relação ao chão) e aumentar/diminuir largura e altura do próprio volume, em passos de 0,1m.

> Adicionado: seção "Fachada" reestruturada na barra lateral — botão-mestre que abre um container com Envidraçamento, Volumetria, Ornamentos (em breve) e Brises (em breve). Nova ferramenta "Volumetria": cria um bloco sólido (1x1x0,3m) que nasce solto, arrasta livre e encosta numa parede (protrai pra fora dela, sem recortar). Ver DEC-81.

> Adicionado: novo botão de cômodo "Área de Circulação" (1x1m) na barra lateral, junto dos demais (Banheiro, Quarto, Sala, Garagem, Lavanderia, Escritório) — clique cria as 4 paredes já no tamanho, igual os outros. Ver DEC-80.

> Corrigido: vidro de porta/janela agora tem transparência de verdade (dá pra enxergar através), mantendo o reflexo. Corrigido também: uma "tampinha" fecha o requadro entre o caixilho do modelo e a espessura da parede — antes sobrava uma folga crua, sem acabamento, visível de ângulos mais abertos.

> Corrigido: vidro dos modelos de porta/janela aparecia preto/opaco em vez de transparente (o arquivo original não tinha dado de transparência real gravado). Agora usa o mesmo material de vidro (reflexo espelhado) já usado no envidraçamento da casa.

> Adicionado: painel de seleção de esquadria — clique em "Janela" ou "Porta" agora abre um painel com abas por material do caixilho (Vidro, Alumínio, PVC, Madeira) e a lista de modelos 3D disponíveis dentro de cada aba, cada um com miniatura de imagem real. Escolher um modelo antes de clicar na parede já cria a porta/janela com aquele modelo aplicado e do tamanho certo — sem precisar mais do console do navegador. Todas as 17 esquadrias de vidro já têm miniatura; as abas Alumínio, PVC e Madeira aparecem como "em breve" até chegar modelo de cada uma. Ver DEC-77.

> Corrigido: a janela antes chamada "Máximo-Ar 700x500" tem o nome certo corrigido pra "Basculante 700x500".

> Corrigido: box de chuveiro de canto (já existente) e box de chuveiro reto (novo, 1500x2000mm) são dois produtos separados no Catálogo agora — a entrada anterior deste changelog tratava errado o box reto como substituto do de canto.

> Adicionado: 6 janelas de correr (500 a 3000mm) e 1 Máximo-Ar com modelo 3D real no Catálogo. Ver DEC-76.

> Adicionado: mais 9 modelos reais (glTF) de porta ao Catálogo — 5 portas de vidro (600 a 1000mm de largura), 3 de giro (1200 a 2000mm) e 2 de correr (2500 e 3000mm). Junto com a porta de teste anterior, já são 10 opções de porta com modelo 3D real disponíveis. Ver DEC-75.

> Adicionado: primeiro modelo real (glTF) de esquadria — "Porta de Vidro 1000x2100" — no lugar da geometria gerada na hora. Portas/janelas podem agora referenciar um modelo 3D do Catálogo (`Opening.productId`); sem escolher nenhum, continua tudo como sempre. Mais modelos da mesma família (janelas de correr/giro, portas de correr/giro em vários tamanhos) entram conforme forem chegando. Ver DEC-74.

> Corrigido: parapeito da platibanda não "casava" com a parede debaixo dele mesmo os dois estando no grid — agora, ao arrastar a borda de um telhado perto o bastante de uma parede, ela gruda exatamente no eixo daquela parede (não só no ponto de grid genérico mais próximo). Removida a textura de reboco de toda a casa (paredes, parapeito da platibanda, laje, empena/oitão e reveal de arco) — acabamento cerâmico já escolhido continua normal, só o material padrão sem acabamento voltou a ser cor lisa. Ver DEC-73.

> Corrigido: telhado tipo platibanda agora se funde ao encostar em outro (arrastar até tocar), igual já acontecia com duasAguas/quatroAguas — antes ficavam como peças separadas para sempre, mesmo lado a lado. As bordas continuam podendo ser arrastadas individualmente depois de fundido, mesmo comportamento já existente de cômodo/laje. Ver DEC-72.

> Corrigido: os pontos hidráulicos criados nos painéis 2D (parede e piso) podiam aparecer longe de onde o clique realmente foi — os painéis tinham uma caixa com proporção fixa, e quando o formato real da parede/cômodo não batia com ela, sobrava uma margem vazia (mesma cor de fundo, sem indicação visual) que também "contava" como clicável. Painéis agora se ajustam à proporção real do conteúdo, sem sobra. De quebra, o painel do piso ganhou a mesma silhueta de móveis que o painel de parede já tinha. Ver DEC-71.

> Corrigido: silhueta de móveis no painel de elevação (DEC-69) não aparecia pros móveis padrão de um cômodo "Cozinha" (mesa e armário ficavam bem em cima do limite antigo de 1 m). Raio de detecção subiu pra 2 m. Ver DEC-70.

> Painel de elevação da parede (posicionamento de ponto hidráulico) agora desenha a silhueta dos móveis já instalados perto daquela parede — referência visual pra não posicionar um ponto atrás de um armário, por exemplo. Usa a caixa delimitadora real do móvel já carregado na cena 3D (não tem dimensão fixa em catálogo), só mostra o que está a até 1 m da parede. Ver DEC-69.

> Móvel (vaso, pia, box de banheiro etc.) vira referência visual durante o posicionamento de um ponto hidráulico — continua aparecendo normalmente na cena 3D, mas para de "roubar" o clique da parede/piso atrás dele, então dá pra selecionar a parede mesmo com o móvel na frente. Ver DEC-66.

> Aba 2D do piso para ralos e outros pontos de piso, reaproveitando o mesmo `Scene2DRenderer` da planta 2D real do projeto — abre direto ao ativar a ferramenta, sem etapa extra. Posicionamento de pontos de piso deixou de travar no grid técnico: agora é livre, exatamente onde o usuário clicar (pontos de parede continuam presos ao eixo da parede, como sempre). Ver DEC-65.

> H2 completa: percurso guiado de água fria, de ponta a ponta. Botão novo no ponto selecionado ("Desenhar percurso até a caixa d'água") entra num modo de clique-clique — cada clique vira um ponto-guia, com barra de "Concluir/Cancelar" (Enter/Esc também funcionam). Um ponto-guia já posicionado pode ser arrastado depois, com prévia fantasma e cotas de altura/distância ao vivo (reaproveita a DEC-63). O botão "Gerar tubulação" (rota automática) e o novo percurso manual passaram a conviver: a rota automática nunca sobrescreve mais um percurso desenhado à mão, e a origem (caixa d'água) passou a ser reaproveitada entre os dois em vez de recriada, evitando trechos órfãos. Ver DEC-64 (fecha a DEC-61).

> Fluxo guiado de posicionamento de ponto hidráulico, completo: ao ativar um ponto de parede (pia, lavatório, chuveiro, torneira externa, água vaso), um prompt central pede pra escolher a parede; escolhida a parede, abre um painel com a elevação dela (distância × altura) onde os pontos são posicionados com precisão, mostrando a altura usual do aparelho (quando existe referência de fonte técnica) e os pontos já existentes ali. Arrastar um ponto já posicionado mostra cotas de altura e distância às duas pontas da parede em tempo real. Pontos de piso continuam sendo criados direto no clique, sem painel. Ver DEC-63 (interação) e DEC-62 (dados de referência e cotas locais).

> Corrigido mais um lote de encoding quebrado (5 ocorrências da palavra "câmera", em `EsboceApplication.ts` e `ViewportController.ts` — botão mobile, comentário e duas mensagens de modo câmera no toque) que não tinha sido pego na varredura anterior.

> Base de domínio para o fluxo guiado de posicionamento de ponto hidráulico: altura de referência (fonte Tigre, quando existe correspondência sem ambiguidade) exposta no catálogo de aparelhos, e funções que calculam a distância de um ponto às duas pontas da parede em metros (e o inverso) — preparação para o painel de elevação da parede e as cotas ao vivo durante o arraste, ainda não implementados. Ver DEC-62.

> Corrigido encoding quebrado em quatro strings herdadas do merge da hidráulica (mensagens do botão "Gerar tubulação", do toast de rede gerada, do modo construção mobile e um comentário) — apareciam como "Ã§Ã£", "Ã¡" etc. na tela em vez de acentuação normal.

> Base de domínio para o percurso guiado de água fria (H2, primeira etapa): novas funções puras que constroem o trecho horizontal entre a caixa d'água e um ponto de consumo a partir de pontos-guia informados, e que classificam cada nó da rede (trecho reto, cotovelo de 45°/90°, tê) só pela geometria dos trechos que se encontram ali, sem depender de regra normativa. Nós e trechos de um percurso guiado ficam marcados com o ponto de consumo a que pertencem, para permitir redesenhar um sem afetar os demais já roteados. Documento versionado sobe para `schemaVersion` 8. Ainda não há interação no editor para desenhar o percurso — só a camada de domínio, testada isoladamente. Ver DEC-61.

> Pontos hidráulicos instalados em paredes compartilhadas agora permitem alternar explicitamente entre as duas faces pelo comando **Trocar lado** (`⇄`). A escolha fica salva no projeto, sem alterar a posição técnica no eixo da parede, a altura do ponto ou o percurso da tubulação.

> Pontos hidráulicos passam a aceitar reposicionamento em duas direções: arraste lateral desliza pela parede e arraste vertical altera a altura entre 5 cm e 2,60 m. A legenda é ocultada durante o gesto e os marcadores de saída permanecem visíveis mesmo quando a face da parede estaria à frente deles.

> Corrigido o reposicionamento posterior dos pontos hidráulicos: um ponto existente agora recebe prioridade mesmo quando a ferramenta de inserção continua ativa. Ao soltar um ponto depois de gerar a rede, o percurso de água fria é recalculado para a nova posição.

> Pontos de saída hidráulica continuam tecnicamente presos ao eixo da parede, mas seus marcadores agora são deslocados para além da face acabada. Pontos internos aparecem na face voltada à planta; a torneira externa aparece na face oposta.

> Refinamento visual dos pontos hidráulicos: saídas de água passam a ser pequenas esferas ciano permanentemente visíveis. O nome técnico fica oculto durante a edição normal e aparece somente quando o usuário seleciona o ponto.

> Correção da interface hidráulica: o botão **Hid.** abre um painel flutuante próprio, sem ficar recortado pela sidebar. A arquitetura de percurso também foi definida: o usuário posicionará somente pontos-guia e o Esboce escolherá automaticamente joelhos, tês e demais conexões conforme a geometria e as regras técnicas.

> Atualização hidráulica: o botão **Hid.** agora abre as ferramentas de pontos empilhadas. Cada ponto técnico permanece identificado na cena, acompanha o reposicionamento e pode ser usado para gerar a primeira rede de água fria. A geração cria uma caixa d'água genérica acima do último pavimento e traça ramais ortogonais até todos os pontos de água posicionados.

> AtualizaÃ§Ã£o hidrÃ¡ulica: pontos posicionÃ¡veis agora podem ser selecionados, arrastados e excluÃ­dos. Pontos de parede permanecem na parede hospedeira, pontos de piso permanecem no grid e o projeto sÃ³ Ã© atualizado ao soltar.

Todas as alterações relevantes do Esboce serão registradas neste arquivo.

---

# Não lançado — estabilização pré-comercial

## Plataforma, persistência e qualidade

- Adicionada ao catálogo a página **Bold · ACM**, com dez referências públicas de chapas, sete conjuntos PBR, aplicação em fachada/volumetria, dimensões, preços datados e links para o catálogo e o manual do fabricante. A interface deixa explícito que não representa parceria oficial nem proposta comercial.
- Reconciliada a estabilização geométrica com o `main`: cálculos compartilhados de fundação, oitão e cobertura foram consolidados em `QuantityGeometry.ts`, sem duplicar as regras usadas pelo quantitativo.
- Projetos salvos passaram a usar documento versionado (`schemaVersion`), normalização e validação de estrutura, tamanho, tipos, identificadores duplicados e referências órfãs. Documentos legados suportados são migrados na leitura; versões futuras incompatíveis são recusadas com mensagem clara.
- Adicionados exportação e importação de backup JSON. O salvamento e a abertura pelo Supabase usam a mesma validação do backup.
- Corrigido o ciclo de projetos autenticados: criar, atualizar, listar em **Meus projetos**, abrir por link e iniciar um projeto novo sem perder o projeto anteriormente salvo.
- Criados gates de qualidade no GitHub Actions: testes, verificação TypeScript e build antecedem a publicação. O deploy do `main` no GitHub Pages só ocorre quando todos passam.
- Baseline atual validada com **135 testes automatizados**.
- Adicionado o **Terreno** (opcional, definível a qualquer momento pelo botão na sidebar): digite a largura e o comprimento do lote e um retângulo-guia aparece na cena; clique em cada lado pra adicionar ou remover um muro ali. O muro reaproveita parede completa (acabamento por face; portão/porta ainda não tem ferramenta própria — pendente). Documento versionado sobe para `schemaVersion` 6. Ver ADR-008 e DEC-59/DEC-60.

## Conta, segurança e conformidade

- Publicados Termos de Uso e Política de Privacidade, com versões explícitas e aceite separado e rastreável no Supabase. Uma nova versão jurídica exige novo aceite.
- Implementados cadastro, login, confirmação de e-mail, recuperação e redefinição de senha, troca de senha autenticada, reautenticação e exclusão integral da conta e de seus dados associados.
- Senhas passaram a exigir no mínimo oito caracteres no cliente e no Supabase. Mensagens distinguem campos divergentes, link inválido/expirado e limite temporário de envio.
- E-mails transacionais usam SMTP próprio via Resend, domínio verificado e remetente do domínio `esboce.com.br`; modelos de confirmação e recuperação foram personalizados em português.
- Cloudflare Turnstile passou a proteger cadastro, login, recuperação e reautenticação contra abuso automatizado. A chave secreta permanece somente no Supabase.
- A Política de Privacidade passou a identificar os operadores técnicos usados em produção: Supabase, GitHub Pages, Resend, Cloudflare Turnstile e Sentry.

## Operação e monitoramento

- Adicionado monitoramento de erros de produção com Sentry, ativo apenas no domínio oficial. A configuração desativa PII padrão, breadcrumbs, replay, tracing e logs; um filtro remove identidade, conteúdos adicionais e parâmetros sensíveis antes do envio.
- O envio de e-mail transacional foi validado ponta a ponta com o domínio próprio e o fluxo de recuperação de senha.
- O site oficial permanece publicado em `https://esboce.com.br`; branches de mudança visual usam prévias isoladas da Vercel antes do merge.

## Interface e viewport

- Iniciada a fase H1 do sistema hidráulico paramétrico: o projeto agora persiste pontos e segmentos de redes, renderiza tubos genéricos procedurais por diâmetro e finalidade e oferece um botão **Hid.** para gerar/ocultar um circuito residencial de demonstração. Documentos antigos migram para `schemaVersion` 7 com rede vazia, sem perda de conteúdo.
- O circuito H1 de água fria passou a localizar o armário de cozinha como ponto provisório de pia e gerar ramal superior, prumada e ramal baixo exclusivamente em trechos ortogonais, eliminando a tubulação diagonal da primeira demonstração.
- Criado o primeiro gabarito hidráulico independente do modelo 3D: a pia genérica possui conector de água fria com posição, altura e rotação próprias; o nó guarda a referência ao equipamento e ao conector, enquanto marcadores de junção foram reduzidos e o ponto terminal ganhou símbolo próprio.

- O arraste de cômodos isolados, móveis, colunas, lajes, conjuntos de telhados e fachadas de glazing passou a usar prévia incremental: durante o movimento, somente os objetos 3D envolvidos mudam de posição; o documento do projeto é atualizado uma única vez ao soltar. Isso elimina reconstruções completas da cena a cada evento do ponteiro e reduz fortemente o atraso em projetos maiores.
- O cadastro passa a enviar nome, telefone e endereço como metadados do Auth; um trigger seguro cria `public.profiles` junto com `auth.users`, sem depender da confirmação de e-mail, do primeiro login ou do `localStorage`. A migração também recupera contas anteriores quando esses metadados estiverem disponíveis, sem sobrescrever perfis existentes.
- Adicionada a categoria **Envidraçamento**, com a primeira ferramenta **Fachada**: o botão cria um painel de vidro solto na cena — arraste o corpo pra posicionar e, ao soltar perto de uma parede, ele encosta sozinho (ímã) e recorta de verdade a camada visível dela nesse trecho, mantendo a parede contando normalmente no quantitativo de alvenaria. O painel trava no tamanho disponível da parede ao encostar. Selecione o painel pra excluir. O preenchimento é o grid de verdade: moldura de contorno e perfis pretos, vidros com encaixe exato nos dois eixos e junta de 10mm entre eles, com acabamento espelhado (reflete o céu e o entorno da cena) — proporções e material calibrados a partir de um modelo de referência real. Substitui por completo a fachada de vidro paramétrica anterior (botão 🪟 numa parede inteira), que nunca chegou a ser publicada. Ver DEC-56 no Registro de Decisões Técnicas (revisão da DEC-55).
- A Fachada ganhou redimensionamento por duas alças laterais e uma superior. Durante o gesto aparece somente uma cópia translúcida, mantendo o objeto definitivo e o Store intactos; ao soltar, largura/altura são confirmadas uma única vez e o grid redistribui automaticamente módulos inteiros, vidros e perfis. A borda oposta permanece fixa no ajuste lateral e painéis anexados respeitam os limites da parede hospedeira.
- O vidro da Fachada passou a respeitar o `doubleSided` e o modo de transparência do GLB de referência. Todas as células são renderizadas por uma única malha instanciada, eliminando a alternância entre placas claras e escuras causada pela ordenação individual de objetos transparentes ao girar a câmera. A prévia de redimensionamento também foi simplificada para um único volume fantasma; perfis e vidros definitivos só são regenerados ao soltar.
- O acabamento da Fachada foi calibrado para vidro realmente espelhado no ambiente do Esboce: mantém metalicidade e baixa rugosidade do GLB, ganha reflexo de ambiente mais intenso e deixa de aplicar o alpha translúcido exportado, que fazia as placas parecerem ausentes sobre o terreno claro.
- A calibração do espelho foi equilibrada para a iluminação real da viewport: metalicidade reduzida para uma mistura refletiva/difusa, tonalidade azul-cinza mais clara e contribuição ambiente mínima evitam que o vidro fique totalmente preto quando não há um HDRI forte refletido naquele ângulo.
- Portas e janelas em paredes associadas ao ático agora recortam também o complemento inclinado, incluindo o volume estrutural e as duas faces texturizadas. O limite superior disponível é calculado pelo ponto mais baixo do telhado sobre toda a largura do vão.
- A antiga criação separada de **Ático** foi incorporada ao fluxo de **Telhado**. Ao iniciar uma cobertura, o usuário escolhe telhado normal ou ático/chalé; o ático nasce como duas águas transparente, tem altura de beiral ajustável por alça e só associa/recorta as paredes quando o usuário confirma em **Gerar ático**. A associação é paramétrica, persistida e usada no 3D e nos quantitativos. Varandas existentes continuam legíveis apenas por compatibilidade.
- Projetos novos agora começam pela escolha obrigatória entre **Tijolos**, **Bloco estrutural** e **Steel Frame**, apresentada em três cartões visuais. A escolha integra o documento versionado, o backup e o compartilhamento; projetos legados são migrados para Tijolos.
- A barra superior mantém o sistema construtivo do projeto visível durante toda a edição e o atualiza ao criar, abrir ou importar um projeto.
- O painel e a planilha de materiais passaram a respeitar o sistema escolhido. Enquanto as composições próprias de bloco estrutural e Steel Frame não estiverem implementadas, o Esboce mantém áreas e itens comuns, mas não apresenta a composição cerâmica como se fosse válida para esses sistemas.

- Melhorados layout e gestos em telas móveis, incluindo rotação da câmera com dois dedos e pinça para zoom. Uma revisão móvel mais ampla permanece planejada para depois da estabilização desktop.
- O viewport ganhou céu em degradê gerado em código, iluminação hemisférica e solar mais natural e terreno ampliado, sem imagem panorâmica nem custo relevante de download.
- A névoa inicialmente testada foi removida por criar uma faixa esbranquiçada artificial sobre o chão; o terreno permanece visualmente uniforme.

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

## Adicionado — pontos hidráulicos posicionáveis

- Catálogo inicial de pontos de água e esgoto com snap técnico no eixo da parede ou no grid do piso.
- Pontos independentes dos móveis preservam tipo, altura, rede, pavimento e parede hospedeira no projeto salvo.

## Adicionado — editor 2D (fase 1)

- O botão **2D** abre uma planta técnica sincronizada com o mesmo projeto usado pela viewport 3D.
- A planta apresenta grid branco, paredes, aberturas, pilares, lajes, telhados, terreno e muros do pavimento atual.
- A navegação 2D oferece enquadramento automático, zoom e deslocamento sem modificar a geometria do projeto.
- A implementação foi isolada em `Scene2DRenderer` e `Viewport2DController`, preparando a edição 2D e os fluxos de PDF das próximas fases.

## Adicionado — edição 2D (fase 2, primeiro bloco)

- Paredes e cômodos isolados agora podem ser selecionados diretamente na planta 2D.
- Cômodos isolados podem ser arrastados individualmente: o gesto move uma prévia vetorial transparente e confirma paredes e móveis uma única vez ao soltar.
- Paredes selecionadas exibem uma alça central no 2D; o arraste move somente a parede e preserva as quinas conectadas, com confirmação única ao soltar.
- A ferramenta **Cômodo livre** cria um retângulo por dois cliques, com snap e prévia vetorial antes da confirmação no mesmo `Store` do 3D.
- `Esc` cancela uma criação 2D em andamento sem modificar o projeto.

## Adicionado (aviso de responsabilidade técnica)

- **Card de boas-vindas com aviso de responsabilidade técnica**, centralizado sobre a viewport ao abrir o Esboce — implementa o que a ADR-006 já exigia ("o aviso não deve ficar escondido") mas nunca tinha ganhado UI. Dois parágrafos: o primeiro explica pra que o Esboce se propõe (desenhar a casa em 3D, escolher acabamento/produto de fornecedor real, quantitativo de materiais e estimativa de orçamento), o segundo deixa claro que é um complemento, não substitui arquiteto/engenheiro. Some com um clique consciente em "Entendi" (não fecha sozinho); a escolha fica lembrada por navegador (localStorage), não reaparece a cada carregamento. Paleta própria — vermelho-vinho + dourado — deliberadamente diferente do resto do app, pra se destacar. Sem fundo opaco cobrindo a viewport (backdrop leve só), coerente com o princípio de nenhum elemento tampar a cena 3D por completo. Ver DEC-46 no Registro de Decisões Técnicas.

## Documentação

- Fechada a pendência "fundação pra Laje" (registrada na DEC-42/DEC-43): definido que **Laje é sempre entrepiso** — nunca fica em contato com o solo, nunca gera fundação própria. Laje em contato com o solo já é responsabilidade do tipo de fundação **radier**, que já existe. Sem mudança de código — o comportamento atual já estava certo, só faltava essa definição registrada. Ver DEC-44 no Registro de Decisões Técnicas.

## Adicionado (quantitativo de materiais)

- **Madeiramento de telhado (ripa, caibro, terça) agora entra no quantitativo**, referenciado na composição real **SINAPI 92539** (trama de madeira pra telhados até 2 águas, telha cerâmica/concreto): ripa 1,5×5cm a cada 0,32m, caibro 5×6cm a cada 0,55m, terça 6×12cm a cada 1,75m, com 10% de perda. Aplica a qualquer telhado com água (duas/quatro águas, uma água) — platibanda fica de fora, por ser laje de concreto sem madeiramento. Sem custo estimado (não achei referência de mercado confiável pra madeira serrada bruta — a linha aparece com quantidade, sem inventar preço). Tesoura (treliça) e frechal ficam fora de escopo por ora. Ver DEC-45 no Registro de Decisões Técnicas.
- **Verga (reforço acima de qualquer vão — porta, janela ou arco) agora entra no quantitativo.** Antes só existia visualmente (continuação da textura de parede acima do vão), sem nenhum concreto/aço contado. Agora: volume por abertura = (largura do vão + 20cm de apoio de cada lado) × espessura da parede × altura de seção (reaproveitando a mesma altura que a cinta já usa), aço pela mesma taxa de superestrutura de pilarete/cinta (100 kg/m³). Aparece agregado no painel e na planilha/CSV, mesmo tratamento que pilarete/cinta já recebem. Ver DEC-43 no Registro de Decisões Técnicas.
- **Laje agora entra no quantitativo de materiais.** A entidade Laje (polígono livre, arrastável, por pavimento) existia na cena, mas nunca era contada no orçamento — nem área, nem concreto, nem aço. Agora: volume = área × espessura real (0,15m, a mesma que o 3D já usa pra desenhar), aço numa taxa própria de **90 kg/m³** (mais baixa que a de viga/pilar, 100 kg/m³, porque armação de laje maciça é mais distribuída). Sem viga própria por laje — a viga de cinta que já existe já cumpre esse papel de apoio; somar as duas duplicaria a peça. Vão de laje sem apoio intermediário fica fora de escopo (fica pro projeto estrutural, mesmo tratamento que pilarete de parede já dá pro vão grande). Aparece nos três lugares que já existiam pra outros itens: painel de quantitativo, planilha/CSV e detalhe elemento-a-elemento. Ver DEC-42 no Registro de Decisões Técnicas.

## Documentação

- Nova **ADR-007 — Catálogo Multi-Loja, Vínculo com Modelos 3D e Orçamento por Loja**: formaliza a separação Produto/Loja/Oferta, o escopo por cidade, o vínculo (por id compartilhado) entre o catálogo do Supabase (preço/loja/foto) e o catálogo local (modelos 3D), a regra de que só produtos de departamentos de acabamento têm modelo 3D, e o fluxo de finalização de projeto → quantitativo → orçamento agrupado por loja. Indexada em "Decisões relacionadas" na Arquitetura.md.
- Corrigido nome de arquivo da ADR-006 (estava sem `.md` e com travessão em vez de hífen, deixando o link dela na Arquitetura.md quebrado) — renomeado pra bater com a convenção das demais ADRs.

## Corrigido (sidebar + barra inferior)

- Corrigida sobreposição: a pill de Grid/Cotas/Ajustes/Visualização (barra inferior) ficava por cima do rodapé do sidebar de ferramentas — os dois terminavam perto do fundo da tela na mesma faixa horizontal. Resolvida também a raiz de outro problema: a seção "Produtos" (Catálogo/Adicionar produto) ficava tão embaixo na lista do sidebar — depois de Cômodos/Cobertura/Aberturas/Avançado, mais de 1000px de conteúdo — que exigia rolar bastante pra achar. **Ordem invertida: Produtos agora vem primeiro no sidebar, Construir depois.** Corrigido um corte de texto nos rótulos "CONSTRUIR"/"PRODUTOS"/"ACABAMENTOS" (apareciam cortados tipo "CONSTRU") por uma quirk do CSS (`overflow-y` sem `overflow-x` explícito força o eixo X a cortar também); agora quebram em duas linhas em vez de cortar. **Grupos "Acabamentos" (Piso/Revestimento/Iluminação) e "Mobiliário" (Móveis) removidos do sidebar** — eram só placeholders `em breve` sem nenhuma função associada, duplicando o que o painel do catálogo já resolve de verdade com departamentos reais (dado do Supabase); "Produtos" no sidebar fica só com o CTA "Adicionar produto" e o grupo "Catálogo" (Catálogo + Materiais). Ver revisão da DEC-41 no Registro de Decisões Técnicas.

## Alterado (catálogo)

- Catálogo de produtos deixou de ser um modal centralizado com fundo escuro cobrindo a tela inteira — agora é um **painel ancorado ao lado do sidebar** (mesma referência de posição do menu Construir/Produtos), sem fundo escuro: a viewport 3D continua visível e orbitável enquanto o catálogo está aberto. Novo botão **"+ Adicionar produto"** (CTA roxo em destaque, acima do grupo Catálogo) — leva pro mesmo painel que "Catálogo"/"Materiais", já que ainda não existe um fluxo de "adicionar ao projeto" tecnicamente distinto de "navegar"; a diferença por ora é só de destaque visual, igual na referência original. Os botões de entrada (Catálogo e Adicionar produto) viraram gaveta — clicar de novo fecha, em vez de recarregar, e os dois sobem/descem o estado "ativo" juntos. Toda a lógica de dados (departamentos, fabricantes, produtos, o fluxo de "🔁 Trocar" no móvel selecionado) continua igual, só o container visual mudou. Fase 4 de 4 do redesign visual — conclui o plano das 4 fases. Ver DEC-41 no Registro de Decisões Técnicas.

## Alterado (barra inferior)

- Barra inferior reconstruída — a antiga faixa escura contínua (`.actions-row`, um texto estático que duplicava a dica dinâmica que já existia) foi removida, não só reestilizada. No lugar: pills flutuantes (mesmo princípio da toolbar) com toggles **Grid/Cotas/Ajustes/Visualização**, um card de estatísticas (Paredes/Área/Telhado — migrado do canto onde ficava solto) e um controle de **zoom (−/100%/+/⤢ tela cheia)**. Grid e Cotas migraram do extinto menu "⋯" da toolbar (que foi removido — ficaria vazio pra quem usa o app). "Ajustes" ainda não tem o que abrir, fica desabilitado com aviso "em breve". "Visualização" reaproveita de verdade o menu de camadas que já existia (antes só acessível por clique direito, sem nenhum jeito descobrível). Zoom e tela cheia são funcionalidade nova: `−`/`+` e a rolagem do mouse/pinça compartilham o mesmo cálculo de porcentagem, e "⤢" usa a API de tela cheia do navegador. Fase 3 de 4 do redesign visual. Ver DEC-40 no Registro de Decisões Técnicas.
  <!-- Nota: esta seção deveria ter entrado no commit da fase 3
       (28155c4) mas ficou de fora por um lapso — DEC-40 já existia no
       Registro de Decisões Técnicas desde aquele commit, só o
       CHANGELOG que ficou incompleto. Adicionada agora, junto da fase
       4, com a fase/DEC corretas preservadas (não é mudança desta
       sessão). -->

## Alterado (sidebar + visualização)

- Sidebar de ferramentas (esquerda) dividido em duas seções: **Construir** (Cômodos, Cobertura, Aberturas, e o grupo Avançado — Parede livre/Cômodo livre/Coluna/Quebrar parede/Pintar — que veio pra cá, antes ficava depois de Acabamentos) e **Produtos** (novo grupo "Catálogo" com os botões 🏬 Catálogo e 📦 Materiais — que antes moravam no menu "⋯" da toolbar — mais os grupos Acabamentos e Mobiliário, ainda só "em breve"). Painel novo no canto direito, abaixo da casinha de orientação: **3D / 2D / Orbit / Medir** — só "3D" (sempre ativo) e "Orbit" (recentraliza a câmera de verdade) funcionam por ora; "2D" e "Medir" ficam desabilitados com aviso "em breve", mesmo padrão já usado nos outros botões não implementados do sidebar. Fase 2 de 4 do redesign visual. Ver DEC-39 no Registro de Decisões Técnicas.

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
