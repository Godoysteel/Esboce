# Esboce

> Sonhe, esboce, construa.

O Esboce é uma plataforma para projeto, gestão e inteligência aplicada ao ciclo de vida completo de uma residência.

O projeto vai além de um construtor de plantas ou modelador 3D. Seu objetivo é criar um Modelo Digital da Residência capaz de acompanhar a construção desde a concepção até a operação, manutenção e evolução do imóvel.

---

# Estrutura do Repositório

```
Esboce/

├── docs/          Engenharia Oficial do Produto
├── atlas/         Projeto Atlas (Auditoria da Engenharia)
├── src/           Código-fonte
├── tests/         Testes
├── assets/        Diagramas, imagens e recursos
└── README.md
```

---

# Documentação

Toda a documentação oficial do produto está localizada em:

```
docs/
```

A documentação é considerada a fonte oficial da verdade do projeto.

Nenhuma implementação deve contradizer a documentação aprovada.

---

# Projeto Atlas

O Projeto Atlas é responsável pela auditoria, consolidação e evolução da engenharia do Esboce.

Toda a documentação relacionada à auditoria encontra-se em:

```
atlas/
```

O Atlas não documenta funcionalidades.

Ele documenta a qualidade da engenharia.

---

# Princípios

- Engenharia antes da implementação.
- Uma única fonte da verdade.
- Conhecimento rastreável.
- Arquitetura orientada ao domínio.
- Evolução contínua.
- Simplicidade para o usuário.
- Complexidade controlada internamente.

---

# Estado Atual

Projeto em estabilização pré-comercial, com versão pública de testes em [esboce.com.br](https://esboce.com.br).

O editor, a persistência autenticada, os documentos jurídicos, os e-mails transacionais, a proteção antiabuso, o monitoramento e o deploy com gates automáticos estão operacionais. A baseline atual possui 122 testes automatizados.

Consulte o [Roadmap](docs/00%20-%20Projeto/Roadmap.md) para o estado das fases e o [Changelog](CHANGELOG.md) para as entregas recentes.

Toda mudança relevante deve manter código, testes e documentação coerentes antes de chegar ao `main`.

---

© Projeto Esboce
