# Landing Page — ProconCapture

**Data:** 2026-06-01  
**Status:** aprovado  
**Repo:** agenciaspace/procon-capture-gui  

---

## Objetivo

Criar uma landing page estática deployada na Vercel que:
- Detecta o OS do visitante e destaca o download correto
- Apresenta passo a passo claro de uso (login → captura → exportação)
- Comunica com clareza que tudo roda localmente na máquina do usuário

---

## Arquitetura

```
procon-capture-gui/
├── web/
│   ├── index.html      ← landing page (markup + JS inline)
│   └── style.css       ← dark theme, mesma paleta do app
├── vercel.json         ← root aponta para /web, headers de cache
└── ... (resto do repo inalterado)
```

Sem framework, sem build step. Vercel serve `/web` como static files.

---

## Seções da página

### 1. Hero
- Nome: **ProconCapture**
- Tagline: "Capture seus processos do Procon SP sem copiar e colar"
- Badge de privacidade em destaque: `🔒 Tudo roda na sua máquina. Nenhum dado sai daqui.`

### 2. Download
- JS detecta OS via `navigator.userAgent`
- Botão primário grande para a plataforma detectada
- Links secundários menores para as outras plataformas
- Nota de primeira abertura contextual por OS:
  - macOS: Ctrl+clique → Abrir → Abrir (Gatekeeper)
  - Windows: "Mais informações" → "Executar assim mesmo" (SmartScreen)
  - Linux: `chmod +x *.AppImage && ./ProconCapture-*.AppImage`
- Fallback: se API falhar ou OS desconhecido, mostra 3 botões iguais linkando para `/releases/latest`

### 3. Passo a passo
4 passos numerados:
1. **Instale** — baixe e abra o ProconCapture para sua plataforma
2. **Inicie a captura** — clique em "Capturar Todos"; o portal Procon SP abre automaticamente
3. **Faça login** — entre no portal normalmente; o app aguarda em background
4. **Exporte** — processos aparecem na aba Processos; clique em Exportar para salvar JSON ou CSV

### 4. Privacidade (rodapé)
Parágrafo curto: o app lê dados diretamente do portal com a sessão do usuário, salva em `~/.procon-capture-data.json`, nunca envia nada a servidor externo. Link para README e licença MIT.

---

## Detecção de OS e download

```js
const ua = navigator.userAgent
const os = ua.includes('Mac')   ? 'mac'
         : ua.includes('Win')   ? 'win'
         : ua.includes('Linux') ? 'linux'
         : 'unknown'
```

### GitHub API
Chama `https://api.github.com/repos/agenciaspace/procon-capture-gui/releases/latest` no carregamento. Assets mapeados por padrão de nome:

| OS      | Padrão            | Extensão    |
|---------|-------------------|-------------|
| macOS   | `*arm64.dmg` / `*x64.dmg` | `.dmg` |
| Windows | `*.exe`           | `.exe`      |
| Linux   | `*.AppImage`      | `.AppImage` |

Para macOS: detecta Apple Silicon via `navigator.platform` ou UA; mostra dmg correspondente como primário, o outro como link secundário.

### Fallback
Se a API falhar (rate limit, offline) ou OS não detectado: mostra 3 botões sem destaque linkando para `https://github.com/agenciaspace/procon-capture-gui/releases/latest`.

---

## vercel.json

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/web/$1" }],
  "headers": [{
    "source": "/(.*)",
    "headers": [{ "key": "Cache-Control", "value": "s-maxage=3600" }]
  }]
}
```

---

## Visual

- Dark theme: `--bg: #0d1117`, `--surface: #161b22`, `--accent: #2f81f7`
- Mesma paleta do renderer do app
- Fonte do sistema (system-ui / -apple-system)
- Zero dependências externas (sem CDN, sem fontes remotas)

---

## Fora do escopo

- Internacionalização
- Analytics / tracking
- Blog ou changelog
- Formulário de contato
