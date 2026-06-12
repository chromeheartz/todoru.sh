import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import * as fs from "fs";

const WIN_WIDTH = 380;
const WIN_HEIGHT = 280;
const MARGIN = 16;

let win: BrowserWindow | null = null;

function dataFilePath(): string {
  return path.join(app.getPath("userData"), "todos.json");
}

function loadTodos(): Todo[] {
  try {
    const raw = fs.readFileSync(dataFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: Todo[]): boolean {
  try {
    fs.writeFileSync(dataFilePath(), JSON.stringify(todos, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Failed to save todos:", err);
    return false;
  }
}

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WIN_WIDTH - MARGIN;
  const y = workArea.y + MARGIN;

  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- IPC ----
ipcMain.handle("todos:load", () => loadTodos());
ipcMain.handle("todos:save", (_e, todos: Todo[]) => saveTodos(todos));
ipcMain.on("window:close", () => win?.close());
ipcMain.on("window:minimize", () => win?.minimize());
