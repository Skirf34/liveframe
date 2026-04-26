const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const playlistState = {
  list: "",
  volume: 40,
  shuffle: true,
  mode: "full",
  position: "bottom",
  theme: "blue",
  opacity: 75,
  showMeta: true,
  showNotice: false,
  autoHideSec: 0,
  compactBadge: false,
  visualPreset: "pro"
};

const chatState = {
  channel: "",
  maxMessages: 8,
  position: "right",
  theme: "dark",
  fontScale: 100,
  showTime: true,
  hideCommands: false,
  fadeSec: 0,
  blockedWords: "",
  hideLinks: false,
  minLength: 1,
  maxLength: 280,
  animation: "none"
};

const appState = {
  username: "",
  email: "",
  passwordHash: "",
  language: "ru"
};

const settingsFilePath = path.join(process.cwd(), "liveframe-settings.json");
const legacySettingsFilePath = path.join(process.cwd(), "streamer-settings.json");

function readSavedSettings() {
  try {
    const sourcePath = fs.existsSync(settingsFilePath)
      ? settingsFilePath
      : fs.existsSync(legacySettingsFilePath)
        ? legacySettingsFilePath
        : null;
    if (!sourcePath) return;
    const raw = fs.readFileSync(sourcePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.playlist && typeof parsed.playlist === "object") {
      Object.assign(playlistState, sanitizePlaylistPatch(parsed.playlist));
    }
    if (parsed.chat && typeof parsed.chat === "object") {
      Object.assign(chatState, sanitizeChatPatch(parsed.chat));
    }
    if (parsed.app && typeof parsed.app === "object") {
      if (typeof parsed.app.username === "string") appState.username = parsed.app.username.slice(0, 60);
      if (typeof parsed.app.email === "string") appState.email = parsed.app.email.slice(0, 120);
      if (typeof parsed.app.passwordHash === "string") appState.passwordHash = parsed.app.passwordHash.slice(0, 500);
      if (parsed.app.language === "en" || parsed.app.language === "ru") appState.language = parsed.app.language;
    }
  } catch {
    // Ignore broken file, app will continue with defaults.
  }
}

function saveAllSettings() {
  const payload = {
    playlist: publicPlaylistState(),
    chat: publicChatState(),
    app: { ...appState }
  };
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Persistence is best-effort for desktop mode.
  }
}

function publicPlaylistState() {
  return { ...playlistState };
}

function publicChatState() {
  return { ...chatState };
}

function publicAppState() {
  return {
    username: appState.username,
    email: appState.email,
    language: appState.language
  };
}

function sanitizePlaylistPatch(payload = {}) {
  const next = {};
  if (typeof payload.list === "string") {
    next.list = payload.list.trim();
  }
  if (Number.isFinite(Number(payload.volume))) {
    next.volume = Math.max(0, Math.min(100, Number(payload.volume)));
  }
  if (typeof payload.shuffle === "boolean") {
    next.shuffle = payload.shuffle;
  }
  if (payload.mode === "full" || payload.mode === "minimal") {
    next.mode = payload.mode;
  }
  if (payload.position === "top" || payload.position === "bottom") {
    next.position = payload.position;
  }
  if (["blue", "purple", "green", "red"].includes(payload.theme)) {
    next.theme = payload.theme;
  }
  if (Number.isFinite(Number(payload.opacity))) {
    next.opacity = Math.max(20, Math.min(95, Number(payload.opacity)));
  }
  if (typeof payload.showMeta === "boolean") {
    next.showMeta = payload.showMeta;
  }
  if (typeof payload.showNotice === "boolean") {
    next.showNotice = payload.showNotice;
  }
  if (Number.isFinite(Number(payload.autoHideSec))) {
    next.autoHideSec = Math.max(0, Math.min(30, Number(payload.autoHideSec)));
  }
  if (typeof payload.compactBadge === "boolean") {
    next.compactBadge = payload.compactBadge;
  }
  if (payload.visualPreset === "pro" || payload.visualPreset === "clean") {
    next.visualPreset = payload.visualPreset;
  }
  return next;
}

function sanitizeChatPatch(payload = {}) {
  const next = {};
  if (typeof payload.channel === "string") {
    next.channel = payload.channel.trim().replace(/^#/, "").toLowerCase();
  }
  if (Number.isFinite(Number(payload.maxMessages))) {
    next.maxMessages = Math.max(3, Math.min(25, Number(payload.maxMessages)));
  }
  if (payload.position === "left" || payload.position === "right") {
    next.position = payload.position;
  }
  if (["dark", "glass", "light"].includes(payload.theme)) {
    next.theme = payload.theme;
  }
  if (Number.isFinite(Number(payload.fontScale))) {
    next.fontScale = Math.max(80, Math.min(180, Number(payload.fontScale)));
  }
  if (typeof payload.showTime === "boolean") {
    next.showTime = payload.showTime;
  }
  if (typeof payload.hideCommands === "boolean") {
    next.hideCommands = payload.hideCommands;
  }
  if (Number.isFinite(Number(payload.fadeSec))) {
    next.fadeSec = Math.max(0, Math.min(120, Number(payload.fadeSec)));
  }
  if (typeof payload.blockedWords === "string") {
    next.blockedWords = payload.blockedWords.slice(0, 500);
  }
  if (typeof payload.hideLinks === "boolean") {
    next.hideLinks = payload.hideLinks;
  }
  if (Number.isFinite(Number(payload.minLength))) {
    next.minLength = Math.max(1, Math.min(120, Number(payload.minLength)));
  }
  if (Number.isFinite(Number(payload.maxLength))) {
    next.maxLength = Math.max(10, Math.min(500, Number(payload.maxLength)));
  }
  if (["rise", "slide", "pop", "none"].includes(payload.animation)) {
    next.animation = payload.animation;
  }
  if (Number.isFinite(next.minLength) && Number.isFinite(next.maxLength) && next.minLength > next.maxLength) {
    const tmp = next.minLength;
    next.minLength = next.maxLength;
    next.maxLength = tmp;
  }
  return next;
}

function createMusicServer() {
  readSavedSettings();
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const publicDir = path.join(__dirname, "public");

  app.use(express.json({ limit: "200kb" }));
  app.use(express.static(publicDir));

  app.get("/api/app-settings", (_req, res) => {
    res.json(publicAppState());
  });

  app.post("/api/app-settings", (req, res) => {
    const payload = req.body || {};
    if (typeof payload.username === "string") appState.username = payload.username.trim().slice(0, 60);
    if (typeof payload.email === "string") appState.email = payload.email.trim().slice(0, 120);
    if (typeof payload.passwordHash === "string") appState.passwordHash = payload.passwordHash.slice(0, 500);
    if (payload.language === "en" || payload.language === "ru") appState.language = payload.language;
    saveAllSettings();
    res.json({ ok: true, app: publicAppState() });
  });

  io.on("connection", (socket) => {
    socket.emit("playlist:state", publicPlaylistState());
    socket.emit("chat:state", publicChatState());

    socket.on("playlist:configure", (payload) => {
      const patch = sanitizePlaylistPatch(payload);
      Object.assign(playlistState, patch);
      saveAllSettings();
      io.emit("playlist:state", publicPlaylistState());
    });

    socket.on("playlist:command", (payload = {}) => {
      if (typeof payload.type !== "string") return;
      const allowed = new Set(["togglePlay", "next", "prev", "volumeUp", "volumeDown", "forceShow"]);
      if (!allowed.has(payload.type)) return;
      io.emit("playlist:command", { type: payload.type });
    });

    socket.on("chat:configure", (payload) => {
      const patch = sanitizeChatPatch(payload);
      Object.assign(chatState, patch);
      saveAllSettings();
      io.emit("chat:state", publicChatState());
    });

    socket.on("chat:test-message", (payload = {}) => {
      const user = typeof payload.user === "string" && payload.user.trim() ? payload.user.trim().slice(0, 30) : "viewer";
      const text = typeof payload.text === "string" && payload.text.trim() ? payload.text.trim().slice(0, 300) : "Тестовое сообщение";
      io.emit("chat:message", {
        user,
        text,
        color: "#a78bfa",
        ts: Date.now(),
        source: "test"
      });
    });
  });

  return { app, server, io };
}

function startMusicServer(port = process.env.PORT || 3000) {
  const { server } = createMusicServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      console.log(`Music app running on http://localhost:${port}`);
      console.log(`Control panel: http://localhost:${port}/playlist-control.html`);
      console.log(`OBS overlay: http://localhost:${port}/playlist-overlay.html`);
      console.log(`Chat panel: http://localhost:${port}/chat-control.html`);
      console.log(`Chat overlay: http://localhost:${port}/chat-overlay.html`);
      resolve(server);
    });
  });
}

module.exports = {
  createMusicServer,
  startMusicServer
};

if (require.main === module) {
  startMusicServer().catch((error) => {
    console.error("Failed to start music server:", error);
    process.exit(1);
  });
}
