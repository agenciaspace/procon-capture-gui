# Como contribuir

Obrigado pelo interesse em contribuir com o ProconCapture!

## Reportando bugs

Abra uma [issue](https://github.com/leonhatori/procon-capture-gui/issues) com:
- O que você estava fazendo
- O que aconteceu
- O que você esperava que acontecesse
- Seu sistema operacional e versão do app

## Desenvolvimento local

**Pré-requisitos:** Node.js 20+, npm, Git

```bash
git clone https://github.com/leonhatori/procon-capture-gui.git
cd procon-capture-gui
npm install
npm run dev
```

A janela do Procon SP abrirá automaticamente. Faça login para testar a captura.

## Convenção de commits

| Prefixo | Quando usar |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção de bug |
| `chore:` | infraestrutura (deps, config, CI) |
| `docs:` | apenas documentação |
| `refactor:` | refactoring sem mudança de comportamento |

Exemplo: `fix: corrigir detecção de token em sessão expirada`

## Enviando um Pull Request

1. Faça fork do repositório
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Faça suas alterações e commit seguindo a convenção acima
4. Abra um PR descrevendo o que mudou e por quê

## Como fazer um release (somente mantenedores)

```bash
# 1. Atualize "version" no package.json
# 2. Commit e push na main
# 3. Crie a tag:
git tag v1.x.x
git push --tags
# GitHub Actions builda e publica automaticamente no GitHub Releases
```
