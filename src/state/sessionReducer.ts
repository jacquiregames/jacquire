// src/state/sessionReducer.ts
import { GameState } from '../types';

export interface SessionState {
  playerName: string;
  playerToken: string;
  gameStarted: boolean;
  gameState: GameState | null;
}

export type SessionAction =
  | { type: 'NAME_EDITED'; name: string }
  | { type: 'TOKEN_ISSUED'; token: string }
  | { type: 'SESSION_RESTORED'; playerName: string; gameState: GameState }
  | { type: 'GAME_STATE_RECEIVED'; gameState: GameState }
  | { type: 'SESSION_CLEARED' };

export const initialSessionState: SessionState = {
  playerName: sessionStorage.getItem("playerName") || "",
  playerToken: sessionStorage.getItem("playerToken") || "",
  gameStarted: false,
  gameState: null,
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'NAME_EDITED':
      // Only relevant pre-join, while the player is typing into the name
      // field in the lobby — harmless (and unused) once a session exists.
      return { ...state, playerName: action.name };
    case 'TOKEN_ISSUED':
      return { ...state, playerToken: action.token };
    case 'SESSION_RESTORED':
      return { ...state, playerName: action.playerName, gameStarted: true, gameState: action.gameState };
    case 'GAME_STATE_RECEIVED':
      return { ...state, gameStarted: true, gameState: action.gameState };
    case 'SESSION_CLEARED':
      return { playerName: '', playerToken: '', gameStarted: false, gameState: null };
    default:
      return state;
  }
}
