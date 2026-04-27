const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const playlistState = {
  sourceType: "playlist",
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
  safeMode: true,
  hideViewer: false,
  hideSubscriber: false,
  hideVip: false,
  hideMod: false,
  dedupeWindowSec: 20,
  fadeSec: 0,
  blockedWords: "",
  hideLinks: false,
  minLength: 1,
  maxLength: 280,
  animation: "none"
};

const gameState = {
  game: "cs2",
  provider: "faceit",
  nickname: "",
  position: "left",
  theme: "dark",
  stylePreset: "neon-blue",
  displayMode: "full",
  autoRefreshSec: 30,
  stats: {
    elo: 0,
    level: 0,
    matches: 0,
    winRate: 0,
    kd: 0,
    avg: 0,
    hs: 0,
    wins: 0,
    losses: 0
  },
  updatedAt: 0,
  status: "idle",
  error: ""
};

const appState = {
  username: "",
  email: "",
  passwordHash: "",
  language: "ru",
  githubRepo: "Skirf34/liveframe"
};

const runtimeState = {
  streamMode: "idle",
  emergencyBlank: false,
  streamStartedAt: 0,
  pausedAt: 0,
  pausedTotalMs: 0,
  activity: {
    chatMessagesTotal: 0,
    chatMessagesPerMin: 0,
    faceitRefreshCount: 0
  },
  scenes: {
    gameplay: { tab: "games" },
    chatting: { tab: "chat" },
    starting: { tab: "music" }
  },
  health: {
    socket: "ok",
    youtube: "unknown",
    twitch: "unknown",
    faceit: "unknown"
  }
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
    if (parsed.game && typeof parsed.game === "object") {
      Object.assign(gameState, sanitizeGamePatch(parsed.game));
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
    game: publicGameState(),
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
    language: appState.language,
    githubRepo: appState.githubRepo
  };
}

function publicGameState() {
  return {
    game: gameState.game,
    provider: gameState.provider,
    nickname: gameState.nickname,
    position: gameState.position,
    theme: gameState.theme,
    stylePreset: gameState.stylePreset,
    displayMode: gameState.displayMode,
    autoRefreshSec: gameState.autoRefreshSec,
    stats: { ...gameState.stats },
    updatedAt: gameState.updatedAt,
    status: gameState.status,
    error: gameState.error
  };
}

function publicRuntimeState() {
  return {
    streamMode: runtimeState.streamMode,
    emergencyBlank: runtimeState.emergencyBlank,
    streamStartedAt: runtimeState.streamStartedAt,
    pausedAt: runtimeState.pausedAt,
    pausedTotalMs: runtimeState.pausedTotalMs,
    activity: { ...runtimeState.activity },
    scenes: { ...runtimeState.scenes },
    health: { ...runtimeState.health }
  };
}

function sanitizePlaylistPatch(payload = {}) {
  const next = {};
  if (payload.sourceType === "playlist" || payload.sourceType === "video") {
    next.sourceType = payload.sourceType;
  }
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
  if (typeof payload.safeMode === "boolean") {
    next.safeMode = payload.safeMode;
  }
  if (typeof payload.hideViewer === "boolean") next.hideViewer = payload.hideViewer;
  if (typeof payload.hideSubscriber === "boolean") next.hideSubscriber = payload.hideSubscriber;
  if (typeof payload.hideVip === "boolean") next.hideVip = payload.hideVip;
  if (typeof payload.hideMod === "boolean") next.hideMod = payload.hideMod;
  if (Number.isFinite(Number(payload.dedupeWindowSec))) {
    next.dedupeWindowSec = Math.max(0, Math.min(120, Number(payload.dedupeWindowSec)));
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

function sanitizeGamePatch(payload = {}) {
  const next = {};
  if (payload.game === "cs2") next.game = "cs2";
  if (payload.provider === "faceit") next.provider = payload.provider;
  if (typeof payload.nickname === "string") {
    next.nickname = payload.nickname.trim().slice(0, 40);
  }
  if (payload.position === "left" || payload.position === "right") {
    next.position = payload.position;
  }
  if (payload.theme === "dark" || payload.theme === "light" || payload.theme === "glass") {
    next.theme = payload.theme;
  }
  if (typeof payload.stylePreset === "string") {
    const allowedPresets = new Set([
      "neon-blue", "neon-purple", "cyber-green", "fire-red",
      "sunset", "ice", "gold", "pink",
      "obsidian", "mint", "royal", "mono"
    ]);
    if (allowedPresets.has(payload.stylePreset)) next.stylePreset = payload.stylePreset;
  }
  if (payload.displayMode === "full" || payload.displayMode === "elo-only" || payload.displayMode === "elo-kd-avg" || payload.displayMode === "wl-only") {
    next.displayMode = payload.displayMode;
  }
  if (Number.isFinite(Number(payload.autoRefreshSec))) {
    next.autoRefreshSec = Math.max(10, Math.min(300, Math.floor(Number(payload.autoRefreshSec))));
  }
  if (payload.stats && typeof payload.stats === "object") {
    const stats = {};
    if (Number.isFinite(Number(payload.stats.elo))) stats.elo = Math.max(0, Math.floor(Number(payload.stats.elo)));
    if (Number.isFinite(Number(payload.stats.level))) stats.level = Math.max(0, Math.floor(Number(payload.stats.level)));
    if (Number.isFinite(Number(payload.stats.matches))) stats.matches = Math.max(0, Math.floor(Number(payload.stats.matches)));
    if (Number.isFinite(Number(payload.stats.winRate))) stats.winRate = Math.max(0, Math.min(100, Number(payload.stats.winRate)));
    if (Number.isFinite(Number(payload.stats.kd))) stats.kd = Math.max(0, Number(payload.stats.kd));
    if (Number.isFinite(Number(payload.stats.avg))) stats.avg = Math.max(0, Number(payload.stats.avg));
    if (Number.isFinite(Number(payload.stats.hs))) stats.hs = Math.max(0, Math.min(100, Number(payload.stats.hs)));
    if (Number.isFinite(Number(payload.stats.wins))) stats.wins = Math.max(0, Math.floor(Number(payload.stats.wins)));
    if (Number.isFinite(Number(payload.stats.losses))) stats.losses = Math.max(0, Math.floor(Number(payload.stats.losses)));
    next.stats = { ...gameState.stats, ...stats };
  }
  if (Number.isFinite(Number(payload.updatedAt))) next.updatedAt = Number(payload.updatedAt);
  if (payload.status === "idle" || payload.status === "loading" || payload.status === "ready" || payload.status === "error") {
    next.status = payload.status;
  }
  if (typeof payload.error === "string") next.error = payload.error.slice(0, 200);
  return next;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLifetimeStat(lifetime = {}, keys = []) {
  for (const key of keys) {
    if (lifetime[key] !== undefined && lifetime[key] !== null && lifetime[key] !== "") {
      return lifetime[key];
    }
  }
  return 0;
}

function parseFaceitLifetime(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const matches = toNumber(getLifetimeStat(source, ["Matches", "matches"]));
  const wins = toNumber(getLifetimeStat(source, ["Wins", "wins"]));
  const losses = matches > wins ? matches - wins : toNumber(getLifetimeStat(source, ["Losses", "losses"]));
  return {
    matches: Math.floor(matches),
    wins: Math.floor(wins),
    losses: Math.floor(losses),
    winRate: toNumber(getLifetimeStat(source, ["Win Rate %", "Win Rate", "win_rate"])),
    kd: toNumber(getLifetimeStat(source, ["Average K/D Ratio", "K/D Ratio", "kd_ratio"])),
    avg: toNumber(getLifetimeStat(source, ["Average Kills", "Average Kills per Round", "Average KR", "avg_kills"])),
    hs: toNumber(getLifetimeStat(source, ["Average Headshots %", "Headshots %", "headshots"]))
  };
}

function extractFaceitNickname(input = "") {
  const value = String(input || "").trim();
  if (!value) return "";
  // Accept full Faceit URLs like https://www.faceit.com/ru/players/SomeNick
  const match = value.match(/faceit\.com\/(?:[a-z]{2}\/)?players\/([^/?#]+)/i);
  if (match && match[1]) return decodeURIComponent(match[1]).trim();
  return value.replace(/^#/, "").trim();
}

async function fetchFaceitCs2Stats(nickname) {
  const nick = extractFaceitNickname(nickname);
  if (!nick) throw new Error("Укажи Faceit nickname.");

  // Public nickname endpoint works without API key.
  const profileRes = await fetch(`https://www.faceit.com/api/users/v1/nicknames/${encodeURIComponent(nick)}`, {
    headers: { "user-agent": "Mozilla/5.0", "accept": "application/json" }
  });
  if (!profileRes.ok) {
    if (profileRes.status === 404) throw new Error("Игрок Faceit не найден.");
    throw new Error(`Faceit profile error (${profileRes.status}).`);
  }
  const profilePayload = await profileRes.json();
  const profile = profilePayload && profilePayload.payload ? profilePayload.payload : {};
  const cs2Meta = profile.games && profile.games.cs2 ? profile.games.cs2 : {};

  // Stats endpoints are often Cloudflare-protected. Try them, but keep graceful fallback.
  let lifetime = {};
  const playerId = profile.id || "";
  if (playerId) {
    const statsRes = await fetch(`https://www.faceit.com/api/stats/v1/stats/users/${encodeURIComponent(playerId)}/games/cs2`, {
      headers: { "user-agent": "Mozilla/5.0", "accept": "application/json", "referer": `https://www.faceit.com/ru/players/${encodeURIComponent(nick)}` }
    });
    if (statsRes.ok) {
      const statsPayload = await statsRes.json();
      lifetime = statsPayload && statsPayload.lifetime ? statsPayload.lifetime : {};
    }
  }
  const parsedLifetime = parseFaceitLifetime(lifetime);

  return {
    elo: Math.floor(toNumber(cs2Meta.faceit_elo || cs2Meta.elo)),
    level: Math.floor(toNumber(cs2Meta.skill_level || cs2Meta.level)),
    matches: parsedLifetime.matches,
    winRate: parsedLifetime.winRate,
    kd: parsedLifetime.kd,
    avg: parsedLifetime.avg,
    hs: parsedLifetime.hs,
    wins: parsedLifetime.wins,
    losses: parsedLifetime.losses
  };
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
    if (typeof payload.githubRepo === "string") appState.githubRepo = payload.githubRepo.trim().slice(0, 120);
    saveAllSettings();
    res.json({ ok: true, app: publicAppState() });
  });

  app.get("/api/runtime", (_req, res) => {
    res.json(publicRuntimeState());
  });

  io.on("connection", (socket) => {
    socket.emit("playlist:state", publicPlaylistState());
    socket.emit("chat:state", publicChatState());
    socket.emit("game:state", publicGameState());
    socket.emit("runtime:state", publicRuntimeState());

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

    socket.on("playlist:now-playing", (payload = {}) => {
      const title = typeof payload.title === "string" ? payload.title.slice(0, 140) : "";
      if (!title) return;
      io.emit("chat:now-playing", { title, ts: Date.now() });
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

    socket.on("chat:ingest", () => {
      runtimeState.activity.chatMessagesTotal += 1;
      io.emit("runtime:state", publicRuntimeState());
    });

    socket.on("game:configure", (payload) => {
      const patch = sanitizeGamePatch(payload);
      Object.assign(gameState, patch);
      saveAllSettings();
      io.emit("game:state", publicGameState());
    });

    socket.on("game:refresh", async (payload = {}) => {
      const provider = "faceit";
      const game = payload.game === "cs2" ? "cs2" : gameState.game;
      const nickname = typeof payload.nickname === "string" ? extractFaceitNickname(payload.nickname) : gameState.nickname;
      Object.assign(gameState, sanitizeGamePatch({ provider, game, nickname, status: "loading", error: "" }));
      io.emit("game:state", publicGameState());

      try {
        if (game !== "cs2") {
          throw new Error("Сейчас поддерживается только CS2.");
        }
        const stats = await fetchFaceitCs2Stats(nickname);
        runtimeState.activity.faceitRefreshCount += 1;
        runtimeState.health.faceit = "ok";
        Object.assign(gameState, sanitizeGamePatch({
          stats,
          status: "ready",
          error: "",
          updatedAt: Date.now()
        }));
        saveAllSettings();
        io.emit("game:state", publicGameState());
      } catch (error) {
        runtimeState.health.faceit = "error";
        Object.assign(gameState, sanitizeGamePatch({
          status: "error",
          error: error && error.message ? error.message : "Не удалось загрузить статистику."
        }));
        io.emit("game:state", publicGameState());
        io.emit("runtime:state", publicRuntimeState());
      }
    });

    socket.on("runtime:set-health", (payload = {}) => {
      const allowed = new Set(["youtube", "twitch", "faceit"]);
      if (!allowed.has(payload.key)) return;
      if (!["ok", "warn", "error", "unknown"].includes(payload.value)) return;
      runtimeState.health[payload.key] = payload.value;
      io.emit("runtime:state", publicRuntimeState());
    });

    socket.on("runtime:stream-action", (payload = {}) => {
      const action = String(payload.action || "");
      if (action === "go-live") {
        runtimeState.streamMode = "live";
        runtimeState.emergencyBlank = false;
        runtimeState.streamStartedAt = Date.now();
        runtimeState.pausedAt = 0;
        runtimeState.pausedTotalMs = 0;
      } else if (action === "pause") {
        runtimeState.streamMode = "paused";
        if (!runtimeState.pausedAt) runtimeState.pausedAt = Date.now();
      } else if (action === "resume") {
        if (runtimeState.pausedAt) {
          runtimeState.pausedTotalMs += Date.now() - runtimeState.pausedAt;
        }
        runtimeState.pausedAt = 0;
        runtimeState.streamMode = "live";
      } else if (action === "end-stream") {
        runtimeState.streamMode = "idle";
        runtimeState.streamStartedAt = 0;
        runtimeState.pausedAt = 0;
        runtimeState.pausedTotalMs = 0;
      } else if (action === "emergency-on") {
        runtimeState.emergencyBlank = true;
      } else if (action === "emergency-off") {
        runtimeState.emergencyBlank = false;
      }
      io.emit("runtime:state", publicRuntimeState());
      io.emit("runtime:emergency", { emergencyBlank: runtimeState.emergencyBlank });
    });

    socket.on("runtime:set-scenes", (payload = {}) => {
      if (!payload || typeof payload !== "object") return;
      const next = {};
      for (const key of ["gameplay", "chatting", "starting"]) {
        const item = payload[key];
        if (!item || typeof item !== "object") continue;
        const tab = ["music", "chat", "games"].includes(item.tab) ? item.tab : runtimeState.scenes[key]?.tab || "music";
        next[key] = { tab };
      }
      runtimeState.scenes = { ...runtimeState.scenes, ...next };
      io.emit("runtime:state", publicRuntimeState());
    });
  });

  setInterval(() => {
    const total = runtimeState.activity.chatMessagesTotal;
    const prev = runtimeState.activity._lastTotal || 0;
    runtimeState.activity.chatMessagesPerMin = Math.max(0, total - prev);
    runtimeState.activity._lastTotal = total;
    io.emit("runtime:state", publicRuntimeState());
  }, 60000);

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
      console.log(`Games panel: http://localhost:${port}/game-control.html`);
      console.log(`Games overlay: http://localhost:${port}/game-overlay.html`);
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
