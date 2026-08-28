# ADR-010 — Estúdio de Fachadas sobre o Modelo Único

**Status:** Aceita — implementação incremental
**Data:** 28/08/2026
**Tema:** criação de fachadas residenciais e comerciais com edição simples e apresentação realista

## Contexto

O editor 3D já representa paredes, aberturas, pele de vidro, materiais e coberturas, mas esses recursos estão distribuídos por categorias gerais. Para criar a frente de uma casa, loja ou empresa, o usuário precisa de um espaço orientado à composição da fachada, com vista frontal, elementos próprios e passagem rápida para uma apresentação realista.

## Decisão

O Esboce terá um **Estúdio de Fachadas** como modo de trabalho do projeto atual. Ele não cria um documento paralelo: `Project`, mantido pelo `Store`, continua sendo a única fonte da verdade. Fachada, planta 2D e cena 3D são projeções e formas de edição do mesmo modelo.

O acesso oferecerá dois caminhos:

1. **Usar a construção atual:** enquadra frontalmente uma parede principal do pavimento e permite compor sobre a geometria existente.
2. **Começar com fachada vazia:** cria um plano inicial isolado de 10 m dentro do projeto e abre o mesmo ambiente de composição.

## Experiência pretendida

O modo dedicado deverá reunir, por etapas:

- vitrines, portas comerciais e pele de vidro;
- letreiros, logotipos e letras-caixa com iluminação frontal, interna ou efeito halo;
- marquises, brises horizontais e verticais;
- ripados, cobogós e painéis vazados paramétricos;
- revestimentos externos e paginação de materiais;
- arandelas, spots, fitas de LED, jardineiras e elementos externos;
- comparação diurna/noturna e exportação de imagem de apresentação.

Elementos aplicados a uma parede devem continuar vinculados à entidade de domínio correspondente, aparecer no 3D geral e participar de persistência, seleção e quantitativos quando aplicável.

## Primeira entrega

A primeira entrega estabelece:

- entrada `Fach.` no painel de visualização;
- escolha entre construção existente e fachada vazia;
- enquadramento frontal automático da maior parede ou do plano recém-criado;
- barra contextual do Estúdio;
- acesso funcional à pele de vidro já existente;
- indicação explícita dos grupos que serão implementados nas próximas fases.

## Realismo

O realismo será construído sobre geometria paramétrica, espessuras reais, materiais PBR, vidro com reflexão, sombras e materiais emissivos. A vista frontal de edição não substitui a câmera de apresentação: ela facilita a composição, enquanto o 3D continua sendo a validação espacial e visual.

## Consequências

- Não haverá sincronização entre dois modelos de fachada.
- O caminho “fachada vazia” adiciona geometria ao pavimento atual sem apagar a construção existente.
- Novas famílias serão entregues incrementalmente e só aparecerão como ativas quando tiverem domínio, renderização, persistência e testes mínimos.
- A futura exportação deverá deixar claro que a imagem é uma simulação visual e não substitui projeto técnico ou aprovação profissional.

## Segunda entrega — letreiro em letras-caixa

O primeiro elemento próprio do Estúdio é o letreiro iluminado vinculado a uma parede. A entidade `FacadeSign` é persistida no pavimento e contém texto, dimensões, elevação, posição, acabamento da face, cor da luz e uma das três soluções visuais: iluminação frontal, interna ou efeito halo.

A edição acontece na barra contextual do Estúdio e atualiza o mesmo objeto. A prévia noturna aumenta a emissão luminosa para facilitar a avaliação, sem alterar os dados construtivos nem criar uma cópia do projeto.
