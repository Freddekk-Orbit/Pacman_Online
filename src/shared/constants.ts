export const TILE = 8;
export const COLS = 28;
export const ROWS = 31;
export const TICK_HZ = 30;
export const TICK_DT = 1 / TICK_HZ;

export const PAC_SPEED = 7.2;
export const GHOST_SPEED = 6.6;
export const FRIGHT_SPEED = 4.4;
export const EYES_SPEED = 14;
export const TUNNEL_SPEED_SCALE = 0.72;

export const FRIGHT_SECONDS = 6;
export const EAT_DISTANCE = 0.55;
export const CENTER_EPS = 0.12;

export const PELLET_SCORE = 10;
export const POWER_SCORE = 50;
export const GHOST_SCORES = [200, 400, 800, 1600] as const;

export const ROOM_CODE_LEN = 4;
export const MAX_PLAYERS = 5;
export const MAX_ROOMS = 80;
export const ROOM_IDLE_MS = 20 * 60 * 1000;

export const GHOST_ROLES = ["blinky", "pinky", "inky", "clyde"] as const;
export type GhostRole = (typeof GHOST_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  pacman: "PAC-MAN",
  blinky: "SCARLET",
  pinky: "ROSE",
  inky: "AZURE",
  clyde: "AMBER",
  unassigned: "OPEN",
};

export const DIR_VEC = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
} as const;

export const OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  none: "none",
} as const;

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
