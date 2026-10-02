import type { Dir, LobbyPlayer, MatchSettings, Role } from "./types.ts";
import type { GameState } from "./types.ts";

export type ClientMsg =
  | { type: "hello"; name: string; roomCode?: string; create?: boolean; settings?: MatchSettings }
  | { type: "set_role"; playerId: string; role: Role }
  | { type: "set_match"; settings: Partial<MatchSettings> }
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "input"; dir: Dir }
  | { type: "return_lobby" }
  | { type: "chat"; text: string };

export type ServerMsg =
  | { type: "welcome"; playerId: string; roomCode: string; isHost: boolean; joinUrl: string; hostHints: string[] }
  | { type: "lobby"; players: LobbyPlayer[]; settings: MatchSettings; hostId: string }
  | { type: "start_game"; state: GameState }
  | { type: "state"; state: GameState }
  | { type: "chat"; name: string; text: string }
  | { type: "error"; message: string }
  | { type: "kicked"; reason: string };
