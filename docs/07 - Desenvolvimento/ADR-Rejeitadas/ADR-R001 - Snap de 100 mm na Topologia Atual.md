# ADR-R001 — Snap de 100 mm na Topologia Atual

**Status:** Rejeitada para a arquitetura atual

**Data:** 04/08/2026

**Experimento:** redução do passo de edição de 500 mm para 100 mm

## Contexto

O passo de 500 mm limita pequenos ajustes de largura de cômodos. Foi experimentado um passo de 100 mm para dar maior precisão ao redimensionamento.

## Resultado observado

O experimento expôs instabilidades na topologia atual: junções foram divididas em posições inadequadas, paredes conectadas deixaram frestas ou prolongamentos e alguns contornos de cômodos ficaram incompletos. Esses efeitos comprometem geometria, áreas e operações posteriores.

## Decisão

Manter o snapping estrutural em **500 mm** nesta fase. O grid visual pode ser ocultado, mas isso não altera o passo usado pelas operações estruturais.

## Motivos da rejeição

- a lógica atual usa tolerâncias e regras de fusão calibradas para o módulo de 500 mm;
- precisão fina aumenta estados intermediários próximos sem uma resolução topológica robusta;
- um ganho de controle não compensa o risco de corromper junções e cômodos derivados.

## Condições para reavaliação

A precisão de 100 mm pode voltar a ser considerada quando houver:

1. separação explícita entre grid visual, passo de arraste e tolerância topológica;
2. resolução determinística de junções T, L e cruzamentos;
3. testes para redimensionamento encadeado, aberturas e cômodos não ortogonais;
4. migração segura de projetos criados no módulo de 500 mm;
5. validação de que áreas e quantitativos permanecem estáveis.

Esta ADR rejeita a adoção imediata, não o objetivo de oferecer precisão fina no futuro.
