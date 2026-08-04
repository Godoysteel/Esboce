# Migration Roadmap

**Atualização:** 04/08/2026

**Baseline funcional:** editor v19 executado em Vite/TypeScript

## Sistemas preservados na migração

- [x] Sistema de câmera
- [x] Sistema de seleção
- [x] Sistema de grid e controle de visibilidade
- [x] Sistema de snapping estrutural
- [x] Sistema de paredes, junções e cômodos derivados
- [x] Sistema de materiais por superfície
- [x] Sistema de cobertura e coberturas compostas
- [x] Sistema de quantitativos
- [x] Fundação com baldrame e radier
- [x] Portas e janelas vinculadas às paredes

## Sprint 01 — execução na arquitetura Vite

**Status:** concluída.

Critérios preservados:

- editor abre e opera na aplicação Vite;
- câmera, seleção e controles funcionam;
- construção paramétrica permanece editável;
- testes existentes e build são os gates automatizados.

## Consolidação v19

**Status:** implementada e em validação visual.

Entregas consolidadas:

- contornos discretos sem arestas de triangulação aparentes;
- textura de reboco em paredes e oitões;
- afastamentos de aberturas;
- materiais por face e por cômodo;
- baldrame padrão visível;
- oitão classificado como parede derivada;
- coberturas compostas com engaste explícito, movimento conjunto e área líquida;
- terreno com grama e grid visual alternável;
- cotas dinâmicas durante redimensionamento de paredes.

## Decisão de precisão

O snapping estrutural permanece em 500 mm. O teste de 100 mm foi revertido por instabilidades topológicas e está documentado em [ADR-R001](../docs/07%20-%20Desenvolvimento/ADR-Rejeitadas/ADR-R001%20-%20Snap%20de%20100%20mm%20na%20Topologia%20Atual.md).

## Próximos passos

- ampliar testes automatizados para coberturas compostas e invariantes de abertura;
- separar progressivamente `src/core` por contextos de negócio;
- persistir comandos/eventos de forma compatível com o modelo híbrido;
- reavaliar precisão fina somente após robustecer a resolução topológica.

## Regra de rollback

Mudanças experimentais devem ser isoladas e revertidas sem remover comportamentos aprovados. Experimentos arquiteturais rejeitados permanecem registrados para futura reavaliação.
