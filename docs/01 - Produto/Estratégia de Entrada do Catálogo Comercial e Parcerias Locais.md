# Estratégia de Entrada do Catálogo Comercial e Parcerias Locais

**Projeto:** Esboce  
**Status:** Estratégia inicial proposta  
**Escopo:** Catálogo de produtos, distribuidores, lojas e fabricantes

## 1. Objetivo

Definir uma estratégia gradual para introduzir produtos e materiais de construção reais no Esboce sem tornar o lançamento da plataforma dependente de acordos comerciais com grandes fabricantes.

O princípio central é:

**O Esboce deve primeiro provar que consegue transformar projetos residenciais em demanda comercial qualificada. Depois, utilizar essa demanda para atrair distribuidores, varejistas e fabricantes.**

A ausência de contratos com grandes fabricantes não deve impedir a evolução do catálogo nem o funcionamento dos quantitativos e orçamentos.

---

## 2. Problema inicial

A visão de longo prazo do Esboce prevê um ecossistema no qual produtos reais de fabricantes possam participar do Modelo Digital da Residência, contendo informações técnicas, comerciais, geométricas e paramétricas.

Entretanto, durante os estágios iniciais da plataforma, existem obstáculos importantes:

- baixa capacidade de negociação com grandes fabricantes;
- ausência inicial de uma base significativa de usuários;
- inexistência de métricas comerciais que comprovem o potencial da plataforma;
- dificuldade para demonstrar retorno financeiro aos parceiros;
- alto custo operacional para estabelecer acordos individuais com grandes marcas.

Consequentemente, o catálogo inicial não pode depender da adesão direta dos fabricantes.

---

# 3. Estratégia de entrada em camadas

O ecossistema comercial deverá evoluir gradualmente.

```text
Componentes genéricos
        ↓
Parceiros locais
        ↓
Distribuidores e varejistas
        ↓
Rede regional
        ↓
Fabricantes
        ↓
Marketplace nacional
```

Cada estágio deve produzir dados e aprendizado suficientes para sustentar o seguinte.

---

# 4. Camada 1 — Componentes genéricos

O Esboce poderá inicialmente disponibilizar componentes técnicos sem associação comercial obrigatória a uma marca.

Exemplos:

- bloco cerâmico 14 × 19 × 29 cm;
- porcelanato 60 × 60 cm;
- argamassa para assentamento;
- tinta acrílica;
- telha de fibrocimento;
- janela de alumínio 120 × 100 cm;
- porta de madeira 80 × 210 cm;
- vaso sanitário genérico.

Esses componentes permitem que o sistema execute normalmente:

- modelagem;
- representação visual;
- quantitativos;
- cálculo de perdas;
- estimativas;
- compatibilização;
- simulações;
- orçamento preliminar.

O componente genérico representa **uma solução construtiva**, e não necessariamente um produto comercial.

Isso permite que o núcleo funcional do Esboce evolua independentemente do marketplace.

---

# 5. Camada 2 — Parceiros comerciais locais

A primeira estratégia comercial deverá priorizar:

- lojas de materiais de construção;
- depósitos;
- distribuidores;
- home centers regionais;
- fornecedores especializados.

Essas empresas possuem uma vantagem estratégica em relação aos fabricantes: comercializam simultaneamente produtos de diversas marcas.

Uma única parceria pode, portanto, introduzir dezenas ou centenas de produtos comerciais no ecossistema.

A proposta inicial não deverá ser baseada em cobrança pela presença no catálogo.

O parceiro deverá perceber o Esboce como um possível **canal de geração de demanda e solicitação de orçamento**.

---

# 6. Projeto-piloto

O primeiro piloto poderá ser realizado com uma distribuidora parceira em Joinville, utilizando um conjunto reduzido de produtos reais.

O objetivo não é construir imediatamente um marketplace completo.

O objetivo é validar o seguinte ciclo:

```text
Usuário projeta a residência
        ↓
Esboce calcula os quantitativos
        ↓
Usuário escolhe materiais/produtos
        ↓
Produtos disponíveis localmente são apresentados
        ↓
Esboce monta a lista de materiais
        ↓
Usuário solicita orçamento
        ↓
Distribuidor recebe uma demanda qualificada
```

O piloto poderá começar com aproximadamente **20 a 50 produtos**, distribuídos entre algumas categorias de alta utilização.

Exemplos:

- pisos;
- revestimentos;
- argamassas;
- tintas;
- blocos;
- telhas;
- louças;
- metais.

O parceiro poderá fornecer:

- nome comercial;
- SKU;
- fabricante;
- categoria;
- dimensões;
- unidade de venda;
- quantidade por embalagem;
- preço;
- disponibilidade;
- fotografia;
- ficha técnica, quando disponível;
- demais informações comerciais autorizadas.

---

# 7. Catálogo orientado à localização

Nos primeiros estágios, o Esboce não precisa oferecer disponibilidade nacional.

Produtos comerciais podem estar associados a regiões atendidas pelos fornecedores.

Exemplo:

```text
Produto técnico

Porcelanato 60 × 60
        ↓
Opções comerciais

Disponível em Joinville

Produto A
Fornecedor X
R$ XX,XX/m²

Produto B
Fornecedor Y
R$ XX,XX/m²
```

Dessa maneira, a plataforma pode crescer cidade por cidade ou região por região.

Isso evita a necessidade inicial de construir uma infraestrutura logística nacional.

---

# 8. Transformação do projeto em intenção de compra

O principal ativo comercial do Esboce não deverá ser simplesmente a exposição de produtos.

O diferencial está no contexto.

Em um marketplace convencional, o usuário pesquisa um produto.

No Esboce, o sistema conhece:

- a residência;
- os cômodos;
- as áreas;
- as paredes;
- as aberturas;
- os materiais especificados;
- as quantidades necessárias;
- as perdas estimadas;
- as etapas da construção.

Consequentemente, a plataforma pode transformar o projeto em uma demanda comercial estruturada.

Exemplo:

```text
BANHEIRO

Piso: 18,4 m²
Perda calculada: 10%

Produto selecionado:
Porcelanato 60 × 60

Quantidade comercial:
10 caixas

Complementos:

4 sacos de argamassa
3 kg de rejunte

[ Solicitar orçamento ]
```

O fornecedor recebe uma oportunidade comercial muito mais qualificada do que um simples acesso a uma página de produto.

---

# 9. Cadastro simplificado para parceiros

O SDK completo de componentes não deverá ser uma exigência para pequenos fornecedores.

A plataforma deverá futuramente possuir uma interface simplificada de cadastro.

Exemplo:

```text
CADASTRAR PRODUTO

Nome
Fabricante
Categoria
SKU

Dimensões

Unidade de venda
Quantidade por embalagem

Preço

Disponibilidade

Imagem

Ficha técnica

Textura ou modelo 3D
(opcional)
```

A plataforma poderá converter esses dados para sua representação interna.

Isso permite que pequenas empresas participem do ecossistema sem possuir equipe de desenvolvimento.

---

# 10. Níveis de origem e confiança

O catálogo deverá deixar explícita a origem das informações.

Sugestão de classificação:

### Componente genérico

Criado e mantido pelo Esboce.

Representa uma solução construtiva sem vínculo obrigatório com marca ou fornecedor.

### Produto de fornecedor

Cadastrado ou fornecido por loja, distribuidor ou parceiro comercial.

Representa um produto efetivamente comercializado pelo parceiro.

### Produto oficial/verificado

Informações fornecidas, validadas ou oficialmente mantidas pelo fabricante.

Pode receber identificação visual de verificação.

Essa distinção evita que informações fornecidas por terceiros sejam interpretadas como conteúdo oficial do fabricante.

---

# 11. Estratégia de aquisição de fabricantes

Grandes fabricantes não precisam constituir o primeiro estágio da estratégia.

A plataforma deverá primeiro gerar evidências de utilização.

Com o crescimento, o Esboce poderá produzir métricas como:

```text
Produtos da Marca X

12.480 projetos especificaram a marca

R$ 3,2 milhões
em materiais especificados

1.840
solicitações de orçamento

Principais regiões

São Paulo
Paraná
Santa Catarina

Produtos mais especificados

Produto A
Produto B
Produto C
```

Nesse momento, a proposta ao fabricante deixa de ser baseada em uma promessa.

Passa a ser baseada em demanda observável.

O fabricante poderá ter interesse em:

- assumir oficialmente seu catálogo;
- fornecer dados técnicos melhores;
- disponibilizar modelos paramétricos;
- fornecer texturas e modelos 3D;
- manter preços sugeridos;
- publicar lançamentos;
- fornecer documentação;
- patrocinar categorias;
- disponibilizar configuradores;
- integrar sistemas próprios.

---

# 12. Modelo econômico progressivo

Durante a fase de validação, parceiros iniciais podem participar gratuitamente.

O objetivo inicial é gerar utilização, aprender sobre o comportamento dos usuários e validar a conversão entre projeto e orçamento.

Posteriormente poderão existir modelos como:

- assinatura profissional para fornecedores;
- catálogo corporativo para fabricantes;
- produtos patrocinados;
- destaque contextual;
- leads comerciais qualificados;
- integração de estoque;
- integração de preços;
- integração com ERP;
- APIs comerciais;
- serviços de inteligência de mercado;
- comissionamento sobre transações, quando tecnicamente e juridicamente adequado.

Nenhum desses modelos precisa ser obrigatório durante a validação inicial.

---

# 13. Métricas do piloto

O piloto deverá medir pelo menos:

- projetos que visualizaram produtos comerciais;
- produtos adicionados aos projetos;
- valor estimado dos materiais especificados;
- listas de materiais geradas;
- solicitações de orçamento;
- solicitações respondidas;
- conversões em venda, quando possível;
- categorias mais utilizadas;
- produtos mais especificados;
- regiões de maior demanda.

Esses dados deverão orientar a expansão comercial.

---

# 14. Regra de independência

Uma regra estrutural deve ser preservada:

**O projeto de uma residência nunca pode depender da permanência de um fornecedor ou produto comercial no marketplace.**

Se um produto deixar de ser comercializado, o projeto histórico deverá continuar íntegro.

A representação técnica necessária para interpretar o componente utilizado deverá permanecer associada ao projeto ou a uma versão persistente compatível.

Isso também está alinhado ao princípio de versionamento previsto para os componentes inteligentes do Esboce.

---

# 15. Regra de neutralidade

O catálogo comercial não deve comprometer a confiabilidade técnica do Esboce.

Patrocínio, comissão ou relacionamento comercial não devem alterar silenciosamente:

- quantitativos;
- requisitos técnicos;
- compatibilidade;
- cálculos estruturais;
- desempenho;
- classificação técnica.

Resultados patrocinados devem ser identificáveis como comerciais.

A recomendação técnica e a publicidade precisam permanecer conceitualmente separadas.

---

# 16. Cuidados com propriedade intelectual e dados comerciais

Durante a fase inicial, o Esboce não deverá construir seu catálogo comercial copiando indiscriminadamente:

- fotografias;
- modelos 3D;
- texturas;
- descrições proprietárias;
- catálogos;
- fichas técnicas protegidas;
- preços;
- marcas e outros assets

de sites de fabricantes sem autorização adequada.

Componentes genéricos podem preencher a necessidade funcional enquanto os dados comerciais são obtidos diretamente de parceiros autorizados.

---

# 17. Papel estratégico dos distribuidores

Distribuidores podem exercer papel particularmente importante no início do ecossistema.

Um fabricante representa normalmente uma marca.

Um distribuidor pode representar dezenas ou centenas delas.

Portanto:

```text
1 fabricante
      ↓
parte limitada do catálogo

1 distribuidor
      ↓
diversas categorias
      ↓
diversas marcas
      ↓
centenas de SKUs
```

Isso torna distribuidores e varejistas regionais candidatos naturais para os primeiros pilotos.

---

# 18. Visão de longo prazo

A estratégia deve permitir uma evolução gradual:

```text
ESBOCE

Modelo Digital da Residência
        │
        ├── Componentes genéricos
        │
        ├── Catálogo técnico
        │
        ├── Produtos comerciais
        │
        ├── Distribuidores
        │
        ├── Lojas
        │
        ├── Fabricantes
        │
        └── Marketplace
                 ↓
          Orçamento real
                 ↓
              Compra
```

A vantagem competitiva pretendida não é possuir simplesmente um grande catálogo.

É conhecer **onde, quanto, por que e em qual contexto construtivo determinado produto será utilizado**.

---

# 19. Princípio estratégico

A entrada no mercado deverá seguir o princípio:

**Não esperar pelos grandes fabricantes para construir o ecossistema.**

Primeiro:

1. construir componentes genéricos;
2. validar quantitativos;
3. integrar pequenos parceiros;
4. gerar solicitações reais de orçamento;
5. medir demanda;
6. expandir regionalmente;
7. demonstrar valor comercial;
8. aproximar fabricantes;
9. transformar produtos populares em componentes oficiais e verificados.

Assim, os acordos com fabricantes tornam-se consequência do crescimento da plataforma, e não pré-requisito para seu nascimento.