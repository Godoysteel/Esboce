# SPEC-003 — Modo Visita e Edição em Escala Humana

**Status:** Conceito de produto

**Data:** 21/08/2026

**Escopo:** navegação em primeira/terceira pessoa dentro do projeto, com seleção e edição contextual das mesmas entidades usadas pelo 2D/3D

## 1. Visão geral

O Modo Visita será uma forma complementar de interação com o projeto.

Além das visualizações 2D e 3D tradicionais, o usuário poderá entrar na casa e percorrê-la como uma pessoa real.

A proposta não é transformar o Esboce em um jogo, mas utilizar uma navegação familiar para tornar decisões de projeto mais intuitivas.

A ideia central é: o usuário deixa de olhar a casa apenas de fora e passa a experimentar o espaço por dentro.

## 2. Modos de visualização

O Esboce poderá oferecer três formas principais de visualização: **2D | 3D | Visitar**.

- **2D** — usado para desenho, precisão, organização da planta e análise geral.
- **3D** — usado para observar volumes, fachada, cobertura, materiais e composição arquitetônica.
- **Visitar** — usado para experimentar os ambientes em escala humana e editar detalhes diretamente no local.

## 3. Navegação

No Modo Visita, o usuário poderá caminhar pela casa utilizando comandos simples e conhecidos.

No computador:

- WASD ou setas para caminhar;
- mouse para olhar;
- clique para interagir;
- roda do mouse ou comando equivalente para aproximação quando necessário.

Em dispositivos móveis, o controle poderá utilizar joysticks virtuais ou gestos.

A navegação deverá respeitar colisões básicas para evitar que o usuário atravesse paredes e outros elementos sólidos.

## 4. Terceira pessoa e primeira pessoa

O Modo Visita poderá oferecer duas perspectivas.

**Terceira pessoa** — um personagem representa o proprietário caminhando pela casa. Especialmente útil para perceber:

- largura de corredores;
- relação entre móveis e circulação;
- altura de elementos;
- sensação de escala;
- espaço livre ao redor dos objetos.

**Primeira pessoa** — o usuário vê a casa pelos olhos do personagem. Especialmente útil para edição de detalhes.

Exemplo: o usuário entra no banheiro, olha para uma parede e decide exatamente onde quer posicionar uma tomada, torneira ou acessório.

A troca entre os modos deverá ser simples: **Pessoa | Meus olhos**.

## 5. Edição contextual

O principal diferencial do Modo Visita será permitir que a própria casa determine quais opções aparecem.

O usuário não precisa procurar uma ferramenta em um menu complexo. Ele simplesmente olha ou seleciona aquilo que deseja modificar.

| Objeto selecionado | Ações disponíveis |
|---|---|
| Parede | Pintar · Revestir · Tomada · Interruptor · Medir |
| Porta | Trocar · Mover · Dimensões · Inverter abertura |
| Janela | Trocar · Mover · Altura · Dimensões |
| Móvel | Mover · Girar · Trocar · Copiar · Remover |
| Piso | Trocar material · Ver área |
| Teto | Luminária · Forro · Acabamento |
| Elementos hidráulicos | Mover ponto · Alterar equipamento · Ver instalação |

A interface deverá apresentar apenas as ações relevantes ao objeto selecionado.

## 6. Instalações elétricas

O Modo Visita pode tornar a instalação elétrica especialmente intuitiva.

O usuário poderá caminhar pelo ambiente, olhar para a parede e escolher **Adicionar tomada**. Depois aponta para a posição desejada e confirma.

O mesmo princípio pode ser aplicado a:

- interruptores;
- tomadas de uso geral;
- tomadas específicas;
- pontos de TV;
- pontos de internet;
- luminárias;
- pontos para ar-condicionado.

O Esboce registra essas informações no modelo do projeto.

## 7. Instalações hidráulicas

O mesmo conceito poderá ser aplicado à hidráulica.

Exemplo: o usuário entra na cozinha, seleciona a pia e decide mover a torneira ou o ponto hidráulico. O Esboce atualiza a posição do ponto e poderá recalcular o percurso da tubulação procedural.

Fluxo: usuário move o ponto → modelo é atualizado → rede hidráulica é recalculada → quantitativos são atualizados.

Assim, uma alteração visual dentro da casa pode repercutir automaticamente no planejamento técnico.

## 8. Mobiliário e interiores

O usuário poderá experimentar o interior como se estivesse organizando a própria residência. Por exemplo:

- mover sofá;
- girar cama;
- trocar mesa;
- alterar posição da TV;
- substituir armário;
- testar outro modelo de móvel;
- alterar materiais e revestimentos;
- verificar circulação.

Isso permite responder perguntas muito naturais:

- "Esse sofá ficou grande demais?"
- "Consigo passar entre a cama e o guarda-roupa?"
- "Essa TV está alta?"
- "A tomada ficou atrás do móvel?"

## 9. Escala humana como ferramenta de projeto

O personagem não deverá ser apenas decorativo. Ele servirá como referência de escala.

Ao observar uma pessoa dentro do ambiente, o usuário entende melhor:

- pé-direito;
- altura de janelas;
- largura de portas;
- tamanho de móveis;
- profundidade dos ambientes;
- proporção dos espaços.

Isso é particularmente importante para usuários que têm dificuldade de interpretar medidas apenas pela planta.

## 10. Integração com o modelo paramétrico

O Modo Visita não deve criar uma segunda versão do projeto. Toda alteração deverá continuar utilizando as mesmas entidades do Esboce.

Exemplo: mover uma janela no Modo Visita continua significando alterar a entidade `Opening`. Mover um móvel continua alterando `Furniture`. Mover um ponto hidráulico continua alterando o sistema hidráulico existente.

Dessa forma, 2D, 3D e Visita trabalham sobre o mesmo `Project`.

## 11. Integração com quantitativos

Alterações feitas durante a visita poderão refletir automaticamente nos quantitativos.

Exemplo: o usuário troca um piso. O Esboce já conhece:

- área do ambiente;
- produto selecionado;
- quantidade necessária;
- perda considerada;
- quantidade comercial.

Outro exemplo: o usuário troca uma janela de 1,20 m por uma de 2,00 m. O Esboce poderá recalcular:

- área de alvenaria;
- acabamento;
- esquadria;
- custo relacionado.

Assim, o Modo Visita não será apenas uma experiência visual. Ele poderá participar diretamente do planejamento da obra.

## 12. Princípio de UX

O Modo Visita deve obedecer à filosofia central do Esboce: **a complexidade pertence ao sistema, não ao usuário**.

Em vez de apresentar dezenas de ferramentas técnicas, o contexto determina as opções.

O usuário pensa: "Quero colocar uma tomada aqui."

O Esboce pensa: qual parede foi selecionada, qual pavimento, qual altura, qual circuito, qual entidade deve ser criada e como isso deve aparecer no projeto.

## 13. Implementação por fases

**Fase 1 — Caminhar.** Primeira pessoa simples: caminhar, olhar, colisão com paredes, entrar e sair do modo visita. Nenhuma edição avançada ainda.

**Fase 2 — Selecionar objetos.** Adicionar raycasting para reconhecer aquilo para o qual o usuário está olhando (parede, porta, janela, móvel). Mostrar identificação simples do objeto.

**Fase 3 — Edição contextual.** Permitir mover móveis, girar, trocar materiais, modificar portas e janelas.

**Fase 4 — Instalações.** Adicionar interação com tomadas, interruptores, luminárias, pontos hidráulicos, equipamentos.

**Fase 5 — Personagem.** Adicionar avatar em terceira pessoa. O usuário poderá alternar entre **Pessoa | Primeira pessoa**.

**Fase 6 — Inteligência contextual.** O Esboce poderá começar a detectar situações e ajudar o usuário. Exemplo: "Esta tomada ficará atrás do armário.", "A passagem entre esses móveis está estreita.", "Essa porta pode colidir com o móvel." Essas funções deverão ser apresentadas como assistência, não como substituição de análise profissional.

## 14. O que deve ser evitado

O Modo Visita não deve:

- transformar o Esboce em jogo;
- criar menus complexos adicionais;
- exigir controles difíceis;
- duplicar o modelo do projeto;
- permitir alterações fora das regras do domínio;
- substituir ferramentas de precisão quando o 2D for mais adequado.

Ele é uma forma complementar de trabalhar.

## 15. Objetivo final

O usuário deverá conseguir entrar na casa e pensar: "Agora consigo imaginar como será morar aqui." E, ao identificar algo que não gostou: "Quero mudar isso." — e fazer a alteração diretamente naquele contexto.

**Princípio final:** no Esboce, projetar uma casa não deve significar apenas desenhá-la. Deve significar poder entrar nela, experimentar os espaços e ajustá-los antes de construir.
