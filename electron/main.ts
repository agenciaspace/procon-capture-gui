/**
 * main.ts — ProconCapture Electron app
 *
 * Diferença crítica vs CLI+osascript:
 *   - webContents.executeJavaScript() AGUARDA Promises — async/await funciona!
 *   - O session 'persist:procon' mantém cookies entre reloads — sem redirect de login
 *   - Não precisa de "Allow JavaScript from Apple Events"
 */

import { app, BrowserWindow, ipcMain, dialog, shell, session } from "electron";
import { join } from "path";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { homedir } from "os";

const DIAG_FILE = join(app.getPath("desktop"), "procon-diagnostico.json");
const DATA_FILE = join(homedir(), ".procon-capture-data.json");

const PROCON_BASE   = "https://consumidor2.procon.sp.gov.br";
const PROCON_LIST   = `${PROCON_BASE}/u/atendimentos`;
const PROCON_DETAIL = (id: string) =>
  `${PROCON_BASE}/u/processos-administrativos/${id}/acompanhar`;

// ─── Estado ───────────────────────────────────────────────────────────────────

let dashboardWin: BrowserWindow | null = null;
let proconWin:    BrowserWindow | null = null;
let captureRunning = false;

interface ProcessData {
  id:              string;
  protocolo:       string | null;
  empresa:         string | null;
  status:          string | null;
  dataCriacao:     string | null;
  dataAtualizacao: string | null;
  descricao:       string | null;
  acompanhamento:  unknown[];
  documentos:      { nome: string; url: string }[];
  pageText:        string;
  detailUrl:       string | null;   // URL real da página de detalhe
  raw:             unknown;
}

const processMap = new Map<string, ProcessData>();

// ─── Utilitários ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function emit(channel: string, data: unknown) {
  dashboardWin?.webContents.send(channel, data);
}

function log(msg: string) {
  console.log(`[ProconCapture] ${msg}`);
  emit("log", msg);
}

// ─── executeJS helper — retorna resultado de async IIFE ───────────────────────

async function runJs<T>(code: string, timeoutMs = 10000): Promise<T | null> {
  if (!proconWin || proconWin.isDestroyed()) return null;
  try {
    const result = await Promise.race([
      proconWin.webContents.executeJavaScript(code) as Promise<T>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("executeJS timeout")), timeoutMs)
      ),
    ]);
    return result;
  } catch (e: any) {
    log(`JS error: ${e?.message ?? e}`);
    return null;
  }
}

// ─── Token discovery — varre localStorage + sessionStorage + JSON aninhado ───

async function discoverToken(): Promise<{ token: string | null; source: string }> {
  const result = await runJs<{ token: string | null; source: string }>(`
    (function() {
      var knownKeys = [
        'access_token', 'token', 'auth_token', 'jwt', 'id_token',
        'accessToken', 'authToken', 'bearerToken', 'Authorization',
        'procon_token', 'user_token', 'session_token', 'keycloak_token',
        'oidc_token', 'openid_token', 'KC_TOKEN', 'kc_token'
      ];

      // 1. Keys conhecidos em localStorage
      for (var i = 0; i < knownKeys.length; i++) {
        var v = localStorage.getItem(knownKeys[i]);
        if (v && v.length > 20 && !v.startsWith('{') && !v.startsWith('['))
          return { token: v, source: 'ls:' + knownKeys[i] };
      }

      // 2. Keys conhecidos em sessionStorage
      for (var i = 0; i < knownKeys.length; i++) {
        var v = sessionStorage.getItem(knownKeys[i]);
        if (v && v.length > 20 && !v.startsWith('{') && !v.startsWith('['))
          return { token: v, source: 'ss:' + knownKeys[i] };
      }

      // 3. Padrão JWT (começa com eyJ) em qualquer valor de localStorage
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k);
        if (v && v.startsWith('eyJ')) return { token: v, source: 'ls-jwt:' + k };
      }

      // 4. Padrão JWT em sessionStorage
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        var v = sessionStorage.getItem(k);
        if (v && v.startsWith('eyJ')) return { token: v, source: 'ss-jwt:' + k };
      }

      // 5. JWT aninhado em objetos JSON no localStorage
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var raw = localStorage.getItem(k);
        try {
          var obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            var tkeys = ['access_token','token','accessToken','jwt','id_token','bearerToken'];
            for (var j = 0; j < tkeys.length; j++) {
              var t = obj[tkeys[j]];
              if (t && typeof t === 'string' && t.startsWith('eyJ'))
                return { token: t, source: 'ls-nested:' + k + '.' + tkeys[j] };
            }
          }
        } catch(e) {}
      }

      // 6. JWT aninhado em sessionStorage
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        var raw = sessionStorage.getItem(k);
        try {
          var obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            var tkeys = ['access_token','token','accessToken','jwt','id_token','bearerToken'];
            for (var j = 0; j < tkeys.length; j++) {
              var t = obj[tkeys[j]];
              if (t && typeof t === 'string' && t.startsWith('eyJ'))
                return { token: t, source: 'ss-nested:' + k + '.' + tkeys[j] };
            }
          }
        } catch(e) {}
      }

      return { token: null, source: 'none' };
    })()`);

  return result ?? { token: null, source: 'error' };
}

// ─── Aguarda DOM ter conteúdo real (substitui sleep fixo) ─────────────────────
// Retorna 'dom' | 'api' | 'timeout'

async function waitForContent(timeoutMs = 30000): Promise<string> {
  const stepMs = 800;
  const end = Date.now() + timeoutMs;

  while (Date.now() < end) {
    await sleep(stepMs);

    const state = await runJs<{
      uuidCount: number;
      hasFetches: boolean;
      bodyLen: number;
      hasAngular: boolean;
    }>(`(function() {
      var uuids = (document.documentElement.innerHTML.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
      ) || []).length;
      var hasFetches = performance.getEntriesByType('resource').some(function(e) {
        return (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
          && !e.name.match(/\\.(js|css|png|jpg|svg|ico|woff2?|ttf|map)($|\\?)/);
      });
      var hasAngular = !!(window['getAllAngularRootElements'] || window['ng']);
      return {
        uuidCount:  uuids,
        hasFetches: hasFetches,
        bodyLen:    document.body ? document.body.innerText.length : 0,
        hasAngular: hasAngular
      };
    })()`);

    if (!state) continue;

    log(`Polling DOM... bodyLen=${state.bodyLen} uuids=${state.uuidCount} api=${state.hasFetches} ng=${state.hasAngular}`);

    if (state.uuidCount > 0)  return "dom";
    if (state.hasFetches)     return "api";
  }

  return "timeout";
}

// ─── Diagnóstico completo do estado da janela Procon SP ──────────────────────

async function runDiagnostic(): Promise<object> {
  const result = await runJs<object>(`
    (function() {
      var diag = {
        url:       location.href,
        title:     document.title,
        bodyPreview: (document.body ? document.body.innerText : '').slice(0, 300),
        localStorage:  {},
        sessionStorage: {},
        cookieKeys: document.cookie.split(';').map(function(c){ return c.trim().split('=')[0]; }).filter(Boolean),
        perfEntries: [],
        domUuids: [],
        angularDetected: !!(window['getAllAngularRootElements'] || window['ng']),
        hasToken: false,
        tokenSource: 'none'
      };

      // localStorage
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k) || '';
        diag.localStorage[k] = v.length > 80 ? v.slice(0,80) + '…' : v;
        if (v.startsWith('eyJ')) { diag.hasToken = true; diag.tokenSource = 'ls:' + k; }
      }

      // sessionStorage
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        var v = sessionStorage.getItem(k) || '';
        diag.sessionStorage[k] = v.length > 80 ? v.slice(0,80) + '…' : v;
        if (v.startsWith('eyJ') && !diag.hasToken) { diag.hasToken = true; diag.tokenSource = 'ss:' + k; }
      }

      // Performance API
      diag.perfEntries = performance.getEntriesByType('resource')
        .filter(function(e) {
          return (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
            && !e.name.match(/\\.(js|css|png|jpg|svg|ico|woff2?|ttf|map)($|\\?)/);
        })
        .map(function(e) {
          try { var u = new URL(e.name); return u.pathname + u.search; }
          catch(_) { return e.name; }
        });

      // UUIDs no DOM
      var allUuids = (document.documentElement.innerHTML.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
      ) || []);
      diag.domUuids = Array.from(new Set(allUuids)).slice(0, 30);

      return diag;
    })()`);

  return result ?? { error: "Janela Procon SP não acessível" };
}

// ─── Janela dashboard ─────────────────────────────────────────────────────────

function createDashboard() {
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  dashboardWin = new BrowserWindow({
    width: 980, height: 720, minWidth: 800, minHeight: 560,
    title: "ProconCapture",
    // ── Native chrome per platform ────────────────────────────────────
    ...(isMac && { titleBarStyle:       "hiddenInset" as const }),
    ...(isMac && { trafficLightPosition: { x: 16, y: 16 } }),
    ...(isMac && { vibrancy:            "under-window" as const }),
    ...(isMac && { transparent:         true }),
    ...(isWin && { backgroundMaterial:  "acrylic" as const }),
    backgroundColor: (isMac || isWin) ? "#00000000" : "#0d1117",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  dashboardWin.loadFile(join(__dirname, "../../renderer/index.html"));
  dashboardWin.on("closed", () => { dashboardWin = null; proconWin?.close(); });
}

// ─── Janela Procon SP ─────────────────────────────────────────────────────────

function createProconWindow() {
  proconWin = new BrowserWindow({
    width: 1100, height: 780,
    title: "Procon SP Digital",
    show: false,  // começa oculta — mostra só quando login é necessário ou usuário pede
    webPreferences: {
      partition: "persist:procon",
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  proconWin.setMenuBarVisibility(false);
  proconWin.webContents.setAudioMuted(true);

  // CDP — intercepta respostas JSON da API
  try {
    proconWin.webContents.debugger.attach("1.3");
    proconWin.webContents.debugger.sendCommand("Network.enable");
    proconWin.webContents.debugger.on("message", onCdpMessage);
  } catch { /* já attachado */ }

  // Detecção de navegação — verifica auth após cada carregamento
  // (não executa durante captura para evitar polling de 20s concorrente)
  proconWin.webContents.on("did-finish-load", () => {
    const url = proconWin!.webContents.getURL();
    log(`Página carregada: ${url}`);
    if (!captureRunning) checkAuthAndNotify();
  });

  proconWin.on("closed", () => {
    proconWin = null;
    emit("auth-status", { loggedIn: false, url: "" });
  });

  proconWin.loadURL(PROCON_LIST);
}

// ─── Verifica autenticação — polling até token aparecer (OIDC é lento) ────────

async function checkAuthAndNotify() {
  // Polling: tenta até 20s para o OIDC library gravar o token após redirect OAuth
  const maxWait = 20000;
  const step    = 1000;
  const end     = Date.now() + maxWait;

  let token: string | null = null;
  let source = "none";
  let url    = "";

  while (Date.now() < end) {
    await sleep(step);

    const urlResult = await runJs<{ url: string }>(`({ url: location.href })`);
    if (!urlResult) continue;
    url = urlResult.url;

    // Se ainda em página de login/SSO, aguarda redirect
    if (url.includes("login") || url.includes("idp") || url.includes("sso")) {
      log(`Aguardando redirect OAuth... (${url.slice(0, 60)})`);
      continue;
    }

    // Página do portal — tenta descobrir token
    const found = await discoverToken();
    if (found.token) {
      token  = found.token;
      source = found.source;
      break;
    }

    log(`Token ainda não disponível em ${url.slice(0, 60)}, aguardando OIDC...`);
  }

  const isLoggedIn =
    !!token &&
    url.includes("procon.sp.gov.br") &&
    !url.includes("login") &&
    !url.includes("idp") &&
    !url.includes("sso");

  log(`Auth: loggedIn=${isLoggedIn}, tokenSource=${source}, tokenLen=${token?.length ?? 0}, url=${url}`);
  emit("auth-status", { loggedIn: isLoggedIn, url, tokenLen: token?.length ?? 0 });

  if (!isLoggedIn) {
    // Precisa de login — mostra a janela para o usuário
    if (proconWin && !proconWin.isDestroyed()) {
      proconWin.show();
      proconWin.focus();
      log("Janela Procon aberta para login");
    }
    return;
  }

  // Logado — auto-captura a lista na primeira vez, depois esconde a janela
  if (processMap.size === 0) {
    await extractProcessListFromDom();
    if (!captureRunning) proconWin?.hide();
  }
}

// ─── CDP handler ──────────────────────────────────────────────────────────────

async function onCdpMessage(_evt: any, method: string, params: any) {
  if (method !== "Network.responseReceived") return;
  const url: string    = params.response?.url ?? "";
  const mime: string   = params.response?.mimeType ?? "";
  const status: number = params.response?.status ?? 0;

  if (!url.includes("procon.sp.gov.br") || status < 200 || status >= 300) return;
  if (!mime.includes("json") && !mime.includes("text/plain")) return;
  if (url.match(/\.(js|css|png|jpg|svg|ico|woff2?|ttf|map)($|\?)/)) return;

  try {
    const resp = await proconWin!.webContents.debugger.sendCommand(
      "Network.getResponseBody", { requestId: params.requestId }
    );
    const body = resp.base64Encoded
      ? Buffer.from(resp.body, "base64").toString("utf-8")
      : resp.body;
    const data = JSON.parse(body);
    const path = (() => { try { return new URL(url).pathname; } catch { return url; } })();

    log(`CDP: ${path} → ${status}`);
    emit("api-captured", { path, status });

    onApiData(url, data);
  } catch { /* binary/parse error */ }
}

// ─── Processa dados capturados (CDP ou fetch direto) ─────────────────────────

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function normalizeList(d: unknown): unknown[] {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object") return [];

  // Busca em campos conhecidos (qualquer profundidade de 1 nível)
  const knownKeys = [
    "content", "data", "items", "atendimentos", "processos",
    "reclamacoes", "results", "list", "records", "elements",
    "payload", "response", "atendimento", "processo",
    "itens", "listaAtendimentos", "listaProcessos",
    "value", "values", "rows", "result",
  ];
  for (const k of knownKeys) {
    const v = (d as any)[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }

  // Tenta um nível de aninhamento (ex: { data: { atendimentos: [...] } })
  for (const outer of Object.values(d as object)) {
    if (outer && typeof outer === "object" && !Array.isArray(outer)) {
      for (const k of knownKeys) {
        const v = (outer as any)[k];
        if (Array.isArray(v) && v.length > 0) return v;
      }
    }
  }

  // Fallback agressivo: retorna o primeiro array com objetos encontrado
  for (const v of Object.values(d as object)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v;
  }

  return [];
}

function extractId(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const r = item as any;
  // Campos conhecidos de ID
  for (const k of [
    "id","idAtendimento","idProcesso","uuid","idReclamacao",
    "numeroProcesso","protocolId","atendimentoId","processoId",
    "reclamacaoId","codigoAtendimento","codigo",
  ]) {
    if (r[k]) return String(r[k]);
  }
  // Fallback: procura qualquer valor UUID no objeto
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const v of Object.values(r)) {
    if (typeof v === "string" && UUID_PATTERN.test(v)) return v;
  }
  return null;
}

function get(r: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null) continue;
    // Só retorna primitivos — objetos precisam de tratamento especial
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      return String(v);
  }
  return null;
}

function upsertProcess(id: string, raw: unknown, extra: Partial<ProcessData> = {}) {
  const r = (raw ?? {}) as any;
  const existing: ProcessData = processMap.get(id) ?? {
    id, protocolo: null, empresa: null, status: null,
    dataCriacao: null, dataAtualizacao: null, descricao: null,
    acompanhamento: [], documentos: [], pageText: "", detailUrl: null, raw: null,
  };
  processMap.set(id, {
    ...existing,
    protocolo:       get(r,"protocolo","numeroProtocolo","numero","numProtocolo") ?? existing.protocolo,
    empresa:         // fornecedor pode ser objeto { nome, nomeFantasia, ... } ou string
                     (typeof r.fornecedor === "string"
                       ? r.fornecedor
                       : r.fornecedor?.nome ?? r.fornecedor?.nomeFantasia ?? null) ??
                     get(r,"nomeEmpresa","empresa","reclamada","razaoSocial","nomeReclamada","nomeFantasia") ??
                     existing.empresa,
    status:          get(r,"nomeDaSituacao","statusFormatted","status","situacao","statusReclamacao","descricaoStatus","statusAtual","fase","descricaoSituacao") ?? existing.status,
    dataCriacao:     get(r,"dataDaSolicitacao","dataCriacao","dataAbertura","dataRegistro","createdAt","dataAtendimento","dataProtocolo") ?? existing.dataCriacao,
    dataAtualizacao: get(r,"ultimaAtualizacao","dataAtualizacao","dataUltimaMovimentacao","updatedAt","dataUltimoAndamento") ?? existing.dataAtualizacao,
    descricao:       // detalhes é objeto aninhado; extrai descrição do produto/serviço
                     (typeof r.detalhes === "string"
                       ? r.detalhes
                       : r.detalhes?.dadosDaCompraOuContratacao?.detalhes ??
                         r.detalhes?.dadosDaCompraOuContratacao?.nomeDoProduto ?? null) ??
                     get(r,"descricao","relato","assunto","objeto","descricaoReclamacao","motivoReclamacao") ??
                     existing.descricao,
    raw:             raw,
    ...extra,
  });
}

function onApiData(url: string, data: unknown) {
  // ── Verifica UUID antes de normalizeList ──────────────────────────────────
  // CRÍTICO: checar UUID primeiro evita que o fallback agressivo de normalizeList
  // trate campos como 'interacoes' (andamentos) como lista de processos,
  // o que criava processos fantasma e impedia o processamento do detalhe.
  const m = url.match(UUID_RE);

  if (m) {
    // Resposta de detalhe de um processo
    const id = m[0];
    const r = (data ?? {}) as any;

    // Andamentos — inclui 'interacoes' (campo real do portal Procon SP)
    let acomp =
      r.acompanhamento ?? r.andamentos ?? r.movimentacoes ?? r.historico ??
      r.interacoes ?? r.tramitacoes ?? r.ocorrencias ?? r.eventos ??
      r.andamentoList ?? r.listaAndamentos ?? r.listaMovimentacoes ??
      r.andamentosProcesso ?? r.timeline ?? r.registros ?? r.ocorrencia;

    if (!Array.isArray(acomp)) {
      for (const outer of Object.values(r)) {
        if (outer && typeof outer === "object" && !Array.isArray(outer)) {
          const o = outer as any;
          acomp = o.acompanhamento ?? o.andamentos ?? o.movimentacoes ??
                  o.historico ?? o.listaAndamentos ?? o.andamentoList ?? o.interacoes;
          if (Array.isArray(acomp) && acomp.length > 0) break;
        }
      }
    }

    // Documentos — inclui 'documentoProduzidos' (campo real do portal Procon SP)
    let docs =
      r.documentoProduzidos ??
      r.anexosDoConsumidor ?? r.anexosDaEmpresa ??
      r.documentos ?? r.anexos ?? r.arquivos ?? r.files ??
      r.listaDocumentos ?? r.listaAnexos ?? r.documentoList ?? r.anexoList;

    if (!Array.isArray(docs)) {
      for (const outer of Object.values(r)) {
        if (outer && typeof outer === "object" && !Array.isArray(outer)) {
          const o = outer as any;
          docs = o.documentoProduzidos ?? o.anexosDoConsumidor ?? o.anexosDaEmpresa ??
                 o.documentos ?? o.anexos ?? o.arquivos ?? o.listaDocumentos;
          if (Array.isArray(docs) && docs.length > 0) break;
        }
      }
    }

    // Combina todas as fontes de documentos
    const docSeen = new Set<unknown>();
    const allDocs = [
      ...(Array.isArray(r.documentoProduzidos) ? r.documentoProduzidos : []),
      ...(Array.isArray(r.anexosDoConsumidor)  ? r.anexosDoConsumidor  : []),
      ...(Array.isArray(r.anexosDaEmpresa)     ? r.anexosDaEmpresa     : []),
    ].filter(d => { const k = JSON.stringify(d); return !docSeen.has(k) && docSeen.add(k); });

    // Se nenhuma das fontes específicas teve dados, usa o genérico
    if (allDocs.length === 0 && Array.isArray(docs)) {
      allDocs.push(...docs);
    }

    upsertProcess(id, data, {
      acompanhamento: Array.isArray(acomp) ? acomp : [],
      documentos: allDocs.map((d: any) => ({
        nome: d.nome ?? d.nomeArquivo ?? d.fileName ?? d.descricao ?? d.titulo ?? "doc",
        url:  d.url ?? d.link ?? d.urlDownload ?? d.caminhoArquivo ?? d.urlArquivo ?? "",
      })),
    });
    broadcastProcesses();
    return;
  }

  // ── Sem UUID → resposta de lista ──────────────────────────────────────────
  const list = normalizeList(data);
  if (list.length > 0) {
    list.forEach(item => { const id = extractId(item); if (id) upsertProcess(id, item); });
    broadcastProcesses();
  }
}

function broadcastProcesses() {
  const procs = Array.from(processMap.values());
  emit("processes-updated", { processes: procs });
  // Persiste em disco após cada atualização (async, não bloqueia)
  setImmediate(() => saveData());
}

// ─── Persistência local ──────────────────────────────────────────────────────

function saveData() {
  try {
    const payload = {
      savedAt:   new Date().toISOString(),
      count:     processMap.size,
      processes: Array.from(processMap.values()),
    };
    writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch { /* ok */ }
}

function loadData() {
  try {
    const raw  = readFileSync(DATA_FILE, "utf-8");
    const payload = JSON.parse(raw);
    if (Array.isArray(payload.processes) && payload.processes.length > 0) {
      payload.processes.forEach((p: ProcessData) => processMap.set(p.id, p));
      const when = payload.savedAt
        ? new Date(payload.savedAt).toLocaleString("pt-BR")
        : "?";
      log(`📂 ${payload.processes.length} processo(s) carregados do disco (${when})`);
    }
  } catch { /* arquivo ainda não existe — ok */ }
}

// ─── Extrai lista via DOM + polling + fetch autenticado ──────────────────────

async function extractProcessListFromDom() {
  log("Aguardando Angular renderizar conteúdo...");
  const waitResult = await waitForContent(30000);
  log(`DOM pronto: ${waitResult}`);

  // ── Diagnóstico: texto da página ────────────────────────────────────────────
  const pageSnippet = await runJs<string>(
    `(function(){ return document.title + '\\n' + document.body.innerText.slice(0,500); })()`
  );
  log(`Página: ${pageSnippet?.slice(0, 200)?.replace(/\n/g, " ") ?? "(vazio)"}`);

  // ── Descobrir token ──────────────────────────────────────────────────────────
  const { token, source } = await discoverToken();
  log(`Token: source=${source}, len=${token?.length ?? 0}`);

  // ── 1) Performance API — endpoints chamados pelo Angular ────────────────────
  const perfPaths = await runJs<string[]>(`
    (function() {
      return performance.getEntriesByType('resource')
        .filter(function(e) {
          return (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
            && !e.name.match(/\\.(js|css|png|jpg|svg|ico|woff2?|ttf|map)($|\\?)/);
        })
        .map(function(e) {
          try { var u = new URL(e.name); return u.pathname + u.search; }
          catch(_) { return e.name; }
        });
    })()`);

  if (perfPaths && perfPaths.length > 0) {
    log(`Performance API encontrou: ${perfPaths.join(", ")}`);
  } else {
    log("Performance API: nenhum XHR/fetch registrado ainda");
  }

  // ── 2) Links / UUIDs no DOM (captura href completo para navegação posterior) ──
  const links = await runJs<{ id: string; text: string; href: string }[]>(`
    (function() {
      var found = [];
      var seen  = new Set();
      var re    = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      // <a href>
      document.querySelectorAll('a').forEach(function(a) {
        var m = (a.href || '').match(re);
        if (m && !seen.has(m[0])) {
          seen.add(m[0]);
          found.push({ id: m[0], text: a.innerText.trim().slice(0,80), href: a.href || '' });
        }
      });
      // [routerLink]
      document.querySelectorAll('[routerlink],[ng-reflect-router-link]').forEach(function(el) {
        var rl = el.getAttribute('routerlink') || el.getAttribute('ng-reflect-router-link') || '';
        var m  = rl.match(re);
        if (m && !seen.has(m[0])) {
          seen.add(m[0]);
          found.push({ id: m[0], text: (el.innerText||'').trim().slice(0,80), href: '' });
        }
      });
      // UUIDs no innerHTML completo (fallback)
      if (found.length === 0) {
        var allUuids = (document.documentElement.innerHTML.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || []);
        Array.from(new Set(allUuids)).forEach(function(uuid) {
          if (!seen.has(uuid)) { seen.add(uuid); found.push({ id: uuid, text: '', href: '' }); }
        });
      }
      return found;
    })()`);

  if (links && links.length > 0) {
    log(`DOM encontrou ${links.length} processo(s): ${links.map(l=>l.id.slice(0,8)).join(", ")}`);
    links.forEach(({ id, text, href }) => upsertProcess(id, null, {
      protocolo: text || null,
      detailUrl: href || null,
    }));
    broadcastProcesses();
  }

  // ── 3) Fetch autenticado — endpoint real primeiro, depois fallbacks ──────────
  // Endpoint confirmado pelo diagnóstico do portal
  const LISTAR_ENDPOINT =
    "/api/Procon/Portais/Consumidores/Application/Atendimentos/Listar/" +
    "ListarAtendimentosEndpoint?pagina=1&itensPorPagina=50" +
    "&tiposDeAtendimentoExtendido=4&tiposDeAtendimentoExtendido=1" +
    "&tiposDeAtendimentoExtendido=-999&tiposDeAtendimentoExtendido=13" +
    "&tiposDeAtendimentoExtendido=472890000";

  const staticPaths = [
    LISTAR_ENDPOINT,                    // ← endpoint real confirmado
    "/api/v1/atendimentos",
    "/api/v1/atendimentos?page=0&size=50",
    "/api/v1/atendimentos?pagina=0&tamanho=50",
    "/api/atendimentos",
    "/api/v1/processos-administrativos",
    "/api/processos-administrativos",
    "/api/v1/reclamacoes",
    "/api/reclamacoes",
  ];

  // Performance API primeiro (caminhos reais do Angular), depois estáticos
  const allPaths = Array.from(new Set([...(perfPaths ?? []), ...staticPaths]));

  for (const path of allPaths) {
    const authHeader = token ? `'Authorization': 'Bearer ' + ${JSON.stringify(token)},` : "";
    const result = await runJs<{ status: number; data: unknown; error?: string } | null>(`
      (async function() {
        try {
          var res = await fetch(${JSON.stringify(PROCON_BASE + path)}, {
            headers: {
              ${authHeader}
              'Accept': 'application/json, text/plain, */*'
            },
            credentials: 'include'
          });
          var text = await res.text();
          var data;
          try { data = JSON.parse(text); } catch(_) { data = text.slice(0, 300); }
          return { status: res.status, data: data };
        } catch(e) {
          return { status: 0, data: null, error: String(e) };
        }
      })()`);

    if (!result) { log(`fetch ${path} → null`); continue; }
    if (result.error) { log(`fetch ${path} → erro: ${result.error}`); continue; }

    if (result.status !== 200) {
      // Só loga não-200 para endpoints Procon (evita spam de 401 em endpoints de user)
      if (path.includes("Atendimentos") || path.includes("Processos"))
        log(`fetch ${path} → ${result.status}`);
      continue;
    }

    const isHtml = typeof result.data === "string" &&
                   (result.data.trimStart().startsWith("<!") || result.data.trimStart().startsWith("<html"));
    const isPrimitive = typeof result.data !== "object" || result.data === null;

    if (!isHtml && !isPrimitive) {
      const preview = JSON.stringify(result.data)?.slice(0, 120) ?? "";
      log(`fetch ${path} → 200 | ${preview}`);
    }

    const list = normalizeList(result.data);
    if (list.length > 0) {
      log(`✅ Lista encontrada em ${path}: ${list.length} item(s)`);
      list.forEach(item => { const id = extractId(item); if (id) upsertProcess(id, item); });
      broadcastProcesses();
      return;
    }

    // 200 com JSON mas sem lista — só avisa se for endpoint de atendimentos
    if (!isHtml && !isPrimitive && path.toLowerCase().includes("atendimento")) {
      log(`⚠️ ${path} → 200 mas sem lista detectada. Estrutura: ${JSON.stringify(result.data)?.slice(0, 300)}`);
      try {
        writeFileSync(
          join(app.getPath("desktop"), "procon-response-debug.json"),
          JSON.stringify({ path, data: result.data }, null, 2)
        );
      } catch { /* ok */ }
    }
  }

  if (links && links.length > 0) {
    log(`ℹ️ Processos encontrados via DOM (${links.length}). Sem dados extras via fetch.`);
    return;
  }

  log("⚠️ Nenhum processo encontrado. Clique em '🔍 Diagnóstico' para ver o estado da sessão.");
}

// ─── Captura completa de um processo via Performance API + DOM ───────────────

async function captureProcessDetail(id: string) {
  log(`Capturando detalhe: ${id.slice(0,8)}...`);

  const stored    = processMap.get(id);
  const detailUrl = stored?.detailUrl || PROCON_DETAIL(id);
  log(`Navegando para: ${detailUrl}`);

  // ── 1) Navega e aguarda did-finish-load ───────────────────────────────────
  // CRÍTICO: aguardar did-finish-load antes de inspecionar Performance API —
  // a navegação reseta a Performance API, eliminando entradas da página anterior.
  // Sem esse await, obtemos "Endpoints relevantes (0)" porque checamos antes da reset.
  await new Promise<void>((resolve) => {
    if (!proconWin || proconWin.isDestroyed()) { resolve(); return; }
    const timer = setTimeout(() => {
      proconWin?.webContents.removeListener("did-finish-load", onLoad);
      log(`⚠️ Timeout aguardando carregamento de ${id.slice(0,8)}`);
      resolve();
    }, 20000);
    function onLoad() { clearTimeout(timer); resolve(); }
    proconWin.webContents.once("did-finish-load", onLoad);
    proconWin.loadURL(detailUrl);
  });

  // ── 2) Aguarda Angular inicializar e fazer chamadas de API (4s) ───────────
  log(`Aguardando Angular carregar detalhes...`);
  await sleep(4000);

  // ── 3) Performance API — endpoints desta página (fresca após navegação) ──
  const perfPaths = await runJs<string[]>(`
    (function() {
      return performance.getEntriesByType('resource')
        .filter(function(e) {
          return (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest')
            && !e.name.match(/\\.(js|css|png|jpg|svg|ico|woff2?|ttf|map)($|\\?)/);
        })
        .map(function(e) {
          try { var u = new URL(e.name); return u.pathname + u.search; }
          catch(_) { return e.name; }
        });
    })()`);

  // Filtra endpoints relevantes ao processo
  const relevantPaths = (perfPaths ?? []).filter(p =>
    p.includes(id) ||
    p.toLowerCase().includes("atendimento") ||
    p.toLowerCase().includes("processo") ||
    p.toLowerCase().includes("andamento") ||
    p.toLowerCase().includes("documento") ||
    p.toLowerCase().includes("movimentac") ||
    p.toLowerCase().includes("historico") ||
    p.toLowerCase().includes("acompanhar") ||
    p.toLowerCase().includes("anexo")
  );
  log(`Endpoints relevantes (${relevantPaths.length}): ${relevantPaths.slice(0,3).join(" | ")}`);

  // Endpoints estáticos de fallback com padrão real do portal
  const staticDetailPaths = [
    `/api/Procon/Portais/Consumidores/Application/Atendimentos/Obter/ObterAtendimentoEndpoint/${id}`,
    `/api/Procon/Portais/Consumidores/Application/Atendimentos/ListarAndamentos/ListarAndamentosEndpoint?atendimentoId=${id}`,
    `/api/Procon/Portais/Consumidores/Application/Atendimentos/ListarAndamentos/ListarAndamentosEndpoint/${id}`,
    `/api/Procon/Portais/Consumidores/Application/Processos/Obter/ObterProcessoEndpoint/${id}`,
  ];

  const allDetailPaths = Array.from(new Set([...relevantPaths, ...staticDetailPaths]));

  const { token } = await discoverToken();
  let detailData: unknown = null;

  for (const path of allDetailPaths) {
    const authHeader = token ? `'Authorization': 'Bearer ' + ${JSON.stringify(token)},` : "";
    const r = await runJs<{ status: number; data: unknown } | null>(`
      (async function() {
        try {
          var res = await fetch(${JSON.stringify(PROCON_BASE + path)}, {
            headers: { ${authHeader} 'Accept': 'application/json' },
            credentials: 'include'
          });
          if (!res.ok) return { status: res.status, data: null };
          var data = await res.json();
          return { status: res.status, data: data };
        } catch(e) { return null; }
      })()`);

    if (!r || r.status !== 200 || !r.data) {
      if (r && r.status !== 200 && r.status !== 0)
        log(`detail fetch ${path.slice(0,60)} → ${r.status}`);
      continue;
    }

    log(`✅ detail fetch ${path.slice(0,80)} → 200`);
    detailData = r.data;
    onApiData(`${PROCON_BASE}/${id}/${path}`, r.data);

    // Diagnóstico: se ainda sem andamentos/docs, salva estrutura completa da resposta
    const existing = processMap.get(id);
    if (!existing?.acompanhamento?.length && !existing?.documentos?.length) {
      const keys = r.data && typeof r.data === "object" ? Object.keys(r.data as object) : [];
      log(`⚠️ Campos da resposta: ${keys.join(", ")}`);
      try {
        writeFileSync(
          join(app.getPath("desktop"), "procon-detail-debug.json"),
          JSON.stringify({ id, path, data: r.data }, null, 2)
        );
        log("📋 Detalhe salvo em ~/Desktop/procon-detail-debug.json");
      } catch { /* ok */ }
    }
    break;
  }

  // ── 4) DOM: texto da página e links de documentos ─────────────────────────
  const domData = await runJs<{
    text: string;
    sections: string[];
    docLinks: { href: string; text: string }[];
  }>(`(function() {
    var sections = [];
    document.querySelectorAll([
      'mat-tab-body','[role="tabpanel"]','mat-card','.mat-card',
      '[class*="andamento"]','[class*="acompanhamento"]','[class*="movimentacao"]',
      '[class*="historico"]','[class*="timeline"]'
    ].join(',')).forEach(function(el) {
      var t = el.innerText.trim();
      if (t.length > 20) sections.push(t.slice(0, 3000));
    });
    var docLinks = [];
    document.querySelectorAll(
      'a[href*="documento"],a[href*="anexo"],a[href*="arquivo"],a[download]'
    ).forEach(function(a) {
      docLinks.push({ href: a.href, text: a.innerText.trim() });
    });
    return {
      text: document.body ? document.body.innerText : '',
      sections: sections,
      docLinks: docLinks
    };
  })()`);

  const existing2 = processMap.get(id);
  if (existing2 && domData) {
    processMap.set(id, {
      ...existing2,
      pageText: domData.text ?? "",
      documentos: existing2.documentos.length > 0
        ? existing2.documentos
        : domData.docLinks.map(d => ({ nome: d.text || "documento", url: d.href })),
      acompanhamento: existing2.acompanhamento.length > 0
        ? existing2.acompanhamento
        : domData.sections,
    });
  } else if (!existing2 && domData) {
    upsertProcess(id, detailData, { pageText: domData.text ?? "" });
  }

  broadcastProcesses();
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("procon:show", async () => {
  if (!proconWin || proconWin.isDestroyed()) createProconWindow();
  else { proconWin.show(); proconWin.focus(); }
});

ipcMain.handle("procon:hide", async () => {
  proconWin?.hide();
});

ipcMain.handle("procon:open-list", async () => {
  if (!proconWin || proconWin.isDestroyed()) createProconWindow();
  proconWin!.show(); proconWin!.focus();
  proconWin!.loadURL(PROCON_LIST);
});

ipcMain.handle("procon:open-detail", async (_e, id: string) => {
  if (!proconWin || proconWin.isDestroyed()) createProconWindow();
  proconWin!.show(); proconWin!.focus();
  proconWin!.loadURL(PROCON_DETAIL(id));
});

ipcMain.handle("procon:devtools", async () => {
  if (!proconWin) return;
  // Detach CDP debugger antes de abrir DevTools — evita conflito de protocolo
  try { proconWin.webContents.debugger.detach(); } catch { /* já detachado */ }
  proconWin.webContents.openDevTools({ mode: "detach" });
  // Reattacha CDP quando DevTools fechar
  proconWin.webContents.once("devtools-closed", () => {
    try {
      proconWin!.webContents.debugger.attach("1.3");
      proconWin!.webContents.debugger.sendCommand("Network.enable");
    } catch { /* ok */ }
  });
});

// Diagnóstico completo — salva JSON no Desktop E envia ao dashboard
ipcMain.handle("procon:diagnose", async () => {
  log("Rodando diagnóstico completo...");
  const diag = await runDiagnostic();
  log("Diagnóstico concluído");

  // Salva no Desktop para acesso fácil independente da UI
  try {
    writeFileSync(DIAG_FILE, JSON.stringify(diag, null, 2), "utf-8");
    log(`📋 Diagnóstico salvo em: ${DIAG_FILE}`);
    shell.openPath(DIAG_FILE); // abre no editor padrão
  } catch (e: any) {
    log(`Erro ao salvar diagnóstico: ${e?.message}`);
  }

  emit("diagnose-result", diag);
  return diag;
});

ipcMain.handle("capture:all", async () => {
  if (captureRunning) return;
  captureRunning = true;
  processMap.clear(); // limpa captura anterior para evitar acúmulo de processos fantasma

  try {
    emit("capture-status", { running: true, step: "Verificando sessão..." });

    if (!proconWin || proconWin.isDestroyed()) {
      createProconWindow();
      await sleep(5000);
    }

    // Só recarrega se não estiver já na lista — evita perder sessão
    const currentUrl = proconWin!.webContents.getURL();
    if (!currentUrl.includes("procon.sp.gov.br") || currentUrl.includes("login")) {
      emit("capture-status", { running: true, step: "Navegando para lista de atendimentos..." });
      proconWin!.loadURL(PROCON_LIST);
      await sleep(5000);
    } else {
      log(`Já na página: ${currentUrl}`);
    }

    await checkAuthAndNotify();
    await extractProcessListFromDom();

    emit("capture-status", {
      running: true,
      step: `${processMap.size} processo(s) encontrado(s). Capturando detalhes...`,
    });

    const ids = Array.from(processMap.keys());
    if (ids.length === 0) {
      log("Lista vazia — use o botão Diagnóstico para investigar.");
      emit("capture-status", { running: false, step: "⚠️ Nenhum processo encontrado. Clique em 🔍 Diagnóstico." });
      return;
    }

    for (let i = 0; i < ids.length; i++) {
      emit("capture-status", {
        running: true,
        step: `[${i+1}/${ids.length}] Capturando ${ids[i].slice(0,8)}...`,
      });
      await captureProcessDetail(ids[i]);
    }

    emit("capture-status", { running: false, step: `✅ Concluído — ${processMap.size} processo(s)` });
    proconWin?.hide(); // esconde após captura completa — sessão mantida em background
  } finally {
    captureRunning = false;
  }
});

ipcMain.handle("capture:check-auth", async () => {
  await checkAuthAndNotify();
});

ipcMain.handle("export:save", async (_e, format: "json" | "csv") => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: join(app.getPath("downloads"),
      `procon-${new Date().toISOString().slice(0,10)}.${format}`),
    filters: format === "json"
      ? [{ name: "JSON", extensions: ["json"] }]
      : [{ name: "CSV",  extensions: ["csv"]  }],
  });
  if (!filePath) return { saved: false };
  const procs = Array.from(processMap.values());
  if (format === "json") {
    writeFileSync(filePath, JSON.stringify({ capturedAt: new Date().toISOString(), processes: procs }, null, 2));
  } else {
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g,'""')}"`;
    const rows = procs.map(p =>
      [p.id,p.protocolo,p.empresa,p.status,p.dataCriacao,p.dataAtualizacao,p.descricao].map(esc).join(",")
    );
    writeFileSync(filePath, ["id,protocolo,empresa,status,dataCriacao,dataAtualizacao,descricao",...rows].join("\n"));
  }
  shell.showItemInFolder(filePath);
  return { saved: true, filePath };
});

ipcMain.handle("document:download", async (_e, { url, nome }: { url: string; nome: string }) => {
  const { filePath } = await dialog.showSaveDialog({ defaultPath: join(app.getPath("downloads"), nome) });
  if (!filePath) return { saved: false };
  const ses = session.fromPartition("persist:procon");
  return new Promise(resolve => {
    ses.downloadURL(url);
    ses.once("will-download", (_ev, item) => {
      item.setSavePath(filePath);
      item.once("done", () => resolve({ saved: true, filePath }));
    });
  });
});

ipcMain.handle("data:get-processes", () => Array.from(processMap.values()));

ipcMain.handle("data:clear", () => {
  processMap.clear();
  try { writeFileSync(DATA_FILE, JSON.stringify({ savedAt: new Date().toISOString(), processes: [] }), "utf-8"); } catch { /* ok */ }
  broadcastProcesses();
  log("🗑 Dados locais apagados");
});

ipcMain.handle("shell:open", (_e, url: string) => shell.openExternal(url));

ipcMain.handle("log:save", async (_e, text: string) => {
  const filePath = join(app.getPath("desktop"), `procon-log-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`);
  writeFileSync(filePath, text, "utf-8");
  shell.showItemInFolder(filePath);
  return { saved: true, filePath };
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  loadData();          // carrega dados persistidos antes de abrir janelas
  createDashboard();
  createProconWindow();

  // Após o dashboard carregar: emite log de startup e reenvia processos salvos
  dashboardWin!.webContents.once("did-finish-load", () => {
    if (processMap.size > 0) {
      log(`📂 ${processMap.size} processo(s) carregados do disco`);
      broadcastProcesses();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) { createDashboard(); createProconWindow(); }
  });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
