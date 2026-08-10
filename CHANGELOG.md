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