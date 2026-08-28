# src/server/game_logic.py
import random
import asyncio  # used in _end_game_sequence for get_running_loop
import copy
import time
import os
import json
import math
import secrets
from typing import List, Dict, Optional, Tuple, Any
from fastapi import HTTPException

from .models import Player, HotelChain, TurnPhase, SpecialPower 
from .utils import get_price_info, get_chain_color

BOARD_ROWS = 9
BOARD_COLS = 12

class Game:
    def __init__(self, players_data: List[Dict[str, str]], wild_tile_variant: bool = False, special_powers_variant: bool = False, fast_game_variant: bool = False):
        # FIX (trust model): carry each player's /join-issued token onto their
        # Player object. If a caller starts a game without going through the
        # normal lobby flow (e.g. a direct API call), fall back to minting a
        # fresh token server-side rather than leaving it blank — a blank
        # token would make verify_player_token() a no-op for that player.
        self.players = [
            Player(p['name'], p['color'], token=p.get('token') or secrets.token_hex(16), is_bot=bool(p.get('is_bot', False)))
            for p in players_data
        ]
        self.board: List[List[Optional[str]]] = [[None for _ in range(BOARD_COLS)] for _ in range(BOARD_ROWS)]
        self.active_chains: List[str] = []
        self.message = "Game started!"
        self.tile_deck = self._generate_tiles()
        self.game_started = True; self.game_over = False; self.winners: List[str] = []
        self.stock_counts: Dict[str, int] = {chain.value: 25 for chain in HotelChain}
        self.turn_phase = TurnPhase.PLACE_TILE
        self.pending_chain_selection: Optional[Dict] = None; 
        # FIX: this field used to be reused for two structurally different
        # payloads depending on phase — {player, row, col, chains, options,
        # pre_merger_sizes} during CHOOSE_MERGER (survivor tie), and
        # {survivor, defunct_chains, resolution_queue, current_resolver_idx,
        # pre_merger_sizes} during TRADE_STOCKS (per-player stock
        # resolution). Nothing enforced which shape was present for a given
        # phase, so the frontend's PendingMergerChoice type had to make every
        # field optional, giving no real type safety. Split into two
        # separate, single-purpose fields.
        self.pending_merger_choice: Optional[Dict] = None      # CHOOSE_MERGER: survivor tie-break only
        self.pending_stock_resolution: Optional[Dict] = None   # TRADE_STOCKS: per-player defunct stock resolution
        self.pending_defunct_choice: Optional[Dict] = None
        self.current_turn_stock_count = 0; self.can_undo_placement = False
        self.last_tile_placement_state: Optional[Dict] = None; 
        self.last_animation_event: Optional[Dict] = None
        self.turn_number = 1; self.game_log: List[Dict[str, Any]] = []
        self.final_bonus_payouts: List[Dict[str, Any]] = []
        self.formed_2x2_chains = set() 
        self.two_by_two_grids = {} 
        self.formed_4x1_chains = set()
        self.four_by_one_grids = {}
        self.wild_tile_placements = set()
        self.power_used_this_turn = False
        self.tiles_to_place_this_turn = 1
        self.max_stocks_to_buy_this_turn = 3
        self.free_stocks_this_turn = 0
        self.trade_actions_remaining = 0
        self.cash_before_scoring_map: Dict[str, int] = {} 
        self.stats = {"chains_founded": {p['name']: 0 for p in players_data}, "bonuses_earned": {p['name']: 0 for p in players_data}, "longest_turn": {"player_name": None, "duration": 0}, "turn_start_time": time.time() }
        
        self.pending_merger_chains: List[str] = []
        self.current_merger_survivor: Optional[str] = None
        self.pre_merger_sizes_cache: Dict[str, int] = {}

        # FIX (soft lock, part 2): monotonic counter bumped once per
        # to_dict() snapshot. Every mutating action is immediately followed,
        # inside the same lock acquisition, by exactly one to_dict() call
        # (main.py's _finalize_and_broadcast, or bot_ai._run_one_bot_step) —
        # so this always increases in true chronological mutation order,
        # even though the *delivery* of a given snapshot (HTTP response
        # serialization, websocket send) can be delayed/reordered relative
        # to other snapshots taken later. The frontend uses this to refuse
        # to let a slow-to-arrive-but-now-stale snapshot (e.g. the HTTP
        # response for the request that handed the turn to bots, arriving
        # after the bots have already finished and broadcast further
        # updates over the socket) regress the UI backward. See
        # applyGameState() in App.tsx.
        self._state_version = 0
        
        if wild_tile_variant:
            for player in self.players:
                player.has_wild_tile = True

        if special_powers_variant:
            for player in self.players:
                player.special_powers = list(SpecialPower)
                
        if fast_game_variant:
            placed_count = 0
            skipped_tiles = []
            while self.tile_deck and placed_count < 15:
                tile = self.tile_deck.pop()
                r, c = tile
                is_adjacent = False
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < BOARD_ROWS and 0 <= nc < BOARD_COLS:
                        if self.board[nr][nc] is not None:
                            is_adjacent = True
                            break
                if not is_adjacent:
                    self.board[r][c] = "P"
                    placed_count += 1
                else:
                    skipped_tiles.append(tile)
            
            self.tile_deck.extend(skipped_tiles)
            random.shuffle(self.tile_deck)
        
        for player in self.players: player.tiles = [self.tile_deck.pop() for _ in range(6) if self.tile_deck]
        lowest_tile, starting_index = None, 0
        for i, player in enumerate(self.players):
            if player.tiles:
                player_lowest = min(player.tiles)
                if lowest_tile is None or player_lowest < lowest_tile:
                    lowest_tile, starting_index = player_lowest, i
        self.current_player_idx = starting_index
        msg = "Initial game state (Fast Game: 15 tiles placed)" if fast_game_variant else "Initial game state"
        self._log_event(action_type="game_start", details={"message": msg})

    def buy_stock(self, player_name: str, chain: str, quantity: int, token: str = ""):
        self.verify_player_token(player_name, token)
        if self.game_over: raise HTTPException(status_code=400, detail="Game is over")
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        if self.turn_phase != TurnPhase.BUY_STOCK:
            raise HTTPException(status_code=400, detail="Not in stock buying phase.")
        if chain not in self.active_chains:
            raise HTTPException(status_code=400, detail="Chain is not active.")
        if quantity < 1:
            raise HTTPException(status_code=400, detail="Cannot buy zero stocks.")
        
        if self.current_turn_stock_count + quantity > self.max_stocks_to_buy_this_turn:
            raise HTTPException(status_code=400, detail=f"Cannot buy more than {self.max_stocks_to_buy_this_turn} stocks total per turn.")
            
        if self.stock_counts[chain] < quantity:
            raise HTTPException(status_code=400, detail="Not enough stocks available.")
        
        player = self.find_player(player_name)
        size = sum(1 for row in self.board for cell in row if cell == chain)
        price, _, _ = get_price_info(size, HotelChain(chain))
        total_cost = price * quantity

        cost_after_free = max(0, total_cost - (self.free_stocks_this_turn * price))
        if player.cash < cost_after_free:
            raise HTTPException(status_code=400, detail="Not enough cash.")

        free_stocks_used = min(self.free_stocks_this_turn, quantity)
        self.free_stocks_this_turn -= free_stocks_used

        player.cash -= cost_after_free
        
        player.stocks[chain] += quantity
        self.stock_counts[chain] -= quantity
        self.current_turn_stock_count += quantity
        self._log_event("buy_stock", {"chain": chain, "quantity": quantity, "cost": cost_after_free})
        self.last_animation_event = {
            "type": "buy_stock",
            "chain": chain
        }
        self.message = f"Bought {quantity} {chain} stock(s) for ${cost_after_free:,}."
        self.can_undo_placement = False
        self.last_tile_placement_state = None

    def to_dict(self) -> Dict:
        animation_event = self.last_animation_event
        self.last_animation_event = None

        players_list = []
        for p in self.players:
            player_data = {
                "name": p.name,
                "cash": p.cash,
                "tiles": p.tiles,
                "stocks": p.stocks,
                "color": p.color,
                "net_worth": self._calculate_player_net_worth(p),
                "has_wild_tile": p.has_wild_tile,
                "special_powers": [power.value for power in p.special_powers],
                "is_bot": p.is_bot,
            }
            
            if self.game_over:
                player_data["cash_before_scoring"] = self.cash_before_scoring_map.get(p.name, p.cash)

            players_list.append(player_data)

        game_data = {
            "players": players_list,
            "board": self.board,
            "current_player": self.current_player,
            "message": self.message,
            "game_started": self.game_started,
            "game_over": self.game_over,
            "is_end_game_possible": self.is_end_game_possible,
            "stock_prices": self.get_stock_prices(),
            "chain_sizes": self.get_chain_sizes(),
            "active_chains": self.active_chains or [],
            "available_chains": (
                self._get_available_chain_data() if self.pending_chain_selection else 
                self._get_tied_defunct_chain_data() if getattr(self, 'pending_defunct_choice', None) else 
                []
            ), 
            "stock_counts": self.stock_counts,
            "turn_phase": self.turn_phase.value,
            "current_turn_stock_count": self.current_turn_stock_count,
            "pending_merger_choice": self.pending_merger_choice,
            "pending_stock_resolution": self.pending_stock_resolution,
            "can_undo_placement": self.can_undo_placement,
            "winners": self.winners,
            "last_animation_event": animation_event,
            "formatted_log": self._format_log(),
            "game_log": self.game_log,
            "final_bonus_payouts": [], 
            "final_stats": None, 
            "two_by_two_grids": self.two_by_two_grids,
            "four_by_one_grids": self.four_by_one_grids,
            "power_used_this_turn": self.power_used_this_turn,
            "max_stocks_to_buy_this_turn": self.max_stocks_to_buy_this_turn,
            "tiles_to_place_this_turn": self.tiles_to_place_this_turn,
            "free_stocks_this_turn": self.free_stocks_this_turn,
            "trade_actions_remaining": self.trade_actions_remaining,
            "turn_number": self.turn_number,
        }
        
        if self.game_over:
            game_data["final_bonus_payouts"] = self.final_bonus_payouts
            game_data["final_stats"] = self.stats

        self._state_version += 1
        game_data["state_version"] = self._state_version

        # FIX (soft lock): every mutable container above (board, each
        # player's stocks, stock_counts, pending_stock_resolution,
        # pending_merger_choice, active_chains, the 2x2/4x1 grid maps,
        # game_log, ...) was being embedded by *reference*, not by value.
        # That's harmless for the synchronous websocket broadcast in
        # manager.broadcast() (send_json serializes it immediately, before
        # anything else can run), but it's a real bug for the HTTP response
        # path: FastAPI/Starlette doesn't necessarily serialize an
        # endpoint's return value the instant the coroutine returns — and
        # in between, main.py's fire-and-forget bot task (spawned right
        # after this same snapshot was taken, to let bots keep playing
        # a merger's remaining resolution queue) can go on mutating these
        # same objects in place. The result was a torn snapshot: primitive
        # fields like turn_phase (captured as a plain string) stayed frozen
        # at "trade_stocks", while the *referenced* pending_stock_resolution
        # dict kept advancing underneath it — sometimes past the end of its
        # own resolution_queue. The frontend applies whichever of
        # (websocket message, this HTTP response) arrives last, so a
        # slow-to-serialize HTTP response could overwrite an already-correct,
        # fully-resolved state with this inconsistent one: turn_phase still
        # "trade_stocks" but resolution_queue[current_resolver_idx] out of
        # range, so nobody is ever shown as the resolver again. That's the
        # soft lock — the backend had already finished, the UI just never
        # found out. A deep copy makes every to_dict() call an atomic,
        # self-consistent snapshot no matter when it's actually serialized.
        return copy.deepcopy(game_data)
        
    def _draw_tile_for(self, player: "Player", count: int, player_override: Optional[str] = None) -> int:
        """
        FIX: single, shared path for handing a player replacement tile(s)
        from self.tile_deck. Previously only end_turn() and
        discard_and_draw_tiles() filtered out squares in
        self.wild_tile_placements before adding a drawn tile to a hand;
        _advance_to_next_player()'s per-turn top-up and the Take 5 special
        power both drew straight from the deck with no such check. Since a
        wild tile lets a player occupy a board square without its real deck
        tile ever being removed from circulation, that real tile can still
        be drawn later by *any* player through *any* draw path — and once
        drawn, it's stuck: is_tile_playable() correctly refuses it (the
        square's occupied), but is_tile_dead() does NOT flag it as
        discardable, since it only considers "sandwiched between two safe
        chains" dead, not "already placed" (which is never possible to draw
        outside the wild-tile case, so it was never handled). Without this
        redraw-on-wild-square logic, that tile would sit in the player's
        hand for the rest of the game, silently costing them one of their
        six tile slots.

        Every draw site now calls this instead of `self.tile_deck.pop()`
        directly, so the fix can't drift out of sync between sites again.

        Returns the number of tiles actually added to the hand (redraws for
        a wild-placed square don't count toward `count`, matching how a
        player would experience "draw 5" or "top up to 6" in the physical
        game).
        """
        drawn = 0
        while drawn < count and self.tile_deck:
            new_tile = self.tile_deck.pop()
            if tuple(new_tile) in self.wild_tile_placements:
                self._log_event(
                    "discard_and_draw",
                    {"discarded_tile": new_tile},
                    player_override=player_override or player.name,
                )
                continue
            player.tiles.append(new_tile)
            drawn += 1
        return drawn

    def _advance_to_next_player(self):
        self.power_used_this_turn = False
        self.tiles_to_place_this_turn = 1
        self.max_stocks_to_buy_this_turn = 3
        self.free_stocks_this_turn = 0
        self.trade_actions_remaining = 0
        self.turn_number += 1
        self.current_player_idx = (self.current_player_idx + 1) % len(self.players)
        self.turn_phase = TurnPhase.PLACE_TILE
        self.current_turn_stock_count = 0
        self.can_undo_placement = False
        self.last_tile_placement_state = None
        current_player = self.players[self.current_player_idx]
        if self.tile_deck and len(current_player.tiles) < 6:
            self._draw_tile_for(current_player, 6 - len(current_player.tiles))
        self._log_event("end_turn", {"next_player": self.current_player})
        self.message = f"{self.current_player}'s turn - place a tile."

    def _calculate_player_net_worth(self, player: Player) -> int:
        stock_value = sum(self.get_stock_prices().get(chain, 0) * count for chain, count in player.stocks.items())
        return player.cash + stock_value

    def _check_for_new_2x2_grid(self, chain_name: str):
        if chain_name in self.formed_2x2_chains:
            return

        for r in range(BOARD_ROWS - 1):
            for c in range(BOARD_COLS - 1):
                tiles_to_check = [(r, c), (r+1, c), (r, c+1), (r+1, c+1)]
                
                is_2x2 = all(self.board[row][col] == chain_name for row, col in tiles_to_check)
                if not is_2x2:
                    continue
                
                is_occupied = any(self._is_tile_occupied_by_special_grid(row, col) for row, col in tiles_to_check)
                if not is_occupied:
                    self.formed_2x2_chains.add(chain_name)
                    self.two_by_two_grids[chain_name] = (r, c)
                    self._log_event("achieved_2x2", {"chain": chain_name, "at": (r, c)})
                    return 
                    
    def _check_for_new_4x1_grid(self, chain_name: str):
        if chain_name in self.formed_4x1_chains:
            return

        for r in range(BOARD_ROWS - 3):
            for c in range(BOARD_COLS):
                tiles_to_check = [(r, c), (r+1, c), (r+2, c), (r+3, c)]
                
                is_4x1 = all(self.board[row][col] == chain_name for row, col in tiles_to_check)
                if not is_4x1:
                    continue

                is_occupied = any(self._is_tile_occupied_by_special_grid(row, col) for row, col in tiles_to_check)
                if not is_occupied:
                    self.formed_4x1_chains.add(chain_name)
                    self.four_by_one_grids[chain_name] = (r, c)
                    self._log_event("achieved_4x1", {"chain": chain_name, "at": (r, c)})
                    return
                
    def _check_and_auto_advance(self):
        """Checks if the current player has any valid moves in the buy phase, otherwise auto-advances."""
        if self.turn_phase != TurnPhase.BUY_STOCK:
            return

        player = self.find_player(self.current_player)

        if self.can_undo_placement:
            return

        if self.is_end_game_possible:
            return

        stock_prices = self.get_stock_prices()
        can_buy = any(
            price > 0 and (player.cash >= price or self.free_stocks_this_turn > 0) and self.stock_counts.get(chain, 0) > 0
            for chain, price in stock_prices.items() if chain in self.active_chains
        )
        if can_buy:
            return

        self.message = f"{player.name} has no available actions. Advancing to the next turn."
        self._advance_to_next_player()

    def _continue_turn_after_action(self):
        """Helper to decide the next phase after a tile action is fully resolved."""
        self.tiles_to_place_this_turn -= 1
        if self.tiles_to_place_this_turn > 0:
            self.turn_phase = TurnPhase.PLACE_TILE
            self.message = f"You may place {self.tiles_to_place_this_turn} more tile(s)."
        else:
            if self.trade_actions_remaining > 0:
                self.turn_phase = TurnPhase.TRADE_STOCKS_POWER
                self.message = "Tile placement complete. You may now use your Trade 2 power."
            else:
                self.turn_phase = TurnPhase.BUY_STOCK
                self.message = "Tile placement phase is over. You may now buy stocks."
                self._check_and_auto_advance()
 
    def choose_chain(self, player_name: str, chain: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        p = self.pending_chain_selection
        if not p:
            raise HTTPException(status_code=400, detail="No pending chain selection.")
        if chain not in p["options"]:
            raise HTTPException(status_code=400, detail="Invalid chain choice.")
        self.pending_chain_selection = None
        self.active_chains.append(chain)
        r, c = p["row"], p["col"]
        self.board[r][c] = chain
        self.expand_chain(r, c, chain)

        self._log_event("found_chain", {"chain": chain, "tile": (r, c)})
        self.stats["chains_founded"][player_name] += 1
        
        self.last_animation_event = {
            "type": "found",
            "chain": chain
        }
        
        if self.get_chain_sizes().get(chain, 0) >= 11:
            self._log_event("chain_safe", {"chain": chain})
        
        self._check_for_new_2x2_grid(chain)
        self._check_for_new_4x1_grid(chain)
            
        pl = self.find_player(player_name)
        if self.stock_counts[chain] > 0:
            pl.stocks[chain] += 1
            self.stock_counts[chain] -= 1
         
        self._continue_turn_after_action()

    def choose_defunct(self, player_name: str, chain: str, token: str = ""):
        self.verify_player_token(player_name, token)
        p = getattr(self, 'pending_defunct_choice', None)
        if not p or p["player"] != player_name:
            raise HTTPException(status_code=400, detail="No pending defunct choice.")
        if chain not in p["options"]:
            raise HTTPException(status_code=400, detail="Invalid chain choice.")
        
        self.pending_defunct_choice = None
        self._log_event("defunct_choice", {"chosen_defunct": chain}, player_override=player_name)
        self._next_defunct_chain_resolution(chosen_chain=chain)

    def choose_merger(self, player_name: str, chain: str, token: str = ""):
        self.verify_player_token(player_name, token)
        p = self.pending_merger_choice
        if not p or p["player"] != player_name:
            raise HTTPException(status_code=400, detail="No pending merger choice.")
        if chain not in p["options"]:
            raise HTTPException(status_code=400, detail="Invalid chain choice.")
        
        self._log_event("merger_choice", {"chosen_survivor": chain})
        
        r, c = p["row"], p["col"]
        pre_merger_sizes = p["pre_merger_sizes"]
        # FIX: this used to rely on _next_defunct_chain_resolution()
        # incidentally overwriting/clearing self.pending_merger_choice as a
        # side effect of setting up the (previously shared) TRADE_STOCKS
        # payload. Now that CHOOSE_MERGER and TRADE_STOCKS have separate
        # fields, this tie-choice payload has to be cleared explicitly once
        # it's been consumed, or it lingers in game state/to_dict() after
        # the phase has moved on.
        self.pending_merger_choice = None
        self._execute_merge(r, c, p["chains"], chain, pre_merger_sizes)

    def creates_new_chain(self, row: int, col: int) -> bool:
        original = self.board[row][col]
        self.board[row][col] = "P"
        visited = set()
        def dfs(r: int, c: int) -> int:
            if not (0 <= r < BOARD_ROWS and 0 <= c < BOARD_COLS): return 0
            if (r, c) in visited: return 0
            if self.board[r][c] != "P": return 0
            visited.add((r, c))
            count = 1
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                count += dfs(r + dr, c + dc)
            return count
        total = dfs(row, col)
        self.board[row][col] = original
        return total >= 2

    @property
    def current_player(self) -> str: return self.players[self.current_player_idx].name

    def discard_and_draw_tiles(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(400, "Not your turn.")
        if self.turn_phase != TurnPhase.PLACE_TILE:
            raise HTTPException(400, "Can only discard tiles during the tile placement phase.")
        
        player = self.find_player(player_name)
        
        dead_tiles = [tile for tile in player.tiles if self.is_tile_dead(tile)]
        
        if not any(self.is_tile_playable(tile) for tile in player.tiles):
            self.message = f"{player_name} has no valid tile placements and must skip."
            # FIX: set to 1 so _continue_turn_after_action (which decrements by 1) lands at 0.
            self.tiles_to_place_this_turn = 1
            self._continue_turn_after_action()
            return
        
        if not dead_tiles:
            raise HTTPException(400, "You do not have any unplayable tiles to discard.")

        for t in dead_tiles:
            player.tiles.remove(t)
            self._log_event("discard_and_draw", {"discarded_tile": t}, player_override=player.name) 
        
        drawn = self._draw_tile_for(player, 6 - len(player.tiles), player_override=player.name)

        self.message = f"{player_name} discarded {len(dead_tiles)} dead tile(s) and drew {drawn} replacement(s)."
        
        if not any(self.is_tile_playable(tile) for tile in player.tiles):
            self.message += " Still no valid moves. Advancing to buy phase."
            # FIX: set to 1 so _continue_turn_after_action (which decrements by 1) lands at 0.
            self.tiles_to_place_this_turn = 1
            self._continue_turn_after_action()
    
    @staticmethod
    def _write_highscore(scores_file: str, entries_to_save: list) -> None:
        """Pure sync helper — safe to call from asyncio.to_thread."""
        with open(scores_file, "w") as f:
            for entry in entries_to_save:
                f.write(json.dumps(entry) + "\n")
    
    def _end_game_sequence(self):
        if self.game_over: return
        self.game_over = True; self.turn_phase = TurnPhase.GAME_OVER
        final_sizes = self.get_chain_sizes()
        self.cash_before_scoring_map = {p.name: p.cash for p in self.players} 
        
        for chain in self.active_chains: 
            self._pay_bonuses(chain, final_sizes.get(chain, 0), is_final_payout=True)
            
        final_scores = []
        max_net_worth = -1
        
        for p in self.players:
            stock_value = sum(self.get_stock_prices().get(chain, 0) * count for chain, count in p.stocks.items())
            total_bonus = sum(b['amount'] for b in self.final_bonus_payouts if b['player_name'] == p.name)
            net_worth = self.cash_before_scoring_map[p.name] + stock_value + total_bonus 
            
            p.net_worth = net_worth
            final_scores.append({"player": p, "net_worth": net_worth})
            if net_worth > max_net_worth: 
                max_net_worth = net_worth
                
        self.winners = [s["player"].name for s in final_scores if s["net_worth"] == max_net_worth]
        winner_str = ', '.join(self.winners)
        
        if len(self.winners) > 1: 
            self.message = f"Game over! It's a tie between: {winner_str} with a net worth of ${max_net_worth:,}!"
        else: 
            self.message = f"Game over! The winner is {winner_str} with a net worth of ${max_net_worth:,}!"

        try:
           scores_file = os.path.join(os.path.dirname(__file__), "highscore.txt")
           existing_scores = []
           if os.path.exists(scores_file):
               with open(scores_file, "r") as f:
                   for line in f:
                       if line.strip():
                           existing_scores.append(json.loads(line.strip()))

           for winner_name in self.winners:
               existing_scores.append({
                   "name": winner_name,
                   "score": max_net_worth,
                   "players": len(self.players)
               })

           grouped_scores: dict = {}
           for s in existing_scores:
               p_count = s.get("players", len(self.players))
               grouped_scores.setdefault(p_count, []).append(s)

           final_scores_to_save = []
           for p_count, group in grouped_scores.items():
               group.sort(key=lambda x: x["score"], reverse=True)
               final_scores_to_save.extend(group[:3])

           # Schedule the blocking write off the event loop.
           # FIX: capture the future and attach an error callback so failures
           # are logged rather than silently swallowed.
           loop = asyncio.get_running_loop()
           future = loop.run_in_executor(None, Game._write_highscore, scores_file, final_scores_to_save)

           def _log_write_error(f):
               exc = f.exception()
               if exc:
                   import logging
                   logging.error(f"Failed to write high score: {exc}")

           future.add_done_callback(_log_write_error)
        except Exception as e:
           print("Failed to save high score:", e)
    
    def end_power_trade(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(400, "Not your turn.")
        if self.turn_phase != TurnPhase.TRADE_STOCKS_POWER:
            raise HTTPException(400, "Not in the trading phase.")
        
        self.turn_phase = TurnPhase.BUY_STOCK
        self.message = "Trading complete. You may now buy stocks."
        self._log_event("end_power_trade", {})
        self._check_and_auto_advance()

    def end_tile_placement(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(400, "Not your turn.")
        if self.turn_phase != TurnPhase.PLACE_TILE:
            raise HTTPException(400, "Not in the tile placement phase.")
        
        self.tiles_to_place_this_turn = 0 
        self.turn_phase = TurnPhase.BUY_STOCK
        self.message = "Ended tile placement. You may now buy stocks."
        self._log_event("end_tile_placement", {})    
    
    def end_turn(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(400, "Not your turn")
        if self.turn_phase not in {TurnPhase.BUY_STOCK}:
            raise HTTPException(400, "Cannot end turn at this phase")
        current_time = time.time()
        turn_duration = current_time - self.stats["turn_start_time"]

        if turn_duration > self.stats["longest_turn"]["duration"]:
            self.stats["longest_turn"]["player_name"] = player_name
            self.stats["longest_turn"]["duration"] = round(turn_duration)

        self.stats["turn_start_time"] = current_time    
        player = self.find_player(player_name)
        
        dead_tiles = [tile for tile in player.tiles if self.is_tile_dead(tile)]
        for t in dead_tiles:
            player.tiles.remove(t)
            self._log_event("discard_and_draw", {"discarded_tile": t}, player_override=player.name)
            
        drew_tile = self._draw_tile_for(player, 6 - len(player.tiles), player_override=player.name) > 0

        if dead_tiles:
            self.message = f"{player_name}'s turn ended (discarded {len(dead_tiles)} dead tile(s))."
        elif drew_tile:
            self.message = f"{player_name}'s turn ended and drew a tile."
        else:
            self.message = f"{player_name}'s turn ended (hand full or deck empty)."
            
        self._advance_to_next_player()

    def _execute_merge(self, row: int, col: int, chains: List[str], winner: str, pre_merger_sizes: Dict[str, int]):
        defunct_chains = [c for c in chains if c != winner]
        
        defunct_chains.sort(key=lambda c: pre_merger_sizes.get(c, 0), reverse=True)
        
        defunct_tiles = {chain: [] for chain in defunct_chains}
        
        self._log_event("merge", { "survivor": winner, "defunct": defunct_chains, "tile": (row, col) })
        
        for r_idx, r_val in enumerate(self.board):
            for c_idx, c_val in enumerate(r_val):
                if c_val in defunct_chains:
                    defunct_tiles[c_val].append((r_idx, c_idx))
                    
        self.last_animation_event = {
            "type": "merge", "survivor": winner, "defunct_tiles": defunct_tiles,
            "merging_tile": (row, col)
        }
        self.board[row][col] = winner
        self.expand_chain(row, col, winner)
        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                if self.board[r][c] in chains and self.board[r][c] != winner:
                    self.board[r][c] = winner
                    
        for chain in defunct_chains:
            self._pay_bonuses(chain, pre_merger_sizes.get(chain, 0))
            if chain in self.active_chains: self.active_chains.remove(chain)

            if chain in self.two_by_two_grids:
                if winner not in self.two_by_two_grids:
                    self.two_by_two_grids[winner] = self.two_by_two_grids[chain]
                    self.formed_2x2_chains.add(winner)
                del self.two_by_two_grids[chain]
            if chain in self.formed_2x2_chains: self.formed_2x2_chains.remove(chain)

            if chain in self.four_by_one_grids:
                if winner not in self.four_by_one_grids:
                    self.four_by_one_grids[winner] = self.four_by_one_grids[chain]
                    self.formed_4x1_chains.add(winner)
                del self.four_by_one_grids[chain]
            if chain in self.formed_4x1_chains: self.formed_4x1_chains.remove(chain)
                
        self._check_for_new_2x2_grid(winner)
        self._check_for_new_4x1_grid(winner)

        self.pending_merger_chains = defunct_chains.copy()
        self.current_merger_survivor = winner
        self.pre_merger_sizes_cache = pre_merger_sizes

        self._next_defunct_chain_resolution()

    def _next_defunct_chain_resolution(self, chosen_chain: Optional[str] = None):
        if not hasattr(self, 'pending_merger_chains') or not self.pending_merger_chains:
            self.pending_stock_resolution = None
            self.pending_defunct_choice = None
            self._continue_turn_after_action()
            return
            
        if chosen_chain:
            current_defunct = chosen_chain
            if current_defunct in self.pending_merger_chains:
                self.pending_merger_chains.remove(current_defunct)
        else:
            current_size = self.pre_merger_sizes_cache.get(self.pending_merger_chains[0], 0)
            tied_chains = [c for c in self.pending_merger_chains if self.pre_merger_sizes_cache.get(c, 0) == current_size]

            if len(tied_chains) > 1:
                self.turn_phase = TurnPhase.CHOOSE_DEFUNCT
                self.pending_defunct_choice = {
                    "player": self.current_player,
                    "options": tied_chains
                }
                self.message = f"Defunct size tie: {self.current_player} must choose which chain resolves first."
                return
            
            current_defunct = self.pending_merger_chains.pop(0)

        winner = self.current_merger_survivor
        
        eligible_players_for_resolution = []
        for i in range(len(self.players)):
            p_idx = (self.current_player_idx + i) % len(self.players)
            player = self.players[p_idx]
            
            if player.stocks.get(current_defunct, 0) > 0:
                eligible_players_for_resolution.append(player.name)

        if eligible_players_for_resolution:
            self.turn_phase = TurnPhase.TRADE_STOCKS
            self.pending_stock_resolution = {
                "survivor": winner, 
                "defunct_chains": [current_defunct],
                "resolution_queue": eligible_players_for_resolution, 
                "current_resolver_idx": 0,
                "pre_merger_sizes": self.pre_merger_sizes_cache
            }
            self.message = f"Merged into {winner}. {eligible_players_for_resolution[0]} must resolve {current_defunct} stock."
        else:
            self._next_defunct_chain_resolution()

    def _format_log_entry(self, entry: Dict[str, Any]) -> Optional[str]:
        action = entry.get('action')
        details = entry.get('details', {})
        player_name = entry.get('player')

        if action == 'use_special_power':
            power = details['power']
            power_icons = {
                "Trade 2": "t2",
                "Free 3": "f3",
                "Place 4": "p4",
                "Buy 5": "b5",
                "Take 5": "t5"
            }
            icon = power_icons.get(power)
            icon_str = f"[[ICON:{icon}]]" if icon else ""
            return f"Used Special Power: {power} {icon_str}"

        if action == 'found_chain':
            return f"Founded\n [[{details['chain']}]]"
        if action == 'expand_chain':
            return f"Expanded\n [[{details['chain']}]]"
        if action == 'buy_stock':
            return f"Purchased {details['quantity']}\n [[{details['chain']}]]"
        if action == 'chain_safe':
            return f"[[{details['chain']}]]\n is now safe"
        if action == 'defunct_choice':
            return f"{player_name} chose [[{details['chosen_defunct']}]] to resolve first."    
        if action == 'merger_choice':
            return f"Survivor\n [[{details['chosen_survivor']}]]"    
        if action == 'merge':
            survivor = details.get('survivor', 'New Chain')
            defunct = details.get('defunct', [])
            if len(defunct) == 1:
                return f"[[LOGO:{survivor}]] \n [[JACQUIRED]] \n [[LOGO:{defunct[0]}]]"
            elif len(defunct) == 2:
                return f"[[LOGO:{survivor}]] \n [[JACQUIRED]] \n [[LOGO:{defunct[0]}]] \n and \n [[LOGO:{defunct[1]}]]"
            elif len(defunct) == 3:
                return f"[[LOGO:{survivor}]] \n [[JACQUIRED]] \n [[LOGO:{defunct[0]}]] \n and \n [[LOGO:{defunct[1]}]] \n and \n [[LOGO:{defunct[2]}]]"
            else:
                return f"[[LOGO:{survivor}]] [[JACQUIRED]] an unknown Hotel"
        if action == 'bonus_payout':
            recipients = details['recipients']
            amount = details['amount']
            bonus_type = details['type']
            
            if len(recipients) > 1:
                names = ' and '.join(recipients)
                if bonus_type == "Split Bonus":
                    return f"Majority & Minority Shareholder Bonuses\n{names} split, each receiving: ${amount:,}"
                return f"Minority Shareholder Bonus\n{names} split, each receiving: ${amount:,}"
            return f"{bonus_type} Shareholder Bonus\n{recipients[0]} received ${amount:,}"
        if action == 'resolve_merger':
            log_parts = []
            survivor = details.get('survivor', 'New Chain') 
            for chain, decision in details.get('decisions', {}).items():
                traded = decision.get('trade', 0)
                sold = decision.get('sell', 0)
                held = decision.get('hold', 0)
                sell_value = decision.get('sell_value', 0)
                
                chain_parts = []
                if traded > 0:
                    received = traded // 2
                    chain_parts.append(f"{player_name} Traded \n {traded} [[CARD:{chain}]] for {received} [[CARD:{survivor}]]")                 
                if sold > 0:
                    chain_parts.append(f"{player_name} Sold \n {sold} [[CARD:{chain}]] for ${sell_value:,}")
                if held > 0:
                    chain_parts.append(f"{player_name} Held  {held} [[CARD:{chain}]] ")
                
                log_parts.extend(chain_parts) 

            return "\n\n".join(log_parts) if log_parts else None
        if action == 'undo_placement':
            return f"{player_name} undid their tile placement."
        if action == 'discard_and_draw':
            r, c = details['discarded_tile']
            tile_str = f"{chr(ord('A') + r)}{c + 1}"
            return f"Defunct Tile Discarded\n{player_name} replaced {tile_str}"
            
        return None

    def expand_chain(self, row: int, col: int, chain: str):
        expanded_tiles = []
        stack = [(row, col)]
        visited = set()
        while stack:
            r, c = stack.pop()
            if (r, c) in visited:
                continue
            visited.add((r, c))
            for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                nr, nc = r+dr, c+dc
                if 0 <= nr < BOARD_ROWS and 0 <= nc < BOARD_COLS and (nr, nc) not in visited:
                    neighbor_val = self.board[nr][nc]
                    if neighbor_val == "P":
                        self.board[nr][nc] = chain
                        expanded_tiles.append((nr, nc))
                        stack.append((nr, nc))
                    elif neighbor_val == chain:
                        stack.append((nr, nc))
        return expanded_tiles

    def find_player(self, player_name: str) -> Player:
        for p in self.players:
            if p.name == player_name: return p
        raise HTTPException(status_code=404, detail="Player not found")

    def verify_player_token(self, player_name: str, token: str) -> Player:
        """
        FIX (trust model): every mutating action is called as a specific
        player, but until now nothing checked that the caller actually was
        that player — any client could send any player_name. This confirms
        the token presented matches the one issued to that player at /join
        before any state-mutating method proceeds.
        """
        player = self.find_player(player_name)
        if not player.token or token != player.token:
            raise HTTPException(status_code=401, detail="Invalid or missing player token.")
        return player

    def _format_log(self) -> List[str]:
        if not self.game_log:
            return []
        formatted = []
        current_turn_events = []
        for i, entry in enumerate(self.game_log):
            if entry['action'] == 'place_tile':
                if current_turn_events:
                    formatted.extend(current_turn_events)
                    current_turn_events = []
                r, c = entry['details']['tile']
                tile_str = f"{chr(ord('A') + r)}{c + 1}"
                header = f"Turn {entry['turn']}: {entry['player']} - {tile_str}"
                
                if (r, c) in self.wild_tile_placements:
                    header += " [[ICON:wildtile]]"
                
                formatted.append(header)
            message = self._format_log_entry(entry)
            if message:
                current_turn_events.append(message)
        if current_turn_events:
            formatted.extend(current_turn_events)
        return formatted

    def _generate_tiles(self) -> List[Tuple[int, int]]:
        tiles = [(r, c) for r in range(BOARD_ROWS) for c in range(BOARD_COLS)]
        random.shuffle(tiles); return tiles

    def get_adjacent_chains(self, row: int, col: int) -> List[str]:
        chains = set()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            r, c = row + dr, col + dc
            if 0 <= r < BOARD_ROWS and 0 <= c < BOARD_COLS:
                val = self.board[r][c]
                if val in [item.value for item in HotelChain]:
                    chains.add(val)
        return list(chains)

    def _get_available_chain_data(self) -> List[Dict]:
        result = []
        for chain in HotelChain:
            if chain.value not in self.active_chains:
                price, _, _ = get_price_info(1, chain)
                color = get_chain_color(chain.value)
                result.append({"name": chain.value, "size": 1, "price": price, "color": color})
        return result
   
    def _get_tied_defunct_chain_data(self) -> List[Dict]:
        if not getattr(self, 'pending_defunct_choice', None):
            return []
        result = []
        for chain in self.pending_defunct_choice["options"]:
            color = get_chain_color(chain)
            result.append({"name": chain, "size": self.pre_merger_sizes_cache.get(chain, 0), "price": 0, "color": color})
        return result

    def get_chain_sizes(self) -> Dict[str, int]:
        sizes = {chain.value: 0 for chain in HotelChain}
        for row in self.board:
            for cell in row:
                if cell in sizes: sizes[cell] += 1
        return sizes

    def get_stock_prices(self) -> Dict[str, int]:
        prices = {chain.value: 0 for chain in HotelChain}
        sizes = self.get_chain_sizes()
        
        for chain_str in self.active_chains:
            size = sizes.get(chain_str, 0)
            price, _, _ = get_price_info(size, HotelChain(chain_str))
            prices[chain_str] = price
            
        return prices

    def get_all_playable_tiles(self) -> List[Tuple[int, int]]:
        playable_tiles = []
        current_sizes = self.get_chain_sizes()
        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                tile = (r, c)
                if self.is_tile_playable(tile, current_sizes):
                    playable_tiles.append(tile)
        return playable_tiles
 
    def get_all_dead_tiles(self) -> List[Tuple[int, int]]:
        dead_tiles = []
        current_sizes = self.get_chain_sizes()
        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                tile = (r, c)
                if self.is_tile_dead(tile, current_sizes):
                    dead_tiles.append(tile)
        return dead_tiles

    def handle_merger(self, row: int, col: int, chains: List[str]):
        pre_merger_sizes = self.get_chain_sizes()
        self.pending_chain_selection = None
        sizes = self.get_chain_sizes()
        merging_sizes = {c: sizes.get(c, 0) for c in chains}
        safe = [c for c, sz in merging_sizes.items() if sz >= 11]
        if len(safe) >= 2:
            raise HTTPException(status_code=400, detail="Cannot merge two safe chains.")
        max_size = max(merging_sizes.values())
        top = [c for c, sz in merging_sizes.items() if sz == max_size]
        if len(top) > 1:
            self.pending_merger_choice = {
                "player": self.current_player, "row": row, "col": col, "chains": chains,
                "options": top, "pre_merger_sizes": pre_merger_sizes
            }
            self.turn_phase = TurnPhase.CHOOSE_MERGER
            self.message = f"Merge tie: choose surviving chain of {', '.join(top)}"
            return
        winner = top[0]
        self._execute_merge(row, col, chains, winner, pre_merger_sizes) 

    def is_chain_safe(self, chain_name):
        return self.get_chain_sizes().get(chain_name, 0) >= 11

    @property
    def is_end_game_possible(self) -> bool:
        if not self.active_chains:
            return False
        sizes = self.get_chain_sizes()
        active_chain_sizes = [size for size in sizes.values() if size > 0]
        if not active_chain_sizes:
            return False
        all_safe = all(size >= 11 for size in active_chain_sizes)
        any_too_big = any(size >= 41 for size in active_chain_sizes)
        return all_safe or any_too_big

    def _is_tile_occupied_by_special_grid(self, r_check: int, c_check: int) -> bool:
        for r, c in self.two_by_two_grids.values():
            if r <= r_check <= r + 1 and c <= c_check <= c + 1:
                return True
        for r, c in self.four_by_one_grids.values():
            if c == c_check and r <= r_check <= r + 3:
                return True
        return False

    def is_tile_dead(self, tile, current_sizes=None):
        row, col = tile
        if self.board[row][col] is not None:
            return False
            
        if current_sizes is None:
            current_sizes = self.get_chain_sizes()
            
        adj_chains = self.get_adjacent_chains(row, col)
        if len(adj_chains) > 1:
            safe = [c for c in adj_chains if current_sizes.get(c, 0) >= 11]
            if len(safe) >= 2:
                return True
        return False

    def is_tile_playable(self, tile, current_sizes=None):
        row, col = tile
        if self.board[row][col] is not None:
            return False
            
        if current_sizes is None:
            current_sizes = self.get_chain_sizes()
            
        adj_chains = self.get_adjacent_chains(row, col)
        
        if len(adj_chains) > 1:
            safe = [c for c in adj_chains if current_sizes.get(c, 0) >= 11]
            if len(safe) >= 2:
                return False   
                
        if not adj_chains and len(self.active_chains) == 7:
            if self.creates_new_chain(row, col):
                return False
                
        return True

    def _log_event(self, action_type: str, details: Dict, player_override: Optional[str] = None):
        player_states = []
        for p in self.players:
            player_states.append({
                "name": p.name,
                "cash": p.cash,
                "net_worth": self._calculate_player_net_worth(p)
            })

        log_entry = {
            "turn": self.turn_number,
            "player": player_override or self.current_player,
            "action": action_type,
            "details": details,
            "player_states": player_states,
            "stock_prices": self.get_stock_prices(),
            "timestamp": time.time() 
        }
        self.game_log.append(log_entry)

    def _pay_bonuses(self, chain_name: str, chain_size: int, is_final_payout: bool = False):
        _, majority_bonus, minority_bonus = get_price_info(chain_size, HotelChain(chain_name))
        holders = sorted([(p, p.stocks.get(chain_name, 0)) for p in self.players if p.stocks.get(chain_name, 0) > 0], key=lambda x: x[1], reverse=True)
        
        if not holders:
            return

        def record_bonus(player, amount, type_str):
            player.cash += amount
            self.stats["bonuses_earned"][player.name] += amount
            if is_final_payout:
                self.final_bonus_payouts.append({"player_name": player.name, "chain": chain_name, "amount": amount, "type": type_str})

        top_share_count = holders[0][1]
        maj_winners = [h for h in holders if h[1] == top_share_count]

        if len(maj_winners) > 1:
            bonus = math.ceil(((majority_bonus + minority_bonus) / len(maj_winners)) / 100.0) * 100
            if not is_final_payout:
                self._log_event('bonus_payout', {'chain': chain_name, 'recipients': [p.name for p, _ in maj_winners], 'amount': bonus, 'type': 'Split Bonus'}, player_override=self.current_player)
            for p, _ in maj_winners:
                record_bonus(p, bonus, "Split Bonus")
        else:
            majority_winner_player = maj_winners[0][0]
            record_bonus(majority_winner_player, majority_bonus, "Majority")
            if not is_final_payout:
                self._log_event('bonus_payout', {'chain': chain_name, 'recipients': [majority_winner_player.name], 'amount': majority_bonus, 'type': 'Majority'}, player_override=self.current_player)

            if len(holders) == 1:
                record_bonus(majority_winner_player, minority_bonus, "Minority")
                if not is_final_payout:
                    self._log_event('bonus_payout', {'chain': chain_name, 'recipients': [majority_winner_player.name], 'amount': minority_bonus, 'type': 'Minority'}, player_override=self.current_player)
            else:
                remaining = [h for h in holders if h[1] < top_share_count]
                if remaining:
                    second_share_count = remaining[0][1]
                    min_winners = [h for h in remaining if h[1] == second_share_count]
                    bonus = math.ceil((minority_bonus / len(min_winners)) / 100.0) * 100
                    if not is_final_payout:
                        self._log_event('bonus_payout', {'chain': chain_name, 'recipients': [p.name for p, _ in min_winners], 'amount': bonus, 'type': 'Minority'}, player_override=self.current_player)
                    
                    for p, _ in min_winners:
                        record_bonus(p, bonus, "Minority")
                        
    def place_tile(self, player_name: str, row: int, col: int, token: str = "", is_wild_tile: bool = False):
        self.verify_player_token(player_name, token)
        outcome_is_paused = False

        if not (0 <= row < BOARD_ROWS and 0 <= col < BOARD_COLS):
            raise HTTPException(status_code=400, detail="Invalid tile coordinates.")
        if self.board[row][col] is not None:
            raise HTTPException(status_code=400, detail="Tile already placed.")
        player = self.find_player(player_name)
        if (row, col) not in player.tiles:
            raise HTTPException(status_code=400, detail="Tile not in player's hand.")
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        if self.turn_phase != TurnPhase.PLACE_TILE:
            raise HTTPException(status_code=400, detail="Not in tile placement phase.")
        self.can_undo_placement = False
        self.last_tile_placement_state = None
        state_snapshot = {
            "board": [b_row[:] for b_row in self.board],
            "player_tiles": player.tiles[:],
            "player_name": player_name,
        }

        # FIX: validate the safe-chain constraint BEFORE removing the tile or
        # writing to the game log, so a rejected placement leaves no trace.
        adj_chains_pre = self.get_adjacent_chains(row, col)
        if len(adj_chains_pre) > 1:
            safe_chains_pre = [chain for chain in adj_chains_pre if self.is_chain_safe(chain)]
            if len(safe_chains_pre) >= 2:
                raise HTTPException(status_code=400, detail="Cannot merge two safe chains.")

        # FIX: validate the "cannot found an 8th chain" constraint BEFORE
        # removing the tile or writing to the game log, mirroring the
        # safe-chain fix above. Without this, a tile that would need to
        # found an 8th chain gets removed from the player's hand and logged
        # as placed, then the request fails with a 400 - leaving the tile
        # lost forever (not on the board, not in hand, not in the deck).
        if not adj_chains_pre and self.creates_new_chain(row, col):
            free_chains_pre = [c.value for c in HotelChain if c.value not in self.active_chains]
            if not free_chains_pre:
                raise HTTPException(status_code=400, detail="Cannot found an 8th chain.")

        player.tiles.remove((row, col))
        self._log_event("place_tile", {"tile": (row, col)})

        adj_chains = self.get_adjacent_chains(row, col)
        if len(adj_chains) > 1:
            self.handle_merger(row, col, adj_chains)
            outcome_is_paused = True  
        elif not adj_chains and self.creates_new_chain(row, col):
            free_chains = [c.value for c in HotelChain if c.value not in self.active_chains]
            if len(free_chains) == 1:
                # Tweak: Auto-found the last available chain!
                self.pending_chain_selection = {"player": player_name, "row": row, "col": col, "options": free_chains}
                self.choose_chain(player_name, free_chains[0], token=token)
                outcome_is_paused = True 
            elif free_chains:
                self.pending_chain_selection = {"player": player_name, "row": row, "col": col, "options": free_chains}
                self.board[row][col] = "P"
                self.turn_phase = TurnPhase.CHOOSE_CHAIN
                self.message = f"{player_name}, choose chain to found."
                outcome_is_paused = True 
            else:
                # Unreachable in practice: the pre-mutation check above already
                # rejects this case before the tile is removed from hand.
                # Kept as defense-in-depth.
                raise HTTPException(status_code=400, detail="Cannot found an 8th chain.")
        elif not adj_chains:
            self.board[row][col] = "P"
            self.message = "Placed single tile"
            # FIX: never allow undo for a wild tile placement. The wild tile
            # is not a real tile from the player's hand - place_wild_tile
            # temporarily injects its coordinate into player.tiles so this
            # method can process it, then restores the real hand afterward.
            # state_snapshot["player_tiles"] is captured above, before that
            # coordinate is removed, so it still contains the injected wild
            # tile coordinate. If undo were allowed here, restoring that
            # snapshot would hand the player back a phantom tile matching a
            # board square they already spent their one-time wild tile on.
            if self.active_chains and not is_wild_tile:
                self.can_undo_placement = True
                self.last_tile_placement_state = state_snapshot
        elif len(adj_chains) == 1:
            chain = adj_chains[0]
            self.board[row][col] = chain
            expanded_tiles = self.expand_chain(row, col, chain)
            
            self._log_event("expand_chain", {"chain": chain})
            
            self.message = f"Expanded chain: {chain}"
            self.last_animation_event = {
                "type": "expand", 
                "chain": chain, 
                "source_tile": (row, col), 
                "expanded_tiles": expanded_tiles
            }
            self._check_for_new_4x1_grid(chain)
            self._check_for_new_2x2_grid(chain)
            
        if not outcome_is_paused:
            self._continue_turn_after_action()
            
        current_sizes = self.get_chain_sizes()
        if any(size >= 41 for size in current_sizes.values()):
            chain_name = [c for c, s in current_sizes.items() if s >= 41][0]
            self.message = f"Chain {chain_name} reached 41 tiles! The game can now end."

    def place_wild_tile(self, player_name: str, row: int, col: int, token: str = ""):
        self.verify_player_token(player_name, token)
        player = self.find_player(player_name)
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        if self.turn_phase != TurnPhase.PLACE_TILE:
            raise HTTPException(status_code=400, detail="Not in tile placement phase.")
        if not player.has_wild_tile:
            raise HTTPException(status_code=400, detail="You do not have a wild tile.")
        if not self.is_tile_playable((row, col)):
             raise HTTPException(status_code=400, detail="This tile is not playable.")
 
        player.has_wild_tile = False
        self.wild_tile_placements.add((row, col))
         
        original_tiles = player.tiles[:]
        player.tiles.append((row, col))  
        try:
            self.place_tile(player_name, row, col, token=token, is_wild_tile=True)        
        finally:
            player.tiles = original_tiles 
         
        for p in self.players:
            if (row, col) in p.tiles:
                p.tiles.remove((row, col))
                self._log_event("discard_and_draw", {"discarded_tile": (row, col)}, player_override=p.name)
                # FIX: route through _draw_tile_for so this replacement draw
                # is itself protected if it happens to land on a square
                # from an *earlier* wild-tile placement (wild_tile_variant
                # grants one wild tile per player, so more than one can be
                # in play across a game).
                self._draw_tile_for(p, 1, player_override=p.name)
                self.last_animation_event = {
                    "type": "other"
                }

    def request_end_game(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.") 
        if not self.is_end_game_possible:
            raise HTTPException(status_code=400, detail="The conditions to end the game have not been met.")
        self.message = f"{player_name} has chosen to end the game. Final scoring..."
        self._end_game_sequence()

    def resolve_merger_stocks(self, player_name: str, decisions: Dict[str, Dict[str, int]], token: str = ""):
        self.verify_player_token(player_name, token)
        if self.turn_phase != TurnPhase.TRADE_STOCKS or not self.pending_stock_resolution:
            raise HTTPException(status_code=400, detail="Not in a stock resolution phase.")
        merger_info = self.pending_stock_resolution
        queue = merger_info["resolution_queue"]
        resolver_idx = merger_info["current_resolver_idx"]
        if not queue or player_name != queue[resolver_idx]:
            raise HTTPException(status_code=400, detail="Not your turn to resolve stocks.")
        
        player = self.find_player(player_name)
        survivor = merger_info["survivor"]

        player_defunct_holdings = {chain for chain in merger_info["defunct_chains"] if player.stocks.get(chain, 0) > 0}
        if player_defunct_holdings != set(decisions.keys()):
            raise HTTPException(status_code=400, detail="Incomplete or invalid stock resolution decisions provided.")
            
        total_survivor_shares_needed = 0
        for defunct_chain, decision in decisions.items():
            if defunct_chain not in merger_info["defunct_chains"]:
                raise HTTPException(status_code=400, detail=f"Invalid defunct chain: {defunct_chain}")
            
            trade_amt = decision.get("trade", 0)
            sell_amt = decision.get("sell", 0)
            hold_amt = decision.get("hold", 0)
            owned_shares = player.stocks.get(defunct_chain, 0)
            
            if trade_amt < 0 or sell_amt < 0 or hold_amt < 0:
                raise HTTPException(status_code=400, detail="Amounts cannot be negative.")
            if trade_amt + sell_amt + hold_amt != owned_shares:
                raise HTTPException(status_code=400, detail=f"Decisions for {defunct_chain} do not add up to owned shares ({owned_shares}).")
            if trade_amt % 2 != 0:
                raise HTTPException(status_code=400, detail=f"Trade amount for {defunct_chain} must be even.")
                
            total_survivor_shares_needed += (trade_amt // 2)

        if self.stock_counts.get(survivor, 0) < total_survivor_shares_needed:
            raise HTTPException(status_code=400, detail=f"Not enough {survivor} shares available in the bank. Need {total_survivor_shares_needed}.")

        for defunct_chain, decision in decisions.items():
            trade_amt = decision.get("trade", 0)
            sell_amt = decision.get("sell", 0)
            
            if trade_amt > 0:
                shares_to_receive = trade_amt // 2
                player.stocks[defunct_chain] -= trade_amt
                self.stock_counts[defunct_chain] += trade_amt
                player.stocks[survivor] += shares_to_receive
                self.stock_counts[survivor] -= shares_to_receive
                
            if sell_amt > 0:
                pre_merger_size = merger_info["pre_merger_sizes"].get(defunct_chain, 0)
                price, _, _ = get_price_info(pre_merger_size, HotelChain(defunct_chain))
                total_value = price * sell_amt
                
                player.cash += total_value
                player.stocks[defunct_chain] -= sell_amt
                self.stock_counts[defunct_chain] += sell_amt
                
                decision["sell_value"] = total_value

        self._log_event("resolve_merger", {"decisions": decisions, "survivor": survivor}, player_override=player_name)
        
        self.last_animation_event = {
            "type": "resolve_merger"
        }
        merger_info["current_resolver_idx"] += 1

        if merger_info["current_resolver_idx"] >= len(queue): 
            self.pending_stock_resolution = None 
            self._next_defunct_chain_resolution()
        else: 
            next_resolver = queue[merger_info["current_resolver_idx"]]
            self.message = f"Next up: {next_resolver} must resolve their stocks."

    def trade_stock_power(self, player_name: str, chain_from: str, chain_to: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(400, "Not your turn.")
        if self.turn_phase != TurnPhase.TRADE_STOCKS_POWER:
            raise HTTPException(400, "Not in the correct phase to trade stocks.")
        if self.trade_actions_remaining <= 0:
            raise HTTPException(400, "No trade actions remaining.")
        # FIX: nothing previously stopped chain_from == chain_to, which would
        # net the player -1 share and hand the bank +1 share for free (2
        # given up, 1 given back, same chain) with no cash involved — a
        # no-cost way to shed a share right before a merger vote. The
        # frontend UI already prevents selecting the same chain for "to",
        # but the server had no independent check.
        if chain_from == chain_to:
            raise HTTPException(400, "Cannot trade a chain's stock for itself.")

        player = self.find_player(player_name)
        if player.stocks.get(chain_from, 0) < 2:
            raise HTTPException(400, f"You don't own enough stock in {chain_from} to trade.")
        if self.stock_counts.get(chain_to, 0) < 1:
            raise HTTPException(400, f"There is no stock available for {chain_to}.")
        if chain_from not in self.active_chains or chain_to not in self.active_chains:
            raise HTTPException(400, "Can only trade between active chains.")

        player.stocks[chain_from] -= 2
        self.stock_counts[chain_from] += 2
        player.stocks[chain_to] += 1
        self.stock_counts[chain_to] -= 1
        self.trade_actions_remaining -= 1

        self._log_event("trade_stock_power", {"from": chain_from, "to": chain_to})
        self.message = f"Traded 2 {chain_from} for 1 {chain_to}. {self.trade_actions_remaining} trades left."
        self.last_animation_event = {
            "type": "trade_stock"
        }

        if self.trade_actions_remaining == 0:
            self.end_power_trade(player_name, token=token)

    def undo_tile_placement(self, player_name: str, token: str = ""):
        self.verify_player_token(player_name, token)
        if not self.can_undo_placement:
            raise HTTPException(status_code=400, detail="Undo is not available.")
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        if not self.last_tile_placement_state:
            raise HTTPException(status_code=500, detail="Internal error: Undo state is missing.")
        snapshot = self.last_tile_placement_state
        player = self.find_player(snapshot["player_name"])
        self.board = snapshot["board"]
        player.tiles = snapshot["player_tiles"]
        self.turn_phase = TurnPhase.PLACE_TILE
        self.message = f"{player.name} undid tile placement. Please place a tile."
        self.can_undo_placement = False
        self.last_tile_placement_state = None
        self._log_event("undo_placement", {})
 
    def use_special_power(self, player_name: str, power_str: str, token: str = ""):
        # FIX: validate every precondition (turn, token, phase, power
        # ownership) up front, before mutating any state. Previously the
        # phase check for Take 5 ran *after* the power was removed from the
        # player's hand and power_used_this_turn was set, so a request in
        # the wrong phase would raise a 400 but leave the in-memory Game
        # permanently corrupted (power burned, no effect granted). All
        # powers now share the same "start of turn" validation for
        # consistency, since Place 4 and Trade 2 are only meaningful if used
        # before tile placement resolves the turn_phase transition for this
        # turn.
        self.verify_player_token(player_name, token)
        if player_name != self.current_player:
            raise HTTPException(status_code=400, detail="Not your turn.")
        if self.power_used_this_turn:
            raise HTTPException(status_code=400, detail="You have already used a special power this turn.")
        if self.turn_phase != TurnPhase.PLACE_TILE:
            raise HTTPException(status_code=400, detail="Special powers must be used at the start of your turn, before placing a tile.")

        player = self.find_player(player_name)
        try:
            power = SpecialPower(power_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Unknown power.")
        if power not in player.special_powers:
            raise HTTPException(status_code=400, detail="You do not have this power or have already used it.")

        player.special_powers.remove(power)
        self.power_used_this_turn = True
        self._log_event("use_special_power", {"power": power.value})

        if power == SpecialPower.TAKE_5:
            drawn = self._draw_tile_for(player, 5, player_override=player.name)
            self.message = f"Used Take 5! You drew {drawn} new tiles."
        
        elif power == SpecialPower.PLACE_4:
            self.tiles_to_place_this_turn = 4
            self.message = "Used Place 4! You may now place up to 4 tiles."

        elif power == SpecialPower.BUY_5:
            self.max_stocks_to_buy_this_turn = 5
            self.message = "Used Buy 5! You may now purchase up to 5 stocks."
        
        elif power == SpecialPower.FREE_3:
            self.free_stocks_this_turn = 3
            self.message = "Used Free 3! Your next 3 stock purchases this turn are free."
        
        elif power == SpecialPower.TRADE_2:
            self.trade_actions_remaining = 3 
            self.message = "Used Trade 2! You may now trade stocks (2 for 1) up to 3 times."

