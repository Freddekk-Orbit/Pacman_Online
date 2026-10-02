import { GHOST_ROLES } from "./constants.ts";
import type { GhostRole } from "./constants.ts";
import type { AssignmentMode, LobbyPlayer, Role } from "./types.ts";

export function shuffle<T>(items: T[], rng = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function uniqueRoles(players: LobbyPlayer[]): boolean {
  const used = new Set<string>();
  for (const p of players) {
    if (p.role === "unassigned") continue;
    if (used.has(p.role)) return false;
    used.add(p.role);
  }
  return true;
}

export function assignRoles(
  players: LobbyPlayer[],
  mode: AssignmentMode,
  rng = Math.random,
): Map<string, Exclude<Role, "unassigned">> {
  const result = new Map<string, Exclude<Role, "unassigned">>();
  if (players.length === 0) return result;

  const taken = new Set<Role>();
  if (mode === "manual") {
    for (const p of players) {
      if (p.role !== "unassigned" && !taken.has(p.role)) {
        result.set(p.id, p.role);
        taken.add(p.role);
      }
    }
  }

  const leftover = players.filter((p) => !result.has(p.id));
  const remainingGhosts = GHOST_ROLES.filter((g) => !taken.has(g));
  const needPac = !taken.has("pacman");
  const order = shuffle(leftover, rng);

  if (needPac && order.length) {
    const pac = order.shift()!;
    result.set(pac.id, "pacman");
    taken.add("pacman");
  }

  for (const p of order) {
    const ghost = remainingGhosts.shift();
    if (ghost) {
      result.set(p.id, ghost);
      taken.add(ghost);
    } else {
      result.set(p.id, "clyde");
    }
  }

  if (!taken.has("pacman") && players[0]) {
    result.set(players[0].id, "pacman");
  }

  return result;
}

export function unusedGhosts(used: Iterable<Role>): GhostRole[] {
  const set = new Set(used);
  return GHOST_ROLES.filter((g) => !set.has(g));
}
