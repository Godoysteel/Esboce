# SPEC-001 — Editor Paramétrico v19

**Status:** Implementada e em validação visual

**Data:** 04/08/2026

**Escopo:** editor local da v19

## 1. Objetivo

Registrar o comportamento aprovado e as invariantes observáveis do editor paramétrico residencial v19.

## 2. Paredes e cômodos

- Cômodos são gerados a partir de contornos fechados de paredes.
- Paredes conectadas devem acompanhar o redimensionamento sem duplicação ou frestas.
- Junções internas não devem exibir linhas de contorno como se fossem quinas externas.
- Contornos visíveis devem ser finos e discretos, sem faixa superior escura, linhas inferiores ou diagonais de triangulação.
- O arraste estrutural usa passos de 500 mm.
- Durante o redimensionamento perpendicular, uma cota tracejada deve mostrar em tempo real a distância até a parede oposta, nos dois lados adjacentes quando existirem.
- Cotas atrás da construção devem ser ocultadas pela geometria e reaparecer quando a câmera tornar a referência visível.

## 3. Portas e janelas

- Toda abertura pertence a uma parede e acompanha essa parede enquanto a operação for válida.
- Uma parede transversal deve manter ao menos **50 mm** de uma porta ou janela.
- Duas aberturas na mesma parede devem manter ao menos **150 mm** entre suas extremidades.
- Operações que atravessem ou expulsem uma abertura da parede devem ser bloqueadas sem alterar o estado confirmado.
- A geometria da parede ao redor de aberturas não deve revelar linhas verticais de triangulação.

## 4. Materiais e superfícies

- A barra de materiais fica à direita, abaixo do gizmo da casa.
- Categorias: Paredes, Pisos, Teto/forro, Telhado e Áreas externas.
- Em Paredes, somente a face clicada é alterada, incluindo faces de oitão.
- Em Pisos, o fluxo é: selecionar categoria → selecionar cômodo → escolher material → ajustar escala e rotação → aplicar.
- A textura de reboco é a aparência padrão de paredes e oitões.
- O terreno pode usar textura de grama; o grid visual pode ser ocultado sem alterar o snapping estrutural.

## 5. Fundação

- Novos projetos usam **baldrame** por padrão.
- O baldrame é gerado sob as paredes e permanece visualmente identificável.
- Deve existir separação vertical suficiente entre fundação e piso para evitar z-fighting.
- O usuário pode trocar posteriormente entre baldrame e radier.
- A camada Fundação controla a visibilidade da geometria sem alterar o tipo escolhido.

## 6. Oitão

- O oitão é tratado como parede derivada da cobertura, não como água de telhado.
- Usa acabamento de parede e integra a área de alvenaria/revestimento.
- Sua base cobre a espessura externa da parede, sem fresta no encontro.
- Seu topo fica sob as águas, sem atravessar o telhado.
- A junção horizontal entre parede e oitão não deve ser enfatizada por contorno.

## 7. Coberturas compostas

- Duas coberturas podem ser posicionadas e ajustadas de forma independente.
- A sobreposição durante o arraste é apenas prévia e não recorta definitivamente nenhuma água.
- O usuário confirma a relação pela ação **Engastar**.
- Após o engaste, coberturas transversais formam um conjunto movido em grupo.
- Ambas as coberturas são recortadas ao longo da interseção real dos planos, formando a água-furtada completa.
- Beirais e partes embutidas não devem permanecer sobrepostos na geometria final.
- A metragem de telhado e os materiais consideram a área líquida após os recortes.

## 8. Quantitativos

Comprimentos, áreas e estimativas de materiais são derivados do modelo confirmado. O painel deve incluir paredes, pisos, telhado líquido, aberturas e fundação. Valores de orçamento são estimativas de referência, não cotação comercial nem cálculo estrutural executivo.

## 9. Critérios de verificação

1. Executar todos os testes existentes sem inventar uma contagem esperada.
2. Concluir `npm run build` sem erro.
3. Validar visualmente: cômodos unidos, portas e janelas junto a cantos, oitão sob telhado, baldrame, materiais por face, grid oculto e dois telhados engastados em T.
4. Confirmar que mover coberturas antes do engaste não produz recorte persistente.

## 10. Fora do escopo desta versão

- Edição estrutural fina em passos de 100 mm.
- Cálculo estrutural executivo.
- Fusão booleana persistida de malhas como fonte da verdade.
- Paginação completa de revestimentos e catálogo comercial definitivo.

## 11. Esquadrias paramétricas de madeira

- A aba **Madeira** do seletor de Aberturas oferece três portas e três janelas: porta frisada, porta pivotante, porta lisa, janela maxim-ar, janela de correr quadriculada e janela veneziana.
- Cada item usa a fotografia de referência fornecida pelo Product Owner como miniatura do catálogo.
- A representação 3D é procedural e acompanha largura e altura do vão. Ela preserva os elementos visuais identificadores de cada referência — frisos, painéis, puxadores, travessas, vidro ou palhetas — sem depender de um arquivo GLB por dimensão.
- As dimensões explicitadas nos nomes de arquivo de origem foram preservadas. Nos casos sem medida declarada, foram adotadas dimensões iniciais usuais apenas para modelagem: porta frisada 0,80 x 2,10 m, maxim-ar 0,60 x 0,60 m, janela de correr 1,50 x 1,20 m e veneziana 1,20 x 1,20 m. O usuário pode ajustar o vão posteriormente.
- Os itens não afirmam fabricante, SKU comercial ou preço das imagens de referência; custo zero no catálogo interno significa **sob consulta**.
