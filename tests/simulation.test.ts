import { TICK_DT } from "../src/shared/constants.ts";
import { MAZE, inBounds, isBlocked, parseMaze } from "../src/shared/maze.ts";
import { assignRoles, uniqueRoles } from "../src/shared/roles.ts";
import { cloneState, createGameState, step } from "../src/shared/simulation.ts";
import type { LobbyPlayer, MatchSettings } from "../src/shared/types.ts";
import { DEFAULT_MATCH } from "../src/shared/types.ts";

const settings: MatchSettings = { ...DEFAULT_MATCH, lives: 3 };

function tilePath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const key = (x: number, y: number) => `${x},${y}`;
  const q = [start];
  const prev = new Map<string, { x: number; y: number } | null>();
  prev.set(key(start.x, start.y), null);
  while (q.length) {
    const p = q.shift()!;
    if (p.x === goal.x && p.y === goal.y) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!inBounds(MAZE, x, y) || isBlocked(MAZE, x, y, false)) continue;
      const k = key(x, y);
      if (prev.has(k)) continue;
      prev.set(k, p);
      q.push({ x, y });
    }
  }
  const path: Array<{ x: number; y: number }> = [];
  let cur: { x: number; y: number } | null | undefined = goal;
  while (cur) {
    path.push(cur);
    cur = prev.get(key(cur.x, cur.y));
  }
  return path.reverse();
}

function dirToward(x: number, y: number, tx: number, ty: number): "up" | "down" | "left" | "right" {
  const dx = tx - x;
  const dy = ty - y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

const corridor = parseMaze([
  "#####",
  "#P..#",
  "#.#.#",
  "#o..#",
  "#####",
]);

describe("simulation", () => {
  it("spawns pac-man and four ghosts", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings);
    expect(state.entities.some((e) => e.role === "pacman")).toBe(true);
    expect(state.entities.filter((e) => e.role !== "pacman")).toHaveLength(4);
    expect(state.pelletsLeft).toBeGreaterThan(80);
  });

  it("moves pac-man right and eats a pellet", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings, corridor);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    pac.x = 1;
    pac.y = 1;
    pac.dir = "right";
    pac.nextDir = "right";
    const before = state.pelletsLeft;
    for (let i = 0; i < 20; i++) step(state, { p1: "right" }, TICK_DT, settings, corridor);
    expect(pac.x).toBeGreaterThan(1.2);
    expect(state.pelletsLeft).toBeLessThan(before);
    expect(state.score).toBeGreaterThan(0);
  });

  it("does not walk through walls", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings, corridor);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    pac.x = 1;
    pac.y = 1;
    pac.dir = "up";
    pac.nextDir = "up";
    for (let i = 0; i < 15; i++) step(state, { p1: "up" }, TICK_DT, settings, corridor);
    expect(pac.y).toBeGreaterThanOrEqual(1);
  });

  it("can walk from spawn into the bottom of the arcade maze", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings, MAZE);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    state.pelletsLeft = 999;
    for (const g of state.entities) {
      if (g.role !== "pacman") g.houseTimer = 999;
    }
    const goal = { x: 1, y: MAZE.rows - 2 };
    const path = tilePath(MAZE.pacSpawn, goal);
    expect(path.length).toBeGreaterThan(8);
    let i = 1;
    for (let t = 0; t < 500; t++) {
      while (i < path.length) {
        const wp = path[i]!;
        const tx = Math.round(pac.x);
        const ty = Math.round(pac.y);
        if (tx === wp.x && ty === wp.y && Math.abs(pac.x - tx) < 0.3 && Math.abs(pac.y - ty) < 0.3) {
          i++;
          continue;
        }
        break;
      }
      const wp = path[Math.min(i, path.length - 1)]!;
      const dir = dirToward(pac.x, pac.y, wp.x, wp.y);
      step(state, { p1: dir }, TICK_DT, settings, MAZE);
    }
    expect(Math.round(pac.y)).toBeGreaterThanOrEqual(goal.y - 1);
  });

  it("stands still against a wall instead of bouncing", () => {
    const alley = parseMaze(["#######", "#P....#", "#o....#", "#######"]);
    const state = createGameState(new Map([["p1", "pacman"]]), settings, alley);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    for (const g of state.entities) {
      if (g.role !== "pacman") g.houseTimer = 999;
    }
    pac.x = 1;
    pac.y = 1;
    pac.dir = "right";
    pac.nextDir = "right";
    for (let i = 0; i < 80; i++) step(state, { p1: "right" }, TICK_DT, settings, alley);
    expect(pac.x).toBeCloseTo(5, 1);
    const samples: number[] = [];
    for (let i = 0; i < 45; i++) {
      step(state, { p1: "right" }, TICK_DT, settings, alley);
      samples.push(pac.x);
    }
    expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(0.05);
    expect(pac.dir).toBe("none");
  });

  it("lets frightened pac-man eat a ghost", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings, corridor);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    const ghost = state.entities.find((e) => e.role === "blinky")!;
    pac.x = 2;
    pac.y = 1;
    ghost.x = 2;
    ghost.y = 1;
    ghost.frightened = true;
    ghost.houseTimer = 0;
    state.frightenedUntil = 10;
    const score = state.score;
    step(state, { p1: "none" }, TICK_DT, settings, corridor);
    expect(ghost.eaten).toBe(true);
    expect(state.score).toBeGreaterThan(score);
    expect(state.lives).toBe(3);
  });

  it("ghosts win when they catch pac-man out of lives", () => {
    const oneLife: MatchSettings = { ...settings, lives: 1 };
    const state = createGameState(new Map([["p1", "pacman"]]), oneLife, corridor);
    const pac = state.entities.find((e) => e.role === "pacman")!;
    const ghost = state.entities.find((e) => e.role === "blinky")!;
    pac.x = 3;
    pac.y = 3;
    ghost.x = 3;
    ghost.y = 3;
    ghost.frightened = false;
    ghost.eaten = false;
    ghost.houseTimer = 0;
    step(state, {}, TICK_DT, oneLife, corridor);
    expect(state.status).toBe("ghosts_win");
  });

  it("clones state without aliasing grids", () => {
    const state = createGameState(new Map([["p1", "pacman"]]), settings);
    const copy = cloneState(state);
    copy.pellets[1][1] = !copy.pellets[1][1];
    expect(copy.pellets[1][1]).not.toBe(state.pellets[1][1]);
  });
});

describe("role assignment", () => {
  const players = (n: number): LobbyPlayer[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      role: "unassigned",
      ready: true,
      isHost: i === 0,
    }));

  it("picks one pac-man and unique ghosts at random", () => {
    const map = assignRoles(players(4), "random", () => 0.5);
    const roles = [...map.values()];
    expect(roles.filter((r) => r === "pacman")).toHaveLength(1);
    expect(new Set(roles).size).toBe(4);
  });

  it("keeps manual picks and fills the rest", () => {
    const list = players(3);
    list[1].role = "blinky";
    const map = assignRoles(list, "manual", () => 0.1);
    expect(map.get("p1")).toBe("blinky");
    expect([...map.values()].includes("pacman")).toBe(true);
  });

  it("detects duplicate roles", () => {
    const list = players(2);
    list[0].role = "pacman";
    list[1].role = "pacman";
    expect(uniqueRoles(list)).toBe(false);
  });
});
