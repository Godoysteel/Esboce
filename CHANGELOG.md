# Changelog

Todas as alterações relevantes do Esboce serão registradas neste arquivo.

---

# Não lançado — estabilização pré-comercial

## Plataforma, persistência e qualidade

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
