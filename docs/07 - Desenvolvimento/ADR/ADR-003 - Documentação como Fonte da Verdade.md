# ADR-003 – Documentação como Fonte da Verdade

**Status:** Aceita

**Data:** 02/08/2026

**Responsáveis:** Product Owner e Arquiteto de Software

---

# Contexto

O Esboce é um projeto de longo prazo composto por documentação de produto, arquitetura, domínio, especificações funcionais e decisões técnicas.

À medida que o software evolui, existe o risco de a implementação seguir um caminho diferente da documentação, tornando-a desatualizada e reduzindo sua confiabilidade.

Como a documentação representa o conhecimento oficial do projeto, é necessário definir uma regra para manter código e documentação sincronizados.

---

# Decisão

Antes da implementação de qualquer funcionalidade será verificado se ela já possui documentação oficial.

Se existir documentação:

- a implementação deverá seguir a documentação existente;

ou

- a documentação deverá ser atualizada antes da implementação.

Nenhuma funcionalidade será considerada concluída enquanto houver divergência entre documentação e implementação.

---

# Objetivos

- manter a documentação confiável;
- evitar divergências entre arquitetura e código;
- reduzir retrabalho;
- preservar as decisões do projeto;
- facilitar futuras manutenções.

---

# Consequências

## Benefícios

- documentação sempre atualizada;
- arquitetura consistente;
- menor risco de interpretações diferentes;
- facilidade para novos colaboradores compreenderem o projeto.

## Custos

Toda alteração arquitetural relevante exigirá atualização da documentação correspondente.

Esse custo é considerado pequeno quando comparado aos benefícios de manter uma base documental consistente.

---

# Observações

A documentação passa a ser considerada parte integrante do desenvolvimento do Esboce.

Implementação e documentação evoluem juntas.

Quando houver conflito entre código e documentação, o conflito deverá ser resolvido imediatamente, atualizando um dos dois antes da continuidade do desenvolvimento.