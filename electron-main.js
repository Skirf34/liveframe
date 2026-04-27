const { app, BrowserWindow, shell } = require("electron");
const { startMusicServer } = require("./server");
const fs = require("fs");
const path = require("path");

let mainWindow = null;
let httpServer = null;
const APP_PORT = 3210;
const WINDOW_STATE_PATH = path.join(app.getPath("userData"), "window-state.json");

function readWindowState() {
  try {
    const raw = fs.readFileSync(WINDOW_STATE_PATH, "utf8");
    const s = JSON.parse(raw);
    return {
      width: Number(s.width) || 1200,
      height: Number(s.height) || 800,
      x: Number.isFinite(Number(s.x)) ? Number(s.x) : undefined,
      y: Number.isFinite(Number(s.y)) ? Number(s.y) : undefined
    };
  } catch {
    return { width: 1200, height: 800 };
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(WINDOW_STATE_PATH, JSON.stringify(bounds, null, 2), "utf8");
  } catch {}
}

async function createWindow() {
  httpServer = await startMusicServer(APP_PORT);
  const state = readWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadURL(`http://localhost:${APP_PORT}/`);

  // Open external URLs in default browser, not inside app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("resize", () => saveWindowState(mainWindow));
  mainWindow.on("move", () => saveWindowState(mainWindow));
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Failed to launch desktop app:", error);
  app.quit();
});

app.setLoginItemSettings({ openAtLogin: true });

app.on("window-all-closed", () => {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
