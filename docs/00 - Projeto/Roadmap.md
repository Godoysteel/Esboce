# Roadmap do Esboce

**Versão:** 1.1

**Status:** Canônico

**Atualização:** 28/08/2026

## Estado atual

O Esboce está em **estabilização pré-comercial**. O editor paramétrico, o viewport 3D, os quantitativos, a persistência online e o ciclo básico de conta já operam em produção. O objetivo imediato não é ampliar indiscriminadamente o escopo, mas consolidar confiabilidade, segurança operacional e clareza da proposta antes da divulgação pública.

Baseline verificada em 10/08/2026:

- produção em `https://esboce.com.br`;
- 135 testes automatizados;
- CI com testes, TypeScript e build antes do deploy;
- projetos versionados e validados no Supabase, com backup JSON;
- Termos, Privacidade e aceite jurídico versionado;
- e-mail transacional em domínio próprio, proteção antiabuso e monitoramento de erros.

## Entregue

### Editor e geometria

- cômodos e paredes paramétricos, snapping estrutural e proteção de topologia;
- portas, janelas e arcos vinculados a paredes, com afastamentos e proteção contra interseções;
- pavimentos comuns e configuração livre de ático/chalé por nível, com parede lateral baixa, lajes, fundações e coberturas compostas;
- portas e janelas recortadas também nas extensões perfiladas dos oitões do ático, respeitando a face inferior do telhado;
- materiais por superfície, móveis GLTF, colisão e arraste;
- quantitativos de alvenaria, fundação, estrutura, laje, verga, telhado e madeiramento;
- exportação de planilha/CSV e aviso de responsabilidade técnica.

### Produto online

- cadastro, login, confirmação de e-mail e recuperação de senha;
- salvar, atualizar, listar, abrir e compartilhar projetos;
- backup e restauração JSON;
- exclusão de conta e dados associados;
- documentos jurídicos públicos e aceite rastreável.

### Estúdio de Fachadas

- entrada dedicada com vista frontal sobre o mesmo modelo do projeto;
- início pela construção atual ou por um plano de fachada vazio de 10 m;
- pele de vidro já disponível no fluxo inicial;
- letreiro iluminado em letras-caixa com configuração e prévia dia/noite entregue;
- marquises, brises, ripados, vazados e vitrines planejados para entregas incrementais conforme ADR-010.

### Operação

- GitHub Pages no domínio oficial;
- prévias isoladas da Vercel para validação antes do merge;
- Resend via SMTP próprio para e-mails do Supabase;
- Cloudflare Turnstile nos fluxos sensíveis;
- Cloudflare Web Analytics com métricas agregadas de acesso, sem cookies de análise;
- Sentry com coleta mínima e sem telemetria invasiva;
- gates automáticos de qualidade e deploy.

## Próxima fase — piloto controlado

Critérios para iniciar um piloto com usuários convidados:

1. executar uma rodada completa de testes manuais desktop nos fluxos essenciais;
2. validar criação, edição, salvamento, reabertura, compartilhamento e backup com projetos reais;
3. revisar quantitativos em tipologias residenciais representativas;
4. revisar textos de suporte, mensagens de erro e canal de contato;
5. corrigir erros reais observados pelo Sentry durante o piloto;
6. definir rotina de backup e acompanhamento do Supabase;
7. concluir a revisão documental a cada mudança relevante.

## Antes da divulgação comercial

- criar e publicar canais comerciais e de suporte definitivos;
- revisar Termos e Privacidade com apoio jurídico quando a empresa estiver formalizada;
- ativar MFA nas contas administrativas e revisar acessos aos serviços;
- executar auditoria de segurança e dependências, incluindo atualização controlada do Vite;
- definir métricas de disponibilidade, suporte e resposta a incidentes;
- validar limites e custos de Supabase, Resend, Sentry, Vercel/GitHub Pages conforme o uso real;
- decidir política de planos, cobrança e atendimento;
- realizar revisão móvel dedicada antes de promover o uso em celular como experiência principal.

## Evoluções posteriores

- redesenho da navegação lateral em painéis por categoria (Ambientes, Paredes, Aberturas, Cobertura, Materiais, Mobiliário, Instalações, Mais), ícone + rótulo em vez da barra de ilhas atual — proposta validada em mockup visual em 2026-08-18, objetivo de tornar os comandos mais fáceis de encontrar. Qualquer botão de funcionalidade ainda não implementada nesse layout nasce travado/desabilitado, mesmo padrão já usado hoje nos rótulos "em breve" — nunca sugerir que algo funciona sem funcionar de fato;
- editor 2D sincronizado com o modelo paramétrico 3D, conforme ADR-009;
- sistema hidráulico paramétrico para água fria, esgoto sanitário e ventilação, com roteamento assistido, modo raio X, regras técnicas versionadas e quantitativos, conforme SPEC-002;
- edição de planta com grid técnico, câmera ortográfica, simbologia arquitetônica, cotas e pavimentos;
- módulo de análise ambiental e desempenho da edificação (sol, ventilação natural, temperatura, umidade e ação do vento sobre a edificação), sem dimensionamento estrutural em nenhuma fase, conforme SPEC-004;
- exportação vetorial de planta em PDF nas escalas iniciais 1:50 e 1:100;
- importação de PDF como referência local calibrável, posicionável, rotacionável, bloqueável e com transparência ajustável;
- composições de quantitativo próprias para bloco estrutural;
- empilhamento de cômodos entre pavimentos com laje de base automática, composição automática de encontros de cobertura e presets editáveis de telhado (incluindo escalonado) e varanda de contorno, conforme SPEC-005;
- fechamentos técnicos por superfície e catálogo comercial por fornecedor para Light Steel Frame, conforme SPEC-005 — mesclado a `main`, pendente de rodada de QA/validação manual;
- orçamento por loja e catálogo multi-loja conforme ADR-007;
- refinamento estrutural para telhas metálicas, fibrocimento e shingle;
- tratamento de junções de cobertura com três ou mais águas;
- histórico/redo completo e evolução do modelo de eventos;
- contextos de domínio separados para Wall, Room, Roof, Foundation, Catalog, Budget e Simulation;
- evolução para o Modelo Digital da Residência e motores inteligentes descritos na visão de longo prazo.

## Fora do escopo da versão comercial inicial

- substituir projeto arquitetônico ou estrutural assinado;
- dimensionar automaticamente estruturas de engenharia;
- prometer precisão executiva sem validação profissional;
- oferecer experiência móvel equivalente ao desktop antes da revisão dedicada;
- ativar funcionalidades de longo prazo apenas porque constam na visão estratégica.
