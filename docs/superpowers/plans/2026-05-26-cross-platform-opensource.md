# ProconCapture Cross-Platform & Open Source Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar o ProconCapture como app nativo instalável para Windows, Linux e macOS, e publicar como projeto open source no GitHub com CI/CD automático que gera instaladores a cada release.

**Architecture:** Adicionar `electron-builder` para packaging (dmg/exe/AppImage/deb/rpm), GitHub Actions com matrix de 3 OSes acionado por git tags, corrigir 7 usos de `homedir()+"Desktop/Downloads"` no main.ts para `app.getPath()`, e criar arquivos open source padrão.

**Tech Stack:** electron-builder, concurrently, wait-on, GitHub Actions

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `.gitignore` | Criar | Excluir out/, dist/, node_modules/ |
| `LICENSE` | Criar | MIT, Copyright 2026 Leon Hatori |
| `assets/icon.png` | Criar | Ícone 1024×1024 (placeholder azul) |
| `README.md` | Criar | Badges, download links, uso, dev local |
| `CONTRIBUTING.md` | Criar | Guia para contribuidores |
| `.github/workflows/release.yml` | Criar | Build + publish em 3 OSes ao fazer git tag |
| `package.json` | Modificar | Scripts novos + config electron-builder |
| `electron/main.ts` | Modificar | 6 trocas homedir()→app.getPath() |

---

## Task 1: Criar .gitignore

**Files:**
- Criar: `.gitignore`

- [ ] Escrever o arquivo:

```
node_modules/
out/
dist/
*.js.map
procon-*.json
.DS_Store
Thumbs.db
```

- [ ] Verificar:
```bash
cat .gitignore
```

- [ ] Commit:
```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

## Task 2: Criar LICENSE

**Files:**
- Criar: `LICENSE`

- [ ] Escrever o arquivo `LICENSE`:

```
MIT License

Copyright (c) 2026 Leon Hatori

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] Commit:
```bash
git add LICENSE
git commit -m "chore: add MIT license"
```

---

## Task 3: Instalar devDependencies

**Files:**
- Modificar: `package.json` (via npm install)

- [ ] Instalar:
```bash
npm install --save-dev electron-builder concurrently wait-on
```

- [ ] Verificar que as 3 dependências foram adicionadas:
```bash
grep -E '"electron-builder"|"concurrently"|"wait-on"' package.json
```
Esperado (versões podem variar):
```
"concurrently": "^9.x.x",
"electron-builder": "^25.x.x",
"wait-on": "^8.x.x",
```

- [ ] Commit:
```bash
git add package.json package-lock.json
git commit -m "chore: add electron-builder, concurrently, wait-on"
```

---

## Task 4: Atualizar package.json — scripts e config electron-builder

**Files:**
- Modificar: `package.json`

- [ ] Substituir a seção `"scripts"` completa por:

```json
"scripts": {
  "build":      "tsc",
  "start":      "npm run build && electron .",
  "dev":        "concurrently -k \"tsc --watch\" \"wait-on out/electron/main.js && electron . --dev\"",
  "dist":       "npm run build && electron-builder",
  "dist:mac":   "npm run build && electron-builder --mac",
  "dist:win":   "npm run build && electron-builder --win",
  "dist:linux": "npm run build && electron-builder --linux",
  "dist:ci":    "npm run build && electron-builder --publish always"
},
```

- [ ] Adicionar a seção `"build"` e `"repository"` no `package.json` (após `"devDependencies"`):

```json
"repository": {
  "type": "git",
  "url": "https://github.com/SEUNOME/procon-capture-gui"
},
"build": {
  "appId": "br.gov.sp.procon.capture",
  "productName": "ProconCapture",
  "directories": { "output": "dist" },
  "files": [
    "out/**/*",
    "renderer/**/*",
    "package.json"
  ],
  "icon": "assets/icon.png",
  "mac": {
    "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
    "category": "public.app-category.productivity"
  },
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }]
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "category": "Office"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

⚠️ Substitua `SEUNOME` pelo seu usuário do GitHub.  
⚠️ As versões de `electron-builder`, `concurrently` e `wait-on` no JSON final devem ser as instaladas no Task 3 — não sobrescreva com placeholders.

- [ ] Verificar que o TypeScript ainda compila:
```bash
npm run build
```
Esperado: sai com código 0, sem erros TypeScript, `out/electron/main.js` atualizado.

- [ ] Commit:
```bash
git add package.json
git commit -m "chore: configure electron-builder and update npm scripts"
```

---

## Task 5: Corrigir paths cross-platform em electron/main.ts

**Files:**
- Modificar: `electron/main.ts`

`app` já está importado na linha 10. O problema: `homedir()+"Desktop"` não existe em todas as distros Linux (ex: Ubuntu Server, WSL). `app.getPath("desktop")` retorna o caminho correto em cada OS.

São **6 substituições** (manter apenas `DATA_FILE` com `homedir()` para não quebrar dados salvos de usuários existentes).

- [ ] Substituição 1 — `DIAG_FILE` (linha 15):

Antes:
```typescript
const DIAG_FILE = join(homedir(), "Desktop", "procon-diagnostico.json");
```
Depois:
```typescript
const DIAG_FILE = join(app.getPath("desktop"), "procon-diagnostico.json");
```

- [ ] Substituição 2 — debug em `extractProcessListFromDom` (linha 785):

Antes:
```typescript
          join(homedir(), "Desktop", "procon-response-debug.json"),
```
Depois:
```typescript
          join(app.getPath("desktop"), "procon-response-debug.json"),
```

- [ ] Substituição 3 — debug em `captureProcessDetail` (linha 902):

Antes:
```typescript
          join(homedir(), "Desktop", "procon-detail-debug.json"),
```
Depois:
```typescript
          join(app.getPath("desktop"), "procon-detail-debug.json"),
```

- [ ] Substituição 4 — handler `export:save` (linha 1073):

Antes:
```typescript
    defaultPath: join(homedir(), "Downloads",
      `procon-${new Date().toISOString().slice(0,10)}.${format}`),
```
Depois:
```typescript
    defaultPath: join(app.getPath("downloads"),
      `procon-${new Date().toISOString().slice(0,10)}.${format}`),
```

- [ ] Substituição 5 — handler `document:download` (linha 1095):

Antes:
```typescript
  const { filePath } = await dialog.showSaveDialog({ defaultPath: join(homedir(), "Downloads", nome) });
```
Depois:
```typescript
  const { filePath } = await dialog.showSaveDialog({ defaultPath: join(app.getPath("downloads"), nome) });
```

- [ ] Substituição 6 — handler `log:save` (linha 1119):

Antes:
```typescript
  const filePath = join(homedir(), "Desktop", `procon-log-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`);
```
Depois:
```typescript
  const filePath = join(app.getPath("desktop"), `procon-log-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`);
```

- [ ] Verificar que `homedir` ainda é necessária (usada em `DATA_FILE` na linha 16):
```bash
grep "homedir()" electron/main.ts
```
Esperado: apenas 1 ocorrência restante — `const DATA_FILE = join(homedir(), ".procon-capture-data.json");`

- [ ] Verificar que não há ocorrências remanescentes de `homedir()` + Desktop/Downloads:
```bash
grep -n 'homedir().*Desktop\|homedir().*Downloads' electron/main.ts
```
Esperado: nenhuma saída.

- [ ] Verificar que o TypeScript compila:
```bash
npm run build
```
Esperado: sai com código 0, sem erros.

- [ ] Commit:
```bash
git add electron/main.ts
git commit -m "fix: replace homedir()+Desktop/Downloads with app.getPath() for cross-platform compatibility"
```

---

## Task 6: Criar ícone placeholder

**Files:**
- Criar: `assets/icon.png`
- Criar: `scripts/create-icon.js` (helper temporário, não commitado)

electron-builder usa `assets/icon.png` como fonte e converte para o formato de cada plataforma: ICNS no macOS (via `sips`, ferramenta nativa), ICO no Windows (via conversor interno), PNG direto no Linux.

- [ ] Criar o script gerador `scripts/create-icon.js`:

```javascript
// scripts/create-icon.js
// Gera assets/icon.png — 1024×1024 azul sólido (#2f81f7) sem dependências externas.
// Uso: node scripts/create-icon.js
const { writeFileSync, mkdirSync } = require('fs');
const { deflateSync } = require('zlib');

const W = 1024, H = 1024;
const R = 0x2f, G = 0x81, B = 0xf7; // #2f81f7

// Scanlines: 1 byte de filtro (0=Nenhum) + pixels RGB por linha
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const i = y * (1 + W * 3) + 1 + x * 3;
    raw[i] = R; raw[i + 1] = G; raw[i + 2] = B;
  }
}
const idat = deflateSync(raw);

function u32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  let v = 0xffffffff;
  for (const byte of buf) v = (t[(v ^ byte) & 0xff] ^ (v >>> 8)) >>> 0;
  return (v ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  return Buffer.concat([u32be(data.length), td, u32be(crc32(td))]);
}

// IHDR: width=1024, height=1024, bit depth=8, color type=2 (RGB)
const ihdr = Buffer.from([0x00,0x00,0x04,0x00, 0x00,0x00,0x04,0x00, 8, 2, 0, 0, 0]);

const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), // assinatura PNG
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', png);
console.log('✅ assets/icon.png criado (1024×1024 #2f81f7)');
```

- [ ] Executar o script:
```bash
node scripts/create-icon.js
```
Esperado:
```
✅ assets/icon.png criado (1024×1024 #2f81f7)
```

- [ ] Verificar que o arquivo é um PNG válido:
```bash
file assets/icon.png
```
Esperado: `assets/icon.png: PNG image data, 1024 x 1024, 8-bit/color RGB, non-interlaced`

- [ ] Commitar apenas o ícone (o script é helper de build, não código-fonte):
```bash
git add assets/icon.png
git commit -m "chore: add placeholder app icon (1024x1024 #2f81f7)"
```

> **Nota:** Substitua `assets/icon.png` por um ícone com branding real antes do lançamento público. O PNG deve ser exatamente 1024×1024 px.

---

## Task 7: Criar README.md

**Files:**
- Criar: `README.md`

- [ ] Escrever `README.md` (substituir `SEUNOME` pelo seu usuário GitHub):

```markdown
# ProconCapture

[![Release](https://img.shields.io/github/v/release/SEUNOME/procon-capture-gui?style=flat-square)](https://github.com/SEUNOME/procon-capture-gui/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/SEUNOME/procon-capture-gui/release.yml?style=flat-square&label=build)](https://github.com/SEUNOME/procon-capture-gui/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

GUI desktop para capturar e exportar automaticamente seus processos do [Procon SP Digital](https://consumidor2.procon.sp.gov.br) — sem copiar e colar, sem telas de impressão.

---

## Download

| Plataforma | Formato | Link |
|---|---|---|
| macOS (Apple Silicon + Intel) | `.dmg` | [Releases →](https://github.com/SEUNOME/procon-capture-gui/releases/latest) |
| Windows | `.exe` (installer) | [Releases →](https://github.com/SEUNOME/procon-capture-gui/releases/latest) |
| Linux | `.AppImage` `.deb` `.rpm` | [Releases →](https://github.com/SEUNOME/procon-capture-gui/releases/latest) |

### Primeira abertura

- **macOS:** clique com ⌃ (Ctrl) no app → Abrir → Abrir (necessário na 1ª vez — o app ainda não tem assinatura de desenvolvedor).
- **Windows:** clique em "Mais informações" → "Executar assim mesmo" no aviso do SmartScreen.
- **Linux AppImage:** `chmod +x ProconCapture-*.AppImage && ./ProconCapture-*.AppImage`

---

## Como usar

1. Clique em **🔄 Capturar Todos** na barra lateral
2. O app abre o portal Procon SP — faça login normalmente
3. Após login, a captura roda automaticamente em background
4. Os processos aparecem na aba **Processos**
5. Clique em **⬇ Exportar** para salvar como JSON ou CSV

---

## Privacidade

**Nenhum dado sai da sua máquina.** O app lê os dados diretamente do portal Procon SP usando sua sessão autenticada e os salva localmente em `~/.procon-capture-data.json`. Nenhuma informação é enviada a servidores externos.

---

## Desenvolvimento local

**Pré-requisitos:** Node.js 20+, npm, Git

```bash
git clone https://github.com/SEUNOME/procon-capture-gui.git
cd procon-capture-gui
npm install
npm run dev
```

Para gerar instaladores localmente:

```bash
npm run dist          # plataforma atual
npm run dist:mac      # .dmg (requer macOS)
npm run dist:win      # .exe (requer Windows)
npm run dist:linux    # .AppImage + .deb + .rpm
```

Os instaladores ficam em `dist/`.

---

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licença

[MIT](LICENSE) © 2026 Leon Hatori
```

- [ ] Commit:
```bash
git add README.md
git commit -m "docs: add README with download links, usage guide, and privacy notice"
```

---

## Task 8: Criar CONTRIBUTING.md

**Files:**
- Criar: `CONTRIBUTING.md`

- [ ] Escrever `CONTRIBUTING.md` (substituir `SEUNOME` pelo seu usuário GitHub):

```markdown
# Como contribuir

Obrigado pelo interesse em contribuir com o ProconCapture!

## Reportando bugs

Abra uma [issue](https://github.com/SEUNOME/procon-capture-gui/issues) com:
- O que você estava fazendo
- O que aconteceu
- O que você esperava que acontecesse
- Seu sistema operacional e versão do app

## Desenvolvimento local

**Pré-requisitos:** Node.js 20+, npm, Git

```bash
git clone https://github.com/SEUNOME/procon-capture-gui.git
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
```

- [ ] Commit:
```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING guide"
```

---

## Task 9: Criar workflow GitHub Actions

**Files:**
- Criar: `.github/workflows/release.yml`

- [ ] Criar o diretório:
```bash
mkdir -p .github/workflows
```

- [ ] Escrever `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build and publish
        run: npm run dist:ci
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: |
            dist/*.dmg
            dist/*.exe
            dist/*.AppImage
            dist/*.deb
            dist/*.rpm
          if-no-files-found: warn
```

> `fail-fast: false` garante que macOS, Windows e Linux continuam buildando mesmo se uma plataforma falhar — útil durante debugging de issues específicas de plataforma.

- [ ] Commit:
```bash
git add .github/
git commit -m "ci: add GitHub Actions release workflow (mac + win + linux)"
```

---

## Task 10: Verificar build local

**Files:** nenhum (apenas verificação)

- [ ] Verificar que o TypeScript compila limpo:
```bash
npm run build
```
Esperado: código de saída 0. `out/electron/main.js` e `out/electron/preload.js` existem.

- [ ] Testar packaging na plataforma atual (escolha um):

**macOS:**
```bash
npm run dist:mac
```
Esperado: `dist/ProconCapture-1.0.0-arm64.dmg` e/ou `dist/ProconCapture-1.0.0.dmg` criados.

**Linux:**
```bash
npm run dist:linux
```
Esperado: `dist/ProconCapture-1.0.0.AppImage` e arquivos `.deb`/`.rpm` criados.

**Windows:**
```bash
npm run dist:win
```
Esperado: `dist/ProconCapture Setup 1.0.0.exe` criado.

> **Problemas comuns:**
> - `ENOENT: assets/icon.png` → executar `node scripts/create-icon.js` primeiro
> - `Cannot find module 'electron'` → executar `npm install`
> - macOS: erro no `sips` ao converter ícone → forneça um `assets/icon.icns` pré-gerado (use Preview.app ou [cloudconvert.com](https://cloudconvert.com/png-to-icns))

- [ ] Verificar conteúdo de `dist/`:
```bash
ls dist/
```

Nenhum commit necessário nesta task.

---

## Task 11: Publicar no GitHub e fazer primeiro release

- [ ] Criar um repositório **público** no GitHub chamado `procon-capture-gui` (sem README, sem .gitignore pré-configurados — já temos esses arquivos localmente).

- [ ] Adicionar o remote e fazer push:
```bash
git remote add origin https://github.com/SEUNOME/procon-capture-gui.git
git branch -M main
git push -u origin main
```

- [ ] Substituir `SEUNOME` pelo seu usuário real em todos os arquivos de uma vez:
```bash
# macOS/Linux:
sed -i '' 's/SEUNOME/SEU_USUARIO_REAL/g' README.md CONTRIBUTING.md package.json
# Windows (PowerShell):
# (Get-Content README.md) -replace 'SEUNOME','SEU_USUARIO_REAL' | Set-Content README.md
# (Get-Content CONTRIBUTING.md) -replace 'SEUNOME','SEU_USUARIO_REAL' | Set-Content CONTRIBUTING.md
# (Get-Content package.json) -replace 'SEUNOME','SEU_USUARIO_REAL' | Set-Content package.json
```

- [ ] Commitar e fazer push da correção:
```bash
git add README.md CONTRIBUTING.md package.json
git commit -m "chore: set GitHub repository URLs"
git push
```

- [ ] Criar e publicar a primeira tag de release:
```bash
git tag v1.0.0
git push --tags
```

- [ ] Acompanhar o CI em `https://github.com/SEU_USUARIO_REAL/procon-capture-gui/actions` — 3 jobs rodam em paralelo (~5–10 min cada).

- [ ] Verificar o release publicado em `https://github.com/SEU_USUARIO_REAL/procon-capture-gui/releases` — todos os instaladores devem aparecer automaticamente.

---

## Self-review

### Cobertura do spec

| Requisito do spec | Task |
|---|---|
| electron-builder config (dmg/exe/AppImage/deb/rpm) | Task 4 |
| macOS arm64 + x64 | Task 4 |
| NSIS com diretório configurável | Task 4 |
| Fix `dev` script cross-platform (concurrently) | Task 4 |
| Fix `homedir()+Desktop` → `app.getPath("desktop")` (6 lugares) | Task 5 |
| Fix `homedir()+Downloads` → `app.getPath("downloads")` | Task 5 |
| GitHub Actions matrix (3 OSes) | Task 9 |
| Trigger em tags `v*` | Task 9 |
| Publish com `GITHUB_TOKEN` | Task 9 |
| `fail-fast: false` | Task 9 |
| LICENSE MIT | Task 2 |
| .gitignore | Task 1 |
| assets/icon.png placeholder | Task 6 |
| README.md com badges, downloads, privacidade | Task 7 |
| CONTRIBUTING.md | Task 8 |
| Instrução sobre code signing no README | Task 7 |
| Verificação local de packaging | Task 10 |
| Push para GitHub + tag v1.0.0 | Task 11 |

✅ Cobertura completa.

### Placeholders

- `SEUNOME` aparece em Task 4, 7, 8, 11 — intencional, cada task documenta a substituição.
- Versões `9.x.x`, `25.x.x`, `8.x.x` na Task 4 — advertência explícita para usar os valores reais da Task 3.

### Consistência de tipos

- `dist:ci` definido em Task 4 e usado no workflow da Task 9. ✅
- `app.getPath("desktop")` e `app.getPath("downloads")` usados consistentemente na Task 5. ✅
- `assets/icon.png` referenciado no build config (Task 4) e criado na Task 6. ✅
