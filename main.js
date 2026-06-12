const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");

const WIN_WIDTH = 380;
const WIN_HEIGHT = 280;
const MARGIN = 16;

let win = null;

function dataFilePath() {
  return path.join(app.getPath("userData"), "todos.json");
}

function loadTodos() {
  try {
    const raw = fs.readFileSync(dataFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  try {
    fs.writeFileSync(dataFilePath(), JSON.stringify(todos, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Failed to save todos:", err);
    return false;
  }
}

function createWindow() {
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
ipcMain.handle("todos:save", (_e, todos) => saveTodos(todos));
ipcMain.on("window:close", () => win && win.close());
ipcMain.on("window:minimize", () => win && win.minimize());
