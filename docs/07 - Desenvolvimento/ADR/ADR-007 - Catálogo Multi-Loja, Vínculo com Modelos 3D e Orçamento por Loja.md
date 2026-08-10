# ADR-007 — Catálogo Multi-Loja, Vínculo com Modelos 3D e Orçamento por Loja.md

**Status:** Aceita

**Data:** 10/08/2026

**Responsáveis:** Product Owner e Arquitetura de Software

**Tema:** Modelo de dados do catálogo de produtos (fabricante × loja × oferta), vínculo entre produto comercial e modelo 3D, e fluxo de finalização de projeto → quantitativo → orçamento por loja.

---

## 1. Contexto

O Esboce hoje tem dois catálogos de produto que não se comunicam:

- **Catálogo local** (`src/core/Catalog.ts`) — empacotado junto com o app, sem dependência de rede. Tem os modelos 3D (`.glb`) usados pra renderizar móveis/portas/janelas na viewport. Preço é só placeholder (`price: 0`), fabricante é fictício único ("Vórtice Materiais"), sem noção de loja.
- **Catálogo do Supabase** (`departments`/`manufacturers`/`products`, acessado via `SupabaseClient.ts`) — tem preço real, fabricante real, foto, e é o que a UI do painel "Catálogo" mostra hoje. Não tem modelo 3D. Tem só **um preço por produto** — nenhuma noção de múltiplas lojas vendendo o mesmo item.

Esta sessão discutiu como evoluir esse desenho pra suportar: (a) o mesmo produto sendo vendido por lojas diferentes, com preços diferentes, possivelmente restritas por cidade; (b) como isso se conecta com produtos que têm representação 3D na casa; e (c) como tudo isso desemboca no fluxo de orçamento que o usuário efetivamente recebe no final de um projeto.

A ADR-006 já havia previsto conceitualmente a necessidade de "comparar fornecedores" (seção 18-19) e a distinção entre quantitativo técnico e comercial (seção 9) — esta ADR formaliza o modelo de dados e o fluxo de produto por trás dessa previsão.

---

## 2. O que o Esboce NÃO é

**O Esboce não é um marketplace.** Não há carrinho, não há checkout, não há pagamento processado pela plataforma, não há reserva de estoque. O Esboce **especifica e conecta** — o usuário monta a especificação (projeto + produtos escolhidos + lojas escolhidas) e recebe um **orçamento** como artefato de saída. A negociação de verdade (entrega, forma de pagamento, prazo, condições) acontece diretamente entre o usuário e a loja, fora da plataforma.

Consequência direta: a plataforma não precisa (e não deve tentar) detectar automaticamente quando uma oferta fica desatualizada ou indisponível. É responsabilidade da própria loja manter seu catálogo — se ela para de vender um item, ela mesma remove a oferta.

---

## 3. Três entidades, não duas

O modelo de dados de catálogo deverá distinguir três conceitos, hoje misturados em um só (`CatalogProduct` com um `manufacturer_id` e um `preco` fixo):

- **Produto** — o item em si: nome, marca (fabricante), especificações técnicas, foto, departamento/categoria. Existe uma vez só, independente de quem vende.
- **Loja** — quem vende. Tem nome, cidade(s)/região de atuação, contato. É uma entidade nova, distinta de "Fabricante" (fabricante faz, loja vende — a mesma torneira Docol pode ser vendida por várias lojas).
- **Oferta** — o vínculo entre Produto e Loja: preço, SKU da loja, data de atualização do preço. Um Produto pode ter N Ofertas (uma por loja que o vende).

Essa separação segue a mesma linha já esboçada na ADR-006 (seção 20), que separa conceitualmente `catalog/` (produtos) de `pricing/` (preços e fornecedores) na arquitetura futura.

---

## 4. Escopo geográfico

A Loja declara em que cidade(s)/região atua. Uma Oferta só é considerada válida para um projeto se a Loja correspondente atende a cidade daquele projeto. O Produto em si não muda por cidade — só o conjunto de Ofertas disponíveis muda.

Ao montar orçamento para um projeto, o sistema filtra as Ofertas de cada Produto pela cidade do projeto **antes** de considerar qual é a mais barata.

---

## 5. Card do catálogo destaca a oferta mais barata

Para cada Produto, dentre as Ofertas válidas para a cidade do projeto em edição, o catálogo destaca a Loja de menor preço (`min(preço)`) diretamente no card da grade — nome da loja + preço em evidência. A lista completa de lojas com preço, cada uma clicável para escolha, fica no modal de detalhe do produto (não no card da grade, para não deixar os cards de altura variável conforme o número de lojas que vendem cada item).

---

## 6. A escolha de loja é por projeto e por item, não por conta

Quando o usuário clica numa loja específica que não é a mais barata (porque já compra sempre lá, por exemplo), essa escolha:

- Pertence à **lista de compra daquele projeto**, item por item — não é uma preferência global salva no perfil da pessoa.
- Precisa ser persistida junto com o projeto salvo no Supabase, junto do resto do estado do projeto — se não for salva, a pessoa perde a escolha ao reabrir o projeto.
- Por padrão, a oferta pré-selecionada é a mais barata disponível na cidade do projeto; a pessoa pode sobrescrever isso item por item.

---

## 7. Vínculo entre o catálogo do Supabase e o catálogo local (modelos 3D)

Os dois catálogos continuam sendo fontes de dados **separadas**, por design — não vão ser unificados num só. A ponte entre eles é o **id compartilhado**: um produto do catálogo do Supabase e sua contraparte no `Catalog.ts` local usam o mesmo `id`. Essa convenção já existe parcialmente hoje (usada pelo fluxo de "🔁 Trocar" de um móvel selecionado, em `EsboceApplication.handleSwapRequested`).

Motivo de manter os dois separados, em vez de fundir num catálogo só:

- **O que renderiza a casa** (modelo 3D) depende só do catálogo local — empacotado junto com o app, carrega instantâneo, sem depender de rede.
- **O que mostra preço/loja/foto** depende do Supabase — pode falhar, demorar, ou estar temporariamente indisponível, e nesse caso só isso degrada (sem foto, sem preço), sem travar o posicionamento de um produto já escolhido.
- Um produto já posicionado na casa não depende de rebuscar nada do Supabase pra continuar aparecendo — só depende do modelo local.

Fluxo: a pessoa escolhe um produto no painel do Supabase (com foto/preço/loja) → o app busca no `Catalog.ts` local pelo mesmo id → se existir, posiciona o modelo 3D correspondente na casa, já carregando a oferta (loja + preço) escolhida.

---

## 8. Regra de quando um produto tem modelo 3D

A regra é por **categoria/departamento**, não decidida produto a produto:

- **Acabamento** (portas, janelas, vaso sanitário, torneira, piso, revestimento, iluminação, móveis) — sempre tem par no catálogo local com modelo 3D.
- **Construtivo/estrutural** (cimento, areia, tijolo, ferro, brita, cal e afins) — nunca tem modelo 3D. Não é posicionado na casa; existe só como linha do quantitativo.

Consequência prática de cadastro: ao adicionar um produto novo ao catálogo do Supabase, quem cadastra já sabe se precisa também produzir um `.glb` e registrar a contraparte no `Catalog.ts`, só pelo departamento do produto.

---

## 9. Fluxo de finalização de projeto → quantitativo → orçamento

1. O usuário modela o projeto normalmente (paredes, cômodos, etc.), escolhendo em tempo real produtos de acabamento no catálogo (que já vêm com modelo 3D e, no momento da escolha, com loja e preço definidos).
2. Ao clicar em "Finalizar projeto" (ou equivalente), o app calcula o **quantitativo de materiais construtivos** a partir da geometria — o "quantitativo técnico → comercial" já descrito na ADR-006 (seção 9): não é "82 m² de parede", é "1.200 tijolos, 40 sacos de cimento, 3 m³ de areia" etc.
3. Nessa tela de quantitativo, os itens se dividem em dois grupos por origem:
   - **Itens de acabamento** posicionados na casa — já chegam com preço e loja preenchidos (escolhidos no momento da colocação).
   - **Itens construtivos/estruturais** (cimento, areia, tijolo, ferro, brita, cal) — chegam **sem preço**, pois não foram escolhidos individualmente pelo usuário; são derivados só da geometria.
4. Para cada item construtivo sem preço, o usuário clica nele → é direcionado ao catálogo → escolhe a loja (oferta) daquele produto → volta com o preço preenchido naquela linha. Repete até quantos itens quiser resolver.
5. Ao final, os itens (de acabamento + construtivos, todos já com loja definida) são agrupados por Loja, gerando **um orçamento por loja**, com subtotal próprio — esse é o artefato final entregue ao usuário (provavelmente PDF/envio).

---

## 10. Fora de escopo desta decisão (registrado como pendência)

- **Frete e consolidação de compra**: comparar só pelo preço unitário mais barato, item por item, ignora que comprar de muitas lojas diferentes pode custar mais em frete/logística do que consolidar numa loja só. Fica como refinamento futuro — o orçamento inicial pode precisar de um aviso explícito sobre essa limitação (consistente com o princípio de "premissas visíveis" da ADR-006, seção 12).
- **O que fazer se uma oferta escolhida deixa de existir** (loja removeu o produto, ou o usuário mudou a cidade do projeto depois de já ter escolhido lojas) — precisa de uma decisão de UX própria (reverter pra "mais barata disponível" automaticamente? avisar e pedir escolha de novo?).
- **Como o quantitativo técnico → comercial é calculado de fato** (o "Estimador Alvenaria" previsto na ADR-006, seção 4) — ainda não implementado; é pré-requisito pra a tela de finalização de projeto existir, mas é uma decisão técnica separada, própria.

---

## Decisão

**ACEITO**

O catálogo de produtos passará a distinguir três entidades — **Produto**, **Loja** e **Oferta** — em vez de um preço único por produto. Ofertas são filtradas pela cidade de atuação da Loja. O card do catálogo destaca a oferta mais barata disponível; a lista completa de lojas e a escolha individual ficam no detalhe do produto. A escolha de loja é registrada por item, dentro do projeto — não como preferência de conta.

O catálogo do Supabase (preço/loja/foto) e o catálogo local `Catalog.ts` (modelos 3D) permanecem fontes de dados **separadas**, ligadas por id compartilhado — por resiliência (o posicionamento de um produto na casa não deve depender de disponibilidade de rede). Produtos de departamentos de **acabamento** sempre têm par no catálogo local com modelo 3D; produtos **construtivos/estruturais** nunca têm.

O fluxo de finalização de projeto gera um quantitativo onde itens de acabamento já chegam precificados (escolhidos no momento da colocação) e itens construtivos chegam sem preço, resolvidos um a um pelo usuário via catálogo. O resultado final é agrupado por loja, gerando um orçamento por loja — artefato de saída da plataforma, sem carrinho, checkout ou pagamento: a negociação acontece diretamente entre usuário e loja, fora do Esboce.