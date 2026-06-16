import { contextBridge, ipcRenderer } from "electron";

const api: TodoApi = {
  loadTodos: () => ipcRenderer.invoke("todos:load"),
  saveTodos: (todos) => ipcRenderer.invoke("todos:save", todos),
  closeWindow: () => ipcRenderer.send("window:close"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  setPin: (enabled) => ipcRenderer.send("window:setPin", enabled),
};

contextBridge.exposeInMainWorld("api", api);
