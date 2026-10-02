import { WebSocket } from "ws";
import {
  CODE_ALPHABET,
  MAX_PLAYERS,
  ROOM_CODE_LEN,
  TICK_DT,
  TICK_HZ,
} from "../shared/constants.ts";
import type { ClientMsg, ServerMsg } from "../shared/protocol.ts";
import { assignRoles } from "../shared/roles.ts";
import { cloneState, createGameState, step } from "../shared/simulation.ts";
import type { Dir, LobbyPlayer, MatchSettings, Role } from "../shared/types.ts";
import { DEFAULT_MATCH } from "../shared/types.ts";

interface Client {
  id: string;
  name: string;
  ws: WebSocket;
  role: Role;
  ready: boolean;
  lastInput: Dir;
}

export class Room {
  readonly code: string;
  readonly createdAt = Date.now();
  hostId: string;
  settings: MatchSettings;
  clients = new Map<string, Client>();
  phase: "lobby" | "playing" | "over" = "lobby";
  private timer: ReturnType<typeof setInterval> | null = null;
  private inputs: Record<string, Dir> = {};
  private state = createGameState(new Map(), DEFAULT_MATCH);
  lastActivity = Date.now();

  constructor(code: string, host: Client, settings?: MatchSettings) {
    this.code = code;
    this.hostId = host.id;
    this.settings = { ...DEFAULT_MATCH, ...settings };
    this.clients.set(host.id, host);
  }

  get idle(): boolean {
    return this.clients.size === 0;
  }

  add(client: Client): string | null {
    if (this.clients.size >= MAX_PLAYERS) return "Room is full (max 5).";
    if (this.phase === "playing") return "Match already in progress.";
    this.clients.set(client.id, client);
    this.touch();
    this.broadcastLobby();
    return null;
  }

  remove(id: string): void {
    this.clients.delete(id);
    delete this.inputs[id];
    if (this.hostId === id) {
      const next = this.clients.values().next().value as Client | undefined;
      this.hostId = next?.id ?? "";
    }
    if (this.clients.size === 0) {
      this.stopLoop();
      return;
    }
    if (this.phase === "playing") {
      const ent = this.state.entities.find((e) => e.controlledBy === id);
      if (ent) ent.controlledBy = null;
    }
    this.touch();
    this.broadcastLobby();
  }

  handle(id: string, msg: ClientMsg, hints: string[], joinUrl: string): void {
    const client = this.clients.get(id);
    if (!client) return;
    this.touch();

    switch (msg.type) {
      case "set_role":
        if (this.phase !== "lobby") return;
        if (id !== this.hostId && msg.playerId !== id) return;
        this.applyRole(msg.playerId, msg.role);
        this.broadcastLobby();
        break;
      case "set_match":
        if (id !== this.hostId || this.phase !== "lobby") return;
        this.settings = { ...this.settings, ...msg.settings };
        this.broadcastLobby();
        break;
      case "ready":
        client.ready = msg.ready;
        this.broadcastLobby();
        break;
      case "start":
        if (id !== this.hostId) return;
        this.startMatch();
        break;
      case "input":
        client.lastInput = msg.dir;
        this.inputs[id] = msg.dir;
        break;
      case "return_lobby":
        if (id !== this.hostId) return;
        this.returnLobby();
        break;
      case "chat": {
        const text = msg.text.trim().slice(0, 80);
        if (!text) return;
        this.broadcast({ type: "chat", name: client.name, text });
        break;
      }
      case "hello":
        this.send(client.ws, {
          type: "welcome",
          playerId: id,
          roomCode: this.code,
          isHost: id === this.hostId,
          joinUrl,
          hostHints: hints,
        });
        this.broadcastLobby();
        if (this.phase === "playing") {
          this.send(client.ws, { type: "state", state: this.state });
        }
        break;
    }
  }

  private applyRole(playerId: string, role: Role): void {
    const target = this.clients.get(playerId);
    if (!target) return;
    if (role !== "unassigned") {
      for (const c of this.clients.values()) {
        if (c.id !== playerId && c.role === role) c.role = "unassigned";
      }
    }
    target.role = role;
    target.ready = false;
  }

  private startMatch(): void {
    const players = this.lobbyPlayers();
    const assigned = assignRoles(players, this.settings.assignmentMode);
    for (const [pid, role] of assigned) {
      const c = this.clients.get(pid);
      if (c) c.role = role;
    }
    this.state = createGameState(assigned, this.settings);
    this.inputs = {};
    this.phase = "playing";
    this.broadcast({ type: "start_game", state: cloneState(this.state) });
    this.stopLoop();
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  private tick(): void {
    if (this.phase !== "playing") return;
    step(this.state, this.inputs, TICK_DT, this.settings);
    if (this.state.status !== "playing") {
      this.phase = "over";
      this.stopLoop();
    }
    this.broadcast({ type: "state", state: cloneState(this.state) });
  }

  private returnLobby(): void {
    this.stopLoop();
    this.phase = "lobby";
    for (const c of this.clients.values()) c.ready = false;
    this.broadcastLobby();
  }

  private lobbyPlayers(): LobbyPlayer[] {
    return [...this.clients.values()].map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      ready: c.ready,
      isHost: c.id === this.hostId,
    }));
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: "lobby",
      players: this.lobbyPlayers(),
      settings: this.settings,
      hostId: this.hostId,
    });
  }

  private broadcast(msg: ServerMsg): void {
    const raw = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
    }
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private stopLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stopLoop();
    for (const c of this.clients.values()) {
      try {
        c.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }
}

export function makeCode(existing: Set<string>): string {
  for (let n = 0; n < 64; n++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LEN; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `X${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w \-!?]/g, "").trim().slice(0, 14);
  return cleaned || `PLAYER${Math.floor(Math.random() * 90 + 10)}`;
}

export type { Client };
