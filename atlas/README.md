# Projeto Atlas

> Engenharia antes da implementação.

---

# O que é o Projeto Atlas?

O Projeto Atlas é a iniciativa responsável por auditar, consolidar e evoluir toda a engenharia do Esboce.

Seu objetivo é transformar a documentação existente em uma **Engineering Baseline** consistente, rastreável e capaz de sustentar a evolução do produto durante muitos anos.

O Atlas não desenvolve funcionalidades.

O Atlas desenvolve a engenharia que sustenta essas funcionalidades.

---

# Missão

Garantir que todo o conhecimento do Esboce seja:

- consistente;
- rastreável;
- auditável;
- organizado;
- evolutivo.

---

# Objetivos

- Inventariar toda a documentação.
- Auditar todos os documentos oficiais.
- Identificar inconsistências.
- Eliminar redundâncias.
- Consolidar documentos canônicos.
- Atualizar a Visão do Produto.
- Atualizar o Modelo de Domínio.
- Atualizar o Glossário.
- Recomendar novos ADRs.
- Produzir a Engineering Baseline.

---

# Princípios

## I — Engenharia antes da implementação

Nenhuma funcionalidade deve ser implementada sem especificação suficiente.

---

## II — Uma única fonte da verdade

Cada conhecimento deve possuir um único documento canônico.

Todos os demais documentos deverão apenas referenciá-lo.

---

## III — Rastreabilidade

Toda decisão importante deve ser rastreável.

Nenhuma decisão arquitetural deverá depender da memória.

---

## IV — Consistência

O conjunto da documentação deve representar uma única engenharia.

Contradições devem ser eliminadas.

---

## V — Evolução Contínua

A engenharia nunca é considerada definitiva.

Ela evolui junto com o produto.

---

# Estrutura

```
atlas/

000 - Planejamento

100 - Inventário

200 - Auditorias

300 - Relatórios

400 - Engineering Baseline

500 - Métricas

600 - Knowledge Graph

900 - Histórico
```

---

# Fluxo da Auditoria

Todo documento segue o seguinte ciclo:

```
Recebido

↓

Inventariado

↓

Classificado

↓

Auditado

↓

Consolidado

↓

Canônico

↓

Monitorado
```

---

# Entregáveis

Ao final do Projeto Atlas deverão existir, no mínimo:

- Engineering Baseline
- Registro Mestre da Engenharia
- Relatório Executivo
- Relatório Técnico
- Mapa da Engenharia
- Knowledge Graph
- Lista de Documentos Canônicos
- Lista de Documentos Obsoletos
- Recomendações de Reorganização
- Atualizações do Modelo de Domínio
- Atualizações do Glossário
- Atualizações da Visão do Produto
- ADRs Recomendados

---

# Escopo

O Projeto Atlas audita:

- Documentação
- Produto
- Modelo de Domínio
- Arquitetura
- Regras de Negócio
- Terminologia
- Consistência
- Governança da Engenharia

O Projeto Atlas **não** implementa funcionalidades.

---

# Resultado Esperado

Ao término da auditoria deverá existir uma única engenharia oficial do Esboce.

Essa engenharia servirá como referência para:

- desenvolvimento;
- testes;
- manutenção;
- evolução;
- onboarding de novos desenvolvedores;
- futuras auditorias.

---

# Relação com o Esboce

O Projeto Atlas não faz parte do produto.

Ele é responsável por avaliar, consolidar e preservar a engenharia do produto.

Enquanto a pasta `docs/` representa a **Engenharia Oficial do Esboce**, a pasta `atlas/` representa a **Engenharia da Auditoria**.

Esses dois conjuntos de documentos são complementares, porém possuem responsabilidades distintas.

---

# Filosofia

> "A documentação registra conhecimento.
>
> A engenharia organiza esse conhecimento.
>
> O Projeto Atlas garante que ele permaneça correto."

---

**Versão:** 1.0

**Status:** Ativo

**Projeto:** Atlas