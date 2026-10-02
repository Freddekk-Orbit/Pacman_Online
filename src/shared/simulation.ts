import {
  CENTER_EPS,
  DIR_VEC,
  EAT_DISTANCE,
  EYES_SPEED,
  FRIGHT_SECONDS,
  FRIGHT_SPEED,
  GHOST_ROLES,
  GHOST_SCORES,
  GHOST_SPEED,
  OPPOSITE,
  PAC_SPEED,
  PELLET_SCORE,
  POWER_SCORE,
  TUNNEL_SPEED_SCALE,
} from "./constants.ts";
import {
  MAZE,
  cellAt,
  isBlocked,
  neighborsOpen,
  type MazeData,
} from "./maze.ts";
import { unusedGhosts } from "./roles.ts";
import type {
  Dir,
  Entity,
  GameState,
  MatchSettings,
  Role,
} from "./types.ts";

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    entities: state.entities.map((e) => ({ ...e })),
    pellets: state.pellets.map((r) => r.slice()),
    power: state.power.map((r) => r.slice()),
  };
}

function speedForGhost(settings: MatchSettings): number {
  if (settings.ghostSpeed === "chill") return GHOST_SPEED * 0.82;
  if (settings.ghostSpeed === "spicy") return GHOST_SPEED * 1.18;
  return GHOST_SPEED;
}

function makeDots(maze: MazeData): { pellets: boolean[][]; power: boolean[][]; left: number } {
  const pellets = maze.cells.map((row) => row.map((c) => c === "pellet"));
  const power = maze.cells.map((row) => row.map((c) => c === "power"));
  let left = 0;
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      if (pellets[y][x] || power[y][x]) left++;
    }
  }
  return { pellets, power, left };
}

export function createGameState(
  assignments: Map<string, Exclude<Role, "unassigned">>,
  settings: MatchSettings,
  maze: MazeData = MAZE,
): GameState {
  const { pellets, power, left } = makeDots(maze);
  const ghostBase = speedForGhost(settings);
  const used = [...assignments.values()];
  const entities: Entity[] = [];

  for (const [playerId, role] of assignments) {
    entities.push(spawnEntity(role, playerId, maze, ghostBase));
  }

  for (const role of unusedGhosts(used)) {
    entities.push(spawnEntity(role, null, maze, ghostBase));
  }

  if (!entities.some((e) => e.role === "pacman")) {
    entities.unshift(spawnEntity("pacman", null, maze, ghostBase));
  }

  return {
    tick: 0,
    time: 0,
    status: "playing",
    entities,
    pellets,
    power,
    score: 0,
    lives: settings.lives,
    pelletsLeft: left,
    frightenedUntil: 0,
    ghostsEatenStreak: 0,
    diedAt: 0,
    respawnAt: 0,
  };
}

function spawnEntity(
  role: Exclude<Role, "unassigned">,
  controlledBy: string | null,
  maze: MazeData,
  ghostBase: number,
): Entity {
  if (role === "pacman") {
    return {
      id: controlledBy ?? "ai-pacman",
      role,
      controlledBy,
      x: maze.pacSpawn.x,
      y: maze.pacSpawn.y,
      dir: "left",
      nextDir: "left",
      frightened: false,
      eaten: false,
      houseTimer: 0,
      speed: PAC_SPEED,
    };
  }
  const idx = GHOST_ROLES.indexOf(role);
  const spawn = maze.ghostSpawns[idx] ?? maze.ghostSpawns[0] ?? maze.houseCenter;
  return {
    id: controlledBy ?? `ai-${role}`,
    role,
    controlledBy,
    x: spawn.x,
    y: spawn.y,
    dir: "up",
    nextDir: "up",
    frightened: false,
    eaten: false,
    houseTimer: 0.4 + idx * 0.55,
    speed: ghostBase,
  };
}

function atCenter(v: number, eps = CENTER_EPS): boolean {
  return Math.abs(v - Math.round(v)) < eps;
}

function wrapX(x: number, cols: number): number {
  if (x < -0.5) return x + cols;
  if (x > cols - 0.5) return x - cols;
  return x;
}

function tileAhead(x: number, y: number, dir: Dir): { x: number; y: number } {
  const v = DIR_VEC[dir];
  return { x: Math.round(x) + v.x, y: Math.round(y) + v.y };
}

function canLeave(maze: MazeData, e: Entity, dir: Dir): boolean {
  const next = tileAhead(e.x, e.y, dir);
  return !isBlocked(maze, next.x, next.y, e.role !== "pacman", e.eaten);
}

function inTunnel(maze: MazeData, e: Entity): boolean {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  return y >= 0 && (x <= 2 || x >= maze.cols - 3) && !isBlocked(maze, e.x, e.y, true);
}

function currentSpeed(e: Entity, maze: MazeData, ghostBase: number): number {
  if (e.role === "pacman") return PAC_SPEED;
  if (e.eaten) return EYES_SPEED;
  let s = e.frightened ? FRIGHT_SPEED : ghostBase;
  if (inTunnel(maze, e)) s *= TUNNEL_SPEED_SCALE;
  return s;
}

function moveEntity(e: Entity, maze: MazeData, dt: number, ghostBase: number): void {
  if (e.houseTimer > 0 && !e.eaten) {
    e.houseTimer = Math.max(0, e.houseTimer - dt);
    const bob = Math.sin(e.houseTimer * 8) * 0.02;
    e.y += bob;
    return;
  }

  if (atCenter(e.x) && atCenter(e.y)) {
    e.x = Math.round(e.x);
    e.y = Math.round(e.y);
    if (e.nextDir !== "none" && canLeave(maze, e, e.nextDir)) {
      e.dir = e.nextDir;
    } else if (e.dir === "none" || !canLeave(maze, e, e.dir)) {
      const opens = neighborsOpen(maze, e.x, e.y, e.role !== "pacman");
      e.dir = opens[0] ?? "none";
    }
  }

  if (e.dir === "none") return;

  const speed = currentSpeed(e, maze, ghostBase);
  const v = DIR_VEC[e.dir];
  let nx = e.x + v.x * speed * dt;
  let ny = e.y + v.y * speed * dt;

  const cx = Math.round(e.x);
  const cy = Math.round(e.y);
  const crossed =
    (v.x !== 0 && (e.x - cx) * (nx - cx) <= 0 && e.x !== nx && Math.abs(e.x - cx) > 0.0001) ||
    (v.y !== 0 && (e.y - cy) * (ny - cy) <= 0 && e.y !== ny && Math.abs(e.y - cy) > 0.0001);

  if (atCenter(e.x) && atCenter(e.y) && !canLeave(maze, e, e.dir)) {
    e.x = cx;
    e.y = cy;
    e.dir = "none";
    return;
  }

  if (crossed && !canLeave(maze, e, e.dir)) {
    e.x = cx;
    e.y = cy;
    e.dir = "none";
    return;
  }

  e.x = wrapX(nx, maze.cols);
  e.y = ny;
}

function scatterCorner(role: Entity["role"], maze: MazeData): { x: number; y: number } {
  switch (role) {
    case "blinky":
      return { x: maze.cols - 2, y: 1 };
    case "pinky":
      return { x: 1, y: 1 };
    case "inky":
      return { x: maze.cols - 2, y: maze.rows - 2 };
    default:
      return { x: 1, y: maze.rows - 2 };
  }
}

function aheadOf(pac: Entity, tiles: number): { x: number; y: number } {
  const v = DIR_VEC[pac.dir === "none" ? "left" : pac.dir];
  return { x: pac.x + v.x * tiles, y: pac.y + v.y * tiles };
}

function ghostTarget(e: Entity, state: GameState, maze: MazeData): { x: number; y: number } {
  if (e.eaten) return maze.houseCenter;
  const pac = state.entities.find((o) => o.role === "pacman");
  if (!pac) return scatterCorner(e.role, maze);

  const dist = Math.hypot(e.x - pac.x, e.y - pac.y);
  switch (e.role) {
    case "blinky":
      return { x: pac.x, y: pac.y };
    case "pinky":
      return aheadOf(pac, 4);
    case "inky": {
      const blinky = state.entities.find((o) => o.role === "blinky");
      const two = aheadOf(pac, 2);
      const bx = blinky?.x ?? two.x;
      const by = blinky?.y ?? two.y;
      return { x: two.x * 2 - bx, y: two.y * 2 - by };
    }
    default:
      return dist > 8 ? { x: pac.x, y: pac.y } : scatterCorner(e.role, maze);
  }
}

function pickAiDir(e: Entity, state: GameState, maze: MazeData): Dir {
  const cx = Math.round(e.x);
  const cy = Math.round(e.y);
  let opens = neighborsOpen(maze, cx, cy, true);
  if (!e.frightened && !e.eaten && e.dir !== "none") {
    const filtered = opens.filter((d) => d !== OPPOSITE[e.dir]);
    if (filtered.length) opens = filtered;
  }
  if (!opens.length) return e.dir;

  if (e.frightened && !e.eaten) {
    return opens[Math.floor(Math.abs(Math.sin(state.time * 12 + cx * 3 + cy)) * opens.length)]!;
  }

  const target = ghostTarget(e, state, maze);
  let best = opens[0]!;
  let bestScore = Infinity;
  for (const d of opens) {
    const v = DIR_VEC[d];
    const nx = cx + v.x;
    const ny = cy + v.y;
    const score = (nx - target.x) ** 2 + (ny - target.y) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function steerGhost(
  e: Entity,
  state: GameState,
  maze: MazeData,
  input: Dir | undefined,
): void {
  if (e.eaten) {
    if (atCenter(e.x) && atCenter(e.y)) e.nextDir = pickAiDir(e, state, maze);
    const hx = maze.houseCenter.x;
    const hy = maze.houseCenter.y;
    if (Math.hypot(e.x - hx, e.y - hy) < 0.8) {
      e.eaten = false;
      e.frightened = false;
      e.houseTimer = 0.8;
      e.x = Math.round(hx);
      e.y = Math.round(hy);
    }
    return;
  }
  if (input && input !== "none") {
    e.nextDir = input;
    return;
  }
  if (atCenter(e.x) && atCenter(e.y)) {
    e.nextDir = pickAiDir(e, state, maze);
  }
}

function eatAt(state: GameState, maze: MazeData, settings: MatchSettings, pac: Entity): void {
  const x = Math.round(pac.x);
  const y = Math.round(pac.y);
  if (y < 0 || y >= maze.rows || x < 0 || x >= maze.cols) return;
  if (state.pellets[y][x]) {
    state.pellets[y][x] = false;
    state.score += PELLET_SCORE;
    state.pelletsLeft--;
  }
  if (state.power[y][x]) {
    state.power[y][x] = false;
    state.score += POWER_SCORE;
    state.pelletsLeft--;
    state.frightenedUntil = state.time + (settings.frightSeconds || FRIGHT_SECONDS);
    state.ghostsEatenStreak = 0;
    for (const g of state.entities) {
      if (g.role !== "pacman" && !g.eaten) {
        g.frightened = true;
        g.dir = OPPOSITE[g.dir] as Dir;
        g.nextDir = g.dir;
      }
    }
  }
}

function collide(state: GameState, maze: MazeData): void {
  const pac = state.entities.find((e) => e.role === "pacman");
  if (!pac || state.respawnAt > state.time) return;

  for (const g of state.entities) {
    if (g.role === "pacman" || g.eaten) continue;
    const dx = Math.abs(g.x - pac.x);
    const wrapDx = Math.min(dx, maze.cols - dx);
    const dist = Math.hypot(wrapDx, g.y - pac.y);
    if (dist > EAT_DISTANCE) continue;
    if (g.frightened) {
      g.eaten = true;
      g.frightened = false;
      const bonus = GHOST_SCORES[Math.min(state.ghostsEatenStreak, GHOST_SCORES.length - 1)]!;
      state.ghostsEatenStreak++;
      state.score += bonus;
    } else {
      state.lives -= 1;
      state.diedAt = state.time;
      if (state.lives <= 0) {
        state.status = "ghosts_win";
      } else {
        state.respawnAt = state.time + 1.4;
        resetPositions(state, maze);
      }
      return;
    }
  }
}

function resetPositions(state: GameState, maze: MazeData): void {
  for (const e of state.entities) {
    if (e.role === "pacman") {
      e.x = maze.pacSpawn.x;
      e.y = maze.pacSpawn.y;
      e.dir = "left";
      e.nextDir = "left";
    } else {
      const idx = GHOST_ROLES.indexOf(e.role);
      const spawn = maze.ghostSpawns[Math.max(0, idx)] ?? maze.houseCenter;
      e.x = spawn.x;
      e.y = spawn.y;
      e.dir = "up";
      e.nextDir = "up";
      e.frightened = false;
      e.eaten = false;
      e.houseTimer = 0.3 + Math.max(0, idx) * 0.4;
    }
  }
  state.frightenedUntil = 0;
}

export function step(
  state: GameState,
  inputs: Record<string, Dir>,
  dt: number,
  settings: MatchSettings,
  maze: MazeData = MAZE,
): GameState {
  if (state.status !== "playing") return state;
  state.tick += 1;
  state.time += dt;

  const ghostBase = speedForGhost(settings);
  const frightened = state.time < state.frightenedUntil;
  if (!frightened) {
    for (const e of state.entities) e.frightened = false;
  }

  if (state.respawnAt && state.time < state.respawnAt) {
    return state;
  }

  for (const e of state.entities) {
    const humanId = e.controlledBy ?? (e.id.startsWith("ai-") ? null : e.id);
    const input = humanId ? inputs[humanId] : undefined;
    if (e.role === "pacman") {
      if (input && input !== "none") e.nextDir = input;
      moveEntity(e, maze, dt, ghostBase);
    } else {
      steerGhost(e, state, maze, input);
      moveEntity(e, maze, dt, ghostBase);
    }
  }

  const pac = state.entities.find((e) => e.role === "pacman");
  if (pac) eatAt(state, maze, settings, pac);
  collide(state, maze);

  if (state.pelletsLeft <= 0 && state.status === "playing") {
    state.status = "pacman_win";
  }
  return state;
}

export function dirFromKey(key: string): Dir | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
    case "i":
    case "I":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
    case "k":
    case "K":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
    case "j":
    case "J":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
    case "l":
    case "L":
      return "right";
    default:
      return null;
  }
}
