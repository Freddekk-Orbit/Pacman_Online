import { COLS, ROWS } from "./constants.ts";
import type { CellKind } from "./types.ts";

/**
 * Original 28x31 maze inspired by arcade corridor play, not a ROM dump.
 * # wall  X void  . pellet  o power  (space) empty
 * - gate  P pac-man spawn  H ghost house  G house spawn
 */
export const MAZE_SRC = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "XXXXX#.#####.##.#####.#XXXXX",
  "XXXXX#.##..........##.#XXXXX",
  "XXXXX#.##.###--###.##.#XXXXX",
  "######.##.#HHHHHH#.##.######",
  "      ....#G    G#....      ",
  "######.##.#HHHHHH#.##.######",
  "XXXXX#.##.########.##.#XXXXX",
  "XXXXX#.##..........##.#XXXXX",
  "XXXXX#.##.########.##.#XXXXX",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#..##.........P........##..#",
  "###.##.##.########.##.##.###",
  "#....##.##.########.##.....#",
  "#.####.##....##....##.####.#",
  "#.####.#####.##.#####.####.#",
  "#............##............#",
  "#.##########.##.##########.#",
  "############################",
] as const;

export interface MazeData {
  cols: number;
  rows: number;
  cells: CellKind[][];
  pacSpawn: { x: number; y: number };
  ghostSpawns: { x: number; y: number }[];
  houseCenter: { x: number; y: number };
  gate: { x: number; y: number }[];
}

function kindFromChar(ch: string): CellKind {
  switch (ch) {
    case "#":
      return "wall";
    case "X":
      return "void";
    case ".":
      return "pellet";
    case "o":
      return "power";
    case "-":
      return "gate";
    case "H":
    case "G":
      return "house";
    case "P":
    case " ":
      return "empty";
    default:
      return "empty";
  }
}

export function parseMaze(src: readonly string[] = MAZE_SRC): MazeData {
  const rows = src.length;
  const cols = src[0]?.length ?? 0;
  const cells: CellKind[][] = [];
  let pacSpawn = { x: 13, y: 23 };
  const ghostSpawns: { x: number; y: number }[] = [];
  const gate: { x: number; y: number }[] = [];
  let houseX = 0;
  let houseY = 0;
  let houseN = 0;

  for (let y = 0; y < rows; y++) {
    const line = src[y];
    const row: CellKind[] = [];
    for (let x = 0; x < cols; x++) {
      const ch = line[x] ?? "#";
      const kind = kindFromChar(ch);
      row.push(kind);
      if (ch === "P") pacSpawn = { x, y };
      if (ch === "G") ghostSpawns.push({ x, y });
      if (ch === "-") gate.push({ x, y });
      if (kind === "house") {
        houseX += x;
        houseY += y;
        houseN++;
      }
    }
    cells.push(row);
  }

  if (ghostSpawns.length < 4) {
    const extras = [
      { x: 12, y: 14 },
      { x: 13, y: 14 },
      { x: 14, y: 14 },
      { x: 15, y: 14 },
    ];
    for (const e of extras) {
      if (ghostSpawns.length >= 4) break;
      if (!ghostSpawns.some((g) => g.x === e.x && g.y === e.y)) ghostSpawns.push(e);
    }
  }

  return {
    cols,
    rows,
    cells,
    pacSpawn,
    ghostSpawns: ghostSpawns.slice(0, 4),
    houseCenter: houseN
      ? { x: houseX / houseN, y: houseY / houseN }
      : { x: 13.5, y: 14 },
    gate,
  };
}

export const MAZE = parseMaze();

export function inBounds(maze: MazeData, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < maze.cols && y < maze.rows;
}

export function cellAt(maze: MazeData, x: number, y: number): CellKind {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (iy < 0 || iy >= maze.rows) return "wall";
  if (ix < 0 || ix >= maze.cols) {
    const row = maze.cells[iy];
    if (row && (row[0] === "empty" || row[maze.cols - 1] === "empty")) return "empty";
    return "wall";
  }
  return maze.cells[iy][ix];
}

export function isBlocked(
  maze: MazeData,
  x: number,
  y: number,
  ghost: boolean,
  eaten = false,
): boolean {
  const c = cellAt(maze, x, y);
  if (c === "wall" || c === "void") return true;
  if (c === "gate") return ghost ? false : true;
  if (c === "house") return ghost || eaten ? false : true;
  return false;
}

export function neighborsOpen(
  maze: MazeData,
  x: number,
  y: number,
  ghost: boolean,
): Array<"up" | "down" | "left" | "right"> {
  const dirs: Array<"up" | "down" | "left" | "right"> = ["up", "left", "down", "right"];
  const out: Array<"up" | "down" | "left" | "right"> = [];
  for (const d of dirs) {
    const nx = x + (d === "left" ? -1 : d === "right" ? 1 : 0);
    const ny = y + (d === "up" ? -1 : d === "down" ? 1 : 0);
    if (!isBlocked(maze, nx, ny, ghost)) out.push(d);
  }
  return out;
}

export function validateMaze(src: readonly string[] = MAZE_SRC): string[] {
  const errors: string[] = [];
  if (src.length !== ROWS) errors.push(`expected ${ROWS} rows, got ${src.length}`);
  src.forEach((line, i) => {
    if (line.length !== COLS) errors.push(`row ${i} length ${line.length} != ${COLS}`);
  });
  const parsed = parseMaze(src);
  const pellets = parsed.cells.flat().filter((c) => c === "pellet" || c === "power").length;
  if (pellets < 80) errors.push(`too few pellets: ${pellets}`);
  const powers = parsed.cells.flat().filter((c) => c === "power").length;
  if (powers < 4) errors.push(`expected 4 power pellets, got ${powers}`);
  if (!parsed.pacSpawn) errors.push("missing pac spawn");

  const seen = new Set<string>();
  const q = [parsed.pacSpawn];
  seen.add(`${parsed.pacSpawn.x},${parsed.pacSpawn.y}`);
  while (q.length) {
    const p = q.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!inBounds(parsed, x, y)) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      if (isBlocked(parsed, x, y, false)) continue;
      seen.add(key);
      q.push({ x, y });
    }
  }
  if (seen.size < 80) errors.push(`walkable flood fill too small: ${seen.size}`);
  return errors;
}
