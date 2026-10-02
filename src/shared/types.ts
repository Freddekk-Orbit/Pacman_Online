import type { GhostRole } from "./constants.ts";

export type Dir = "up" | "down" | "left" | "right" | "none";
export type Role = "pacman" | GhostRole | "unassigned";
export type AssignmentMode = "random" | "manual";
export type GameStatus =
  | "waiting"
  | "playing"
  | "pacman_win"
  | "ghosts_win";

export type CellKind =
  | "wall"
  | "void"
  | "empty"
  | "pellet"
  | "power"
  | "gate"
  | "house";

export interface Palette {
  id: string;
  name: string;
  bg: string;
  wall: string;
  wallInner: string;
  pellet: string;
  power: string;
  pac: string;
  blinky: string;
  pinky: string;
  inky: string;
  clyde: string;
  frightened: string;
  eyes: string;
  text: string;
  muted: string;
  hud: string;
  gate: string;
  accent: string;
}

export interface GraphicsSettings {
  paletteId: string;
  custom: Partial<Palette>;
  scanlines: boolean;
  crtGlow: boolean;
  pixelScale: "auto" | 2 | 3 | 4 | 5;
  shake: boolean;
}

export interface MatchSettings {
  assignmentMode: AssignmentMode;
  lives: 1 | 3 | 5;
  ghostSpeed: "chill" | "normal" | "spicy";
  frightSeconds: number;
}

export interface Entity {
  id: string;
  role: Exclude<Role, "unassigned">;
  controlledBy: string | null;
  x: number;
  y: number;
  dir: Dir;
  nextDir: Dir;
  frightened: boolean;
  eaten: boolean;
  houseTimer: number;
  speed: number;
}

export interface GameState {
  tick: number;
  time: number;
  status: GameStatus;
  entities: Entity[];
  pellets: boolean[][];
  power: boolean[][];
  score: number;
  lives: number;
  pelletsLeft: number;
  frightenedUntil: number;
  ghostsEatenStreak: number;
  diedAt: number;
  respawnAt: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  role: Role;
  ready: boolean;
  isHost: boolean;
}

export const DEFAULT_MATCH: MatchSettings = {
  assignmentMode: "random",
  lives: 3,
  ghostSpeed: "normal",
  frightSeconds: 6,
};

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  paletteId: "classic",
  custom: {},
  scanlines: true,
  crtGlow: true,
  pixelScale: "auto",
  shake: true,
};
