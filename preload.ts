import { contextBridge, ipcRenderer } from "electron";

const api: TodoApi = {
  loadTodos: () => ipcRenderer.invoke("todos:load"),
  saveTodos: (todos) => ipcRenderer.invoke("todos:save", todos),
  closeWindow: () => ipcRenderer.send("window:close"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
};

contextBridge.exposeInMainWorld("api", api);
