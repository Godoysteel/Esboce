# Documentação Oficial do Esboce

Este diretório reúne as fontes canônicas de produto, domínio, arquitetura e desenvolvimento do Esboce. Código e documentação devem evoluir juntos, conforme a [ADR-003](../07%20-%20Desenvolvimento/ADR/ADR-003%20-%20Documentação%20como%20Fonte%20da%20Verdade.md).

## Estado documentado

- **Produto:** editor paramétrico residencial v19 em validação local.
- **Implementação atual:** aplicação web Vite/TypeScript com renderização Three.js.
- **Modelo:** paredes e coberturas paramétricas; cômodos, geometria e quantitativos derivados.
- **Precisão de edição:** encaixe estrutural de 500 mm nesta fase.

## Navegação

- [Visão e glossário](./Glossário.md)
- [Princípios de produto e UX](../01%20-%20Produto/Princípios%20de%20Produto%20e%20UX.md)
- [Modelo de domínio](../02%20-%20Domínio/Modelo%20de%20Domínio.md)
- [Arquitetura](../03%20-%20Arquitetura/Arquitetura.md)
- [SPEC-001 — Editor Paramétrico v19](../06%20-%20Especificações/SPEC-001%20-%20Editor%20Paramétrico%20v19.md)
- [ADRs aceitas](../07%20-%20Desenvolvimento/ADR)
- [ADRs rejeitadas](../07%20-%20Desenvolvimento/ADR-Rejeitadas)
- [Roadmap de migração](../../migration/Migration%20Roadmap.md)

## Regra de manutenção

Uma funcionalidade não é considerada concluída quando seu comportamento real diverge da especificação, do modelo de domínio ou de uma ADR aceita. Experimentos descartados que possam voltar a ser propostos devem ser preservados como ADR rejeitada.
