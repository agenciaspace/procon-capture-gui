# ProconCapture — Cross-Platform & Open Source Distribution

**Data:** 2026-05-26  
**Status:** Aprovado  
**Autor:** Leon Hatori

---

## Objetivo

Tornar o ProconCapture distribuível em Windows, Linux e macOS, e publicá-lo como projeto open source no GitHub com CI/CD automatizado que gera instaladores nativos a cada release.

---

## Escopo

### O que está incluído

- Configuração de `electron-builder` para geração de instaladores nativos (dmg, exe, AppImage, deb, rpm)
- GitHub Actions CI/CD: build em matriz (3 OSes) acionado por git tag
- Correções de compatibilidade cross-platform no código existente
- Arquivos de open source: LICENSE (MIT), README.md, CONTRIBUTING.md, .gitignore
- Ícone placeholder (PNG 1024×1024) que o electron-builder converte automaticamente

### O que não está incluído

- Code signing (assinatura de código para macOS notarization / Windows SmartScreen) — pode ser adicionado depois com certificados pagos
- Auto-update no app (electron-updater) — não é prioridade no MVP open source
- Tradução do app para inglês — mantém PT-BR

---

## Arquitetura

### Estrutura de arquivos resultante

```
procon-capture-gui/
├── .github/
│   └── workflows/
│       └── release.yml          ← CI/CD: build + publish GitHub Releases
├── assets/
│   ├── icon.icns                ← macOS (gerado pelo electron-builder a partir do .png)
│   ├── icon.ico                 ← Windows (gerado pelo electron-builder a partir do .png)
│   └── icon.png                 ← fonte: 1024×1024 px
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-26-cross-platform-opensource-design.md  ← este arquivo
├── electron/
│   ├── main.ts                  ← fix: app.getPath() em vez de homedir()
│   └── preload.ts
├── renderer/
│   └── index.html
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE                      ← MIT, Copyright (c) 2026 Leon Hatori
├── README.md                    ← PT-BR, badges CI + release, download links
├── package.json                 ← adicionar electron-builder, concurrently, wait-on
└── tsconfig.json
```

---

## Componentes

### 1. electron-builder (empacotador)

Adicionado como devDependency. Configuração inline em `package.json` sob a chave `"build"`.

```json
"build": {
  "appId": "br.gov.sp.procon.capture",
  "productName": "ProconCapture",
  "directories": { "output": "dist" },
  "files": ["out/**/*", "renderer/**/*", "package.json"],
  "mac": {
    "icon": "assets/icon.icns",
    "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
    "category": "public.app-category.productivity"
  },
  "win": {
    "icon": "assets/icon.ico",
    "target": [{ "target": "nsis", "arch": ["x64"] }]
  },
  "linux": {
    "icon": "assets/icon.png",
    "target": ["AppImage", "deb", "rpm"],
    "category": "Office"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

**Scripts adicionados:**

```json
"scripts": {
  "build":     "tsc",
  "start":     "npm run build && electron .",
  "dev":       "concurrently -k \"tsc --watch\" \"wait-on out/electron/main.js && electron . --dev\"",
  "dist":      "npm run build && electron-builder",
  "dist:mac":  "npm run build && electron-builder --mac",
  "dist:win":  "npm run build && electron-builder --win",
  "dist:linux":"npm run build && electron-builder --linux"
}
```

### 2. GitHub Actions (`.github/workflows/release.yml`)

Acionado em push de tags `v*`. Roda jobs em paralelo em `macos-latest`, `windows-latest` e `ubuntu-latest`. Usa `GITHUB_TOKEN` para publicar automaticamente no GitHub Releases.

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build & Package
        run: npm run dist
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
```

### 3. Correções cross-platform em `electron/main.ts`

| Problema | Causa | Correção |
|---|---|---|
| `dev` script quebra no Windows | `&` e `sleep` são bash-only | Usar `concurrently` + `wait-on` |
| `join(homedir(), "Desktop", ...)` | `~/Desktop` não existe em todas as distros Linux | Usar `app.getPath("desktop")` |
| `join(homedir(), "Downloads", ...)` | Caminho pode variar no Linux | Usar `app.getPath("downloads")` |
| `join(homedir(), ".procon-...")` | Funciona em todos os OSes | Manter (homedir() é cross-platform) |

### 4. Arquivos open source

**LICENSE** — MIT License, `Copyright (c) 2026 Leon Hatori`

**README.md** (PT-BR) — seções:
- Badges: CI status + última versão
- O que é / para quem serve
- Download links (macOS dmg | Windows exe | Linux AppImage)
- Como usar (login → capturar → exportar)
- Desenvolvimento local (pré-requisitos, npm install, npm run dev)
- Nota de privacidade: nenhum dado sai da máquina
- Contribuindo

**CONTRIBUTING.md** — guia curto:
- Como abrir issues
- Como rodar localmente
- Convenção de commits
- Como criar um PR

**`.gitignore`**:
```
node_modules/
out/
dist/
*.js.map
procon-*.json
```

---

## Fluxo de release

```
git tag v1.0.0
git push --tags
      │
      ▼
GitHub Actions dispara
      │
      ├─→ macos-latest   → ProconCapture-1.0.0.dmg (x64 + arm64)
      ├─→ windows-latest → ProconCapture-Setup-1.0.0.exe
      └─→ ubuntu-latest  → ProconCapture-1.0.0.AppImage
                           procon-capture_1.0.0_amd64.deb
                           procon-capture-1.0.0.x86_64.rpm
                                    │
                                    ▼
                           GitHub Releases (público)
```

---

## Decisões

- **electron-builder sobre electron-forge**: mais maduro, mais targets Linux, melhor documentação de CI
- **MIT sobre GPL**: maximiza adoção; o portal Procon SP é público, sem razão para restrição copyleft
- **Sem code signing no MVP**: certificados de desenvolvedor Apple ($99/ano) e EV Windows ($300+/ano) podem ser adicionados depois; por ora o README documenta que usuários precisam "abrir assim mesmo" na primeira vez
- **macOS arm64 + x64**: Apple Silicon é comum; electron-builder gera ambos sem overhead significativo

---

## O que não muda

- Interface visual (HTML/CSS/JS no renderer) — sem alterações
- Lógica de captura Procon SP (main.ts) — apenas as 2 chamadas de path corrigidas
- Configuração TypeScript (tsconfig.json) — sem alterações
