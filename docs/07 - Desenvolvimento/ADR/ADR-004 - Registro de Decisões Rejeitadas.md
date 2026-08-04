# ADR-004 – Registro de Decisões Rejeitadas

**Status:** Aceita

**Data:** 02/08/2026

**Responsáveis:** Product Owner e Arquiteto de Software

---

# Contexto

Durante o desenvolvimento do Esboce, diversas alternativas arquiteturais serão estudadas antes da implementação.

Algumas dessas alternativas serão descartadas por motivos técnicos, arquiteturais ou de manutenção.

Sem um registro dessas decisões, existe o risco de que as mesmas propostas sejam reavaliadas futuramente, repetindo discussões já resolvidas e desperdiçando tempo da equipe.

---

# Decisão

O Esboce manterá um registro permanente das decisões arquiteturais rejeitadas.

Cada decisão rejeitada será documentada individualmente na pasta:

docs/07 - Desenvolvimento/ADR-Rejeitadas

utilizando a nomenclatura:

ADR-R001
ADR-R002
ADR-R003
...

---

# Objetivos

- preservar o raciocínio técnico;
- registrar alternativas avaliadas;
- evitar rediscussões recorrentes;
- manter a memória arquitetural do projeto.

---

# Consequências

## Benefícios

- economia de tempo;
- histórico completo das decisões;
- maior consistência arquitetural;
- documentação mais rica.

## Custos

Exige disciplina para registrar apenas decisões relevantes, evitando documentar discussões de pequena importância.

---

# Observações

Uma decisão rejeitada não significa que ela nunca poderá ser revista.

Caso novas informações, tecnologias ou requisitos justifiquem uma reavaliação, uma nova ADR deverá ser criada referenciando a decisão anterior.
