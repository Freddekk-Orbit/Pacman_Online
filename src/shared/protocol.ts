import type { Dir, LobbyPlayer, MatchSettings, Role } from "./types.ts";
import type { GameState } from "./types.ts";

export type ClientMsg =
  | {
      type: "hello";
      name: string;
      roomCode?: string;
      create?: boolean;
      settings?: MatchSettings;
      roomName?: string;
      listed?: boolean;
    }
  | { type: "set_role"; playerId: string; role: Role }
  | { type: "set_match"; settings: Partial<MatchSettings> }
  | { type: "set_room"; listed?: boolean; name?: string }
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "input"; dir: Dir }
  | { type: "return_lobby" }
  | { type: "chat"; text: string };

export type ServerMsg =
  | {
      type: "welcome";
      playerId: string;
      roomCode: string;
      isHost: boolean;
      joinUrl: string;
      inviteUrl: string;
      hostHints: string[];
      listed: boolean;
      roomName: string;
    }
  | {
      type: "lobby";
      players: LobbyPlayer[];
      settings: MatchSettings;
      hostId: string;
      listed: boolean;
      roomName: string;
      inviteUrl: string;
    }
  | { type: "start_game"; state: GameState }
  | { type: "state"; state: GameState }
  | { type: "chat"; name: string; text: string }
  | { type: "error"; message: string }
  | { type: "kicked"; reason: string };
