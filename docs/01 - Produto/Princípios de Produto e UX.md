Princípios de Produto e UX
Construtor de Casas Online — versão consolidada v1.0
Nota de consolidação
Este documento substitui, de forma consolidada, dois documentos anteriores que tratavam do mesmo conteúdo com sobreposição quase total: “Manifesto de Experiência do Usuário” e “User Experience Philosophy (UXP)”. Ambos foram descontinuados como documentos ativos; seu conteúdo foi fundido na Parte 1 abaixo, sem repetições.
A Parte 2 incorpora, na íntegra, o documento “Product Principles (PP)”, que permanece com seu valor diferenciado: um checklist de aprovação objetivo e acionável.
“As Leis do Construtor de Casas Online” continua existindo como documento separado, funcionando como o resumo de uma página desta filosofia — não como uma terceira fonte independente.

Parte 1 — Filosofia
Fusão de “Manifesto de Experiência do Usuário” e “User Experience Philosophy (UXP)”
Missão
Democratizar o projeto residencial, permitindo que qualquer pessoa, independentemente de sua formação técnica, consiga transformar ideias em uma residência digital completa.
Visão
O Construtor de Casas Online não deve se comportar como um software CAD tradicional. Ele deve proporcionar uma experiência natural, intuitiva e agradável, permitindo que qualquer pessoa consiga criar sua casa sem treinamento.
No futuro, desenhar uma casa será tão simples quanto desenhar em uma folha de papel. O usuário não precisará aprender comandos, ferramentas ou conceitos técnicos — ele apenas expressará suas intenções. O sistema cuidará do restante.
Filosofia central
As pessoas não sonham com paredes. Sonham com uma casa. Não imaginam polígonos, vértices ou segmentos — imaginam quartos, cozinhas, salas.
O objetivo não é ensinar o usuário a utilizar um software. O objetivo é permitir que ele pense apenas em sua casa. Toda a complexidade pertence ao sistema. Nunca ao usuário. O sistema deve adaptar-se ao usuário — nunca o contrário.
Princípios fundamentais
Os dez princípios abaixo consolidam o conteúdo dos dois documentos originais, eliminando as repetições entre eles.
    • O usuário nunca aprende o software — ele constrói uma casa. Durante toda a utilização existe apenas uma atividade: construir. O usuário nunca está editando entidades, manipulando geometrias ou configurando parâmetros técnicos; essas responsabilidades pertencem ao sistema.
    • O sistema faz o trabalho difícil. O usuário expressa intenções; o sistema interpreta e executa: unir paredes automaticamente, detectar cômodos, criar pisos, gerar lajes, reconstruir geometria, recalcular quantitativos, atualizar o modelo 3D.
    • A complexidade mora inteiramente no sistema, nunca na interface. O motor paramétrico pode ser extremamente sofisticado internamente — entidades, interseções, topologia, motores de cálculo — mas nada disso deve ser percebido pelo usuário.
    • A interface é mínima. Cada botão precisa justificar sua existência; cada ferramenta adicionada aumenta a carga cognitiva. Sempre que possível, uma ferramenta inteligente substitui várias ferramentas específicas.
    • Tudo acontece em tempo real. Nenhuma operação importante deve exigir um botão de “atualizar”. Cada alteração produz resposta imediata — o sistema deve transmitir a sensação de que a casa está viva.
    • O usuário pensa em ambientes, não em elementos técnicos. A interface deve utilizar conceitos familiares ao proprietário da residência, e não ao engenheiro de software.
    • Experimentar nunca gera medo. Toda decisão deve poder ser alterada posteriormente. A plataforma deve incentivar a experimentação — errar deve ser simples, modificar deve ser natural.
    • A simplicidade é requisito técnico, não estética. Sempre que houver duas soluções possíveis, adota-se aquela que reduz a carga cognitiva do usuário — mesmo que sua implementação seja significativamente mais complexa.
    • O fluxo criativo nunca é interrompido. Diálogos desnecessários, configurações excessivas, confirmações repetitivas e etapas intermediárias interrompem o pensamento criativo e devem ser evitados.
    • A tecnologia deve desaparecer. Quanto mais avançado o sistema internamente, mais simples deve parecer externamente. A sofisticação é percebida pelos resultados, nunca pela dificuldade de utilização.
A criança como referência
Existe um princípio permanente para avaliação da experiência do usuário: se uma criança consegue compreender como construir uma casa utilizando a plataforma, um adulto conseguirá desenvolver projetos muito mais complexos. A simplicidade não reduz a capacidade do sistema — ela amplia seu alcance.
Critérios de avaliação
Antes de aprovar qualquer nova funcionalidade, a filosofia exige respostas positivas às seguintes perguntas:
    • Uma pessoa que nunca utilizou o sistema entenderia isso sem explicações?
    • Existe uma maneira mais simples de realizar essa tarefa?
    • O sistema pode executar automaticamente parte desse trabalho?
    • Essa funcionalidade aproxima ou afasta o usuário de seu objetivo — construir a casa?
    • Uma criança conseguiria descobrir como utilizá-la apenas explorando a interface?
Se qualquer resposta indicar aumento desnecessário de complexidade, a solução deve ser revista. (Estas perguntas se somam, sem duplicar, ao Checklist de Aprovação formal da Parte 2.)
Objetivo final
O maior elogio que o Construtor de Casas Online pode receber não é:
“Esse software é extremamente poderoso.”
O maior elogio será:
“Foi tão fácil que eu nem percebi que estava usando um software.”
Quando esse objetivo for alcançado, a tecnologia terá desaparecido, restando apenas a experiência de criar uma casa.
Consulte “As Leis do Construtor de Casas Online” para a versão-resumo de uma página desta filosofia.


Parte 2 — Princípios de Desenvolvimento do Produto
Incorporação integral do documento “Product Principles (PP)” — mantido na íntegra por conter o checklist de aprovação acionável, que é a ferramenta de trabalho diferenciada desta camada.
Introdução
Este documento estabelece os princípios que orientam todas as decisões de desenvolvimento do Construtor de Casas Online. Ele complementa a filosofia apresentada na Parte 1, transformando seus valores em regras objetivas de projeto. Sempre que houver dúvida sobre uma implementação, estes princípios deverão orientar a decisão.
Princípio 1 — O usuário nunca aprende comandos
O usuário aprende apenas a construir uma casa. Ferramentas que exigem treinamento excessivo devem ser redesenhadas.
Princípio 2 — A interface deve ser descoberta
O usuário deve descobrir naturalmente como utilizar cada recurso. Interfaces que dependem de documentação para operações básicas representam falhas de design.
Princípio 3 — Menos ferramentas. Mais inteligência.
Cada ferramenta adicionada aumenta a complexidade da interface. Sempre que possível, uma única ferramenta inteligente deve substituir diversas ferramentas específicas.
Princípio 4 — Nunca pedir aquilo que o sistema pode deduzir
Se o sistema consegue determinar automaticamente uma informação com alta confiabilidade, ele deve fazê-lo. Exemplos: regenerar o modelo, reconstruir geometria, recalcular relações, sincronizar elementos, atualizar vistas.
Princípio 5 — Nenhuma operação técnica pertence ao usuário
O usuário nunca deve executar tarefas como união de paredes, fechamento de ambientes, criação de pisos, geração de lajes, reconstrução da geometria ou atualização do modelo tridimensional. Esses processos pertencem exclusivamente ao sistema.
Princípio 6 — Um clique é melhor que dois
Sempre que uma ação puder ser realizada com menos interações, essa solução deverá ser adotada. O número de cliques deve diminuir ao longo da evolução do produto. Nunca aumentar.
Princípio 7 — O desenho acontece em tempo real
Toda alteração deve produzir uma resposta visual imediata. A sensação deve ser de manipular um objeto físico.
Princípio 8 — O usuário nunca espera
Operações demoradas devem ocorrer em segundo plano sempre que possível. A interface deve permanecer responsiva.
Princípio 9 — O sistema protege o usuário
A plataforma deve impedir inconsistências antes que elas aconteçam. Sempre que possível, erros devem ser evitados automaticamente. Não apenas informados.
Princípio 10 — Todo erro deve ser reversível
O usuário deve experimentar sem receio. Toda ação deve poder ser desfeita.
Princípio 11 — O contexto permanece
Ao executar qualquer ação, o usuário nunca deve perder a percepção do projeto. Mudanças bruscas de tela ou contexto devem ser evitadas.
Princípio 12 — A interface fala a linguagem das pessoas
O sistema utiliza palavras familiares ao proprietário de uma residência (Quarto, Sala, Cozinha, Janela, Porta, Cobertura). Evitam-se termos técnicos desnecessários.
Princípio 13 — A tecnologia é invisível
Motores internos, modelos paramétricos, algoritmos, topologia e reconstrução devem permanecer invisíveis. O usuário apenas percebe os resultados.
Princípio 14 — Toda funcionalidade deve economizar tempo
Nenhum recurso será incorporado apenas porque é tecnicamente interessante. Cada funcionalidade deve reduzir esforço.
Princípio 15 — A simplicidade tem prioridade
Quando existir conflito entre maior quantidade de recursos e maior simplicidade, a simplicidade prevalece.
Princípio 16 — O software deve antecipar intenções
Sempre que possível, o sistema deve compreender o objetivo do usuário. A plataforma auxilia; não espera comandos explícitos.
Princípio 17 — O primeiro minuto define o produto
Nos primeiros sessenta segundos o usuário deve sentir que consegue construir. Esse momento é mais importante do que qualquer funcionalidade avançada.
Princípio 18 — O primeiro projeto deve ser memorável
O primeiro contato deve gerar entusiasmo. O usuário precisa terminar sua primeira casa com facilidade. A experiência inicial determina a percepção de todo o produto.
Princípio 19 — A criança é o teste definitivo
Antes da aprovação de uma funcionalidade deve-se perguntar: “Uma criança conseguiria descobrir como isso funciona apenas explorando a interface?” Se a resposta for negativa, a solução deve ser simplificada.
Princípio 20 — A criatividade nunca pode ser interrompida
O usuário deve permanecer concentrado em imaginar sua residência. Toda interrupção deve ser cuidadosamente justificada.
Checklist de aprovação
Antes que qualquer funcionalidade seja incorporada ao produto, todas as perguntas abaixo devem ser respondidas positivamente:
    • O usuário entenderá essa funcionalidade sem treinamento?
    • O sistema executa automaticamente tudo o que for possível?
    • Existe uma solução ainda mais simples?
    • O usuário permanece focado na casa?
    • O fluxo criativo permanece contínuo?
    • A funcionalidade reduz esforço?
    • A interface continua limpa?
    • A operação acontece imediatamente?
    • O usuário pode desfazer qualquer ação?
    • Uma criança conseguiria descobrir como utilizar esse recurso?
Se qualquer resposta for negativa, a funcionalidade deverá retornar para revisão.
Compromisso
O Construtor de Casas Online não será avaliado pela quantidade de funcionalidades. Será avaliado pela facilidade com que qualquer pessoa consegue transformar uma ideia em uma residência digital completa.
A verdadeira inovação não está em adicionar recursos. Está em eliminar complexidade. Esse compromisso deve orientar todas as decisões de desenvolvimento, independentemente do crescimento da plataforma ou da evolução de sua tecnologia.