import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_ROOMS, ROOM_IDLE_MS } from "../shared/constants.ts";
import type { ClientMsg } from "../shared/protocol.ts";
import { DEFAULT_MATCH, type MatchSettings } from "../shared/types.ts";
import { Room, makeCode, makeId, sanitizeName, type Client } from "./room.ts";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "../../dist/client");

const app = express();
app.use(express.json());

const rooms = new Map<string, Room>();

function lanAddresses(): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const n of list) {
      if (n.family === "IPv4" && !n.internal) out.push(n.address);
    }
  }
  return out;
}

function hostHints(reqHost?: string): string[] {
  const port = PORT;
  const hints = lanAddresses().map((ip) => `http://${ip}:${port}`);
  if (reqHost) hints.unshift(`http://${reqHost}`);
  return [...new Set(hints)];
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/api/info", (req, res) => {
  res.json({
    port: PORT,
    rooms: rooms.size,
    hints: hostHints(req.headers.host),
  });
});

app.get("/api/rooms/:code", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) {
    res.status(404).json({ ok: false });
    return;
  }
  res.json({
    ok: true,
    code: room.code,
    players: room.clients.size,
    phase: room.phase,
  });
});

app.post("/api/rooms", (req, res) => {
  if (rooms.size >= MAX_ROOMS) {
    res.status(503).json({ error: "Too many rooms on this server." });
    return;
  }
  const settings = { ...DEFAULT_MATCH, ...(req.body?.settings as MatchSettings | undefined) };
  res.json({
    ok: true,
    settings,
    hints: hostHints(req.headers.host),
  });
});

if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
      next();
      return;
    }
    res.sendFile(join(clientDir, "index.html"));
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function send(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/ws", `http://${req.headers.host || "localhost"}`);
  let room: Room | null = null;
  let playerId = "";

  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw)) as ClientMsg;
    } catch {
      send(ws, { type: "error", message: "Bad message." });
      return;
    }

    if (msg.type === "hello" && !room) {
      const name = sanitizeName(msg.name || "");
      const hints = hostHints(req.headers.host);
      const joinHost = req.headers.host || `localhost:${PORT}`;

      if (msg.create) {
        if (rooms.size >= MAX_ROOMS) {
          send(ws, { type: "error", message: "Server is full." });
          return;
        }
        const code = makeCode(new Set(rooms.keys()));
        playerId = makeId();
        const client: Client = {
          id: playerId,
          name,
          ws,
          role: "unassigned",
          ready: false,
          lastInput: "none",
        };
        room = new Room(code, client, msg.settings);
        rooms.set(code, room);
        room.handle(playerId, msg, hints, `http://${joinHost}`);
        return;
      }

      const code = (msg.roomCode || url.searchParams.get("code") || "").toUpperCase();
      const found = rooms.get(code);
      if (!found) {
        send(ws, { type: "error", message: "No room with that code." });
        return;
      }
      playerId = makeId();
      const client: Client = {
        id: playerId,
        name,
        ws,
        role: "unassigned",
        ready: false,
        lastInput: "none",
      };
      const err = found.add(client);
      if (err) {
        send(ws, { type: "error", message: err });
        return;
      }
      room = found;
      room.handle(playerId, { ...msg, roomCode: code }, hints, `http://${joinHost}`);
      return;
    }

    if (!room || !playerId) {
      send(ws, { type: "error", message: "Join or create a room first." });
      return;
    }
    room.handle(playerId, msg, hostHints(req.headers.host), `http://${req.headers.host}`);
  });

  ws.on("close", () => {
    if (room && playerId) {
      room.remove(playerId);
      if (room.idle) {
        rooms.delete(room.code);
        room.dispose();
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.idle || now - room.lastActivity > ROOM_IDLE_MS) {
      room.dispose();
      rooms.delete(code);
    }
  }
}, 30_000);

server.listen(PORT, HOST, () => {
  const hints = lanAddresses();
  console.log(`PACMAN ONLINE listening on http://${HOST}:${PORT}`);
  for (const ip of hints) console.log(`  LAN: http://${ip}:${PORT}`);
});
