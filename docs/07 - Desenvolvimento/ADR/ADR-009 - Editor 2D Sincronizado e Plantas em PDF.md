# ADR-009 — Editor 2D Sincronizado e Plantas em PDF

**Status:** Aceita para implementação incremental

**Data:** 11/08/2026

**Responsáveis:** Product Owner e Arquitetura de Software

**Tema:** Vista de planta 2D sincronizada com o modelo paramétrico 3D, importação de PDF como referência calibrável e exportação de planta em PDF.

---

## 1. Contexto

O Esboce possui um modelo paramétrico único e uma projeção 3D derivada. A vista 3D é adequada para compreensão volumétrica, materiais e apresentação, mas não substitui a linguagem de planta baixa usada para desenhar, conferir alinhamentos, trabalhar com cotas ou aproveitar um levantamento existente.

O botão `2D` já comunica ao usuário a expectativa de uma vista técnica. A evolução proposta é transformar esse modo em um editor de planta completo, com fundo branco, grid e simbologia arquitetônica, mantendo todas as alterações sincronizadas com o 3D. Também é necessário permitir que uma planta em PDF seja usada como referência de traçado e que o projeto seja exportado em PDF para compartilhamento.

## 2. Um único modelo, duas projeções

O 2D e o 3D **não são documentos independentes**. `Project`, mantido pelo `Store`, continua sendo a única fonte da verdade. As duas vistas apenas projetam e editam o mesmo estado:

```text
                 Project / Store
                       │
           ┌───────────┴───────────┐
           │                       │
    Scene2DRenderer         Scene3DRenderer
           │                       │
 Viewport2DController     ViewportController
           └───────────┬───────────┘
                       │
                Store.commands
```

Uma parede criada, movida ou redimensionada no 2D deve aparecer no 3D após a confirmação do mesmo comando. Alterações realizadas no 3D devem aparecer no 2D sem conversão ou cópia de entidades. Nenhuma malha, linha ou símbolo de uma das vistas se torna estado canônico.

## 3. Separação de renderização e interação

A vista 2D terá componentes próprios:

- `Scene2DRenderer`: projeção gráfica de pavimentos, paredes, aberturas, pilares, lajes, telhados, terreno, muros, cotas e referências;
- `Viewport2DController`: seleção, desenho, arraste, snap, zoom, pan e ferramentas específicas do plano;
- `Store.commands`: comandos compartilhados com o 3D para alterar o projeto;
- câmera ortográfica dedicada, sem simular 2D por meio de uma câmera 3D inclinada;
- representação arquitetônica própria, como paredes em linhas duplas e arco de abertura de portas.

Essa separação evita acoplar simbologia técnica à geometria Three.js usada na apresentação 3D e permite otimizar cada viewport de forma independente.

## 4. Experiência de navegação

O botão `2D` troca o conteúdo da área central do editor, preservando as barras e ferramentas aplicáveis. O primeiro escopo não abre uma segunda janela ou guia do navegador. Isso mantém uma única sessão de interação e impede duas janelas concorrentes de editarem o mesmo estado.

A vista 2D deve oferecer:

- fundo branco e grid técnico configurável;
- zoom e deslocamento sem alterar as coordenadas do projeto;
- seleção do pavimento atual;
- indicação de escala e unidade;
- visibilidade controlável de cotas, nomes, áreas e referência PDF;
- símbolos próprios para portas, janelas, arcos, pilares e escadas;
- destaque consistente com a seleção da vista 3D.

## 5. Edição simultânea

As ferramentas de criar, selecionar, mover e redimensionar devem reutilizar comandos de domínio existentes sempre que possível. A vista 2D pode ter prévias gráficas específicas, mas só confirma uma alteração válida no `Store` ao final do gesto, seguindo a arquitetura incremental já adotada pelos arrastes 3D.

Não existe obrigação de renderizar 2D e 3D ao mesmo tempo quando apenas uma vista está visível. “Simultâneo” significa consistência imediata do modelo: ao alternar a vista, o resultado confirmado já está presente. Uma futura tela dividida poderá observar o mesmo estado sem mudar este contrato.

## 6. Importação de PDF como referência

No primeiro escopo, o PDF importado é uma **camada visual de referência**, não uma fonte automática de paredes ou ambientes. O fluxo será:

1. selecionar um arquivo PDF local;
2. escolher a página quando houver mais de uma;
3. renderizar a página como base visual na vista 2D;
4. marcar dois pontos cuja distância real seja conhecida;
5. informar essa distância para calibrar a escala;
6. ajustar posição, rotação, transparência e visibilidade;
7. bloquear a camada para desenhar por cima sem movê-la acidentalmente.

O arquivo deve ser validado por tipo e tamanho antes do processamento. A importação acontece localmente por padrão; o PDF não deve ser enviado a serviços externos silenciosamente. Caso a referência passe a ser salva junto ao projeto, isso exigirá decisão posterior sobre armazenamento, limites, privacidade, ciclo de exclusão e migração de schema.

## 7. Exportação em PDF

A exportação deve gerar uma planta vetorial sempre que possível, com opções de:

- pavimento;
- escala, inicialmente 1:50 e 1:100;
- tamanho e orientação da folha;
- paredes, aberturas, pilares, terreno e muros;
- cotas, nomes e áreas de ambientes;
- identificação do projeto, data e legenda;
- aviso de que o documento é um estudo preliminar e não substitui projeto técnico assinado.

A escala impressa só é válida quando o PDF é impresso em 100% do tamanho da página. O arquivo deve indicar escala numérica e uma escala gráfica para reduzir erros de impressão.

## 8. Persistência

A vista 2D não exige novos campos no modelo: ela deriva das entidades atuais. Preferências puramente visuais podem permanecer locais enquanto não precisarem acompanhar o projeto entre dispositivos.

Uma referência PDF persistente, quando aprovada, deverá ser representada por metadados explícitos, por exemplo: página, transformação, escala calibrada, opacidade e identificador do arquivo armazenado. Dados binários não devem ser embutidos diretamente no JSON do projeto.

## 9. Implementação incremental

### Fase 1 — visualização 2D sincronizada

- câmera ortográfica, fundo branco e grid;
- projeção de paredes, portas, janelas, pilares, lajes, terreno e muros;
- alternância 2D/3D sobre o mesmo `Store`;
- seleção de pavimento, zoom e pan;
- testes de equivalência entre entidades e símbolos 2D.

### Fase 2 — edição 2D

- criação, seleção, arraste e redimensionamento;
- snap e prévias incrementais;
- cotas, nomes e áreas;
- paridade dos comandos essenciais com o editor 3D.

### Fase 3 — exportação em PDF

- composição vetorial da folha;
- escalas 1:50 e 1:100;
- cabeçalho, legenda, cotas e aviso técnico;
- validação visual e dimensional do arquivo gerado.

### Fase 4 — importação e calibração de PDF

- escolha da página;
- camada de referência local;
- calibração por dois pontos;
- posição, rotação, opacidade, visibilidade e bloqueio;
- desenho sobre a referência.

## 10. Fora do escopo inicial

- reconhecimento automático de paredes, portas ou ambientes no PDF;
- conversão automática de desenho raster em entidades editáveis;
- formatos CAD como DWG ou DXF;
- edição simultânea em duas janelas independentes;
- pranchas técnicas executivas completas;
- assinatura ou responsabilidade técnica;
- substituição de projeto arquitetônico aprovado por profissional habilitado.

## 11. Riscos e controles

- **Divergência entre 2D e 3D:** evitada mantendo um único modelo e comandos compartilhados.
- **Regressão no editor atual:** implementação por fases e componentes isolados, sem substituir inicialmente o `ViewportController` 3D.
- **PDF fora de escala:** calibração obrigatória e indicação visual da escala.
- **Desempenho:** renderização sob demanda da vista visível e prévias incrementais durante gestos.
- **Privacidade:** processamento local por padrão e nenhuma transmissão externa não informada.
- **Expectativa de documento técnico:** aviso explícito na interface e no PDF exportado.

## 12. Critérios de aceitação da primeira fase

- alternar entre 2D e 3D sem perder seleção ou geometria confirmada;
- representar corretamente um projeto existente em todos os pavimentos;
- refletir no 2D uma alteração feita no 3D e vice-versa por meio do mesmo `Store`;
- manter zoom e pan fluidos em um projeto representativo;
- não alterar o schema persistido apenas para viabilizar a visualização;
- manter todos os testes, typecheck e build aprovados.

---

## Decisão

**ACEITO PARA IMPLEMENTAÇÃO INCREMENTAL**

O Esboce adotará um editor 2D técnico como projeção do mesmo modelo paramétrico usado pelo 3D. A implementação será separada em renderizador e controlador próprios, reutilizando `Store.commands`. A importação de PDF começará como referência visual local e calibrável, sem reconhecimento automático. A exportação priorizará planta vetorial com escala, informações básicas e aviso de responsabilidade técnica.
