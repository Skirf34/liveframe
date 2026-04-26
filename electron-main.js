const { app, BrowserWindow, shell } = require("electron");
const { startMusicServer } = require("./server");

let mainWindow = null;
let httpServer = null;
const APP_PORT = 3210;

async function createWindow() {
  httpServer = await startMusicServer(APP_PORT);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
}

app.whenReady().then(createWindow).catch((error) => {
  console.error("Failed to launch desktop app:", error);
  app.quit();
});

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
