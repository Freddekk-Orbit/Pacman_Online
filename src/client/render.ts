import { COLS, ROWS, TILE } from "../shared/constants.ts";
import type { MazeData } from "../shared/maze.ts";
import { ROLE_LABELS } from "../shared/constants.ts";
import type { Entity, GameState, Palette } from "../shared/types.ts";

const HUD = 24;
const FOOT = 16;
export const VIEW_W = COLS * TILE;
export const VIEW_H = HUD + ROWS * TILE + FOOT;

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function sprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, dots: Array<[number, number]>): void {
  ctx.fillStyle = color;
  for (const [x, y] of dots) ctx.fillRect(ox + x, oy + y, 1, 1);
}

function circle16(cx: number, cy: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) out.push([x, y]);
    }
  }
  return out;
}

function drawPac(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, t: number): void {
  const px0 = Math.round(e.x * TILE + TILE / 2 - 8);
  const py0 = Math.round(HUD + e.y * TILE + TILE / 2 - 8);
  const mouth = 0.15 + (Math.sin(t * 18) * 0.5 + 0.5) * 0.55;
  const body = circle16(8, 8, 7);
  const dir = e.dir === "none" ? "left" : e.dir;
  ctx.fillStyle = palette.pac;
  for (const [x, y] of body) {
    const dx = x - 8;
    const dy = y - 8;
    let ang = Math.atan2(dy, dx);
    if (dir === "right") ang = ang;
    if (dir === "left") ang = Math.atan2(dy, -dx);
    if (dir === "up") ang = Math.atan2(dx, -dy);
    if (dir === "down") ang = Math.atan2(dx, dy);
    if (Math.abs(ang) < mouth) continue;
    ctx.fillRect(px0 + x, py0 + y, 1, 1);
  }
}

function ghostPixels(frame: number): Array<[number, number]> {
  const skirt = frame % 2 === 0
    ? [0, 2, 4, 6, 8, 10, 12, 14]
    : [1, 3, 5, 7, 9, 11, 13, 15];
  const dots: Array<[number, number]> = [];
  for (let y = 2; y <= 12; y++) {
    for (let x = 1; x <= 14; x++) {
      const top = y === 2 && (x < 4 || x > 11);
      const top2 = y === 3 && (x < 2 || x > 13);
      if (top || top2) continue;
      dots.push([x, y]);
    }
  }
  for (const x of skirt) dots.push([x, 13], [x, 14]);
  return dots;
}

function ghostColor(e: Entity, palette: Palette, t: number): string {
  if (e.eaten) return "transparent";
  if (e.frightened) {
    const flash = e.frightened && t % 0.4 < 0.2;
    return flash ? palette.eyes : palette.frightened;
  }
  if (e.role === "pacman") return palette.pac;
  return palette[e.role];
}

function drawGhost(ctx: CanvasRenderingContext2D, e: Entity, palette: Palette, t: number): void {
  const ox = Math.round(e.x * TILE + TILE / 2 - 8);
  const oy = Math.round(HUD + e.y * TILE + TILE / 2 - 8);
  const color = ghostColor(e, palette, t);
  if (color !== "transparent") {
    sprite(ctx, ox, oy, color, ghostPixels(Math.floor(t * 8)));
  }
  const eyeWhite: Array<[number, number]> = [
    [3, 5], [4, 5], [5, 5], [3, 6], [5, 6], [3, 7], [4, 7], [5, 7],
    [10, 5], [11, 5], [12, 5], [10, 6], [12, 6], [10, 7], [11, 7], [12, 7],
  ];
  sprite(ctx, ox, oy, palette.eyes, eyeWhite);
  let pxOff = 0;
  let pyOff = 0;
  if (e.dir === "right") pxOff = 1;
  if (e.dir === "left") pxOff = -1;
  if (e.dir === "up") pyOff = -1;
  if (e.dir === "down") pyOff = 1;
  sprite(ctx, ox, oy, palette.bg === "#000000" ? "#2121de" : palette.wall, [
    [4 + pxOff, 6 + pyOff],
    [11 + pxOff, 6 + pyOff],
  ]);
}

function drawWalls(ctx: CanvasRenderingContext2D, maze: MazeData, palette: Palette): void {
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      const c = maze.cells[y][x];
      const ox = x * TILE;
      const oy = HUD + y * TILE;
      if (c === "wall") {
        ctx.fillStyle = palette.wall;
        ctx.fillRect(ox + 1, oy + 1, TILE - 2, TILE - 2);
        const up = y > 0 && maze.cells[y - 1][x] === "wall";
        const dn = y < maze.rows - 1 && maze.cells[y + 1][x] === "wall";
        const lf = x > 0 && maze.cells[y][x - 1] === "wall";
        const rt = x < maze.cols - 1 && maze.cells[y][x + 1] === "wall";
        if (up) ctx.fillRect(ox + 1, oy, TILE - 2, 2);
        if (dn) ctx.fillRect(ox + 1, oy + TILE - 2, TILE - 2, 2);
        if (lf) ctx.fillRect(ox, oy + 1, 2, TILE - 2);
        if (rt) ctx.fillRect(ox + TILE - 2, oy + 1, 2, TILE - 2);
        ctx.fillStyle = palette.wallInner;
        ctx.fillRect(ox + 3, oy + 3, 2, 2);
      } else if (c === "gate") {
        ctx.fillStyle = palette.gate;
        ctx.fillRect(ox, oy + 3, TILE, 2);
      }
    }
  }
}

function drawDots(ctx: CanvasRenderingContext2D, state: GameState, maze: MazeData, palette: Palette, t: number): void {
  for (let y = 0; y < maze.rows; y++) {
    for (let x = 0; x < maze.cols; x++) {
      const ox = x * TILE + 3;
      const oy = HUD + y * TILE + 3;
      if (state.pellets[y][x]) {
        ctx.fillStyle = palette.pellet;
        ctx.fillRect(ox, oy, 2, 2);
      }
      if (state.power[y][x] && Math.floor(t * 6) % 2 === 0) {
        ctx.fillStyle = palette.power;
        ctx.fillRect(ox - 2, oy - 2, 6, 6);
      }
    }
  }
}

function pad(n: number, w = 6): string {
  return Math.max(0, n).toString().padStart(w, "0");
}

export function renderFrame(
  canvas: HTMLCanvasElement,
  state: GameState,
  maze: MazeData,
  palette: Palette,
  youRole: string,
  roomCode: string,
  shake = 0,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (shake) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWalls(ctx, maze, palette);
  drawDots(ctx, state, maze, palette, state.time);
  for (const e of state.entities) {
    if (e.role === "pacman") drawPac(ctx, e, palette, state.time);
    else drawGhost(ctx, e, palette, state.time);
  }

  ctx.fillStyle = palette.hud;
  ctx.font = "8px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(`1UP ${pad(state.score)}`, 8, 8);
  ctx.fillText(`LEFT ${state.pelletsLeft}`, 96, 8);
  let lx = VIEW_W - 8 - state.lives * 10;
  ctx.fillStyle = palette.pac;
  for (let i = 0; i < state.lives; i++) {
    ctx.beginPath();
    ctx.arc(lx + 4, 12, 3, 0.4, Math.PI * 2 - 0.4);
    ctx.lineTo(lx + 4, 12);
    ctx.fill();
    lx += 10;
  }

  ctx.fillStyle = palette.muted;
  ctx.fillText(`${roomCode || "SOLO"}  YOU:${ROLE_LABELS[youRole] ?? youRole}`, 8, HUD + ROWS * TILE + 4);
  ctx.restore();

  // silence unused helper in some builds
  void px;
}
