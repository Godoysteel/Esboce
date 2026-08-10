DOCUMENTO DE DOMÍNIO
Construtor de Casas Online
Domain Model v2.0
1. Introdução
Este documento define o modelo de domínio do sistema.
O domínio representa todas as entidades existentes dentro da plataforma, seus
relacionamentos, responsabilidades e regras de negócio.
O objetivo é separar completamente:
interface
renderização
armazenamento
regras de negócio
Toda funcionalidade do sistema deverá operar sobre este domínio.
2. Filosofia
O software não desenha linhas.
O software não desenha polígonos.
O software não desenha meshes.
O software representa uma residência real.
Uma parede continua sendo uma parede, independentemente de como ela será exibida.
A renderização é apenas uma consequência do domínio.
Essa filosofia garante que o mesmo projeto possa ser utilizado para:
renderização 2D
renderização 3D
quantitativos
orçamento
IA
impressão
exportação BIM
integração com fornecedores
3. Hierarquia Geral
Projeto
└── Terreno
└── Casa
├── Fundação
├── Pavimentos
│      
├── Paredes
│      
│      
│      
│      
│      
│      
│      
├── Cômodos
├── Pisos
├── Tetos
├── Escadas
├── Portas
├── Janelas
└── Instalações
│
├── Cobertura
├── Fachadas
├── Paisagismo
├── Mobiliário
└── Catálogo Aplicado
4. Entidade Raiz — Projeto
Responsabilidade
Representa um arquivo completo.
É a raiz do domínio.
Nada existe fora de um Projeto.
Atributos
id
nome
descrição
autor
cliente
versão
dataCriação
últimaAlteração
configurações
terreno
casa
histórico
Responsabilidades
Salvar.
Carregar.
Compartilhar.
Versionar.
Exportar.
Importar.
5. Terreno
Representa o lote.
Geometria
largura
comprimento
polígono
Topografia
cotaZero
declividade
curvasDeNível
Ambiente
orientaçãoSolar
latitude
longitude
ventoPredominante
Futuramente
Muros
Piscina
Calçada
Garagem
Vegetação
Árvores
Jardins
6. Casa
Representa a construção.
Nunca armazena geometria diretamente.
Apenas organiza seus elementos.
Possui
fundação
pavimentos
cobertura
fachadas
instalações
Calcula
Área construída
Volume
Número de pavimentos
Área impermeável
7. Pavimento
Cada pavimento representa um plano horizontal.
Atributos
nome
elevação
altura
tipo (`standard` ou `attic`)
altura da parede lateral (somente no ático; padrão de 1,20 m)
Contém
paredes
cômodos
escadas
portas
janelas
lajes

Ático/Chalé é uma configuração do pavimento atual, não um novo nível obrigatório. Pode ser aplicada ao térreo ou a qualquer outro pavimento: no modo Chalé a cobertura começa praticamente junto ao piso; no modo Ático existe uma parede lateral baixa de 1,20 m. Uma laje parcial pode representar o mezanino. Projetos antigos sem o campo `tipo` são migrados como pavimentos comuns. A entidade Varanda continua reconhecida apenas para compatibilidade de arquivos anteriores, mas não aparece mais como ferramenta de criação.
8. Parede
É a entidade estrutural principal.
Identificação
id
nome
tipo
Geometria
pontoInicial
pontoFinal
altura
espessura
Materiais
estrutura
acabamentoInterno
acabamentoExterno
Aberturas
portas[]
janelas[]
Dados derivados
Calculados automaticamente.
comprimento
áreaInterna
áreaExterna
volume
Eventos
Criada
Movida
Rotacionada
Dividida
Unida
Excluída
9. Cômodo
Nunca é criado manualmente.
Sempre nasce da geometria das paredes.
Possui
polígono
área
perímetro
Classificação
Sala
Quarto
Banheiro
Lavabo
Cozinha
Área Gourmet
Lavanderia
Garagem
Escritório
Varanda
Outro
Acabamentos
piso
rodapé
teto
pintura
Calcula
Área de piso.
Área de teto.
Rodapé.
Área de pintura.
Volume interno.
10. Porta
Representa uma abertura.
Nunca existe isoladamente.
Sempre pertence a uma parede.
Geometria
posição
largura
altura
Produto
SKU
marca
fabricante
modelo
Dados derivados
Área da abertura.
Vão.
Peso.
11. Janela
Mesmo conceito da porta.
Acrescenta
tipoDeAbertura
peitoril
veneziana
persiana
12. Piso
Pertence exclusivamente a um cômodo.
Dados
material
textura
paginação
rejunte
Quantitativos
área
perdas
quantidade
13. Rodapé
Entidade independente.
Pode possuir material diferente do piso.
14. Teto
Representa o acabamento interno.
Tipos
Laje
Gesso
PVC
Madeira
15. Fundação
Primeira implementação
Radier
Depois
Baldrame
Sapata
Estaca
16. Cobertura
Tipos
Uma água
Duas águas
Quatro águas
Platibanda
Metálica
Laje
17. Escada
largura
espelho
pisada
inclinação
patamar
18. Material
Representa categorias.
Nunca um produto.
Exemplo
Cerâmica
Madeira
Concreto
Porcelanato
Tinta
19. Produto
Representa um item comercial.
Dados
SKU
fabricante
marca
modelo
categoria
preço
modeloGLB
texturas
Pode ser aplicado em
Parede.
Piso.
Teto.
Cobertura.
Mobiliário.
20. Fabricante
Exemplos
Suvinil
Portobello
Tigre
Lorenzetti
Deca
21. Fornecedor
Representa quem vende.
Um mesmo produto pode possuir vários fornecedores.
22. Orçamento
Nunca editado manualmente.
Sempre calculado.
Possui
produtos
quantidades
custos
impostos
frete
total
23. Lista de Compras
Derivada do orçamento.
Estados possíveis
Planejado
Cotado
Comprado
Recebido
Instalado
24. Relacionamentos
Projeto
↓
Casa
↓
Pavimento
↓
Parede
↓
Porta
↓
Produto
↓
Fornecedor
↓
Compra
25. Objetos Paramétricos
Todos os objetos devem ser descritos por parâmetros.
Nunca por geometria fixa.
Exemplo:
Parede
Início
Fim
Espessura
Altura
A geometria é reconstruída a partir desses parâmetros.
26. Objetos Derivados
Existem entidades que nunca são armazenadas.
Exemplos:
cômodos;
áreas;
perímetros;
quantitativos;
orçamento;
lista de compras.
Esses elementos são sempre recalculados quando necessário.
27. Sistema de Eventos
Toda alteração gera um evento.
Exemplo:
ProjetoCriado
ParedeCriada
ParedeMovida
ParedeEditada
PortaInserida
JanelaInserida
MaterialAplicado
ProdutoSubstituído
ProjetoSalvo
Esses eventos alimentam:
desfazer/refazer;
histórico;
colaboração em tempo real;
sincronização em nuvem;
auditoria.
28. Invariantes do Domínio
As seguintes regras nunca podem ser violadas:
1. Todo elemento pertence a um Projeto.
2. Uma Casa pertence a um único Terreno.
3. Um Pavimento pertence a uma única Casa.
4. Uma Parede pertence a um único Pavimento.
5. Uma Porta e uma Janela pertencem obrigatoriamente a uma Parede.
6. Um Piso pertence a um único Cômodo.
7. Produtos comerciais nunca armazenam geometria da construção.
8. A renderização nunca altera o domínio.
9. Valores derivados (áreas, volumes, quantitativos) não devem ser persistidos como fonte da
verdade; devem ser recalculados ou armazenados apenas como cache invalidável.
10. Nenhuma malha 3D é considerada parte do modelo de negócio.
29. Extensibilidade
O domínio deve permitir adicionar novos módulos sem alterar as entidades principais.
Exemplos:
Automação residencial
Energia solar
Hidráulica
Elétrica
Climatização
Paisagismo
Piscinas
Fotovoltaico
Monitoramento por sensores
Gêmeo Digital
Inteligência Artificial
Todos esses módulos deverão consumir o mesmo modelo de domínio.
30. Visão Estratégica
O objetivo da plataforma não é ser apenas um editor de plantas.
O objetivo é representar digitalmente uma residência durante todo o seu ciclo de vida.
A construção da casa é apenas o início da jornada.
O mesmo modelo poderá acompanhar o imóvel durante anos, registrando reformas,
substituição de materiais, manutenção, ampliações e integrações com fornecedores, tornando
se um gêmeo digital confiável e evolutivo da residência.
Minha principal sugestão
Há um conceito que eu incorporaria desde já: DDD (Domain-Driven Design).
Em vez de organizar o código por tecnologia (
render 
, 
ui 
, 
services 
), organizaria por
contextos de negócio. Por exemplo:
House/
Room/
Wall/
Catalog/
Budget/
Marketplace/
Project/
Collaboration


Documento de Domínio
Construtor de Casas Online
Atualização v2.1 — Identity, Event Sourcing, Budget e Bounded Contexts
Este documento complementa e revisa o Domain Model v2.0.
As seções abaixo devem ser incorporadas ao documento original nos pontos indicados.


Sumário desta atualização
    • Novo Capítulo 31 — Identity & Access Management (IAM)
    • Revisão do Capítulo 27 — Sistema de Eventos (decisão sobre Event Sourcing)
    • Revisão do Capítulo 22 — Orçamento: separação entre entidade Budget e serviço Budget Engine
    • Revisão da Estrutura de Pastas — organização por Bounded Context
    • Novo Bounded Context — Simulation
    • Atualização das Invariantes do Domínio (Capítulo 28) — nova invariante 11
31. Identity & Access Management (IAM)
Até a versão 2.0, o domínio termina em Projeto → Casa → Objetos. Não existe representação de usuários, organizações ou permissões — o Projeto possui apenas um atributo "autor". Esta lacuna é resolvida com um novo Bounded Context: Identity.
31.1 Escopo do contexto
Identity é responsável por tudo relacionado a quem acessa o sistema e o que essa pessoa pode fazer. Nenhuma outra entidade do domínio deve conter lógica de autenticação ou autorização — apenas referenciar objetos deste contexto.
Identity/
├── User
├── Organization
├── Team
├── Role
├── Permission
├── Session
├── Invite
└── AccessPolicy
31.2 Impacto na entidade Projeto
O Projeto deixa de possuir apenas um "autor" e passa a referenciar objetos do contexto Identity:
Projeto
├── owner: User
├── members: Member[]      (User + Role)
├── accessPolicy: AccessPolicy
└── sharedLinks: SharedLink[]
Exemplo:
Projeto "Casa da Praia"
  Owner:    João
  Members:
    - Maria  (Editora)
    - Carlos (Comentador)
    - Pedro  (Somente leitura)
31.3 Links públicos (SharedLink)
O compartilhamento por link, previsto na Especificação Funcional (Módulo 13), passa a ser modelado como entidade própria dentro de Identity, não como atributo solto do Projeto:
SharedLink
├── url
├── expiraEm
├── senha (opcional)
├── permissao   (leitura | comentário | edição)
└── visualizacoes
31.4 Relação entre AccessPolicy e Permissions do Projeto
Ponto de atenção: para evitar duas fontes de verdade sobre permissões, o array Permissions[] do Projeto não deve duplicar regras — ele deve ser apenas a lista materializada (cache) das decisões que AccessPolicy calcula. AccessPolicy, dentro de Identity, é a única fonte de verdade sobre quem pode o quê.
31.5 Multi-tenancy (Organization)
O Documento de Visão prevê modelo White Label para lojas e construtoras. Isso implica que Organization não é apenas um agrupamento social de usuários — é uma fronteira de isolamento de dados. Esta decisão deve ser tomada agora, ainda que não implementada no MVP, porque decisões de persistência (particionamento por organização) são custosas de introduzir depois.
31.6 O que este contexto habilita
    • Colaboração multiusuário em um mesmo projeto
    • Contas empresariais (construtoras, arquitetos, lojas)
    • Convites e controle de acesso por papel (Role)
    • Links públicos com permissão e expiração
    • Base para auditoria de "quem alterou o quê", que se conecta ao Capítulo 27 (Sistema de Eventos)
Revisão — Capítulo 27: Sistema de Eventos
A versão 2.0 descreve o fluxo Evento → Undo → Histórico → Colaboração sem definir se os eventos são apenas auditoria (Caminho A) ou se constituem a própria fonte da verdade do estado, via Event Sourcing (Caminho B).
Os dois caminhos
	Caminho A — Auditoria	Caminho B — Event Sourcing
O que é	Evento é um registro paralelo ao estado	Evento é a única fonte da verdade; estado é reprodução
Estado atual	Armazenado diretamente (parâmetros da casa)	Reconstruído a partir do replay dos eventos
Ganhos imediatos	Simplicidade, previsibilidade	Undo/redo infinito, time travel, replay, branches
Custo	Baixo	Versionamento de schema de eventos, read models (CQRS), maior complexidade operacional
Decisão adotada: caminho híbrido
Event Sourcing completo desde o dia 1 tem um custo real que não aparece só nos ganhos: o formato de um evento como ParedeCriada precisa continuar interpretável daqui a anos — o próprio domínio prevê que o Digital Twin acompanha o imóvel "durante anos" — o que exige uma estratégia de upcasting de eventos desde o início, não depois. Além disso, funcionalidades como listar "todos os projetos do usuário" exigem read models mantidos à parte (CQRS), e colaboração em tempo real de baixa latência normalmente depende de CRDT/Operational Transform, que o Event Sourcing não resolve sozinho.
Por isso, a decisão para esta fase do projeto é um caminho híbrido:
    • O modelo paramétrico continua sendo a fonte da verdade do estado atual (como já definido no Documento de Arquitetura), o que atende integralmente ao MVP (Fase 1 do roadmap: desenho, extrusão, cômodos, salvar, compartilhar).
    • Toda alteração no domínio é expressa desde já como um Comando explícito (CreateWall, MoveWall, InsertDoor, DeleteWall), e não como mutação direta de atributos.
    • Cada Comando, ao ser executado, gera um Evento correspondente, persistido para auditoria, histórico e undo/redo simples (pilha de comandos inversos).
    • Quando Colaboração em tempo real e Time Travel completo se tornarem prioridade (Fase 5 em diante do roadmap), o sistema evolui para Event Sourcing pleno sem reescrever a superfície de API — porque os Comandos já existem e os Eventos já são o registro canônico de mudança.
Fluxo revisado
Comando (CreateWall, MoveWall, InsertDoor...)
        ↓
Validação + aplicação no Modelo Paramétrico
        ↓
Evento gerado e persistido
        ↓
   ┌────────────┬───────────────┬───────────────┐
   ↓            ↓               ↓               ↓
Undo/Redo   Histórico      Quantitativos    (futuro) Event
(pilha)     (auditoria)    /Orçamento        Sourcing pleno
Snapshots (quando o Event Sourcing pleno for adotado)
Mantém-se a orientação original: para desempenho, o replay não deve percorrer o histórico completo — snapshots periódicos evitam reprocessar milhares de eventos a cada carregamento.
Eventos 1–500 → Snapshot → Eventos 501–900 → Snapshot → ...
Revisão — Capítulo 22: Orçamento
A versão 2.0 usa "Motor Financeiro" (no Documento de Arquitetura) e "Orçamento" (no Documento de Domínio) de forma ambígua, sem deixar claro se são a mesma coisa. Esta revisão separa claramente entidade de domínio e serviço.
Budget — entidade de domínio
Representa um orçamento já gerado. É dado, não comportamento.
Budget
├── itens[]      (produto, quantidade, preço unitário, subtotal)
├── impostos
├── frete
└── total
Budget Engine — serviço
Responsável por produzir um Budget a partir dos quantitativos. Não é uma entidade — é comportamento, e vive na camada de aplicação/serviços, não no domínio persistido.
Quantitativos → Consulta catálogo → Consulta preços →
Aplica impostos → Calcula frete → Gera Budget
Esta separação substitui as referências anteriores a "Motor Financeiro" no Documento de Arquitetura — o nome correto do serviço passa a ser Budget Engine, e seu único produto é a entidade Budget.
Revisão — Estrutura de Pastas: organização por Bounded Context
O Documento de Arquitetura v1.0 propõe uma estrutura por camada técnica (core / editor / render / services / storage). Esta revisão adota organização por Bounded Context, mais adequada à escala do projeto.
Por que mudar
Arquitetura por camada técnica funciona bem até dezenas de milhares de linhas de código; depois disso, alterações em uma única funcionalidade (por exemplo, Parede) passam a exigir mudanças espalhadas por múltiplas pastas técnicas (core/Wall.ts, render/WallRenderer.ts, services/WallService.ts...). Organizar por contexto de negócio mantém tudo sobre um mesmo conceito unido.
Estrutura revisada
src/
├── House/
├── Room/
├── Wall/
├── Foundation/
├── Roof/
├── Catalog/
├── Budget/
├── Marketplace/
├── Identity/
├── Collaboration/
├── Simulation/
├── Rendering/
├── Infrastructure/
└── Shared/
Dentro de cada módulo
Para evitar que um módulo vire um arquivo único misturando regra de negócio e infraestrutura, cada módulo mantém uma sub-separação leve:
Wall/
├── Wall.ts          (entidade / domínio)
├── WallCommands.ts  (CreateWall, MoveWall, ...)
├── WallEvents.ts    (WallCreated, WallMoved, ...)
├── WallService.ts   (aplicação)
├── WallRenderer.ts  (infraestrutura de renderização)
└── WallTests.ts
Bounded context resolve o acoplamento entre módulos; a sub-separação interna resolve o acoplamento dentro do módulo.
Novo Bounded Context: Simulation
Nenhum dos documentos anteriores nomeia explicitamente um contexto para funcionalidades que apenas leem o modelo paramétrico e produzem conhecimento derivado, sem nunca alterar a Casa. Este contexto é criado agora.
Escopo
    • Quantitativos
    • Orçamento (consome Budget Engine)
    • Iluminação natural
    • Insolação
    • Ventilação
    • Consumo energético
    • Acústica
    • Simulação estrutural (futuro)
    • Simulação hidráulica (futuro)
    • Simulação elétrica (futuro)
Regra fundamental
Simulation nunca altera House. Ele apenas faz perguntas ao modelo paramétrico e produz resultados. Esta regra é do mesmo tipo das invariantes já existentes (ex.: "a renderização nunca altera o domínio") e é formalizada como nova invariante no capítulo seguinte.
Atualização — Capítulo 28: Invariantes do Domínio
Adiciona-se a seguinte invariante à lista existente (as dez invariantes da versão 2.0 permanecem válidas e inalteradas):
11. O contexto Simulation nunca altera House, Room, Wall ou qualquer outra entidade estrutural — ele apenas lê o modelo paramétrico e produz resultados derivados.
Resumo das mudanças
Item	Status na v2.0	Status na v2.1
Identity	Ausente	Novo Bounded Context (Cap. 31)
Sistema de Eventos	Ambíguo (auditoria ou Event Sourcing?)	Híbrido: Comandos + Eventos agora, Event Sourcing pleno na Fase 5+
Orçamento	"Motor Financeiro" e "Orçamento" confundidos	Budget (entidade) × Budget Engine (serviço)
Estrutura de pastas	Organização por camada técnica	Organização por Bounded Context
Simulation	Ausente	Novo Bounded Context
Invariantes	10 regras	11 regras
11 regras

---

# Atualização v2.2 — Regras consolidadas do Editor v19

Esta atualização registra as invariantes já implementadas no editor v19 sem transformar detalhes de renderização em entidades do domínio.

## Parede, junções e aberturas

- Junções entre paredes são relações topológicas; linhas de contorno são apenas representação.
- Porta e janela continuam pertencendo obrigatoriamente a uma parede.
- Uma abertura deve manter 50 mm de uma parede transversal e 150 mm de outra abertura na mesma parede.
- Uma operação inválida é rejeitada antes de substituir o estado confirmado.
- Cômodos, cotas e superfícies continuam derivados da topologia das paredes.

## Cobertura composta

Uma cobertura mantém seus parâmetros próprios e pode participar opcionalmente de um conjunto composto por meio de `compoundGroupId`. O engaste é uma relação confirmada entre coberturas transversais. Recortes, água-furtada e área líquida são derivados dessa relação e não são persistidos como malha.

## Oitão

O oitão é uma superfície de parede derivada da cobertura de duas águas. Ele usa acabamento e quantitativos de parede, embora sua forma e altura sejam calculadas a partir da cobertura.

## Fundação

Baldrame e radier são tipos de fundação do projeto. Na v19, baldrame é o padrão de novos projetos. Sua geometria visível e seus quantitativos são derivados das paredes do térreo.

## Materiais

Acabamentos podem ser associados à superfície lógica atingida. Paredes e oitões aceitam acabamento por face; pisos pertencem ao cômodo e armazenam material, escala e rotação. A textura renderizada é uma consequência desses parâmetros.

## Invariantes adicionais

12. Uma prévia de arraste nunca substitui o último estado válido.
13. Uma cobertura só participa de recortes compostos depois da confirmação do engaste.
14. Quantitativos de coberturas compostas usam a área líquida das superfícies derivadas.
15. Ocultar o grid visual não altera o snapping estrutural.
