# H0 — Base Técnica do Sistema Hidráulico

**Status:** Levantamento inicial; requer validação profissional

**Data:** 12/08/2026

**Documento relacionado:** SPEC-002 — Sistema Hidráulico Paramétrico

**Exemplo de referência:** [H0 — Exemplo Residencial e Conectores Hidráulicos](H0%20-%20Exemplo%20Residencial%20e%20Conectores%20Hidráulicos.md)

**Contrato de dados:** [H0 — Contrato de Dados Hidráulicos](H0%20-%20Contrato%20de%20Dados%20Hidráulicos.md)

## 1. Objetivo

Definir como o Esboce reunirá, classificará e transformará conhecimento técnico em orientações verificáveis para instalações residenciais de água fria, esgoto sanitário e ventilação.

Este documento não transcreve normas técnicas nem define ainda valores executivos. Ele registra a estrutura de conhecimento, as fontes identificadas e as regras candidatas que deverão passar por validação antes de entrar no produto.

## 2. Hierarquia das fontes

Quando fontes tratarem do mesmo assunto, o Esboce deverá preservar a origem e aplicar a seguinte separação:

1. **legislação e regulação aplicável** — obrigações legais e limites de responsabilidade;
2. **normas técnicas vigentes** — requisitos nacionais de projeto e execução;
3. **prestador local** — padrão de ligação, ponto de coleta/entrega e exigências regionais;
4. **perfil técnico do projeto** — decisões e parâmetros aprovados pelo responsável;
5. **fabricante** — compatibilidade, instalação e limitações de determinada linha comercial;
6. **boa prática** — recomendação didática que não deve ser apresentada como obrigação.

Uma regra de fabricante nunca substituirá uma exigência normativa ou do prestador local. Uma orientação regional não será aplicada universalmente a projetos de outras cidades.

## 3. Fontes primárias identificadas

### 3.1 Normas técnicas

| Referência | Tema previsto | Uso no Esboce | Situação |
| --- | --- | --- | --- |
| ABNT NBR 5626 | Sistemas prediais de água fria e água quente | topologia, desempenho, reservação, distribuição, operação e manutenção | confirmar edição vigente e consultar texto integral licenciado |
| ABNT NBR 8160 | Sistemas prediais de esgoto sanitário | ramais, desconectores, ventilação, inspeção, declividade e dimensionamento | confirmar edição vigente e consultar texto integral licenciado |
| ABNT NBR 5688 | Tubos e conexões de PVC para esgoto, águas pluviais e ventilação | características e compatibilidade dos componentes | confirmar edição vigente e escopo aplicável |
| ABNT NBR 5648 | Tubos e conexões de PVC-U para água fria | características e compatibilidade dos componentes | confirmar edição vigente e escopo aplicável |

Os títulos acima servem somente como índice inicial. Nenhum valor numérico será codificado com base apenas em resumos, páginas comerciais ou memória técnica.

### 3.2 Regulação nacional

- **ANA — Norma de Referência nº 11/2024 (Resolução ANA nº 230/2024):** estabelece condições gerais para abastecimento de água e esgotamento sanitário. Confirma que instalações internas são responsabilidade do usuário, que normas da ABNT e do prestador devem ser observadas e que os pontos de entrega/coleta são indicados pelo prestador.
- **Manual orientativo da ANA para a NR 11:** material de apoio para interpretar a relação entre usuário, instalação predial e prestador.

### 3.3 Prestador do piloto — Joinville

- **Companhia Águas de Joinville — Manual do Construtor:** referência regional para viabilidade, aprovação e padrões de ligação de água e esgoto.
- **Companhia Águas de Joinville — Resolução Normativa nº 19/2019, compilada em 2024:** regras do serviço local; inclui responsabilidade do usuário sobre instalações internas e vedações relativas à rede de esgoto.
- **Companhia Águas de Joinville — guia de caixa de gordura:** orientação regional sobre finalidade, instalação e manutenção.
- **Companhia Águas de Joinville — serviço de ligação nova de esgoto:** descreve a espera com caixa de inspeção, o limite na testada do terreno e a responsabilidade pela ligação interna.

### 3.4 Fabricantes

- **Tigre — materiais e catálogos técnicos:** fontes para famílias comerciais de água fria, esgoto e conexões.
- **Amanco Wavin — bibliotecas técnicas/BIM:** fontes para características declaradas de linhas comerciais e componentes compatíveis.

Conteúdo de fabricante será uma biblioteca opcional. Antes de distribuir textos, imagens, modelos ou tabelas proprietárias, o projeto deverá verificar licença e autorização de uso.

## 4. Metadados obrigatórios de uma regra

Cada regra técnica deverá possuir:

```text
id
título
descrição para o usuário
rede e elementos afetados
condição verificável
severidade
fonte
edição ou data da fonte
jurisdição
perfil ao qual se aplica
parâmetros utilizados
estado de validação
responsável pela revisão
data da última revisão
```

Estados possíveis:

- **rascunho:** hipótese ainda não validada;
- **fonte confirmada:** origem localizada, mas regra ainda não revisada;
- **revisão técnica:** aguardando ou em análise por profissional habilitado;
- **aprovada:** pode orientar o usuário no perfil correspondente;
- **obsoleta:** preservada para rastreabilidade, mas não aplicada a novos projetos.

## 5. Severidades

### 5.1 Bloqueio de integridade

Reservado a estados que corrompem o modelo ou representam impossibilidade lógica evidente, independentemente de dimensionamento executivo.

Exemplos:

- ligar uma saída de esgoto a uma rede de água;
- criar trecho sem origem ou destino;
- usar uma conexão incompatível com o número de ramais;
- formar ciclo inválido no sentido de escoamento por gravidade;
- persistir geometria sem sua correspondente ligação lógica.

### 5.2 Alerta técnico

O usuário pode continuar, mas a situação fica visivelmente pendente de revisão.

Exemplos candidatos:

- inclinação insuficiente ou contrafluxo;
- ausência de ventilação prevista pelo perfil;
- diâmetro abaixo do parâmetro aprovado;
- falta de acesso para inspeção ou manutenção;
- conflito com parede, abertura, fundação ou estrutura;
- aparelho que deveria passar por desconector ou caixa específica.

### 5.3 Recomendação

Melhoria de percurso, manutenção, custo ou clareza.

Exemplos:

- reduzir mudanças de direção;
- aproximar ambientes molhados;
- preferir percurso acessível;
- agrupar registros de maneira compreensível;
- comparar alternativas com menor quantidade de conexões.

### 5.4 Informação

Explica uma consequência ou decisão sem classificar o estado como problema.

## 6. Catálogo inicial de regras candidatas

As regras abaixo são hipóteses de produto. Salvo as regras puramente lógicas, elas não devem ser ativadas em produção antes da consulta às fontes integrais e da revisão profissional.

| ID provisório | Regra candidata | Nível pretendido | Escopo | Estado |
| --- | --- | --- | --- | --- |
| HYD-INT-001 | Toda representação 3D deve corresponder a um trecho lógico conectado | bloqueio | universal | aprovada como integridade de software |
| HYD-INT-002 | Conectores de redes incompatíveis não podem ser unidos | bloqueio | universal | aprovada como integridade de software |
| HYD-INT-003 | Uma rede confirmada não pode conter trecho órfão | bloqueio | universal | aprovada como integridade de software |
| HYD-AF-001 | Todo ponto de consumo deve possuir caminho contínuo até a origem de água | alerta técnico | água fria | fonte técnica a confirmar |
| HYD-AF-002 | Pressão e diâmetros devem respeitar parâmetros aprovados para o projeto | alerta técnico | água fria | depende de dimensionamento e NBR 5626 |
| HYD-AF-003 | Registros devem permanecer identificáveis e acessíveis | alerta técnico | água fria | fonte técnica a confirmar |
| HYD-ES-001 | Todo aparelho sanitário deve possuir caminho contínuo até o destino de esgoto | alerta técnico | esgoto | fonte técnica a confirmar |
| HYD-ES-002 | Trechos por gravidade devem manter sentido e inclinação válidos | alerta técnico | esgoto | valores dependem da NBR 8160 e dimensionamento |
| HYD-ES-003 | Águas pluviais não podem ser conectadas à rede predial de esgoto sanitário no perfil Joinville | bloqueio regulatório | Joinville | fonte regional localizada; revisar implementação |
| HYD-ES-004 | Efluente de pia de cozinha/churrasqueira deve passar por caixa de gordura no perfil Joinville | alerta técnico | Joinville | fonte regional localizada; revisar condições |
| HYD-ES-005 | Caixa de gordura e pontos de inspeção devem permanecer acessíveis | alerta técnico | esgoto | fontes local e normativa a consolidar |
| HYD-ES-006 | A rede deve prever ventilação conforme o perfil técnico aprovado | alerta técnico | esgoto | depende da NBR 8160 |
| HYD-ES-007 | Mudanças relevantes de direção, material ou diâmetro devem preservar possibilidade de inspeção e manutenção | alerta técnico | esgoto | fonte e condições exatas a validar |
| HYD-LOC-001 | O ponto final da instalação interna deve corresponder ao ponto de coleta indicado pelo prestador | alerta técnico | regional | confirmado conceitualmente pela ANA; dado do projeto necessário |
| HYD-GEO-001 | Tubulação não deve atravessar abertura ou região marcada como proibida | bloqueio ou alerta configurável | geometria | regra de compatibilização do Esboce |
| HYD-GEO-002 | Toda passagem por elemento construtivo deve registrar o elemento atravessado | informação/alerta | geometria | regra de domínio do Esboce |

## 7. Parâmetros que não devem ser fixados ainda

Até a revisão das normas e o primeiro dimensionamento de referência, permanecerão configuráveis ou ausentes:

- diâmetros mínimos por aparelho e trecho;
- inclinações mínimas por diâmetro;
- unidades de contribuição e simultaneidade;
- pressão mínima e máxima nos pontos de utilização;
- volume de reservação;
- distâncias máximas entre inspeções;
- condições exatas de ventilação;
- dimensões e capacidade de caixas;
- limites de comprimento e quantidade de mudanças de direção;
- requisitos de passagem em elementos estruturais.

O produto não deverá inferir esses números a partir de um único catálogo comercial.

## 8. Dados regionais do projeto

Para aplicar regras locais, o projeto precisará registrar:

- país, estado e município;
- prestador de água e esgoto;
- existência de rede pública disponível;
- posição e cota do ponto de entrega de água;
- posição e cota do ponto de coleta de esgoto;
- solução alternativa quando não houver rede pública;
- perfil técnico e sua versão.

Sem esses dados, o Esboce exibirá orientações gerais e marcará verificações regionais como não avaliadas.

## 9. Revisão profissional necessária

Antes da implementação das fases H3 e H4, um profissional habilitado deverá revisar:

1. vocabulário e modelo lógico;
2. catálogo de aparelhos e conectores;
3. parâmetros de água fria;
4. regras de esgoto e ventilação;
5. severidade de cada verificação;
6. mensagens apresentadas ao usuário;
7. exemplo completo de uma residência térrea;
8. limites entre orientação, pré-dimensionamento e projeto executivo.

A revisão deverá produzir nome do responsável, registro profissional quando aplicável, data, fontes consultadas e versão do perfil aprovado.

## 10. Próximas entregas da H0

1. obter acesso legal aos textos integrais e confirmar as edições vigentes das normas;
2. escolher um profissional revisor;
3. submeter o exemplo residencial e o catálogo inicial de conectores à revisão profissional;
4. corrigir os conectores e diagramas conforme a revisão;
5. preparar um conjunto de regras em formato de dados, ainda sem conectar ao editor;
6. aprovar a fronteira do primeiro protótipo antes de iniciar a H1.

## 11. Referências públicas consultadas

- Agência Nacional de Águas e Saneamento Básico. Norma de Referência nº 11/2024 — Resolução ANA nº 230/2024. <https://www.gov.br/ana/pt-br/legislacao/resolucoes/resolucoes-regulatorias/2024/230>
- Agência Nacional de Águas e Saneamento Básico. Manual orientativo da NR 11. <https://www.gov.br/ana/pt-br/assuntos/saneamento-basico/Normativos-publicados-pela-ANA/manual-nr11-final.pdf>
- Companhia Águas de Joinville. Manual do Construtor. <https://www.aguasdejoinville.com.br/?publicacao=manual-do-construtor>
- Companhia Águas de Joinville. Guia prático — como dimensionar a caixa de gordura. <https://www.aguasdejoinville.com.br/wp-content/uploads/2022/03/GUIA_PRATICO_DIGITAL_-_COMO_DIMENSIONAR_A_CAIXA_DE_GORDURA_2022.pdf>
- Companhia Águas de Joinville. Resolução Normativa nº 19/2019, compilada em 2024. <https://www.aguasdejoinville.com.br/wp-content/uploads/2017/11/Resolucao_Normativa_n__19_2019__atualizada_compilada_2024_.pdf>
- Companhia Águas de Joinville. Ligação nova de esgoto. <https://www.aguasdejoinville.com.br/?servico=ligacao-nova-de-esgoto>
- Tigre. Catálogos técnicos. <https://www.tigre.com.br/catalogos-tecnicos/>
- Amanco Wavin. Biblioteca BIM de água fria. <https://bim.amanco.com.br/librerias-bim/agua-fria/>
- Amanco Wavin. Biblioteca BIM de esgoto. <https://bim.amanco.com.br/librerias-bim/esgoto/>

## 12. Conclusão

Existe base técnica suficiente para orientar a arquitetura do sistema e construir um protótipo seguro de modelagem. Ainda não existe base validada suficiente para o Esboce prometer dimensionamento ou conformidade automática. A próxima decisão correta é consolidar as normas integrais e submeter o primeiro perfil a revisão profissional antes de transformar parâmetros técnicos em regras de produção.
