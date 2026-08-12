# SPEC-002 — Sistema Hidráulico Paramétrico

**Status:** Concepção aprovada para evolução futura

**Data:** 12/08/2026

**Escopo:** instalações residenciais de água fria e esgoto sanitário

## 1. Visão

O Esboce deverá permitir que o usuário conceba e visualize as instalações hidráulicas como parte do mesmo Modelo Digital da Residência usado pela arquitetura.

O sistema não será apenas um desenho de tubos. Cada trecho deverá conhecer sua função, origem, destino, diâmetro, material, conexões, equipamentos atendidos e relação com paredes, pisos e pavimentos.

O objetivo é tornar compreensível o caminho da água e do esgoto, antecipar incompatibilidades, gerar quantitativos e orientar decisões. O resultado continuará sendo uma estimativa de projeto que exige validação de profissional habilitado antes da execução.

## 2. Experiência pretendida

O usuário poderá:

- posicionar pontos hidráulicos em equipamentos como vaso sanitário, lavatório, chuveiro, pia e tanque;
- inserir caixa d'água, registros, caixa sifonada, caixa de gordura e ponto de saída para a rede de esgoto;
- criar ou solicitar rotas entre os pontos;
- ajustar manualmente o percurso sugerido;
- visualizar tubulações dentro de paredes, pisos, lajes e shafts;
- ativar um modo de transparência da residência para inspecionar toda a instalação;
- identificar redes por função e cor;
- receber alertas de incompatibilidade ou de regra técnica;
- obter uma relação preliminar de tubos, conexões, registros e caixas.

## 3. Princípio arquitetural

A fonte da verdade será uma rede lógica, não a malha 3D.

```text
Equipamento
  → conector hidráulico
  → nó da rede
  → trecho de tubulação
  → conexão ou derivação
  → destino
```

A geometria visível será derivada dessa rede. Cotovelos, tês, tubos e conexões serão representações do modelo lógico e poderão ser reconstruídos sem perda de informação.

Uma operação de arraste deverá usar uma prévia visual leve. O estado definitivo, os quantitativos e as verificações técnicas serão recalculados quando o usuário confirmar a operação, preservando o padrão de desempenho já aprovado no editor.

## 4. Entidades iniciais do domínio

### 4.1 Rede hidráulica

Agrupa elementos que transportam o mesmo tipo de fluido e cumprem a mesma função.

Tipos iniciais:

- água fria;
- esgoto sanitário;
- ventilação sanitária.

Água quente, águas pluviais, reúso, gás e combate a incêndio ficam fora do primeiro escopo.

### 4.2 Conector

Ponto técnico pertencente a um equipamento. Deve registrar posição, direção, tipo de rede, diâmetro nominal aceito e requisitos de ligação.

### 4.3 Nó

Representa origem, destino, mudança de direção, derivação, junção, inspeção ou transição de diâmetro.

### 4.4 Trecho

Segmento entre dois nós. Deve registrar ao menos:

- rede à qual pertence;
- caminho espacial;
- diâmetro nominal;
- material ou família de produto;
- inclinação, quando aplicável;
- pavimento e elementos construtivos atravessados;
- estado de validação.

### 4.5 Equipamentos e dispositivos

Escopo inicial:

- caixa d'água;
- vaso sanitário;
- lavatório;
- chuveiro;
- pia de cozinha;
- tanque ou máquina de lavar;
- registro;
- caixa sifonada;
- caixa de gordura;
- ponto de inspeção;
- saída predial de esgoto.

## 5. Roteamento

O roteamento deverá ser assistido, previsível e editável. O sistema pode sugerir um caminho, mas o usuário deve poder corrigir o percurso sem perder a integridade da rede.

Prioridades iniciais:

1. respeitar o tipo de rede e seus conectores compatíveis;
2. usar corredores permitidos em paredes, pisos, lajes e shafts;
3. evitar aberturas, elementos bloqueados e interferências conhecidas;
4. reduzir mudanças de direção desnecessárias;
5. preservar acesso a registros, caixas e inspeções;
6. aplicar inclinação coerente ao esgoto;
7. manter o percurso compreensível e editável.

No primeiro estágio, o usuário definirá pontos intermediários e o Esboce completará os trechos e conexões. O roteamento totalmente automático será posterior.

## 6. Visualização

O modo **Instalações** deverá oferecer:

- residência opaca, semitransparente ou em modo raio X;
- isolamento por rede;
- cores distintas por função;
- destaque do trecho selecionado e de todo o caminho conectado;
- indicação de fluxo, diâmetro, inclinação e destino;
- ocultação seletiva de arquitetura, mobiliário ou outras instalações;
- visualização sincronizada nos modos 2D e 3D.

A transparência é uma ferramenta de inspeção. Ela não altera materiais nem o modelo arquitetônico persistido.

## 7. Motor de regras

As regras deverão ser armazenadas como dados versionados e rastreáveis, separadas da geometria. Cada regra terá fonte, versão, escopo e nível de severidade.

Níveis:

- **Bloqueio:** estado fisicamente impossível ou que corrompe a rede;
- **Alerta técnico:** situação que exige revisão antes da execução;
- **Recomendação:** melhoria de prática, manutenção ou compatibilidade;
- **Informação:** orientação sem impedir a operação.

Exemplos de verificações futuras:

- conector incompatível com o tipo de rede;
- trecho desconectado ou destino inexistente;
- esgoto sem declividade suficiente ou com contrafluxo;
- mudança de direção excessiva;
- ausência de ventilação ou inspeção prevista pelo perfil adotado;
- passagem por abertura ou região proibida;
- registro inacessível;
- conflito entre tubulação e elemento construtivo;
- distância ou desnível incompatível entre equipamento e ponto receptor.

As regras técnicas não serão apresentadas como garantia de conformidade executiva. O sistema deverá informar a origem e permitir revisão profissional.

## 8. Perfis técnicos e fabricantes

O núcleo do Esboce deverá trabalhar com regras genéricas e independentes de fabricante. Bibliotecas comerciais poderão complementar o núcleo com produtos, famílias, limitações e recomendações específicas.

Exemplo de separação:

```text
Perfil técnico residencial
  ├── regras gerais versionadas
  ├── parâmetros configuráveis do projeto
  └── biblioteca comercial opcional
        ├── fabricante
        ├── linha de produtos
        └── compatibilidades declaradas
```

Manuais de fabricantes poderão orientar o levantamento e a validação, mas sua incorporação dependerá de rastreabilidade, permissão de uso e revisão técnica. Questões jurídicas e licenciamento serão tratadas antes da publicação de qualquer biblioteca comercial.

## 9. Quantitativos

O quantitativo preliminar deverá ser derivado da rede confirmada e incluir:

- comprimento por tipo, material e diâmetro de tubo;
- quantidade de cotovelos, tês, luvas, reduções e adaptadores;
- registros, caixas e dispositivos;
- margem configurável de perda;
- associação futura a produtos e fornecedores do catálogo.

O orçamento não será recalculado durante cada quadro do arraste. A prévia permanece visual, e o cálculo definitivo ocorre na confirmação.

## 10. Escopo do primeiro produto utilizável

O primeiro recorte deverá atender uma residência térrea simples contendo:

- uma caixa d'água;
- um banheiro;
- uma cozinha;
- rede de água fria;
- esgoto do vaso sanitário;
- esgoto de lavatório e chuveiro até caixa sifonada;
- esgoto da pia até caixa de gordura;
- saída predial de esgoto;
- ventilação sanitária básica;
- roteamento manual assistido;
- modo raio X;
- quantitativo básico;
- alertas essenciais de conexão, interferência e inclinação.

Esse recorte deverá funcionar integralmente antes da inclusão de casas com múltiplos pavimentos ou redes adicionais.

## 11. Fases de implantação

### Fase H0 — pesquisa e validação

- consolidar vocabulário e entidades;
- levantar fontes técnicas aplicáveis;
- definir responsabilidade e mensagens ao usuário;
- revisar a concepção com profissional habilitado.

### Fase H1 — visualização e conectores

- modo Instalações/raio X;
- conectores nos equipamentos;
- seleção, cores e inspeção das redes;
- persistência versionada das novas entidades.

### Fase H2 — roteamento manual assistido

- criação por pontos intermediários;
- geração procedural de tubos e conexões;
- edição com prévia leve e confirmação única;
- detecção básica de interferências.

### Fase H3 — água fria

- caixa d'água, ramais, sub-ramais e registros;
- continuidade da rede;
- diâmetros configuráveis;
- quantitativos iniciais.

### Fase H4 — esgoto e ventilação

- aparelhos, caixas, ramais, ventilação e saída predial;
- inclinação e sentido de fluxo;
- alertas essenciais e acesso para inspeção.

### Fase H5 — sugestões automáticas

- busca de caminhos possíveis;
- comparação de alternativas;
- otimização sem retirar o controle do usuário.

### Fase H6 — catálogo e orçamento

- associação a famílias e produtos comerciais;
- composição por fornecedor;
- orçamento e disponibilidade regional.

## 12. Critérios de aceitação do primeiro escopo

1. Toda conexão visual deve corresponder a uma conexão lógica válida.
2. Salvar e reabrir o projeto deve preservar redes, parâmetros e vínculos.
3. Mover um equipamento deve sinalizar ou atualizar sua rede sem deixá-la silenciosamente inválida.
4. O modo raio X deve permitir acompanhar cada percurso da origem ao destino.
5. A rede de esgoto deve exibir claramente sentido e inclinação.
6. Quantitativos devem corresponder ao estado confirmado, não à prévia durante o arraste.
7. Regras e mensagens devem indicar severidade e motivo.
8. Nenhum resultado deve ser apresentado como projeto executivo automaticamente aprovado.

## 13. Fora do escopo inicial

- dimensionamento hidráulico executivo automático;
- certificação de conformidade;
- substituição de projeto assinado por profissional habilitado;
- água quente, pluvial, reúso, gás ou incêndio;
- edifícios multifamiliares ou instalações industriais;
- roteamento automático irrestrito;
- reprodução de manuais proprietários sem autorização;
- compra automática de materiais.

## 14. Decisões em aberto

- fontes técnicas e versões que formarão o primeiro perfil de regras;
- parâmetros que serão fixos, recomendados ou configuráveis;
- representação dos corredores permitidos em paredes e lajes;
- comportamento da rede ao mover paredes, equipamentos ou pavimentos;
- estratégia de compatibilização futura com elétrica e estrutura;
- nível de detalhe visual adequado ao desempenho do navegador;
- processo de revisão e aprovação por profissional habilitado.

## 15. Princípio final

O usuário deve compreender a instalação, experimentar alternativas e detectar problemas cedo. O Esboce assume a complexidade do modelo e da visualização, mas não oculta incertezas nem substitui a responsabilidade técnica necessária à execução.
