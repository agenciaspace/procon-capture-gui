/**
 * preload.ts — Bridge segura entre o processo principal e o renderer
 * Expõe via contextBridge apenas as funções necessárias.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("procon", {
  // Navegação
  openList:     ()           => ipcRenderer.invoke("procon:open-list"),
  openDetail:   (id: string) => ipcRenderer.invoke("procon:open-detail", id),
  showBrowser:  ()           => ipcRenderer.invoke("procon:show"),
  hideBrowser:  ()           => ipcRenderer.invoke("procon:hide"),

  // Captura
  captureAll:   ()           => ipcRenderer.invoke("capture:all"),
  getProcesses: ()           => ipcRenderer.invoke("data:get-processes"),
  checkAuth:    ()           => ipcRenderer.invoke("capture:check-auth"),

  // Diagnóstico
  diagnose:     ()           => ipcRenderer.invoke("procon:diagnose"),

  // Export
  exportJson:   ()           => ipcRenderer.invoke("export:save", "json"),
  exportCsv:    ()           => ipcRenderer.invoke("export:save", "csv"),

  // Documentos
  downloadDoc:  (url: string, nome: string) =>
    ipcRenderer.invoke("document:download", { url, nome }),

  // Links externos
  openUrl:      (url: string) => ipcRenderer.invoke("shell:open", url),

  // DevTools
  devTools:     ()           => ipcRenderer.invoke("procon:devtools"),

  // Log
  saveLog:      (text: string) => ipcRenderer.invoke("log:save", text),

  // Dados
  clearData:    ()             => ipcRenderer.invoke("data:clear"),

  // Eventos main → renderer
  onAuthStatus:      (cb: (v: { loggedIn: boolean; url: string; tokenLen?: number }) => void) =>
    ipcRenderer.on("auth-status", (_e, v) => cb(v)),
  onProcessesUpdated:(cb: (v: { processes: unknown[] }) => void) =>
    ipcRenderer.on("processes-updated", (_e, v) => cb(v)),
  onCaptureStatus:   (cb: (v: { running: boolean; step: string }) => void) =>
    ipcRenderer.on("capture-status", (_e, v) => cb(v)),
  onApiCaptured:     (cb: (v: { path: string; status: number }) => void) =>
    ipcRenderer.on("api-captured", (_e, v) => cb(v)),
  onLog:             (cb: (msg: string) => void) =>
    ipcRenderer.on("log", (_e, msg) => cb(msg)),
  onDiagnoseResult:  (cb: (v: object) => void) =>
    ipcRenderer.on("diagnose-result", (_e, v) => cb(v)),
});
