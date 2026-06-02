# ProconCapture

[![Release](https://img.shields.io/github/v/release/agenciaspace/procon-capture-gui?style=flat-square)](https://github.com/agenciaspace/procon-capture-gui/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/agenciaspace/procon-capture-gui/release.yml?style=flat-square&label=build)](https://github.com/agenciaspace/procon-capture-gui/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Site:** [procon-capture-gui.vercel.app](https://procon-capture-gui.vercel.app)

GUI desktop para capturar e exportar automaticamente seus processos do [Procon SP Digital](https://consumidor2.procon.sp.gov.br) — sem copiar e colar, sem telas de impressão.

---

## Download

| Plataforma | Formato | Link |
|---|---|---|
| macOS (Apple Silicon + Intel) | `.dmg` | [Releases →](https://github.com/agenciaspace/procon-capture-gui/releases/latest) |
| Windows | `.exe` (installer) | [Releases →](https://github.com/agenciaspace/procon-capture-gui/releases/latest) |
| Linux | `.AppImage` `.deb` `.rpm` | [Releases →](https://github.com/agenciaspace/procon-capture-gui/releases/latest) |

### Primeira abertura

- **macOS:** se aparecer aviso "Apple could not verify…", vá em **Ajustes do Sistema → Privacidade e Segurança**, role até o fim e clique em **"Abrir assim mesmo"**.
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
git clone https://github.com/agenciaspace/procon-capture-gui.git
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
