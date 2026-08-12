# H0 — Exemplo Residencial e Conectores Hidráulicos

**Status:** Modelo conceitual para revisão técnica

**Data:** 12/08/2026

**Documentos relacionados:** SPEC-002 e H0 — Base Técnica do Sistema Hidráulico

## 1. Objetivo

Definir o menor exemplo residencial capaz de provar o modelo lógico do sistema hidráulico do Esboce. O exemplo deverá orientar protótipos, testes e revisão profissional sem antecipar dimensionamento executivo.

## 2. Residência de referência

O cenário inicial representa uma casa térrea ligada à rede pública, com:

- uma caixa d'água;
- um banheiro contendo vaso sanitário, lavatório e chuveiro;
- uma cozinha contendo pia;
- uma caixa sifonada no banheiro;
- uma caixa de gordura para a cozinha;
- um ponto de inspeção antes da saída predial;
- um ponto de coleta de esgoto indicado pelo prestador;
- uma coluna ou trecho de ventilação sanitária;
- registros necessários para isolar a alimentação.

Lavanderia, água quente, águas pluviais e múltiplos pavimentos não participam do primeiro exemplo.

## 3. Redes lógicas esperadas

### 3.1 Água fria

```text
Origem pública
  → entrada predial
  → reservatório
  → saída do reservatório
  → registro geral interno
  ├── alimentação do vaso sanitário
  ├── alimentação do lavatório
  ├── alimentação do chuveiro
  └── alimentação da pia da cozinha
```

Esse diagrama expressa conectividade, não dimensionamento. A posição de derivações, os diâmetros, a pressão e os dispositivos definitivos dependerão do perfil técnico aprovado.

### 3.2 Esgoto do banheiro

```text
Lavatório ─┐
           ├── caixa sifonada ──┐
Chuveiro ──┘                     │
                                 ├── ponto de inspeção ── saída predial
Vaso sanitário ──────────────────┘
```

O vaso sanitário permanece identificado como contribuição própria. O modelo não deve unir visualmente fluxos sem registrar o nó lógico correspondente.

### 3.3 Esgoto da cozinha

```text
Pia da cozinha
  → caixa de gordura
  → trecho de esgoto
  → ponto de inspeção
  → saída predial
```

### 3.4 Ventilação

```text
Rede de esgoto
  → conexão de ventilação definida pelo perfil técnico
  → trecho vertical
  → terminal de ventilação
```

A configuração e o ponto correto de conexão deverão ser definidos na revisão da NBR 8160. O primeiro modelo precisa representar a rede, mas não deve inventar sua solução executiva.

## 4. Conceito de conector

Um conector é uma interface técnica pertencente a um equipamento. Ele não é apenas um ponto geométrico do modelo 3D.

Cada conector deverá informar:

- identificador estável;
- equipamento proprietário;
- função: entrada, saída, ventilação, inspeção ou controle;
- tipo de rede aceito;
- posição local relativa ao equipamento;
- direção preferencial de saída;
- liberdade de reposicionamento, quando existir;
- parâmetros de diâmetro aceitos pelo perfil;
- necessidade de conexão direta ou por dispositivo intermediário;
- condição de conectado, pendente ou inválido;
- origem da especificação técnica.

Quando um equipamento for movido, seus conectores acompanham o equipamento. A rede ligada deverá entrar em prévia de ajuste e só será confirmada após validação.

## 5. Catálogo mínimo de equipamentos e conectores

Os diâmetros permanecem como parâmetros não preenchidos até a validação técnica.

| Equipamento | Conector | Função | Rede aceita | Direção inicial sugerida | Observação |
| --- | --- | --- | --- | --- | --- |
| Caixa d'água | entrada | receber água | água fria | lateral/superior configurável | inclui vínculo futuro com controle de nível |
| Caixa d'água | saída | alimentar distribuição | água fria | inferior/lateral configurável | origem interna da rede de consumo |
| Caixa d'água | extravasor | segurança | descarga apropriada a definir | lateral | não conectar silenciosamente ao esgoto sanitário |
| Caixa d'água | limpeza | manutenção | descarga apropriada a definir | inferior | deve permanecer identificável |
| Vaso sanitário | alimentação | entrada de água | água fria | conforme família do aparelho | posição depende do produto/família |
| Vaso sanitário | descarga | saída de efluente | esgoto sanitário | inferior ou posterior | tipo depende do aparelho |
| Lavatório | alimentação fria | entrada de água | água fria | posterior/inferior | água quente fica fora do primeiro escopo |
| Lavatório | descarga | saída de efluente | esgoto sanitário | inferior | ligação deve representar o desconector aplicável |
| Chuveiro | alimentação fria | entrada de água | água fria | posterior/superior | primeiro exemplo não inclui água quente |
| Chuveiro | descarga de piso | saída de efluente | esgoto sanitário | inferior | direcionada à solução de coleta aprovada |
| Pia de cozinha | alimentação fria | entrada de água | água fria | posterior/inferior | água quente fica fora do primeiro escopo |
| Pia de cozinha | descarga | saída de efluente | esgoto sanitário de cozinha | inferior | rota prevista por caixa de gordura no perfil Joinville |
| Caixa sifonada | entradas | receber contribuições | esgoto sanitário | laterais configuráveis | quantidade e posição pertencem à família |
| Caixa sifonada | saída | encaminhar efluente | esgoto sanitário | lateral | deve registrar acessibilidade |
| Caixa de gordura | entrada | receber cozinha | esgoto sanitário de cozinha | lateral | deve permanecer acessível |
| Caixa de gordura | saída | encaminhar parte líquida | esgoto sanitário | lateral | condições dependem do perfil local |
| Registro | entrada | controle | água fria | axial | pertence a um trecho controlado |
| Registro | saída | controle | água fria | axial | fechamento deve identificar rede afetada |
| Ponto de inspeção | entradas/saída | inspeção | esgoto sanitário | configurável | deve permanecer acessível |
| Saída predial | entrada interna | destino da instalação | esgoto sanitário | conforme ponto fornecido | posição e cota são dados regionais do projeto |
| Terminal de ventilação | entrada | terminar ventilação | ventilação sanitária | vertical | posição final depende da regra técnica |

## 6. Estados dos elementos

### 6.1 Equipamento

- **não configurado:** existe no projeto, mas seus conectores técnicos ainda não foram definidos;
- **aguardando ligação:** possui conectores válidos e ao menos um obrigatório está livre;
- **ligado:** conectores obrigatórios participam de redes contínuas;
- **com pendência:** rede existe, mas alguma regra técnica requer revisão;
- **inválido:** há incompatibilidade lógica que impede confirmação.

### 6.2 Conector

- livre;
- em prévia;
- conectado;
- incompatível;
- desativado pelo perfil.

### 6.3 Rede

- incompleta;
- contínua;
- pendente de dimensionamento;
- tecnicamente alertada;
- revisada.

## 7. Interação inicial

O primeiro fluxo assistido deverá ser:

1. usuário ativa o modo **Instalações**;
2. Esboce revela os conectores disponíveis nos equipamentos;
3. usuário escolhe o tipo de rede;
4. seleciona o conector de origem e o destino;
5. indica pontos intermediários ou corredores permitidos;
6. Esboce mostra uma rota transparente de prévia;
7. usuário ajusta o percurso;
8. ao confirmar, o sistema cria nós, trechos e conexões lógicas;
9. a geometria definitiva é gerada;
10. verificações e quantitativos são executados;
11. pendências aparecem vinculadas aos elementos responsáveis.

O usuário nunca deverá desenhar um tubo visual que não tenha significado na rede.

## 8. Comportamento ao alterar a arquitetura

### 8.1 Mover equipamento

- conectores acompanham o equipamento durante a prévia;
- rede confirmada não é recalculada quadro a quadro;
- uma rota fantasma indica a possível adaptação;
- ao soltar, o sistema tenta ajustar e validar;
- se não houver solução válida, conserva o último estado confirmado e apresenta a pendência.

### 8.2 Mover parede

- trechos explicitamente hospedados na parede acompanham sua prévia;
- passagens por outros elementos são reavaliadas na confirmação;
- trechos não hospedados não devem se mover apenas por proximidade visual.

### 8.3 Excluir equipamento

- a exclusão deve mostrar quais redes serão afetadas;
- trechos que perderiam significado não podem permanecer órfãos;
- o usuário confirma a remoção conjunta ou cancela a operação.

## 9. Hospedagem e corredores

Um trecho poderá declarar um hospedeiro ou corredor:

- parede;
- piso/contrapiso;
- laje;
- shaft;
- espaço técnico livre;
- trecho enterrado no lote.

O hospedeiro informa onde a tubulação pretende passar. Ele não autoriza automaticamente cortes estruturais. Elementos estruturais ou regiões proibidas deverão gerar alerta ou bloqueio conforme o perfil.

## 10. Dados de teste do cenário

O cenário de referência deverá conseguir responder, sem depender da malha 3D:

- quais pontos recebem água da caixa d'água;
- qual registro interrompe determinado ponto;
- por onde o efluente de cada aparelho chega à saída predial;
- quais contribuições passam pela caixa sifonada;
- quais contribuições passam pela caixa de gordura;
- onde a ventilação se conecta;
- quais trechos atravessam cada parede, piso ou laje;
- quais elementos estão desconectados ou pendentes;
- qual comprimento existe por rede e por parâmetro de diâmetro;
- quantas conexões foram derivadas da topologia.

## 11. Casos mínimos de verificação futura

1. impedir ligação entre saída de esgoto e água fria;
2. detectar aparelho sem caminho até sua origem ou destino;
3. preservar IDs e conectividade ao salvar e reabrir;
4. mover um lavatório sem criar trecho órfão;
5. excluir a caixa de gordura e sinalizar a interrupção da cozinha;
6. identificar contrafluxo em um trecho configurado por gravidade;
7. distinguir trecho hospedado em parede de trecho apenas próximo a ela;
8. mostrar o caminho completo ao selecionar um aparelho;
9. calcular quantitativo apenas após a confirmação;
10. manter os modos 2D e 3D como duas representações da mesma rede.

## 12. Decisões pendentes para o revisor

- conectores obrigatórios de cada equipamento;
- famílias diferentes de saída para vasos e outros aparelhos;
- quais dispositivos intermediários precisam ser entidades próprias;
- topologia correta da ventilação no exemplo;
- parâmetros e condições de dimensionamento;
- classificação dos trechos e ramais segundo a terminologia normativa;
- regras para reservatório, extravasor e limpeza;
- corredores normalmente aceitáveis e passagens proibidas;
- severidade correta das mensagens.

## 13. Resultado esperado da revisão

O revisor deverá devolver este exemplo com:

- diagrama lógico aprovado ou corrigido;
- catálogo de conectores revisado;
- terminologia técnica normalizada;
- parâmetros mínimos acompanhados de fonte e edição;
- regras classificadas por severidade;
- limitações explícitas do protótipo.

Somente depois dessa revisão os conectores devem ser transformados em tipos persistidos do código.
