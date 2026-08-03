SDK DE PRODUTOS INTELIGENTES
Especificação Funcional
Versão 1.0
Objetivo
O SDK (Software Development Kit) permite que fabricantes desenvolvam Produtos Inteligentes
para a plataforma.
Um Produto Inteligente não é apenas um modelo tridimensional.
Ele é um componente capaz de armazenar informações, executar validações, participar de
simulações, gerar quantitativos e interagir com o modelo paramétrico da residência.
O SDK estabelece uma interface única para todos os fabricantes.
Filosofia
Na plataforma:
o software conhece a casa;
o fabricante conhece seu produto.
Toda lógica específica pertence ao fabricante.
A plataforma apenas executa essas regras.
Essa arquitetura permite que novos produtos sejam publicados continuamente sem
necessidade de atualizar o núcleo do sistema.
Estrutura de um Produto Inteligente
Produto Inteligente
├── Manifesto
├── Dados Comerciais
├── Dados Técnicos
├── Geometria
├── Materiais
├── Configurador
├── Regras
├── Compatibilidades
├── Simulações
├── Eventos
├── Documentação
└── Assets
Manifesto
Todo produto possui um manifesto.
Exemplo
id: deca.toilet.carrara
name: Bacia Carrara
manufacturer: Deca
version: 1.0.0
category: bathroom.toilet
sdkVersion: 1.0
license: comercial
O manifesto identifica unicamente o componente.
Dados Comerciais
SKU
Preço
Linha
Categoria
Código interno
Garantia
Fornecedor
EAN
Disponibilidade
País
Idioma
Dados Técnicos
Peso
Largura
Altura
Profundidade
Volume
Material
Normas
Certificações
Vida útil
Consumo
Eficiência
Assets
Um produto pode possuir diversos recursos.
GLB
Miniaturas
Texturas
HDR
PDF
Manual
Vídeos
Imagens
Catálogo
Ficha técnica
Modelo Paramétrico
Nem todos os produtos possuem tamanho fixo.
O SDK permite criar parâmetros.
Exemplo
parameters:
width:
min: 600
max: 3000
step: 10
height:
min: 600
max: 2500
step: 10
color:
white
black
champagne
glass:
clear
green
smoked
O sistema gera automaticamente novas variantes.
Interface Principal
Todo produto implementa a interface básica.
interface SmartProduct {
initialize()
validate()
install()
update()
remove()
simulate()
calculate()
serialize()
deserialize()
}
Essa interface é comum para qualquer categoria.
Instalação
Durante a instalação o produto recebe informações do ambiente.
install(context)
context.room
context.wall
context.floor
context.house
context.user
O componente decide se pode ser instalado.
Validação
validate(context)
returns ValidationResult
Exemplo
✓ espaço suficiente
✓ parede válida
✓ altura correta
✓ hidráulica compatível
ou
Erro
Espaço insuficiente
Necessário:
70 cm
Disponível:
48 cm
Compatibilidade
Todo produto pode informar quais outros produtos aceita.
compatibleWith()
returns
Seat
FlushBox
Pipe
Valve
Assim o catálogo filtra automaticamente componentes incompatíveis.
Quantitativos
O produto participa automaticamente da geração de quantitativos.
calculateQuantities()
Exemplo
Um piso retorna
Área
Perda
Caixas
Peso
Rodapé
Rejunte
Argamassa
Orçamento
calculateBudget()
Retorna
Preço unitário
Quantidade
Subtotal
Impostos
Frete
Total
Simulações
Cada produto pode fornecer dados físicos.
simulationProperties()
Exemplo
Janela
Transmitância térmica
Área de ventilação
Fator solar
Isolamento acústico
Painel Solar
Potência
Eficiência
Área
Produção anual
Luminária
Fluxo luminoso
Consumo
Temperatura de cor
Eventos
Produtos recebem eventos da plataforma.
onInstall()
onMove()
onRotate()
onResize()
onMaterialChanged()
onRoomChanged()
onDelete()
onSave()
onLoad()
Configurador
Produtos podem possuir uma interface própria.
Exemplo
Janela
Largura
Altura
Vidro
Cor
Quantidade de folhas
Puxador
Toda alteração atualiza automaticamente o projeto.
Serviços Disponíveis
O SDK fornece acesso controlado aos serviços da plataforma.
RoomService
WallService
GeometryService
MaterialService
BudgetService
SimulationService
MarketplaceService
NotificationService
Os fabricantes não acessam diretamente o banco de dados.
Segurança
O SDK é executado em ambiente isolado (sandbox).
Produtos:
não acessam arquivos do usuário;
não acessam rede diretamente;
não executam código arbitrário;
não manipulam outros produtos.
Toda comunicação ocorre por APIs autorizadas.
Versionamento
Cada produto possui versão própria.
1.0.0
1.1.0
1.2.0
2.0.0
Projetos antigos continuam funcionando utilizando a versão compatível.
Publicação
Fluxo de publicação:
Desenvolvimento
↓
Validação automática
↓
Testes
↓
Assinatura digital
↓
Revisão
↓
Marketplace
Somente produtos aprovados ficam disponíveis aos usuários.
Marketplace de Componentes
Os fabricantes publicam seus produtos em uma loja oficial.
Os usuários podem pesquisar por:
fabricante;
categoria;
ambiente;
faixa de preço;
compatibilidade;
desempenho energético;
certificações;
popularidade.
Todos os componentes seguem a mesma especificação do SDK.
Roadmap do SDK
SDK 1.0
Produtos estáticos
Produtos paramétricos
Validação de instalação
Quantitativos
Orçamento
Compatibilidade
SDK 2.0
Simulações físicas
Produtos compostos (ex.: cozinha modular)
Configuradores avançados
Regras condicionais
Componentes inteligentes reutilizáveis
SDK 3.0
IA embarcada nos produtos
Recomendações automáticas
Otimização de layouts
Manutenção preditiva
Integração com IoT e Digital Twin da residência
Minha sugestão mais importante
Eu faria uma pequena mudança de nomenclatura. Em vez de chamar esses itens de Produtos
Inteligentes, chamaria de Building Components (Componentes da Construção) e reservaria
"Produto" para a parte comercial (SKU, preço, fabricante).
Assim, um Building Component seria um objeto digital completo, com geometria, regras,
comportamento e integração ao modelo paramétrico. Um mesmo componente poderia originar
diversos SKUs (por exemplo, uma janela disponível em várias cores e acabamentos),
separando claramente a inteligência técnica da comercialização.
Essa separação é comum em plataformas robustas e deixará a arquitetura mais flexível
conforme o ecossistema crescer