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
    // arm64 preferido para Macs (maioria novos)
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
