const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flickctx", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (partial) => ipcRenderer.invoke("config:set", partial),
  mark: () => ipcRenderer.send("app:mark"),
  cancelOverlay: () => ipcRenderer.send("overlay:cancel"),
  completeOverlay: (rect) => ipcRenderer.send("overlay:complete", rect),
  askAboutMark: (payload) => ipcRenderer.send("result:ask", payload),
  clearChat: () => ipcRenderer.send("result:clear-chat"),
  closeResult: () => ipcRenderer.send("result:close"),
  copyText: (text) => ipcRenderer.send("result:copy", text),
  openConfig: () => ipcRenderer.send("result:open-config"),
  onOverlayReset: (cb) => {
    ipcRenderer.on("overlay:reset", () => cb());
  },
  onResultReadyAsk: (cb) => {
    ipcRenderer.on("result:ready-ask", (_e, data) => cb(data));
  },
  onResultLoading: (cb) => {
    ipcRenderer.on("result:loading", (_e, data) => cb(data));
  },
  onResultDone: (cb) => {
    ipcRenderer.on("result:done", (_e, data) => cb(data));
  },
  onResultError: (cb) => {
    ipcRenderer.on("result:error", (_e, data) => cb(data));
  },
  dismissHighlights: () => ipcRenderer.send("highlight:dismiss"),
  showHighlightsAgain: () => ipcRenderer.send("highlight:reshow"),
  onHighlightShow: (cb) => {
    ipcRenderer.on("highlight:show", (_e, data) => cb(data));
  },
  onHighlightClear: (cb) => {
    ipcRenderer.on("highlight:clear", () => cb());
  },
});
