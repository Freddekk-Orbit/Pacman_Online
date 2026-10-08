import { COLS, ROWS } from "../src/shared/constants.ts";
import { MAZE, MAZE_SRC, parseMaze, validateMaze } from "../src/shared/maze.ts";

describe("maze", () => {
  it("is a 28x31 arcade grid", () => {
    expect(MAZE_SRC).toHaveLength(ROWS);
    for (const row of MAZE_SRC) expect(row).toHaveLength(COLS);
    expect(validateMaze()).toEqual([]);
  });

  it("has a pac-man spawn and ghost house", () => {
    expect(MAZE.pacSpawn.x).toBeGreaterThan(0);
    expect(MAZE.ghostSpawns.length).toBeGreaterThanOrEqual(2);
    expect(MAZE.cells.flat().filter((c) => c === "power")).toHaveLength(4);
  });

  it("parses custom layouts", () => {
    const src = ["#####", "#P.o#", "#####"];
    const maze = parseMaze(src);
    expect(maze.pacSpawn).toEqual({ x: 1, y: 1 });
    expect(maze.cells[1][2]).toBe("pellet");
    expect(maze.cells[1][3]).toBe("power");
  });

  it("lets pac-man reach the bottom corridor from spawn", () => {
    const bottom = MAZE.cells[MAZE.rows - 2];
    const open = bottom
      .map((c, x) => ({ c, x }))
      .filter(({ c }) => c === "pellet" || c === "empty" || c === "power");
    expect(open.length).toBeGreaterThan(10);
    expect(MAZE.pacSpawn.y).toBeLessThan(MAZE.rows - 4);
  });

  it("gives the south the same around-corridors as the north", () => {
    expect(MAZE_SRC[1]).toBe(MAZE_SRC[MAZE_SRC.length - 2]);
    expect(MAZE_SRC[5]).toBe("#..........................#");
    expect(MAZE_SRC[24].replace("P", ".")).toBe("#..........................#");
  });
});
