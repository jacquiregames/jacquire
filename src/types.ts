// src/types.ts

export interface Player {
  name: string;
  cash: number;
  tiles: [number, number][];
  stocks: Record<string, number>;
  color: string;
  net_worth: number;
  has_wild_tile: boolean;
  special_powers: string[];
  cash_before_scoring?: number; 
  is_bot?: boolean;
}

export interface FinalBonusPayout {
  player_name: string;
  chain: string;
  amount: number;
  type: "Majority" | "Minority" | "Split Bonus";
}

export interface FinalStats {
  chains_founded: Record<string, number>;
  bonuses_earned: Record<string, number>;
  longest_turn: {
    player_name: string | null;
    duration: number;
  };
}

export interface GameLogEntry {
  turn: number;
  player: string;
  action: string;
  details: Record<string, any>;
  player_states: { name: string; cash: number; net_worth: number }[];
  stock_prices: Record<string, number>;
  timestamp: number;
}

// FIX: this used to be a single interface reused for two structurally
// different backend payloads (survivor tie-break vs. per-player stock
// resolution), with every field marked optional to cover both shapes. That
// gave no real type safety — nothing stopped code from reading a
// resolution-only field while in the tie-break phase or vice versa. The
// backend now sends these as two separate fields (pending_merger_choice and
// pending_stock_resolution), so the types are split to match.
export interface MergerTieChoice {
  player: string;
  row: number;
  col: number;
  chains: string[];
  options: string[];
  pre_merger_sizes: Record<string, number>;
}

export interface StockResolutionData {
  survivor: string;
  defunct_chains: string[];
  resolution_queue: string[];
  current_resolver_idx: number;
  pre_merger_sizes: Record<string, number>;
}

export interface AnimationEvent {
  type: 'expand' | 'merge' | 'found' | 'buy_stock' | 'trade_stock' | 'resolve_merger' | 'other';
  chain?: string;
  source_tile?: [number, number];
  expanded_tiles?: [number, number][];
  survivor?: string;
  defunct_tiles?: Record<string, [number, number][]>;
  merging_tile?: [number, number];
}

export interface GameState {
  players: Player[];
  board: (string | null)[][];
  current_player: string;
  message: string;
  game_started: boolean;
  game_over: boolean;
  is_end_game_possible: boolean;
  stock_prices: Record<string, number>;
  chain_sizes: Record<string, number>;
  active_chains: string[];
  available_chains: { name: string; size: number; price: number; color: string }[];
  stock_counts: Record<string, number>;
  turn_phase: 'place_tile' | 'choose_chain' | 'buy_stock' | 'choose_merger' | 'trade_stocks' | 'trade_stocks_power' | 'game_over' | 'choose_defunct';
  current_turn_stock_count: number;
  max_stocks_to_buy_this_turn: number; 
  pending_merger_choice: MergerTieChoice | null;
  pending_stock_resolution: StockResolutionData | null;
  can_undo_placement: boolean;
  winners: string[];
  last_animation_event: AnimationEvent | null;
  game_log: GameLogEntry[];
  final_bonus_payouts: FinalBonusPayout[];
  // FIX: the backend only includes final_stats once game_over is true
  // (see GameStateResponse.final_stats: Optional[...] = None in models.py);
  // it was `null` at runtime on every non-final state despite this type
  // saying it was always present. GameSummaryPanel already defended against
  // this with a fallback default, but the type itself should be honest so
  // future code doesn't skip that same defensive check.
  final_stats: FinalStats | null;
  formatted_log: string[];
  two_by_two_grids: Record<string, [number, number]>;
  four_by_one_grids: Record<string, [number, number]>;
  tiles_to_place_this_turn: number;  
  power_used_this_turn: boolean;
  free_stocks_this_turn: number;  
  turn_number: number;
  trade_actions_remaining: number;
  // FIX (soft lock): monotonic snapshot counter from the backend (see
  // Game._state_version in game_logic.py). Used by App.tsx's
  // applyGameState() to drop a stale-but-internally-consistent state
  // update that arrives after a newer one already has.
  state_version?: number;
}


