# ADR-005 — Coberturas Compostas e Engaste Explícito

**Status:** Aceita

**Data:** 04/08/2026

**Responsáveis:** Product Owner e Arquitetura de Software

## Contexto

Casas em L ou T exigem mais de uma cobertura. Apenas sobrepor duas malhas gera beirais cruzados, superfícies internas indevidas e dupla contagem de materiais. Recortar automaticamente durante o arraste também é incorreto: uma sobreposição temporária pode ser apenas parte do posicionamento e não representa intenção de união.

## Decisão

Coberturas permanecem entidades paramétricas independentes durante criação, ajuste e arraste. Quando coberturas transversais estiverem encostadas ou sobrepostas, o usuário pode executar **Engastar** para confirmar a relação.

O engaste atribui um identificador comum de conjunto (`compoundGroupId`). A partir daí:

- o conjunto se move como unidade;
- ambas as coberturas são recortadas pela interseção de seus planos;
- a linha de vale acompanha toda a água-furtada;
- áreas e materiais usam as superfícies líquidas resultantes.

A malha recortada continua sendo derivada. O domínio preserva as coberturas e a relação entre elas, não uma união booleana de triângulos.

## Justificativa de UX

O produto evita perguntas quando a intenção pode ser deduzida com segurança. Neste caso, a sobreposição durante o posicionamento é ambígua e uma união automática destrutiva dificultaria ajustes. A ação explícita é, portanto, uma confirmação contextual da intenção, não uma etapa burocrática.

## Consequências

### Benefícios

- ajuste livre antes da confirmação;
- ausência de cortes persistentes durante o arraste;
- recorte visual coerente nas duas coberturas;
- metragem líquida sem dupla contagem;
- preservação do modelo paramétrico.

### Custos

- exige uma ação explícita de engaste;
- interseções dependem de coberturas transversais suportadas;
- casos com múltiplas alturas, inclinações ou mais de duas interseções exigirão evolução do algoritmo.

## Alternativas rejeitadas

- **Recortar ao detectar sobreposição:** rejeitada porque altera a geometria durante o posicionamento.
- **Manter malhas sobrepostas:** rejeitada por defeitos visuais e quantitativos incorretos.
- **Persistir uma única malha fundida:** rejeitada porque torna a malha fonte da verdade e dificulta a edição paramétrica.
