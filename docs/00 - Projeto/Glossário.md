# Glossário Oficial do Esboce

**Versão:** 1.0

**Status:** Em evolução

**Última atualização:** 02/08/2026

---

# Objetivo

Este documento estabelece a definição oficial dos principais termos utilizados no Esboce.

Seu objetivo é garantir que toda a documentação, especificações, código e futuras implementações utilizem uma linguagem consistente.

Quando houver dúvida sobre o significado de um termo, este documento será a referência oficial.

---

# Termos Oficiais

## Ambiente

Espaço interno delimitado por elementos construtivos destinado a uma função específica, como quarto, sala, cozinha ou banheiro.

---

## Casa

Representação digital completa de uma residência.

A Casa é o principal objeto do Modelo de Domínio e contém todos os elementos necessários para representar uma construção durante todo o seu ciclo de vida.

---

## Cobertura

Conjunto de elementos responsáveis pelo fechamento superior da residência.

Inclui telhados, lajes, estruturas de cobertura e seus respectivos componentes.

---

## Componente

Elemento reutilizável da plataforma.

Exemplos:

- porta
- janela
- telha
- perfil metálico
- luminária
- equipamento

---

## Core

Núcleo lógico do Esboce.

Responsável pelas regras de negócio, Modelo de Domínio e operações internas.

O Core não possui dependência da interface gráfica nem do renderizador.

---

## Digital Twin

Representação digital persistente da residência.

O Digital Twin acompanha a residência durante todo o seu ciclo de vida, permitindo armazenamento de informações, manutenção, simulações e integração com outros serviços.

---

## Editor

Interface utilizada pelo usuário para criar e modificar a residência.

O Editor não representa a lógica do sistema.

Ele apenas interage com o Core.

---

## Elemento Construtivo

Qualquer objeto físico que compõe a residência.

Exemplos:

- paredes
- pilares
- vigas
- portas
- janelas
- pisos
- telhados

---

## Especificação Funcional

Documento que descreve o comportamento esperado de uma funcionalidade do sistema.

---

## Motor

Módulo especializado responsável pelo processamento de uma determinada área da plataforma.

Exemplos:

- RHE
- RPE
- RAE
- Budget Engine
- Simulation Engine

---

## Modelo de Domínio

Representação conceitual da residência.

Define quais entidades existem e como elas se relacionam.

É independente da interface gráfica e do renderizador.

---

## Modelo Paramétrico

Modelo baseado em propriedades e relações, permitindo que alterações em um elemento atualizem automaticamente todos os componentes relacionados.

---

## Parede

Elemento construtivo vertical utilizado para delimitar ambientes.

A parede existe como entidade do Modelo de Domínio antes de existir como representação gráfica.

---

## Plataforma

Conjunto completo de módulos que compõem o ecossistema do Esboce.

Inclui o Editor, motores especializados, marketplace, SDK, APIs e demais serviços.

---

## Projeto

Conjunto de informações que descrevem uma residência.

Um projeto pode conter múltiplos pavimentos, ambientes, componentes, materiais e demais informações necessárias para representar a construção.

---

## Renderer

Módulo responsável exclusivamente pela representação gráfica do Modelo de Domínio.

O Renderer não contém regras de negócio.

---

## Residência

Objeto físico representado pelo Modelo de Domínio.

A residência continua existindo independentemente da forma como é visualizada.

---

## SDK

Conjunto de ferramentas destinado ao desenvolvimento de componentes e integrações para a plataforma Esboce.

---

## Usuário

Pessoa que utiliza o Esboce para criar, modificar, analisar ou acompanhar uma residência.

---

## Visão do Produto

Documento que descreve os objetivos estratégicos e a direção de longo prazo do Esboce.

---

# Observações

Este glossário é um documento vivo.

Novos termos poderão ser adicionados conforme a evolução da plataforma.

Sempre que um termo possuir uma definição oficial, toda a documentação deverá utilizar exatamente essa definição.