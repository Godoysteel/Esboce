# H0 — Contrato de Dados Hidráulicos

**Status:** Rascunho estrutural; não conectado ao editor

**Data:** 12/08/2026

**Artefato:** [hydraulic-h0-profile.example.json](dados/hydraulic-h0-profile.example.json)

## 1. Finalidade

O arquivo de exemplo transforma parte da concepção hidráulica em dados legíveis por máquina. Ele serve para revisar nomes, relações, fontes e estados antes da criação de tipos TypeScript, migrações de persistência ou geometria 3D.

O arquivo não é uma configuração de produção. Nenhuma regra nele é executada pelo Esboce.

## 2. Decisões incorporadas

- perfil técnico identificado e versionável;
- município e prestador separados das regras universais;
- equipamentos organizados em famílias;
- conectores pertencentes aos equipamentos;
- rede aceita declarada em cada conector;
- parâmetros técnicos desconhecidos representados por `null`, nunca por valores presumidos;
- regras com fonte, escopo, severidade e estado de validação;
- invariantes de software separadas de regras técnicas;
- aprovação profissional registrada no próprio perfil.

## 3. Limites desta versão

O contrato ainda não representa:

- instâncias posicionadas no projeto;
- nós e trechos de uma rede construída;
- caminhos tridimensionais;
- hospedagem em paredes ou pisos;
- produtos de fabricantes;
- fórmulas de dimensionamento;
- histórico de migrações;
- mensagens localizadas da interface.

Esses elementos só deverão ser adicionados depois que o catálogo de conectores for revisado.

## 4. Critérios para evoluir o contrato

1. O JSON deve continuar válido e legível sem executar o aplicativo.
2. Todo identificador deve ser estável e independente do texto exibido.
3. Valores técnicos devem carregar fonte e versão.
4. Regra regional deve declarar jurisdição ou perfil.
5. Regra não revisada não pode receber estado de aprovada.
6. Ausência de conhecimento deve ser explícita (`null` ou estado pendente), nunca preenchida por suposição.
7. O futuro schema persistido do projeto deverá ser diferente do perfil técnico, embora possa referenciá-lo por ID e versão.

## 5. Próximo passo

Após revisão técnica, será criado um JSON Schema para validar automaticamente o formato. Somente depois disso o projeto poderá discutir tipos de domínio e persistência da fase H1.
