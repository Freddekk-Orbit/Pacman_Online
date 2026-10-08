import { MAZE } from "../shared/maze.ts";
import type { ServerMsg } from "../shared/protocol.ts";
import { createGameState, step } from "../shared/simulation.ts";
import type {
  AssignmentMode,
  Dir,
  GameState,
  LobbyPlayer,
  MatchSettings,
  Role,
} from "../shared/types.ts";
import { DEFAULT_MATCH } from "../shared/types.ts";
import { audio } from "./audio.ts";
import { Input, isTypingTarget } from "./input.ts";
import { Net, defaultHost } from "./net.ts";
import { VIEW_H, VIEW_W, renderFrame } from "./render.ts";
import {
  PALETTES,
  activePalette,
  applyTheme,
  loadSettings,
  saveSettings,
  type LocalSettings,
} from "./settings.ts";

type Screen = "title" | "settings" | "host" | "join" | "world" | "lobby" | "game";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const input = new Input();
const net = new Net();
let local = loadSettings();
let screen: Screen = "title";
let playerId = "";
let isHost = false;
let roomCode = "";
let joinHints: string[] = [];
let joinUrl = "";
let inviteUrl = "";
let roomListed = true;
let lobbyPlayers: LobbyPlayer[] = [];
let match: MatchSettings = { ...DEFAULT_MATCH };
let mode: "solo" | "online" = "solo";
let state: GameState | null = null;
let lastPellets = 0;
let lastLives = 3;
let lastFright = false;
let lastGhostsEaten = 0;
let lastStatus: GameState["status"] = "waiting";
let raf = 0;
let lastTs = 0;
let titleIndex = 0;

function show(next: Screen): void {
  screen = next;
  for (const id of ["title", "settings", "host", "join", "world", "lobby", "game"]) {
    $("screen-" + id).classList.toggle("hidden", id !== next);
  }
  $("status-line").textContent =
    next === "title"
      ? "WORLDWIDE CABINET · SHARE A CODE WITH ANYONE"
      : next === "lobby"
        ? `ROOM ${roomCode} · SEND THE INVITE LINK`
        : next === "game"
          ? "ARROWS / WASD TO MOVE"
          : next === "settings"
            ? "PALETTES · SCANLINES · YOUR NAME"
            : next === "host"
              ? "OPEN A ROOM FRIENDS CAN JOIN FROM ANYWHERE"
              : next === "world"
                ? "PUBLIC ROOMS ON THIS SERVER"
                : "ENTER A ROOM CODE TO JOIN FROM ANYWHERE";
}

function fillSettingsForm(): void {
  ($("set-name") as HTMLInputElement).value = local.name;
  const sel = $("set-palette") as HTMLSelectElement;
  sel.innerHTML = PALETTES.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  sel.value = local.graphics.paletteId;
  ($("set-scan") as HTMLInputElement).checked = local.graphics.scanlines;
  ($("set-glow") as HTMLInputElement).checked = local.graphics.crtGlow;
  ($("set-shake") as HTMLInputElement).checked = local.graphics.shake;
  ($("set-scale") as HTMLSelectElement).value = String(local.graphics.pixelScale);
  ($("set-wall") as HTMLInputElement).value = activePalette(local).wall;
  ($("set-pac") as HTMLInputElement).value = activePalette(local).pac;
  ($("set-sfx") as HTMLInputElement).value = String(Math.round(local.sfx * 100));
  ($("set-music") as HTMLInputElement).value = String(Math.round(local.music * 100));
  paintSwatches();
}

function paintSwatches(): void {
  const p = activePalette(local);
  $("swatches").innerHTML = ["wall", "pac", "blinky", "pinky", "inky", "clyde", "pellet"]
    .map((k) => `<span class="swatch" title="${k}" style="background:${p[k as keyof typeof p]}"></span>`)
    .join("");
}

function readSettingsForm(): void {
  local.name = ($("set-name") as HTMLInputElement).value.trim() || "PLAYER";
  const paletteId = ($("set-palette") as HTMLSelectElement).value;
  const paletteChanged = paletteId !== local.graphics.paletteId;
  local.graphics.paletteId = paletteId;
  local.graphics.scanlines = ($("set-scan") as HTMLInputElement).checked;
  local.graphics.crtGlow = ($("set-glow") as HTMLInputElement).checked;
  local.graphics.shake = ($("set-shake") as HTMLInputElement).checked;
  const scale = ($("set-scale") as HTMLSelectElement).value;
  local.graphics.pixelScale = scale === "auto" ? "auto" : (Number(scale) as 2 | 3 | 4 | 5);
  if (paletteChanged) {
    local.graphics.custom = {};
    const fresh = activePalette(local);
    ($("set-wall") as HTMLInputElement).value = fresh.wall;
    ($("set-pac") as HTMLInputElement).value = fresh.pac;
  } else {
    local.graphics.custom = {
      wall: ($("set-wall") as HTMLInputElement).value,
      pac: ($("set-pac") as HTMLInputElement).value,
    };
  }
  local.sfx = Number(($("set-sfx") as HTMLInputElement).value) / 100;
  local.music = Number(($("set-music") as HTMLInputElement).value) / 100;
  audio.sfx = local.sfx;
  audio.music = local.music;
  saveSettings(local);
  applyTheme(activePalette(local), local.graphics);
  paintSwatches();
}

function applyCanvasScale(): void {
  const canvas = $("game") as HTMLCanvasElement;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const scale = local.graphics.pixelScale;
  if (scale === "auto") {
    canvas.style.height = "min(640px, 70vh)";
    canvas.style.width = "auto";
  } else {
    canvas.style.height = `${VIEW_H * scale}px`;
    canvas.style.width = "auto";
  }
}

function startSolo(): void {
  stopLoop();
  mode = "solo";
  roomCode = "";
  playerId = "local";
  isHost = true;
  match = {
    assignmentMode: "manual",
    lives: 3,
    ghostSpeed: "normal",
    frightSeconds: Number(($("host-fright") as HTMLInputElement)?.value || 6),
  };
  const assigned = new Map<string, Role>([["local", "pacman"]]);
  state = createGameState(assigned as Map<string, Exclude<Role, "unassigned">>, match);
  lastPellets = state.pelletsLeft;
  lastLives = state.lives;
  lastFright = false;
  lastGhostsEaten = 0;
  lastStatus = state.status;
  lastTs = 0;
  show("game");
  applyCanvasScale();
  grabPlayFocus();
  audio.startJingle();
  audio.startSiren();
  $("overlay-again").classList.add("hidden");
  $("game-overlay").classList.add("hidden");
  loop();
}

function grabPlayFocus(): void {
  input.reset();
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  const canvas = $("game") as HTMLCanvasElement;
  canvas.tabIndex = 0;
  canvas.focus({ preventScroll: true });
}

function stopLoop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  audio.stopSiren();
}

function loop(): void {
  raf = requestAnimationFrame(loop);
  const now = performance.now();
  if (!lastTs) lastTs = now;
  const dt = Math.min(0.05, (now - lastTs) / 1000);
  lastTs = now;

  if (mode === "solo" && state && state.status === "playing") {
    step(state, { local: input.dir }, dt, match);
  }

  if (state) {
    sfxFromState(state);
    const dying = state.respawnAt > state.time;
    const shake = local.graphics.shake && dying ? 2 : 0;
    renderFrame(
      $("game") as HTMLCanvasElement,
      state,
      MAZE,
      activePalette(local),
      youRole(),
      roomCode,
      shake,
    );
    if (state.status !== "playing") {
      const win = state.status === "pacman_win";
      $("game-overlay").classList.remove("hidden");
      $("overlay-title").textContent = win ? "PELLETS CLEARED" : "GHOSTS WIN";
      $("overlay-sub").textContent = win ? "PAC-MAN CLEARS THE MAZE" : "THE PACK GOT THEIR MUNCHER";
      if (mode === "solo") {
        $("overlay-again").textContent = "PLAY AGAIN";
        $("overlay-again").classList.remove("hidden");
        audio.stopSiren();
      } else {
        $("overlay-again").textContent = "LOBBY";
        $("overlay-again").classList.toggle("hidden", !isHost);
      }
    }
  }
}

function youRole(): string {
  if (mode === "solo") return "pacman";
  const me = lobbyPlayers.find((p) => p.id === playerId);
  const ent = state?.entities.find((e) => e.controlledBy === playerId || e.id === playerId);
  return ent?.role ?? me?.role ?? "unassigned";
}

function sfxFromState(s: GameState): void {
  if (s.pelletsLeft < lastPellets) audio.wakaEat();
  if (s.time < s.frightenedUntil && !lastFright) audio.power();
  if (s.ghostsEatenStreak > lastGhostsEaten) audio.ghostEat();
  if (s.lives < lastLives) audio.death();
  if (s.status !== lastStatus && s.status === "pacman_win") audio.win();
  if (s.status !== lastStatus && s.status === "ghosts_win") audio.death();
  lastPellets = s.pelletsLeft;
  lastLives = s.lives;
  lastFright = s.time < s.frightenedUntil;
  lastGhostsEaten = s.ghostsEatenStreak;
  lastStatus = s.status;
}

function renderLobby(): void {
  $("lobby-code").textContent = roomCode;
  $("lobby-url").textContent = inviteUrl || joinUrl || defaultHost();
  $("lobby-hints").textContent = joinHints.join("  ·  ");
  const listed = $("lobby-listed") as HTMLInputElement;
  listed.checked = roomListed;
  listed.disabled = !isHost;
  const list = $("lobby-players");
  list.innerHTML = lobbyPlayers
    .map((p) => {
      const tag = p.isHost ? "HOST" : p.ready ? "READY" : "WAIT";
      return `<li><span>${escapeHtml(p.name)}</span><span>${p.role.toUpperCase()} · ${tag}</span></li>`;
    })
    .join("");
  ($("lobby-assign") as HTMLSelectElement).value = match.assignmentMode;
  ($("lobby-assign") as HTMLSelectElement).disabled = !isHost;
  const me = lobbyPlayers.find((p) => p.id === playerId);
  ($("lobby-role") as HTMLSelectElement).value = me?.role ?? "unassigned";
  ($("lobby-ready") as HTMLInputElement).checked = Boolean(me?.ready);
  $("lobby-start").classList.toggle("hidden", !isHost);
  $("lobby-mode-help").textContent =
    match.assignmentMode === "random"
      ? "Random: one friend becomes Pac-Man, the rest become ghosts when the host starts."
      : "Manual: pick Pac-Man or a ghost now. Host can reassign anyone.";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function onServer(msg: ServerMsg): void {
  if (msg.type === "error") {
    $("status-line").textContent = msg.message;
    return;
  }
  if (msg.type === "welcome") {
    playerId = msg.playerId;
    roomCode = msg.roomCode;
    isHost = msg.isHost;
    joinUrl = msg.joinUrl;
    inviteUrl = msg.inviteUrl || msg.joinUrl;
    joinHints = msg.hostHints;
    roomListed = msg.listed;
    show("lobby");
    return;
  }
  if (msg.type === "lobby") {
    lobbyPlayers = msg.players;
    match = msg.settings;
    isHost = msg.hostId === playerId;
    roomListed = msg.listed;
    if (msg.inviteUrl) inviteUrl = msg.inviteUrl;
    if (screen !== "game") show("lobby");
    renderLobby();
    return;
  }
  if (msg.type === "start_game") {
    mode = "online";
    state = msg.state;
    lastPellets = state.pelletsLeft;
    lastLives = state.lives;
    lastStatus = state.status;
    lastGhostsEaten = state.ghostsEatenStreak;
    show("game");
    applyCanvasScale();
    grabPlayFocus();
    audio.startJingle();
    audio.startSiren();
    $("game-overlay").classList.add("hidden");
    if (!raf) loop();
    return;
  }
  if (msg.type === "state") {
    state = msg.state;
    if (screen !== "game") {
      show("game");
      applyCanvasScale();
      if (!raf) loop();
    }
    return;
  }
  if (msg.type === "chat") {
    const log = $("chat-log");
    const line = document.createElement("div");
    line.textContent = `${msg.name}: ${msg.text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
}

async function createRoom(settings: MatchSettings): Promise<void> {
  mode = "online";
  net.onMessage = onServer;
  net.onClose = () => {
    if (screen === "lobby" || screen === "game") {
      $("status-line").textContent = "DISCONNECTED FROM CABINET";
    }
  };
  await net.connect(defaultHost(), {
    type: "hello",
    name: local.name,
    create: true,
    settings,
    roomName: ($("host-name") as HTMLInputElement).value,
    listed: ($("host-listed") as HTMLInputElement).checked,
  });
}

async function joinRoom(host: string, code: string, name: string): Promise<void> {
  mode = "online";
  net.onMessage = onServer;
  net.onClose = () => {
    $("status-line").textContent = "DISCONNECTED FROM CABINET";
  };
  await net.connect(host || defaultHost(), {
    type: "hello",
    name,
    roomCode: code,
  });
}

function leaveOnline(): void {
  net.close();
  stopLoop();
  state = null;
  roomCode = "";
  inviteUrl = "";
  lobbyPlayers = [];
  show("title");
}

function bindUi(): void {
  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.beep(440, 0.06);
      const go = (btn as HTMLElement).dataset.go as Screen | "solo";
      if (go === "solo") {
        startSolo();
        return;
      }
      if (go === "settings") fillSettingsForm();
      if (go === "join") {
        ($("join-name") as HTMLInputElement).value = local.name;
        ($("join-host") as HTMLInputElement).value = defaultHost();
      }
      if (go === "world") void refreshWorldLobby();
      show(go);
    });
  });

  $("settings-form").addEventListener("input", readSettingsForm);
  $("settings-reset").addEventListener("click", () => {
    local.graphics.custom = {};
    local.graphics.paletteId = "classic";
    saveSettings(local);
    fillSettingsForm();
    readSettingsForm();
  });

  $("host-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    match = {
      assignmentMode: ($("host-assign") as HTMLSelectElement).value as AssignmentMode,
      lives: Number(($("host-lives") as HTMLSelectElement).value) as 1 | 3 | 5,
      ghostSpeed: ($("host-speed") as HTMLSelectElement).value as MatchSettings["ghostSpeed"],
      frightSeconds: Number(($("host-fright") as HTMLInputElement).value) || 6,
    };
    try {
      audio.startJingle();
      await createRoom(match);
    } catch (err) {
      $("status-line").textContent = err instanceof Error ? err.message : "HOST FAILED";
    }
  });

  $("join-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    local.name = ($("join-name") as HTMLInputElement).value.trim() || local.name;
    saveSettings(local);
    try {
      await joinRoom(
        ($("join-host") as HTMLInputElement).value.trim(),
        ($("join-code") as HTMLInputElement).value.trim(),
        local.name,
      );
    } catch (err) {
      $("status-line").textContent = err instanceof Error ? err.message : "JOIN FAILED";
    }
  });

  $("lobby-assign").addEventListener("change", () => {
    if (!isHost) return;
    net.send({
      type: "set_match",
      settings: { assignmentMode: ($("lobby-assign") as HTMLSelectElement).value as AssignmentMode },
    });
  });
  $("lobby-role").addEventListener("change", () => {
    net.send({
      type: "set_role",
      playerId,
      role: ($("lobby-role") as HTMLSelectElement).value as Role,
    });
  });
  $("lobby-ready").addEventListener("change", () => {
    net.send({ type: "ready", ready: ($("lobby-ready") as HTMLInputElement).checked });
  });
  $("lobby-start").addEventListener("click", () => net.send({ type: "start" }));
  $("lobby-leave").addEventListener("click", leaveOnline);
  $("lobby-copy").addEventListener("click", async () => {
    const link = inviteUrl || `${window.location.origin}/?join=${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      $("status-line").textContent = "INVITE COPIED · SEND IT ANYWHERE";
    } catch {
      $("status-line").textContent = link;
    }
  });
  $("lobby-listed").addEventListener("change", () => {
    if (!isHost) return;
    net.send({ type: "set_room", listed: ($("lobby-listed") as HTMLInputElement).checked });
  });
  $("world-refresh").addEventListener("click", () => void refreshWorldLobby());

  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const box = $("chat-input") as HTMLInputElement;
    if (box.value.trim()) net.send({ type: "chat", text: box.value });
    box.value = "";
  });

  $("overlay-quit").addEventListener("click", () => {
    if (mode === "online") leaveOnline();
    else {
      stopLoop();
      state = null;
      show("title");
    }
  });
  $("overlay-again").addEventListener("click", () => {
    if (mode === "solo") {
      startSolo();
      return;
    }
    net.send({ type: "return_lobby" });
  });

  document.querySelectorAll("#dpad [data-dir]").forEach((btn) => {
    const send = (ev: Event) => {
      ev.preventDefault();
      const dir = (btn as HTMLElement).dataset.dir as Dir;
      input.tap(dir);
      if (mode === "online") net.send({ type: "input", dir });
    };
    btn.addEventListener("pointerdown", send);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && screen === "game") {
      $("game-overlay").classList.remove("hidden");
      $("overlay-title").textContent = "PAUSED";
      $("overlay-sub").textContent = "QUIT RETURNS TO THE TITLE";
    }
    if (isTypingTarget(e.target)) return;
    if (screen !== "title") return;
    const buttons = Array.from(document.querySelectorAll("#title-menu button")) as HTMLButtonElement[];
    if (e.key === "ArrowDown" || e.key === "s") titleIndex = (titleIndex + 1) % buttons.length;
    if (e.key === "ArrowUp" || e.key === "w") titleIndex = (titleIndex + buttons.length - 1) % buttons.length;
    buttons.forEach((b, i) => b.classList.toggle("active", i === titleIndex));
    if (e.key === "Enter") buttons[titleIndex]?.click();
  });

  setInterval(() => {
    if (mode === "online" && screen === "game" && input.dir !== "none") {
      net.send({ type: "input", dir: input.dir });
    }
  }, 50);
}

async function refreshWorldLobby(): Promise<void> {
  const list = $("world-rooms");
  list.innerHTML = `<li class="empty-world">SCANNING CABINETS...</li>`;
  try {
    const res = await fetch("/api/rooms");
    const data = (await res.json()) as {
      rooms: Array<{ code: string; name: string; players: number; max: number; assignmentMode: string }>;
    };
    if (!data.rooms.length) {
      list.innerHTML = `<li class="empty-world">NO OPEN WORLD GAMES. CREATE A SERVER AND SHARE THE LINK.</li>`;
      return;
    }
    list.innerHTML = data.rooms
      .map(
        (r) =>
          `<li><span>${escapeHtml(r.name)} · ${r.code} · ${r.players}/${r.max} · ${r.assignmentMode}</span><button type="button" data-join="${r.code}">SIT DOWN</button></li>`,
      )
      .join("");
    list.querySelectorAll("[data-join]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = (btn as HTMLElement).dataset.join || "";
        ($("join-code") as HTMLInputElement).value = code;
        ($("join-name") as HTMLInputElement).value = local.name;
        ($("join-host") as HTMLInputElement).value = defaultHost();
        show("join");
        void joinRoom(defaultHost(), code, local.name).catch((err) => {
          $("status-line").textContent = err instanceof Error ? err.message : "JOIN FAILED";
        });
      });
    });
  } catch {
    list.innerHTML = `<li class="empty-world">COULD NOT REACH THE WORLD SERVER.</li>`;
  }
}

function boot(): void {
  audio.sfx = local.sfx;
  audio.music = local.music;
  applyTheme(activePalette(local), local.graphics);
  fillSettingsForm();
  ($("join-host") as HTMLInputElement).value = defaultHost();
  input.attach();
  bindUi();
  show("title");
  applyCanvasScale();
  const join = new URLSearchParams(window.location.search).get("join") || new URLSearchParams(window.location.search).get("code");
  if (join) {
    ($("join-code") as HTMLInputElement).value = join.toUpperCase();
    ($("join-name") as HTMLInputElement).value = local.name;
    show("join");
    if (local.name) {
      void joinRoom(defaultHost(), join, local.name).catch((err) => {
        $("status-line").textContent = err instanceof Error ? err.message : "JOIN FAILED";
      });
    }
  }
}

boot();
