# SPEC-004 — Módulo de Análise Ambiental e Desempenho da Edificação

**Status:** Concepção aprovada para evolução futura

**Data:** 22/08/2026

**Escopo:** análise ambiental do projeto antes da construção — sol, ventilação natural, temperatura, umidade e ação do vento sobre a edificação

**Fora deste escopo, por decisão explícita:** dimensionamento estrutural de qualquer tipo, inclusive para Steel Frame. Ver seção 15.

## 1. Visão

O Esboce deverá permitir que o usuário compreenda, de maneira visual e simples, como a geometria, a localização, os materiais, as aberturas e os sistemas construtivos de um projeto influenciam seu comportamento antes da construção.

O princípio central: o usuário não deve apenas ver como a casa ficará. Deve conseguir entender como ela poderá se comportar. Uma alteração em uma janela, parede, cobertura, isolamento ou material não muda apenas a aparência da residência — pode alterar iluminação, ventilação, temperatura, umidade e exposição ao vento. Este módulo torna essas relações compreensíveis.

## 2. Princípio arquitetural

O módulo trabalha sobre o mesmo `Projeto` usado pelo restante do Esboce. Não existe um segundo modelo criado especificamente para análise — as ferramentas leem geometria, localização, orientação, pavimentos, paredes, composição das paredes, cobertura, aberturas e materiais já existentes no domínio.

```text
Projeto (geometria + localização + materiais)
  → motor de análise ambiental
  → resultado visual (mapa, indicador, número)
  → explicação rastreável ("Como calculamos?")
```

Cada análise é derivada, não persistida como verdade paralela: se o usuário move uma janela, o resultado da análise muda na próxima leitura, sem sincronização manual.

## 3. Localização e dados climáticos

Para qualquer análise que dependa de clima (vento, temperatura externa), o projeto precisa de uma localização — coordenada geográfica (latitude/longitude), obtida por busca de endereço/cidade ou marcação no mapa.

A análise solar (seção 6) não depende de dado climático nenhum, apenas da coordenada — é astronomia, não meteorologia.

As demais análises (vento, temperatura) dependem de dados climáticos históricos/típicos da região, não de previsão do tempo em tempo real — o objetivo é entender o comportamento típico do projeto naquele lugar, não o clima de hoje. Fontes candidatas, a validar antes da implementação:

- NASA POWER — dados históricos gratuitos, cobertura global, sem autenticação;
- Open-Meteo — API climática histórica gratuita;
- INMET — dados oficiais brasileiros, quando a cobertura de estação for adequada à região do projeto.

A escolha final de fonte, licença de uso e frequência de atualização é uma decisão em aberto (seção 16) — nenhuma dessas fontes deve ser integrada sem validar limites de uso e confiabilidade para o caso do Esboce.

## 4. Cadeia de dependência técnica

As cinco frentes do documento original não têm o mesmo grau de prontidão. A ordem de implementação deve seguir a dependência real, não a ordem de preferência de produto:

```text
Sol (independente — só geometria + coordenada)
Ventilação natural (independente — só geometria + coordenada)
      ↓
Catálogo de propriedades térmicas dos materiais (trabalho de curadoria — o gargalo real)
      ↓
Temperatura interna (depende do catálogo)
      ↓
Umidade e condensação (depende da temperatura de superfície)
```

Sol e Ventilação podem ser construídos em paralelo, sem esperar nenhum dado adicional. Temperatura não deve começar antes de existir uma fonte técnica citável para condutividade/resistência térmica dos materiais — sem isso, o mapa térmico da seção 9 estaria inventando número, exatamente o que a seção 12 (transparência) proíbe.

## 5. Análise solar

A análise solar representa a incidência do sol sobre a residência considerando localização, orientação, data, horário, geometria, cobertura, paredes, aberturas, beirais e elementos de sombreamento.

### 5.1 Cálculo

Posição do sol (azimute e elevação) é calculada por um algoritmo de posição solar padrão a partir de latitude, longitude, data e horário — cálculo determinístico, sem simplificação relevante. Não depende de nenhum dado de material ou clima.

Para exposição de uma parede ou abertura específica: amostragem da posição solar em intervalos regulares ao longo do dia (por exemplo, a cada 15 minutos) e, para cada instante, verificação por interseção geométrica se a superfície recebe luz direta sem obstrução (telhado, beiral, outra parte da própria casa, elemento de sombreamento). A soma dos intervalos expostos resulta em horas de sol direto no dia.

Por ser cálculo geométrico puro, sem simplificação de modelo físico relevante, esta é a única análise deste documento que nasce classificada como **🟢 Validado** (ver seção 12) — as demais nascem 🟡 ou ⚪.

### 5.2 Experiência do usuário

Três formas de exibição, todas derivadas do mesmo cálculo de base:

- **Linha do tempo** — o usuário arrasta um controle 06h → 09h → 12h → 15h → 18h e observa a luz varrendo o modelo 3D em tempo real, com sombras reais projetadas pela própria geometria da casa;
- **Mapa de exposição** — sobreposição na planta e no modelo 3D, cada fachada/cobertura colorida por total de horas de sol acumuladas no dia (🔵 pouco sol → 🔴 muito sol), permitindo identificar de relance fachadas muito expostas ao sol da tarde sem interação nenhuma;
- **Exposição por parede** — ao selecionar uma parede (mesma seleção já usada para editar), exibir horas de sol direto no dia e horário de pico, por exemplo: *"Parede Oeste — Quarto 1. Exposição solar direta hoje: 3h40 (14h20–18h00). Pico de incidência: 16h–17h."*

O usuário também deve poder escolher a data (não só o horário), para comparar solstícios/equinócios ou meses específicos — a exposição de uma mesma parede muda bastante entre dezembro e junho.

## 6. Ventilação natural

Ferramenta para ajudar o usuário a compreender como o ar pode circular pela residência dado um vento predominante (seção 3).

### 6.1 Cálculo

Diferente do sol, ventilação interna não é simulação de escoamento de fluido (CFD) — é fora de escopo próximo (ver seção 15). O motor usa uma heurística geométrica: dada uma direção de vento, classifica pares de aberturas em fachadas opostas ou adjacentes por alinhamento, distância e proporção de área, e classifica o resultado como:

- 🟢 **Boa ventilação** — aberturas posicionadas de maneira favorável a entrada e saída de ar;
- 🟡 **Ventilação limitada** — existe circulação, mas geometria ou proporção de abertura reduz a eficiência;
- 🔴 **Baixa circulação** — condição desfavorável à renovação natural do ar.

Essas classificações são indicadores de projeto, não certificações de desempenho — nasce 🟡 Estimativa (seção 12), nunca 🟢, porque a heurística é uma aproximação declarada, não uma medição física.

### 6.2 Reação a portas e janelas

A análise reage a alterações do usuário: abrir uma janela aumenta entrada de ar na classificação; abrir uma segunda janela em fachada oposta habilita a possibilidade de ventilação cruzada; fechar uma abertura reduz a circulação naquela condição analisada. A representação visual do fluxo aproximado (partículas, linhas, setas) é sempre derivada da classificação, nunca o contrário.

### 6.3 Integração com o Modo Visita

Ver [SPEC-003 — Modo Visita e Edição em Escala Humana](SPEC-003%20-%20Modo%20Visita%20e%20Edição%20em%20Escala%20Humana.md). Dentro do Modo Visita, o usuário pode caminhar pela residência visualizando partículas de fluxo de ar atravessando janelas e ambientes, tornando o conceito abstrato de ventilação cruzada em experiência visual direta.

## 7. Composição das paredes e propriedades térmicas

Pré-requisito técnico para as seções 8 e 9 (ver seção 4).

Uma parede deixa de ser compreendida apenas como espessura geométrica e passa a poder possuir uma composição construtiva em camadas.

```text
Exemplo alvenaria:
Pintura → reboco → bloco cerâmico → reboco → pintura

Exemplo Steel Frame:
Drywall → isolamento → perfis → OSB → membrana → revestimento externo
```

Cada camada referencia um material do catálogo técnico, que passa a poder carregar propriedades usadas pelo motor de análise: condutividade térmica, resistência térmica, espessura, densidade, calor específico e, quando necessário, permeabilidade ao vapor.

**Esses dados não devem ser inventados pelo sistema.** Devem vir de fonte técnica citável — norma, fabricante ou banco de dados validado — com a mesma exigência de rastreabilidade já aplicada ao catálogo de preços de materiais (dois níveis: correspondência real de produto quando disponível, referência genérica validada como situação padrão). Popular essa tabela é trabalho de curadoria, não de cálculo, e é o item de maior risco de cronograma deste documento inteiro.

## 8. Temperatura interna

Estimativa comparativa do comportamento térmico dos ambientes, considerando temperatura externa típica da região, radiação solar (seção 5), orientação das fachadas, composição das paredes (seção 7), cobertura, tamanho das aberturas, ventilação (seção 6) e sombreamento.

O objetivo inicial não é reproduzir uma simulação científica completa (ver seção 15 — fora de escopo o transporte transiente de calor). É um balanço térmico simplificado em regime permanente, suficiente para comparação entre soluções.

### 8.1 Mapa térmico

Representação visual sobre a planta e o modelo 3D, escala 🔵 menor temperatura → 🟢 → 🟡 → 🔴 maior temperatura, por ambiente. Exemplo:

```text
Exterior: 32 °C
Sala: 29,1 °C
Cozinha: 30,4 °C
Quarto 1: 27,8 °C
Quarto 2: 28,3 °C
```

### 8.2 Ao longo do dia

Acompanhamento 06h → 21h mostrando aquecimento de fachadas e cobertura, aumento da temperatura interna, influência do sombreamento e resfriamento após o pôr do sol — reaproveita a mesma linha do tempo da seção 5.1.

### 8.3 Regra de linguagem

Um valor absoluto de temperatura estimada nasce 🟡 Estimativa (seção 12), nunca 🟢 — a simplificação de regime permanente introduz erro real frente a uma simulação dinâmica. A forma mais segura de apresentar o resultado é sempre comparativa: *"esta opção esquenta mais que aquela nesta fachada"*, preferível a afirmar um número absoluto como se fosse medição.

## 9. Comparação de soluções

Função central, não um extra: o usuário salva a configuração atual, testa uma alternativa e o Esboce mostra a diferença lado a lado (ANTES × DEPOIS). Aplicável a qualquer variável que a seção 4 já cobre: janela, telha, parede, isolamento, vidro, cor, brise, orientação, abertura aberta/fechada.

Isso transforma o módulo em ferramenta de tomada de decisão, não apenas de visualização — e é o formato mais seguro de comunicar resultado 🟡, porque o valor relativo entre duas simulações do mesmo motor é mais confiável que o valor absoluto de qualquer uma isolada.

## 10. Umidade e risco de condensação

Depende da temperatura interna (seção 8) — não deve ser iniciada antes dela.

### 10.1 Cálculo

Ponto de orvalho a partir de temperatura interna e umidade relativa (fórmula de Magnus, bem estabelecida). Comparado contra a temperatura de superfície interna estimada da parede (derivada da composição de camadas, seção 7). Quando a temperatura de superfície se aproxima ou fica abaixo do ponto de orvalho, existe maior possibilidade de condensação superficial.

Escopo inicial: condensação superficial apenas. Condensação intersticial (dentro da parede, entre camadas) é analiticamente mais complexa e fica para uma fase posterior, se houver necessidade real.

### 10.2 Visualização

Indicadores por superfície: 🟢 baixo risco, 🟡 atenção, 🔴 condição favorável à condensação. Ao selecionar a parede, exibir os valores que geraram o indicador — temperatura interna, umidade relativa, temperatura superficial estimada, ponto de orvalho — para que a origem do alerta seja sempre visível, nunca uma afirmação isolada.

### 10.3 Regra de linguagem — obrigatória, não opcional

O Esboce nunca deve afirmar diretamente "esta parede terá mofo". Existem variáveis reais demais envolvidas nesse fenômeno para essa certeza. A linguagem correta é sempre condicional à simulação:

> "As condições analisadas indicam maior risco de condensação superficial nesta região."

> "Esta solução apresenta condições mais favoráveis ao acúmulo de umidade na situação simulada."

Essa regra de linguagem é parte do critério de aceitação da funcionalidade (seção 14), não apenas uma recomendação de copy.

## 11. Ação do vento externo sobre a edificação

Distinto de ventilação natural (seção 6). Ventilação natural analisa circulação de ar pelos ambientes; ação do vento analisa pressão e força exercida sobre a envoltória da edificação — fachadas, cobertura, beirais.

O usuário seleciona direção, velocidade e condição de análise; o Esboce representa visualmente a intensidade da ação do vento por região da envoltória (🔵 menor ação → 🟡 intermediária → 🔴 maior ação), com atenção especial à cobertura, onde pressão e sucção variam por geometria e direção do vento de forma não uniforme.

### 11.1 Aplicação a um pré-quantitativo Steel Frame

Aplicação futura de maior valor de produto: hoje o Esboce estima consumo de Steel Frame por área construída × consumo estimado em kg/m². A ação do vento, combinada com geometria, altura, pavimentos e aberturas, pode tornar essa estimativa progressivamente mais sensível ao projeto real, sem se tornar dimensionamento (ver seção 15, decisão explícita e não negociável do Product Owner).

```text
Localização → condições de vento → geometria → altura e pavimentos
  → fachadas e cobertura → aberturas → ações estimadas do vento
  → pré-quantitativo Steel Frame → estimativa de orçamento
```

O resultado desta cadeia é sempre rotulado como estimativa de orçamento, nunca como memorial de cálculo estrutural.

## 12. Níveis de confiabilidade

Toda análise deste módulo carrega um nível declarado de maturidade, visível ao usuário:

- ⚪ **Conceitual** — serve principalmente para visualização e educação;
- 🟡 **Estimativa** — usa modelo físico real e dado técnico, mas com simplificação relevante frente a uma simulação completa;
- 🟢 **Validado** — motor comparado com caso de referência ou metodologia reconhecida para o escopo declarado.

Classificação de cada análise deste documento: Sol = 🟢; Ventilação natural = 🟡; Temperatura interna = 🟡; Umidade/condensação = 🟡; Ação do vento = 🟡; pré-quantitativo Steel Frame por vento = 🟡, nunca 🟢 enquanto não houver validação por engenharia (seção 15).

Nenhuma análise nasce apresentada como certeza absoluta. Downgrade de nível é sempre possível conforme validação real; upgrade exige evidência, não apenas confiança na implementação.

## 13. Transparência — "Como calculamos?"

Mesmo padrão já em uso no motor de quantitativos de materiais (`buildRows()` como fonte única, preço rastreável por camada): todo resultado numérico ou classificação visual deve poder ser explicado sob demanda, mostrando localização, condição climática considerada, data/horário, materiais e propriedades usados, aberturas consideradas, modelo matemático aplicado, simplificações e limitações conhecidas.

Dois níveis de leitura, sempre lado a lado, nunca só um: indicador visual simples para o usuário comum (🔴 "este ambiente recebe muito calor durante a tarde"); dado técnico completo para quem clicar em "Ver detalhes técnicos".

## 14. Relação com o Residential Performance Engine

Ver [05 - Motores/Residential Performance Engine.md](../05%20-%20Motores/Residential%20Performance%20Engine.md).

O RPE descreve, na visão de longo prazo, um Performance Score agregado que inclui sub-indicadores de Conforto Térmico, Ventilação e Iluminação Natural — mas não especifica como esses sub-indicadores são calculados. Este documento é essa especificação: o motor concreto de sol, ventilação, temperatura e umidade descrito aqui pode, no futuro, alimentar esses sub-indicadores do RPE.

Essa relação é estritamente opcional e não bloqueante nos dois sentidos: este módulo não depende de nenhuma infraestrutura do RPE (Modelo Digital persistente de longo prazo, Construction Intelligence Network, score gamificado, comparação de mercado) para funcionar — é uma ferramenta de análise de projeto standalone, útil por si só durante a fase de desenho. O RPE, por sua vez, continua sendo visão de longo prazo (ver Roadmap.md, "evolução para o Modelo Digital da Residência e motores inteligentes") e não deve ser tratado como pré-requisito nem como justificativa para adiantar escopo deste módulo.

## 15. Fora do escopo — decisão explícita do Product Owner

Confirmado nesta especificação, sem ambiguidade: **este módulo não indicará estrutura para dimensionamento, em nenhuma fase, inclusive para Steel Frame.**

Uma coisa é estimar: "para esta configuração, o consumo estrutural tende a estar dentro desta faixa" (seção 11.1, sempre rotulado como pré-quantitativo/orçamento). Outra, categoricamente fora de escopo, é afirmar "utilize perfil X, espessura Y, espaçamento Z porque esta estrutura suporta determinado vento" — isso é dimensionamento estrutural e exige responsabilidade técnica de engenheiro habilitado, cálculo validado e nível de precisão que este módulo não se propõe a entregar.

Também fora do escopo inicial, alinhado à seção 90 do Roadmap.md ("fora do escopo da versão comercial inicial"):

- substituir projeto arquitetônico ou estrutural assinado por profissional habilitado;
- certificar conformidade normativa;
- simulação CFD real de escoamento de ar;
- transporte higrotérmico transiente (dinâmico) pelas camadas da parede;
- condensação intersticial (dentro da composição da parede);
- previsão de mofo ou qualquer afirmação categórica sobre um fenômeno biológico real;
- integração com sensores IoT, fabricantes ou Construction Intelligence Network — isso é escopo do RPE (seção 14), não deste módulo;
- ativar qualquer fase deste documento apenas porque consta aqui — cada fase exige decisão explícita de início, mesma regra já aplicada ao restante da visão estratégica do Esboce.

## 16. Decisões em aberto

- fonte definitiva de dados climáticos (seção 3) — licença de uso, limite de requisições, cobertura para regiões brasileiras menos atendidas;
- fonte definitiva do catálogo de propriedades térmicas de materiais (seção 7) — norma, fabricante ou banco de dados a adotar como referência inicial;
- algoritmo de posição solar a adotar (seção 5.1) — validar precisão suficiente sem custo computacional desnecessário no navegador;
- heurística exata de classificação de ventilação cruzada (seção 6.1) — parâmetros de alinhamento/distância/proporção de área a validar com caso conhecido antes do primeiro lançamento;
- modelo de balanço térmico em regime permanente a adotar (seção 8) — nível de simplificação aceitável para permanecer 🟡 honesto sem ficar inútil;
- revisão da concepção completa por profissional habilitado (engenharia civil/térmica) antes de qualquer fase entrar em desenvolvimento.

## 17. Fases de implantação

### Fase AA0 — pesquisa e validação

- consolidar vocabulário e entidades deste documento com o Glossário oficial;
- levantar e validar fontes técnicas de dados climáticos e propriedades de materiais;
- revisar a concepção com profissional habilitado (engenharia civil/térmica).

### Fase AA1 — sol

- algoritmo de posição solar;
- linha do tempo interativa com sombra real no modelo 3D;
- mapa de exposição por fachada/cobertura;
- exposição por parede ao selecionar (horas de sol direto, horário de pico);
- seletor de data, não só de horário.

### Fase AA2 — ventilação natural

- seleção de direção/velocidade de vento predominante por região;
- heurística de classificação de ventilação cruzada por par de aberturas;
- reação visual a abrir/fechar portas e janelas;
- integração com o Modo Visita (SPEC-003).

### Fase AA3 — composição de paredes e catálogo térmico

- camadas de composição construtiva por parede;
- propriedades térmicas no catálogo técnico, com fonte rastreável;
- indicadores técnicos por composição (resistência R, transmitância U).

### Fase AA4 — temperatura interna

- balanço térmico simplificado em regime permanente;
- mapa térmico por ambiente;
- acompanhamento ao longo do dia;
- comparação de soluções (ANTES × DEPOIS).

### Fase AA5 — umidade e condensação

- cálculo de ponto de orvalho;
- estimativa de temperatura superficial da parede;
- indicadores de risco por superfície, com linguagem condicional obrigatória (seção 10.3).

### Fase AA6 — ação do vento externo

- visualização de pressão/sucção estimada sobre fachadas e cobertura;
- pré-quantitativo Steel Frame sensível a vento e geometria (seção 11.1), sempre como estimativa de orçamento.

## 18. Critérios de aceitação da Fase AA1 (primeiro recorte utilizável)

1. Mover, adicionar ou remover uma parede, abertura, cobertura ou elemento de sombreamento atualiza a análise solar sem ação manual do usuário.
2. A linha do tempo produz sombra real no modelo 3D, consistente com a posição solar calculada para aquela data/horário/coordenada.
3. A exposição por parede (horas de sol direto) é calculada pela mesma amostragem que alimenta o mapa de exposição — uma única fonte de cálculo, sem números divergentes entre as duas visualizações.
4. Trocar a localização do projeto muda o resultado da análise.
5. Nenhum resultado desta fase é apresentado sem a opção "Como calculamos?" (seção 13).
6. Esta fase não introduz nenhuma dependência de dado climático ou de propriedade de material — funciona apenas com geometria e coordenada.

## 19. Princípio final

O Esboce não deve apenas mostrar a casa que o usuário desenhou. Deve ajudá-lo a compreender as consequências das decisões que tomou antes de construir — mantendo, na mesma medida, absoluta clareza sobre onde termina a análise de apoio à decisão e onde começa a responsabilidade técnica de um profissional habilitado.
