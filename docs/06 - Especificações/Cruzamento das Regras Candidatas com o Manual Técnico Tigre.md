# H0 — Cruzamento das Regras Candidatas com o Manual Técnico Tigre

**Status:** Levantamento de apoio; não substitui a revisão profissional prevista no H0 §9

**Data:** 14/08/2026

**Documento relacionado:** [H0 — Base Técnica do Sistema Hidráulico](H0%20-%20Base%20Técnica%20do%20Sistema%20Hidráulico.md)

## 1. Objetivo

O H0 lista, na seção 6, dezessete regras candidatas (`HYD-*`) e registra que a maioria depende de "fonte técnica a confirmar". Este documento cruza cada regra com o que já está publicamente disponível no **Manual Técnico Tigre** (7ª edição, julho/2025, "Orientações Técnicas sobre Instalações Hidráulicas Prediais") e no **catálogo técnico de esgoto da Tigre**, ambos fontes de fabricante que traduzem a NBR 5626 e a NBR 8160 em parâmetros comerciais prontos para uso.

Isso não elimina a necessidade de revisão por profissional habilitado (H0 §9) — apenas reduz o trabalho dele: em vez de partir do zero, ele recebe cada regra já com um valor candidato extraído de fonte de fabricante, e confirma, ajusta ou substitui pela leitura direta da NBR quando achar necessário. Conforme a hierarquia de fontes do H0 §2, o manual do fabricante nunca substitui a norma — ele é um atalho a ser validado contra ela.

## 2. Água fria — cruzamento

| ID | Regra candidata | O que o manual Tigre já traz | Status proposto |
| --- | --- | --- | --- |
| HYD-AF-001 | Todo ponto de consumo deve ter caminho contínuo até a origem de água | Não é um parâmetro numérico — é uma verificação de integridade topológica da rede, equivalente à HYD-INT-003. Pode ser tratada como regra de software desde já. | Pronta para implementar como verificação lógica, sem depender de norma numérica. |
| HYD-AF-002 | Pressão e diâmetros devem respeitar parâmetros aprovados | O manual traz o método completo: pressão estática máxima 40 m.c.a. (400 kPa), sobrepressão de serviço limitada a 20 m.c.a. adicionais (total 60 m.c.a.), pressão mínima de serviço recomendada de 5 m.c.a., e dois métodos de dimensionamento de diâmetro por peso relativo de peça de utilização (consumo máximo possível e consumo máximo provável), com tabela de pesos por aparelho e ábaco de conversão peso→diâmetro comercial (20/25/32/40/50 mm soldável). | Parâmetro candidato disponível e citado como derivado da NBR 5626 — recomendo levar ao profissional já com a tabela de pesos e o ábaco para confirmação, em vez de pedir para reconstruir do zero. |
| HYD-AF-003 | Registros devem permanecer identificáveis e acessíveis | O manual não detalha critério de acessibilidade para água fria especificamente (o item aparece mais desenvolvido do lado de esgoto/ventilação). | Ainda pendente de fonte específica — manter como está no H0. |

Parâmetros de apoio já disponíveis no manual, úteis para o motor de regras mesmo sem estarem listados como `HYD-*` no H0:

- **Alturas de instalação por aparelho** (relativas ao piso acabado): chuveiro 220 cm, lavatório 60 cm, pia 110 cm, tanque 115 cm, vaso com caixa acoplada 20 cm, registro de gaveta 180 cm, registro de pressão 110 cm. Isso pode alimentar uma verificação de faixa razoável de altura ao posicionar um ponto — hoje o protótipo H1 usa uma faixa genérica de 5 cm a 2,60 m para qualquer ponto, sem diferenciar por tipo de aparelho.
- **Velocidade máxima de escoamento**: a norma recomenda limitar a 3 m/s para reduzir o risco de golpe de aríete — parâmetro relevante quando o dimensionamento de diâmetro entrar em cena (H3).
- **Consumo diário por tipo de edificação**: 150 L/pessoa/dia para residências, usado para dimensionar reservatório — relevante quando a caixa d'água deixar de ser genérica (hoje H1 já cria uma caixa d'água, mas sem dimensionamento).

## 3. Esgoto sanitário — cruzamento

| ID | Regra candidata | O que o catálogo Tigre já traz | Status proposto |
| --- | --- | --- | --- |
| HYD-ES-001 | Todo aparelho sanitário deve ter caminho contínuo até o destino de esgoto | Mesma natureza da HYD-AF-001: verificação de integridade topológica, não depende de norma numérica. | Pronta para implementar como verificação lógica. |
| HYD-ES-002 | Trechos por gravidade devem manter sentido e inclinação válidos | O catálogo cita apenas a declividade **máxima** do coletor predial (5%, conforme compilação de norma). A declividade **mínima** por diâmetro — valor mais crítico para evitar entupimento — não apareceu nas fontes de fabricante consultadas até agora; é o núcleo da NBR 8160 e não deve ser assumido de memória. | Pendente de leitura direta da NBR 8160 pelo profissional — não usar valor de memória aqui. |
| HYD-ES-003 | Águas pluviais não podem se conectar ao esgoto sanitário no perfil Joinville | Não é tema de fabricante — é regra do prestador local, já identificada no H0 §3.3 (Águas de Joinville). O catálogo Tigre reforça a separação técnica entre as duas redes (linhas e conexões distintas), mas não fala da regra regional específica. | Mantém como estava: fonte regional já localizada, falta formalizar a regra. |
| HYD-ES-004 | Efluente de pia/churrasqueira deve passar por caixa de gordura no perfil Joinville | A Tigre fornece a **Caixa de Gordura** dimensionada para 23 litros de retenção, declarada como superior ao mínimo exigido pela NBR 8160 para cozinha residencial — confirma que existe um piso técnico nacional, mas o piso do prestador Joinville pode ser diferente e precisa ser conferido separadamente (H0 §3.3). | Parâmetro nacional de referência disponível (23 L); regra regional ainda depende do guia da Águas de Joinville já citado no H0. |
| HYD-ES-005 | Caixa de gordura e pontos de inspeção devem permanecer acessíveis | A NBR 8160, segundo o catálogo, limita a profundidade de uma caixa de inspeção a **1 metro** para garantir acesso de limpeza, e exige caixa de inspeção a cada mudança de direção e, no máximo, **a cada 25 metros** de rede. | Parâmetro candidato disponível e diretamente citado como exigência normativa — bom candidato a "alerta técnico" já nesta fase. |
| HYD-ES-006 | A rede deve prever ventilação conforme o perfil aprovado | O catálogo descreve a ventilação como elemento obrigatório do sistema (protege o fecho hídrico dos desconectores) e exige que a extremidade da coluna de ventilação ultrapasse o telhado em, no mínimo, **30 cm**, ficando aberta à atmosfera. | Parâmetro candidato disponível (30 cm de saída acima do telhado) — ainda falta a regra completa de quando ventilação é obrigatória por tipo de aparelho/trecho. |
| HYD-ES-007 | Mudanças de direção, material ou diâmetro devem preservar inspeção | Reforçado indiretamente: conexões reforçadas são recomendadas em pés-de-coluna (onde há impacto de queda), e caixas de inspeção são exigidas nas mudanças de direção (mesma fonte da HYD-ES-005). | Parcialmente coberto pela mesma fonte da HYD-ES-005. |

Parâmetros de apoio adicionais, úteis mesmo sem estarem no catálogo `HYD-*` do H0:

- **Diâmetro mínimo por conjunto de aparelhos**: o catálogo relaciona diâmetro mínimo do ramal conforme o conjunto atendido (ex.: banheiro com 2 aparelhos sem banheira, cozinha do sifão até a caixa de gordura, lavanderia com tanque etc.), com valores comerciais entre 40 mm e 75 mm. Útil para validar automaticamente o diâmetro mínimo de um trecho assim que o roteamento (H2) souber que tipo de aparelho está em cada ponta.
- **Unidade Hunter de Contribuição (UHC)**: tabela de UHC por diâmetro de ramal de descarga e de ramal de esgoto, citada como "conforme NBR 8160" — é o mesmo tipo de tabela peso→diâmetro usada em água fria, mas para esgoto. Vale como base para o motor de regras da fase H4.
- **Profundidade mínima de vala** por tipo de carga sobre a tubulação enterrada (interior de lote, calçada, tráfego leve/pesado, ferrovia) — relevante quando a rede de esgoto sair do volume da casa e passar pelo terreno (integra com a entidade `Terreno` do DEC-59/60).

## 4. O que continua sem fonte de fabricante (não inventar valor)

Estes pontos do H0 §7 seguem sem parâmetro candidato depois deste levantamento, e não devem ser fixados a partir de suposição:

- inclinação mínima de esgoto por diâmetro (o núcleo mais sensível da NBR 8160);
- unidades de simultaneidade/pressão dinâmica mínima por aparelho específico além do genérico já citado;
- condições exatas de quando a ventilação é dispensável por perfil técnico;
- qualquer parâmetro específico do prestador Joinville além do que já está no H0 §3.3.

## 5. Recomendação de uso

1. Levar este documento junto com o H0 original ao profissional revisor — ele já entra sabendo quais regras têm parâmetro candidato de fabricante e quais dependem só da leitura direta da norma.
2. Não promover nenhuma regra de "rascunho"/"fonte confirmada" para "aprovada" só com base neste documento — o H0 §4 exige que a aprovação registre responsável, data e fontes consultadas, o que só o profissional pode assinar.
3. Priorizar a leitura direta da NBR 8160 no item de declividade mínima de esgoto (seção 3, HYD-ES-002) antes de qualquer outra pendência — é o parâmetro mais citado em qualquer dimensionamento de esgoto e nenhuma fonte de fabricante consultada até agora o declarou com segurança suficiente para uso no produto.

## 6. Fontes consultadas nesta sessão

- Tigre S.A. Manual Técnico — Orientações Técnicas sobre Instalações Hidráulicas Prediais, 7ª edição, julho/2025. <https://tigresite.s3.amazonaws.com/2025/08/manual_tigre_2025.pdf>
- Tigre S.A. Catálogo Técnico — Esgoto Série Normal e Reforçada, Caixas e Ralos, Caixas Múltiplas. <https://api.aecweb.com.br/cls/catalogos/tigre/catalogo_predial_esgoto_opt.pdf>