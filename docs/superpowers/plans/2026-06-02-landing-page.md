# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma landing page estática em `/web` deployada na Vercel com detecção de OS, download inteligente via GitHub API e passo a passo de uso.

**Architecture:** Pasta `web/` com `index.html` + `style.css` servida diretamente pela Vercel via `vercel.json`. Sem build step, sem framework. JS inline no HTML detecta OS e busca assets do release mais recente via GitHub API.

**Tech Stack:** HTML5, CSS3, vanilla JS (ES2020), Vercel static hosting, GitHub Releases API

---

### Task 1: Criar `vercel.json`

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Criar o arquivo `vercel.json` na raiz**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/web/$1" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "s-maxage=3600" }]
    }
  ]
}
```

- [ ] **Step 2: Verificar que o arquivo é JSON válido**

```bash
node -e "require('./vercel.json'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json for static site routing"
```

---

### Task 2: Criar `web/style.css`

**Files:**
- Create: `web/style.css`

- [ ] **Step 1: Criar o diretório `web/`**

```bash
mkdir -p web
```

- [ ] **Step 2: Criar `web/style.css` com a paleta do app**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #0d1117;
  --surface:  #161b22;
  --surface2: #21262d;
  --border:   #30363d;
  --accent:   #2f81f7;
  --accent2:  #58a6ff;
  --green:    #3fb950;
  --text:     #e6edf3;
  --muted:    #8b949e;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent2); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ── Layout ─────────────────────────────────────────────── */
.container {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ── Hero ────────────────────────────────────────────────── */
.hero {
  text-align: center;
  padding: 80px 24px 48px;
}

.hero h1 {
  font-size: 2.6rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 12px;
}

.hero h1 span { color: var(--accent); }

.hero .tagline {
  font-size: 1.15rem;
  color: var(--muted);
  margin-bottom: 24px;
}

.privacy-badge {
  display: inline-block;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 0.85rem;
  color: var(--green);
  font-weight: 500;
}

/* ── Download ────────────────────────────────────────────── */
.download-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 40px 32px;
  margin: 0 0 48px;
  text-align: center;
}

.download-section h2 {
  font-size: 1.3rem;
  margin-bottom: 24px;
  color: var(--text);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 14px 28px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
  margin-bottom: 20px;
}

.btn-primary:hover { background: var(--accent2); text-decoration: none; }

.btn-primary .arrow { font-size: 1.2rem; }

.other-platforms {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.btn-secondary {
  color: var(--muted);
  font-size: 0.875rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}

.btn-secondary:hover { color: var(--text); text-decoration: none; }

.first-run-note {
  margin-top: 20px;
  padding: 12px 16px;
  background: var(--surface2);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: left;
}

.first-run-note strong { color: var(--text); }

.loading-state { color: var(--muted); font-size: 0.95rem; padding: 20px 0; }

/* ── Steps ───────────────────────────────────────────────── */
.steps-section { margin-bottom: 64px; }

.steps-section h2 {
  font-size: 1.4rem;
  margin-bottom: 32px;
  font-weight: 600;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step {
  display: flex;
  gap: 20px;
  padding-bottom: 32px;
  position: relative;
}

.step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 18px;
  top: 40px;
  bottom: 0;
  width: 2px;
  background: var(--border);
}

.step-num {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface2);
  border: 2px solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--accent);
  position: relative;
  z-index: 1;
}

.step-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  padding-top: 7px;
}

.step-content p {
  color: var(--muted);
  font-size: 0.9rem;
}

.step-content code {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 0.85em;
  color: var(--text);
}

/* ── Footer ──────────────────────────────────────────────── */
footer {
  border-top: 1px solid var(--border);
  padding: 40px 24px;
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.8;
}

footer strong { color: var(--text); }
footer code {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 0.9em;
}

footer .footer-links { margin-top: 12px; }
footer .footer-links a { margin: 0 8px; }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 600px) {
  .hero h1 { font-size: 2rem; }
  .download-section { padding: 28px 20px; }
  .other-platforms { flex-direction: column; align-items: center; }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/style.css
git commit -m "feat: add landing page stylesheet"
```

---

### Task 3: Criar `web/index.html` — estrutura e hero

**Files:**
- Create: `web/index.html`

- [ ] **Step 1: Criar `web/index.html` com head, hero e estrutura base**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Capture e exporte automaticamente seus processos do Procon SP Digital. Tudo roda na sua máquina." />
  <title>ProconCapture — Capture seus processos do Procon SP</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1><span>Procon</span>Capture</h1>
      <p class="tagline">Capture seus processos do Procon SP sem copiar e colar</p>
      <span class="privacy-badge">🔒 Tudo roda na sua máquina. Nenhum dado sai daqui.</span>
    </div>
  </section>

  <div class="container">

    <!-- Download (preenchido por JS) -->
    <div class="download-section" id="download">
      <p class="loading-state">Carregando informações de download…</p>
    </div>

    <!-- Passo a passo -->
    <section class="steps-section">
      <h2>Como usar</h2>
      <div class="steps">

        <div class="step">
          <div class="step-num">1</div>
          <div class="step-content">
            <h3>Instale o ProconCapture</h3>
            <p>Baixe o instalador para sua plataforma acima e abra o arquivo. Na primeira vez, pode ser necessário confirmar a abertura — veja a nota ao lado do botão de download.</p>
          </div>
        </div>

        <div class="step">
          <div class="step-num">2</div>
          <div class="step-content">
            <h3>Inicie a captura</h3>
            <p>Clique em <strong>🔄 Capturar Todos</strong> na barra lateral. O portal do Procon SP abre automaticamente em uma janela do app.</p>
          </div>
        </div>

        <div class="step">
          <div class="step-num">3</div>
          <div class="step-content">
            <h3>Faça login no portal</h3>
            <p>Entre normalmente em <strong>consumidor2.procon.sp.gov.br</strong> com seu CPF e senha. O app aguarda em background — não é necessário fazer nada.</p>
          </div>
        </div>

        <div class="step">
          <div class="step-num">4</div>
          <div class="step-content">
            <h3>Exporte seus processos</h3>
            <p>Após o login, a captura roda automaticamente. Os processos aparecem na aba <strong>Processos</strong>. Clique em <strong>⬇ Exportar</strong> para salvar como <code>JSON</code> ou <code>CSV</code>.</p>
          </div>
        </div>

      </div>
    </section>

  </div><!-- /container -->

  <!-- Footer -->
  <footer>
    <div class="container">
      <p>
        <strong>Privacidade:</strong> o ProconCapture lê seus dados diretamente do portal usando sua sessão autenticada
        e os salva em <code>~/.procon-capture-data.json</code> na sua máquina.
        Nenhuma informação é enviada a servidores externos.
      </p>
      <div class="footer-links">
        <a href="https://github.com/agenciaspace/procon-capture-gui">GitHub</a>
        <a href="https://github.com/agenciaspace/procon-capture-gui/blob/main/README.md">README</a>
        <a href="https://github.com/agenciaspace/procon-capture-gui/blob/main/LICENSE">MIT License</a>
      </div>
    </div>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add web/index.html
git commit -m "feat: add landing page HTML structure and hero"
```

---

### Task 4: Criar `web/app.js` — detecção de OS e download via GitHub API

**Files:**
- Create: `web/app.js`

- [ ] **Step 1: Criar `web/app.js` com toda a lógica de download**

```js
(function () {
  const REPO = 'agenciaspace/procon-capture-gui'
  const API  = `https://api.github.com/repos/${REPO}/releases/latest`
  const FALLBACK = `https://github.com/${REPO}/releases/latest`

  // ── Detecção de OS ─────────────────────────────────────────
  function detectOS() {
    const ua = navigator.userAgent
    if (ua.includes('Mac'))   return 'mac'
    if (ua.includes('Win'))   return 'win'
    if (ua.includes('Linux')) return 'linux'
    return 'unknown'
  }

  function detectArch() {
    // Apple Silicon: userAgentData (Chrome/Edge) ou heurística UA
    if (navigator.userAgentData) {
      const brands = navigator.userAgentData.brands || []
      // arm64 não está disponível sem getHighEntropyValues; default arm64 para Macs novos
    }
    // Fallback conservador: arm64 preferido para Macs (maioria novos)
    return 'arm64'
  }

  // ── Mapeamento de assets ───────────────────────────────────
  function findAsset(assets, pattern) {
    return assets.find(a => a.name.includes(pattern)) || null
  }

  function getDownloadLinks(assets, os) {
    if (os === 'mac') {
      const arm = findAsset(assets, 'arm64') && findAsset(assets, '.dmg')
        ? assets.find(a => a.name.includes('arm64') && a.name.endsWith('.dmg'))
        : null
      const x64 = assets.find(a => a.name.includes('x64') && a.name.endsWith('.dmg'))
             || assets.find(a => a.name.endsWith('.dmg'))
      const arch = detectArch()
      const primary   = arch === 'arm64' ? (arm || x64) : (x64 || arm)
      const secondary = arch === 'arm64' ? x64 : arm
      return { primary, secondary, ext: '.dmg' }
    }
    if (os === 'win') {
      const primary = assets.find(a => a.name.endsWith('.exe'))
      return { primary, secondary: null, ext: '.exe' }
    }
    if (os === 'linux') {
      const primary = assets.find(a => a.name.endsWith('.AppImage'))
      const deb     = assets.find(a => a.name.endsWith('.deb'))
      const rpm     = assets.find(a => a.name.endsWith('.rpm'))
      return { primary, secondary: deb || rpm, ext: '.AppImage' }
    }
    return { primary: null, secondary: null, ext: '' }
  }

  // ── Notas de primeira execução ─────────────────────────────
  const FIRST_RUN = {
    mac:   '<strong>Primeira abertura no macOS:</strong> Ctrl+clique no app → <em>Abrir</em> → <em>Abrir</em> (necessário por não ter assinatura de desenvolvedor).',
    win:   '<strong>Primeira abertura no Windows:</strong> Se aparecer aviso do SmartScreen, clique em <em>"Mais informações"</em> → <em>"Executar assim mesmo"</em>.',
    linux: '<strong>Linux AppImage:</strong> antes de abrir, execute no terminal: <code>chmod +x ProconCapture-*.AppImage && ./ProconCapture-*.AppImage</code>',
  }

  // ── Labels por OS ──────────────────────────────────────────
  const OS_LABEL = {
    mac:     'macOS',
    win:     'Windows',
    linux:   'Linux',
    unknown: '',
  }

  const OS_ICON = { mac: '🍎', win: '🪟', linux: '🐧', unknown: '⬇' }

  // ── Render ─────────────────────────────────────────────────
  function renderDownload(release, os) {
    const links  = getDownloadLinks(release.assets, os)
    const ver    = release.tag_name || ''
    const el     = document.getElementById('download')

    if (!links.primary) {
      renderFallback()
      return
    }

    const archLabel = (os === 'mac')
      ? (links.primary.name.includes('arm64') ? ' (Apple Silicon)' : ' (Intel)')
      : ''

    const secondaryHTML = links.secondary
      ? `<div class="other-platforms">
           <a href="${links.secondary.browser_download_url}" class="btn-secondary">
             ${os === 'mac'
               ? (links.primary.name.includes('arm64') ? '↓ Intel (.dmg)' : '↓ Apple Silicon (.dmg)')
               : (os === 'linux' ? `↓ ${links.secondary.name.split('.').pop().toUpperCase()}` : '')}
           </a>
         </div>`
      : ''

    const othersHTML = buildOtherPlatforms(release.assets, os)
    const noteHTML   = FIRST_RUN[os]
      ? `<p class="first-run-note">${FIRST_RUN[os]}</p>`
      : ''

    el.innerHTML = `
      <h2>${OS_ICON[os]} Download para ${OS_LABEL[os]}</h2>
      <a href="${links.primary.browser_download_url}" class="btn-primary">
        ⬇ Baixar ProconCapture ${ver}${archLabel}
        <span class="arrow">→</span>
      </a>
      ${secondaryHTML}
      ${noteHTML}
      ${othersHTML}
    `
  }

  function buildOtherPlatforms(assets, currentOS) {
    const others = []
    if (currentOS !== 'mac') {
      const dmg = assets.find(a => a.name.endsWith('.dmg'))
      if (dmg) others.push(`<a href="${dmg.browser_download_url}" class="btn-secondary">↓ macOS (.dmg)</a>`)
    }
    if (currentOS !== 'win') {
      const exe = assets.find(a => a.name.endsWith('.exe'))
      if (exe) others.push(`<a href="${exe.browser_download_url}" class="btn-secondary">↓ Windows (.exe)</a>`)
    }
    if (currentOS !== 'linux') {
      const appimage = assets.find(a => a.name.endsWith('.AppImage'))
      if (appimage) others.push(`<a href="${appimage.browser_download_url}" class="btn-secondary">↓ Linux (.AppImage)</a>`)
    }
    if (!others.length) return ''
    return `<div class="other-platforms" style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
      <span style="font-size:0.8rem;color:var(--muted);margin-right:8px">Outras plataformas:</span>
      ${others.join('')}
    </div>`
  }

  function renderFallback() {
    const el = document.getElementById('download')
    el.innerHTML = `
      <h2>⬇ Download</h2>
      <div class="other-platforms" style="flex-direction:column;gap:12px">
        <a href="${FALLBACK}" class="btn-primary">🍎 macOS (.dmg) <span class="arrow">→</span></a>
        <a href="${FALLBACK}" class="btn-primary" style="background:var(--surface2);border:1px solid var(--border)">🪟 Windows (.exe) <span class="arrow">→</span></a>
        <a href="${FALLBACK}" class="btn-primary" style="background:var(--surface2);border:1px solid var(--border)">🐧 Linux (.AppImage) <span class="arrow">→</span></a>
      </div>
      <p style="margin-top:16px;font-size:0.8rem;color:var(--muted)">Todos os downloads em <a href="${FALLBACK}">github.com/agenciaspace/procon-capture-gui/releases</a></p>
    `
  }

  // ── Init ───────────────────────────────────────────────────
  const os = detectOS()

  fetch(API)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
    .then(release => renderDownload(release, os))
    .catch(() => renderFallback())
})()
```

- [ ] **Step 2: Verificar que o arquivo existe**

```bash
ls -la web/
```
Expected: `app.js`, `index.html`, `style.css` listados

- [ ] **Step 3: Atualizar `index.html` para referenciar `app.js` (já está no template do Task 3 — confirmar que a linha existe)**

```bash
grep 'app.js' web/index.html
```
Expected: `<script src="app.js"></script>`

- [ ] **Step 4: Commit**

```bash
git add web/app.js
git commit -m "feat: add OS detection and GitHub API download logic"
```

---

### Task 5: Testar localmente com servidor HTTP

**Files:**
- No files changed

- [ ] **Step 1: Subir servidor local na pasta `web/`**

```bash
npx serve web -p 3333
```
Expected: `Serving!  http://localhost:3333`

- [ ] **Step 2: Abrir no navegador e verificar**

Abrir `http://localhost:3333` e verificar:
- Hero com badge verde "🔒 Tudo roda na sua máquina" aparece
- Seção de download carrega (pode mostrar loading ou fallback se não houver release ainda)
- Os 4 passos são visíveis com numeração e linhas de conexão
- Footer com links para GitHub, README e licença
- Nenhum erro no console (F12 → Console)

- [ ] **Step 3: Testar fallback**

Abrir DevTools → Network → selecionar "Offline" → recarregar a página.
Expected: 3 botões de download aparecem sem destaque, linkando para `/releases/latest`

- [ ] **Step 4: Encerrar o servidor**

`Ctrl+C` no terminal

---

### Task 6: Conectar à Vercel e fazer deploy

**Files:**
- No files changed

- [ ] **Step 1: Verificar que está logado na Vercel**

```bash
npx vercel whoami
```
Expected: seu email/username da Vercel

Se não estiver logado:
```bash
npx vercel login
```

- [ ] **Step 2: Deploy de preview**

```bash
npx vercel --cwd . --yes
```
Expected: URL de preview como `https://procon-capture-gui-xxx.vercel.app`

- [ ] **Step 3: Abrir a URL de preview e verificar os mesmos itens do Task 5 Step 2**

- [ ] **Step 4: Deploy para produção**

```bash
npx vercel --cwd . --prod --yes
```
Expected: URL de produção como `https://procon-capture-gui.vercel.app`

- [ ] **Step 5: Commit final com URLs documentadas no README**

Atualizar a seção "Download" do `README.md` para incluir o link da landing page:

```markdown
## Site

[procon-capture-gui.vercel.app](https://procon-capture-gui.vercel.app)
```

```bash
git add README.md
git commit -m "docs: add landing page URL to README"
```

---

### Task 7: Atualizar `package.json` com URL correta do repositório

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Corrigir o campo `repository.url` no `package.json`**

O campo atual aponta para `leonhatori/procon-capture-gui`. Corrigir para o repo certo:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/agenciaspace/procon-capture-gui"
}
```

- [ ] **Step 2: Verificar**

```bash
node -e "const p = require('./package.json'); console.log(p.repository.url)"
```
Expected: `https://github.com/agenciaspace/procon-capture-gui`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: fix repository URL in package.json"
```

---

### Task 8: Push para GitHub

- [ ] **Step 1: Push de tudo**

```bash
git push origin main
```

- [ ] **Step 2: Verificar que os arquivos aparecem no repo**

```bash
gh repo view agenciaspace/procon-capture-gui --web
```
