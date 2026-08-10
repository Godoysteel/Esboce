# ADR-006 — Quantitativos, Orçamentos e Limites de Responsabilidade Técnica

**Status:** Aceita

**Data:** Agosto de 2026

**Responsáveis:** Product Owner e Arquitetura de Software

**Tema:** Quantitativos, orçamento, sistemas construtivos e responsabilidade técnica

---

## 1. Contexto

O Esboce tem como objetivo permitir que o usuário modele uma edificação de maneira simples e utilize a geometria criada para obter informações úteis para planejamento, especificação de produtos, quantitativos e estimativas de custos.

Com a evolução da plataforma, surgiu a possibilidade de permitir que um mesmo projeto seja analisado sob diferentes sistemas construtivos.

Entre eles:

- alvenaria convencional;
- Light Steel Frame;
- outros sistemas construtivos que poderão ser incorporados futuramente.

Essa capacidade cria uma distinção fundamental entre:

**estimativa e orçamento de construção**

e

**projeto, dimensionamento e responsabilidade técnica.**

O Esboce atuará no primeiro grupo.

---

## 2. Decisão fundamental

> **O Esboce estima quantitativos e custos. O Esboce não dimensiona estruturas e não substitui projetos elaborados por profissionais legalmente habilitados.**

Essa regra deverá orientar permanentemente o desenvolvimento dos módulos de quantitativos e orçamento.

---

## 3. Princípio de funcionamento

O usuário deverá modelar a edificação uma única vez.

A geometria do projeto servirá como fonte de dados para diferentes motores de orçamento.

Fluxo conceitual:

**Modelo da edificação**

↓

**Geometria**

↓

**Sistema construtivo selecionado**

↓

**Regras de estimativa**

↓

**Quantitativos**

↓

**Produtos / composições**

↓

**Preços**

↓

**Orçamento estimado**

Portanto, a geometria não precisa ser recriada quando o usuário deseja comparar sistemas construtivos.

---

## 4. Separação entre geometria e orçamento

O núcleo geométrico do Esboce não deverá conter regras específicas de Steel Frame, alvenaria ou qualquer outro sistema construtivo.

O Core deverá continuar responsável por elementos como:

- paredes;
- dimensões;
- áreas;
- pavimentos;
- ambientes;
- aberturas;
- coberturas;
- relações geométricas;
- demais informações espaciais.

Os motores de orçamento interpretarão esses dados.

Conceitualmente:

```text
Core / Geometria
        │
        ├── Estimador Alvenaria
        │
        ├── Estimador Steel Frame
        │
        └── Outros estimadores futuros
```

Essa separação deverá ser preservada na arquitetura do software.

---

## 5. Light Steel Frame

### 5.1 Escopo

O Esboce **não deverá gerar automaticamente a estrutura metálica detalhada na viewport 3D**.

Não será objetivo inicial da plataforma modelar:

- montantes individualmente;
- guias;
- bloqueadores;
- vergas estruturais;
- reforços;
- contraventamentos;
- conexões;
- parafusos estruturais;
- espessuras de perfis;
- modulação estrutural.

O modelo visual continuará representando a edificação de maneira arquitetônica.

---

## 6. Estrutura engenheirada

Para orçamento de Steel Frame, o Esboce utilizará inicialmente o conceito de:

### Estrutura Steel Frame engenheirada por peso

O orçamento poderá ser calculado utilizando:

**área considerada × índice estimado de kg/m² × preço por kg**

Exemplo conceitual:

```text
Área considerada:       120 m²
Índice informado:        28 kg/m²

Peso estimado:
120 × 28 = 3.360 kg

Preço da estrutura:
R$ 18,00/kg

Estimativa:
3.360 × R$ 18,00

Total estimado:
R$ 60.480,00
```

Os valores acima são apenas ilustrativos e **não constituem parâmetros técnicos recomendados pelo Esboce**.

---

## 7. O índice kg/m² não é uma constante técnica

O Esboce não deverá possuir um único valor universal apresentado como:

> "Uma construção em Steel Frame utiliza X kg/m²."

O consumo de aço depende do projeto e das condições específicas da edificação.

Portanto, o parâmetro de kg/m² deverá possuir origem identificável.

Poderá ser proveniente de:

- fornecedor;
- fabricante;
- empresa especializada;
- orçamento comercial;
- projetista;
- engenheiro;
- composição cadastrada;
- parâmetro informado manualmente pelo usuário.

A interface deverá deixar clara a origem do índice utilizado.

---

## 8. Exemplo de interface

### Steel Frame — Estrutura engenheirada

**Área considerada**

120,00 m²

**Índice de orçamento**

28,00 kg/m²

**Origem do índice**

Fornecedor / composição selecionada

**Peso estimado**

3.360 kg

**Preço**

R$ 18,00/kg

### Estrutura estimada

**R$ 60.480,00**

---

## 9. Quantitativo técnico × quantitativo comercial

O Esboce deverá distinguir dois conceitos.

### Quantitativo técnico

Representa a necessidade estimada derivada da geometria.

Exemplos:

- m² de parede;
- m² de revestimento;
- volume de concreto;
- área de cobertura;
- peso estimado de estrutura.

### Quantitativo comercial

Representa a conversão dessa necessidade em produtos comercialmente disponíveis.

Exemplos:

```text
Necessidade:
82,4 m² de placa

Produto:
Placa 1,20 × 2,40 m

Quantidade comercial:
30 placas

Preço unitário:
R$ XX

Total:
R$ XXXX
```

Essa distinção será importante para integração futura com catálogos de produtos e fornecedores.

---

## 10. Steel Frame e produtos complementares

A estrutura engenheirada poderá constituir apenas uma parte do orçamento Steel Frame.

Outros componentes poderão ser calculados separadamente quando houver regras suficientemente confiáveis.

Exemplos futuros:

- OSB;
- placas cimentícias;
- drywall;
- isolamento térmico;
- isolamento acústico;
- membranas;
- revestimentos;
- acabamentos;
- impermeabilização;
- fixadores não estruturais.

Esses elementos não deverão ser confundidos com o dimensionamento da estrutura.

---

## 11. Comparação entre sistemas construtivos

Uma mesma edificação poderá futuramente possuir diferentes cenários de orçamento.

Exemplo:

| Sistema | Estimativa |
|---|---:|
| Alvenaria convencional | R$ XX.XXX |
| Steel Frame | R$ XX.XXX |

O objetivo é permitir ao usuário responder:

> **"Quanto custaria aproximadamente construir esta mesma edificação utilizando outro sistema construtivo?"**

A comparação deverá sempre utilizar premissas claramente identificadas.

---

## 12. Premissas visíveis

Todo orçamento deverá registrar as premissas utilizadas.

Exemplo:

### Premissas deste orçamento

- Área considerada: 120 m²
- Sistema: Light Steel Frame
- Estrutura: engenheirada
- Índice utilizado: 28 kg/m²
- Origem: fornecedor X
- Preço utilizado: R$ 18,00/kg
- Data do preço: XX/XX/XXXX

Isso permitirá que o usuário compreenda como o resultado foi obtido.

---

## 13. Aviso obrigatório — Steel Frame

Sempre que uma estimativa de Steel Frame for apresentada, deverá existir aviso claro semelhante a:

> **Estimativa preliminar de orçamento**
>
> O Esboce não realiza projeto estrutural nem dimensionamento de perfis, cargas, espaçamentos, reforços ou conexões. O índice de kg/m² utilizado nesta estimativa é um parâmetro de orçamento e não representa dimensionamento estrutural. O peso e as especificações finais da estrutura devem ser definidos pelo projeto estrutural elaborado e validado por profissional legalmente habilitado.

---

## 14. Aviso geral do Esboce

Além do aviso específico de Steel Frame, a plataforma deverá possuir um aviso geral relacionado aos resultados produzidos.

> **O Esboce é uma ferramenta de apoio ao planejamento, modelagem, quantitativos e estimativas de custos.**
>
> As informações geradas pela plataforma não substituem projetos arquitetônicos, estruturais, elétricos, hidrossanitários ou outros projetos técnicos obrigatórios, nem cálculos, verificações, especificações ou responsabilidade técnica de arquitetos, engenheiros e demais profissionais legalmente habilitados.

---

## 15. O aviso não deverá ficar escondido

A responsabilidade não deverá ser tratada somente nos Termos de Uso.

O aviso deverá aparecer contextualizado em pontos relevantes da experiência.

Especialmente:

- geração de quantitativos;
- orçamento;
- comparação de sistemas construtivos;
- exportação de relatórios;
- impressão;
- PDF;
- Steel Frame;
- resultados que possam ser interpretados como especificação técnica.

O objetivo não é assustar o usuário.

O objetivo é deixar clara a natureza da informação apresentada.

---

## 16. Terminologia

O Esboce deverá preferir termos como:

- **estimativa**;
- **quantitativo estimado**;
- **orçamento estimado**;
- **estudo preliminar**;
- **parâmetro de orçamento**;
- **estrutura engenheirada — estimativa**.

Deverá evitar apresentar resultados automáticos como:

- "dimensionamento estrutural";
- "projeto estrutural";
- "estrutura calculada";
- "perfil necessário";
- "estrutura aprovada";
- "quantidade definitiva".

Quando tais informações dependerem de responsabilidade profissional.

---

## 17. Princípio de rastreabilidade

Sempre que possível, cada resultado deverá permitir responder:

> **De onde veio esse número?**

Exemplo:

```text
Peso estimado: 3.360 kg

120 m²
×
28 kg/m²
=
3.360 kg
```

E:

```text
Custo estimado: R$ 60.480

3.360 kg
×
R$ 18/kg
=
R$ 60.480
```

Isso aumenta transparência e confiança no orçamento.

---

## 18. Produtos e parceiros comerciais

Quando preços ou parâmetros forem fornecidos por parceiros comerciais, isso deverá ser identificado.

Exemplo:

**Estrutura Steel Frame engenheirada**

Fornecedor: Empresa X

Preço de referência: R$ XX/kg

Atualizado em: XX/XX/XXXX

Isso permitirá futuramente que diferentes fornecedores apresentem propostas para o mesmo quantitativo estimado.

---

## 19. Possibilidade futura

O sistema poderá futuramente permitir:

### Comparar fornecedores

Fornecedor A
25 kg/m² — R$ XX/kg

Fornecedor B
27 kg/m² — R$ XX/kg

Fornecedor C
estrutura sob orçamento

Porém, o Esboce deverá comparar **propostas comerciais**, e não declarar qual solução estrutural é tecnicamente correta.

A responsabilidade pelo dimensionamento permanece com o profissional responsável pelo projeto.

---

## 20. Regra arquitetural

Os motores de orçamento deverão permanecer desacoplados do núcleo geométrico.

Uma organização futura poderá seguir conceitualmente:

```text
src/
 ├─ core/
 │   └─ geometria
 │
 ├─ estimating/
 │   ├─ masonry/
 │   ├─ steel-frame/
 │   └─ shared/
 │
 ├─ catalog/
 │   └─ produtos
 │
 └─ pricing/
     └─ preços e fornecedores
```

A estrutura definitiva será decidida durante a implementação.

---

## 21. Regra de ouro

> **O Esboce calcula o orçamento a partir de premissas.
> O profissional habilitado calcula e especifica a construção.**

Essa distinção deverá permanecer explícita em toda evolução futura do produto.

---

## Decisão

**ACEITO**

O Esboce poderá gerar quantitativos e orçamentos para diferentes sistemas construtivos.

Para Light Steel Frame, a primeira implementação deverá utilizar **estimativa de estrutura engenheirada baseada em kg/m² e R$/kg**, sem geração ou dimensionamento automático da estrutura na viewport.

O resultado será apresentado explicitamente como **estimativa de orçamento**, acompanhado das premissas utilizadas e de aviso de responsabilidade técnica.

O Esboce **não substitui arquiteto, engenheiro, projetos técnicos, cálculos ou responsabilidade profissional.**