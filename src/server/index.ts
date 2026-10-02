import { existsSync } from "node:fs";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_PLAYERS, MAX_ROOMS, ROOM_IDLE_MS } from "../shared/constants.ts";
import type { ClientMsg } from "../shared/protocol.ts";
import { DEFAULT_MATCH, type MatchSettings } from "../shared/types.ts";
import { inviteUrl, publicOrigin } from "./publicUrl.ts";
import { Room, makeCode, makeId, sanitizeName, type Client } from "./room.ts";
import { startWorldwideTunnel } from "./tunnel.ts";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "../../dist/client");

const app = express();
app.set("trust proxy", true);
app.use(express.json());

const rooms = new Map<string, Room>();
let tunnelUrl = "";

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

function originFrom(headers?: IncomingHttpHeaders): string {
  return publicOrigin({
    headers,
    tunnelUrl,
    port: PORT,
  });
}

function hostHints(headers?: IncomingHttpHeaders): string[] {
  const origin = originFrom(headers);
  const hints = [origin, ...lanAddresses().map((ip) => `http://${ip}:${PORT}`)];
  return [...new Set(hints)];
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, worldwide: Boolean(tunnelUrl || process.env.PUBLIC_URL) });
});

app.get("/api/info", (req, res) => {
  const origin = originFrom(req.headers);
  res.json({
    port: PORT,
    rooms: rooms.size,
    publicUrl: origin,
    worldwide: Boolean(tunnelUrl || process.env.PUBLIC_URL || req.headers["x-forwarded-host"]),
    hints: hostHints(req.headers),
  });
});

app.get("/api/rooms", (_req, res) => {
  const list = [...rooms.values()]
    .filter((room) => room.listed && room.phase === "lobby")
    .map((room) => ({
      code: room.code,
      name: room.name,
      players: room.clients.size,
      max: MAX_PLAYERS,
      assignmentMode: room.settings.assignmentMode,
    }));
  res.json({ rooms: list });
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
    name: room.name,
    players: room.clients.size,
    phase: room.phase,
    listed: room.listed,
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
      const origin = originFrom(req.headers);
      const hints = hostHints(req.headers);

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
        room = new Room(code, client, msg.settings, { name: msg.roomName, listed: msg.listed });
        room.inviteUrl = inviteUrl(origin, code);
        rooms.set(code, room);
        room.handle(playerId, msg, hints, room.inviteUrl);
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
      room.inviteUrl = inviteUrl(origin, code);
      room.handle(playerId, { ...msg, roomCode: code }, hints, room.inviteUrl);
      return;
    }

    if (!room || !playerId) {
      send(ws, { type: "error", message: "Join or create a room first." });
      return;
    }
    room.handle(playerId, msg, hostHints(req.headers), room.inviteUrl);
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

server.listen(PORT, HOST, async () => {
  console.log(`PACMAN ONLINE listening on http://${HOST}:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  LAN: http://${ip}:${PORT}`);
  if (process.env.WORLDWIDE === "1" || process.argv.includes("--world")) {
    const url = await startWorldwideTunnel(PORT);
    if (url) {
      tunnelUrl = url;
      console.log(`  WORLD: ${url}`);
    } else {
      console.log("  WORLD: tunnel failed — set PUBLIC_URL or deploy this server.");
    }
  }
  if (process.env.PUBLIC_URL) console.log(`  PUBLIC: ${process.env.PUBLIC_URL}`);
});
