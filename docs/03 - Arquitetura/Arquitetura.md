# Arquitetura do Esboce

**Versão:** 2.1

**Status:** Canônico

**Atualização:** 04/08/2026

## 1. Objetivo

Definir a arquitetura vigente do editor e distingui-la da arquitetura-alvo da plataforma. O modelo paramétrico é a fonte da verdade; a cena 3D, as cotas e os quantitativos são projeções derivadas.

## 2. Princípios

1. A construção é armazenada como entidades e parâmetros, nunca como malha 3D canônica.
2. Alterações passam pelos comandos do domínio antes de serem renderizadas.
3. Relações geométricas são validadas antes da confirmação de uma operação.
4. Cômodos, superfícies, recortes e quantitativos são recalculados.
5. A interface apresenta intenção e resultado, mas não se torna fonte da verdade.

## 3. Arquitetura implementada na v19

```text
Interface HTML
    ↓
Bootstrap / EsboceApplication
    ↓
ViewportController ─── painéis de camadas e materiais
    ↓
Store.commands ─────── validações e mutações do projeto
    ↓
Core ───────────────── topologia, snapping e regras geométricas
    ↓
Scene3DRenderer ────── projeção Three.js
    ↓
ViewportStats / MaterialsPanel ── valores derivados
```

Responsabilidades atuais:

- `src/core/types.ts`: contrato persistível do projeto.
- `src/core/Store.ts`: estado e comandos do editor.
- `src/core/Core.ts`: operações geométricas e invariantes.
- `src/core/ViewportController.ts`: seleção, arraste, ferramentas e cotas.
- `src/core/Scene3DRenderer.ts`: geração da cena a partir do estado.
- `src/core/MaterialsPanel.ts`: quantitativos e estimativas derivados.

## 4. Fluxo de uma alteração

```text
gesto do usuário
→ prévia da operação
→ snapping e validação
→ comando no Store
→ atualização do modelo paramétrico
→ reconstrução da cena
→ recálculo de áreas e materiais
```

Uma prévia de arraste não deve persistir geometria inválida. Ao confirmar, paredes conectadas e coberturas engastadas mantêm suas relações paramétricas.

## 5. Regras estruturais vigentes

- O snapping estrutural usa módulo de 500 mm.
- Portas e janelas pertencem a paredes e respeitam afastamentos mínimos.
- O oitão é superfície de parede derivada de uma cobertura de duas águas.
- Coberturas continuam independentes durante o posicionamento e só formam um conjunto após o engaste explícito.
- A área de coberturas engastadas desconta as regiões recortadas.
- A fundação padrão de um novo projeto é baldrame e sua visualização pode ser alternada por camada.
- Materiais de parede e oitão podem ser aplicados por face; pisos são aplicados por cômodo.

## 6. Persistência e eventos

O estado paramétrico atual continua sendo a fonte da verdade. A direção arquitetural é o modelo híbrido definido no documento de domínio: comandos explícitos agora, eventos para auditoria e evolução posterior para histórico mais completo. Malhas, linhas de contorno, cotas e estatísticas não são persistidas como entidades estruturais.

## 7. Arquitetura-alvo

A organização atual em `src/core` é uma etapa de migração, não o destino final. À medida que os módulos estabilizarem, o código deve migrar para contextos de negócio como `Wall`, `Room`, `Roof`, `Foundation`, `Catalog`, `Budget` e `Simulation`, mantendo separação interna entre domínio, comandos, renderização e testes.

## 8. Verificação

- Testes geométricos existentes: `npm test`.
- Verificação de tipos e produção: `npm run build`.
- Validação visual: prévia Vite e cenários descritos na SPEC-001.

## 9. Decisões relacionadas

- [ADR-003 — Documentação como Fonte da Verdade](../07%20-%20Desenvolvimento/ADR/ADR-003%20-%20Documentação%20como%20Fonte%20da%20Verdade.md)
- [ADR-004 — Registro de Decisões Rejeitadas](../07%20-%20Desenvolvimento/ADR/ADR-004%20-%20Registro%20de%20Decisões%20Rejeitadas.md)
- [ADR-005 — Coberturas Compostas e Engaste Explícito](../07%20-%20Desenvolvimento/ADR/ADR-005%20-%20Coberturas%20Compostas%20e%20Engaste%20Explícito.md)
