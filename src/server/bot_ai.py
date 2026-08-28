# src/server/bot_ai.py
"""
Computer opponent logic for Jacquire.

Design overview
----------------
A bot doesn't get its own connection or its own client — the server drives
it directly by calling the exact same `Game` methods a human's HTTP request
would call, using the token minted for that bot when it was added to the
lobby. This means a bot can never do anything a human couldn't also do, and
every move a bot makes goes through the same validation as a human move.

`run_bot_turns()` is the entry point called from main.py after every
mutating endpoint. It repeatedly asks "who needs to act right now?" via
`get_acting_player_name()`, and if that's a bot, asks `perform_bot_step()`
to make exactly one decision (place a tile, buy some stock, resolve a
merger, etc.), then broadcasts the resulting state and loops again. It stops
as soon as the next actor is a human, or the game ends.

Difficulty Levels
-----------------
Bots are assigned a random difficulty (Easy, Medium, Hard) when added to the
lobby. This is indicated in their name (e.g., "Vanderbilt (Hard)").
  - Easy: High randomness, ignores majorities, sells during mergers for quick cash.
  - Medium: Solid baseline heuristics. Targets majorities, keeps a cash buffer.
  - Hard: Ruthless. Aggressively protects majorities, spends to $0 to take the lead, 
    avoids handing free merger payouts to opponents.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

from fastapi import HTTPException

from .models import HotelChain, TurnPhase, SpecialPower, Player
from .utils import get_price_info

if TYPE_CHECKING:
    from .game_logic import Game

logger = logging.getLogger("bot_ai")

# FIX (soft lock): see the matching comment at the one place this is used,
# in run_bot_turns' MAX_BOT_STEPS_PER_CALL rollover path.
_background_continuation_tasks: set = set()

# --- Timing -------------------------------------------------------------

BOT_STEP_DELAY_SECONDS = 0.55
BOT_STEPS_LOG_CHECKPOINT = 200
MAX_BOT_STEPS_PER_CALL = 20000

# --- Lobby helpers --------------------------------------------------------

BOT_NAME_POOL = [
    "PoopieBot", "Clippy", "BotFly", "BotDotCom", "BeepBoop", "NPCbot", 
]

BOT_COLOR_POOL = [
    "#7C3AED", "#E53935", "#10D164", "#2196F3", "#F4C20D", "#FF4FA3",
]


def pick_bot_name(existing_names: set, difficulty: str = "Medium") -> str:
    """Picks the next unused name from a themed pool, falling back to
    'Bot N' if the whole pool is somehow already taken. Assigns
    a difficulty level and appends it to the name."""
    
    # Strip existing difficulty tags to check base name availability
    base_existing = {name.split(" (")[0] for name in existing_names}
    
    for name in BOT_NAME_POOL:
        if name not in base_existing:
            return f"{name} ({difficulty})"
            
    n = 1
    while f"Bot {n}" in base_existing:
        n += 1
    return f"Bot {n} ({difficulty})"


def pick_bot_color(existing_colors: set) -> Optional[str]:
    for color in BOT_COLOR_POOL:
        if color not in existing_colors:
            return color
    return None


def _get_bot_difficulty(player: Player) -> str:
    """Extracts the assigned difficulty from the bot's name."""
    if "(Easy)" in player.name:
        return "Easy"
    elif "(Hard)" in player.name:
        return "Hard"
    return "Medium"

# --- Strategic constants ---------------------------------------------------

CHAIN_TIER: Dict[str, int] = {
    "Luxor": 1, "Tower": 1,
    "Festival": 2, "Worldwide": 2, "American": 2,
    "Continental": 3, "Imperial": 3,
}

SAFE_CHAIN_SIZE = 11


def _chain_tier(chain: str) -> int:
    return CHAIN_TIER.get(chain, 1)


def _holders_ranked(game: "Game", chain: str) -> List[Tuple[str, int]]:
    holders = [(p.name, p.stocks.get(chain, 0)) for p in game.players if p.stocks.get(chain, 0) > 0]
    holders.sort(key=lambda x: x[1], reverse=True)
    return holders


def _is_majority_holder(game: "Game", player: Player, chain: str) -> bool:
    holders = _holders_ranked(game, chain)
    if not holders:
        return False
    top_name, top_shares = holders[0]
    if top_name != player.name:
        return False
    return len(holders) == 1 or holders[1][1] < top_shares


# --- Tile placement scoring -------------------------------------------------

def evaluate_tile_placement(game: "Game", player: Player, tile: Tuple[int, int]) -> float:
    difficulty = _get_bot_difficulty(player)
    
    if difficulty == "Easy":
        # Add high random noise so Easy bots don't consistently play the best tiles
        base_score = random.random() * 30.0
    else:
        base_score = 0.0

    row, col = tile
    adjacent = game.get_adjacent_chains(row, col)
    sizes = game.get_chain_sizes()

    if not adjacent:
        if game.creates_new_chain(row, col):
            free_chains = [c.value for c in HotelChain if c.value not in game.active_chains]
            if not free_chains:
                return -1000.0
            
            if difficulty == "Easy":
                return base_score + 10.0 # Doesn't value founding highly
                
            best_tier = max(_chain_tier(c) for c in free_chains)
            return base_score + 45.0 + best_tier * 12.0
        return base_score + 6.0

    if len(adjacent) == 1:
        chain = adjacent[0]
        size = sizes.get(chain, 0)
        owned = player.stocks.get(chain, 0)
        tier = _chain_tier(chain)
        
        score = base_score + 10.0 + tier * 4.0
        
        if difficulty != "Easy":
            score += min(owned, 10) * 3.0
            
        if size < SAFE_CHAIN_SIZE <= size + 1:
            score += 22.0
            if difficulty == "Hard" and _is_majority_holder(game, player, chain):
                # Hard bot strongly prioritizes protecting its own majorities
                score += 40.0 
                
        if difficulty != "Easy":
            score += min(size, 40) * 0.4
            
        return score

    return base_score + evaluate_merger(game, player, adjacent, sizes)


def evaluate_merger(game: "Game", player: Player, adjacent_chains: List[str], sizes: Dict[str, int]) -> float:
    difficulty = _get_bot_difficulty(player)
    
    max_size = max(sizes.get(c, 0) for c in adjacent_chains)
    top = [c for c in adjacent_chains if sizes.get(c, 0) == max_size]
    defunct_candidates = [c for c in adjacent_chains if c not in top]
    
    if len(top) > 1:
        defunct_candidates = adjacent_chains[:]
        defunct_candidates.remove(top[0])

    score = 15.0
    for chain in defunct_candidates:
        size = sizes.get(chain, 0)
        price, majority_bonus, minority_bonus = get_price_info(size, HotelChain(chain))
        holders = _holders_ranked(game, chain)
        bot_shares = player.stocks.get(chain, 0)

        if holders:
            top_name, top_shares = holders[0]
            if top_name == player.name and (len(holders) == 1 or holders[1][1] < top_shares):
                score += (majority_bonus + minority_bonus * 0.4) / 120.0
            elif bot_shares > 0:
                score += minority_bonus / 160.0
            elif top_name != player.name:
                if difficulty == "Hard":
                    # Actively avoid handing massive free payouts to opponents
                    score -= (majority_bonus + minority_bonus) / 40.0
                else:
                    score -= majority_bonus / 400.0

        if difficulty != "Easy":
            score += bot_shares * price * 0.35 / 100.0

    for chain in top:
        if difficulty != "Easy":
            score += player.stocks.get(chain, 0) * 1.4

    return score


# --- Chain founding / merger tie-break / defunct order ---------------------

def choose_founding_chain(player: Player, options: List[str]) -> str:
    if _get_bot_difficulty(player) == "Easy":
        return random.choice(options)
    return max(options, key=_chain_tier)


def choose_merger_survivor(player: Player, options: List[str]) -> str:
    if _get_bot_difficulty(player) == "Easy":
        return random.choice(options)
    return max(options, key=lambda c: (player.stocks.get(c, 0), _chain_tier(c)))


def choose_defunct_resolution_order(player: Player, options: List[str]) -> str:
    if _get_bot_difficulty(player) == "Easy":
        return random.choice(options)
    return max(options, key=lambda c: player.stocks.get(c, 0))


# --- Stock purchase planning ------------------------------------------------

def decide_stock_purchases(game: "Game", player: Player) -> List[Tuple[str, int]]:
    difficulty = _get_bot_difficulty(player)
    
    # Easy bot might occasionally skip buying entirely
    if difficulty == "Easy" and random.random() < 0.2:
        return []

    remaining_shares = game.max_stocks_to_buy_this_turn - game.current_turn_stock_count
    if remaining_shares <= 0 or not game.active_chains:
        return []

    prices = game.get_stock_prices()
    sizes = game.get_chain_sizes()
    cash = player.cash
    free_remaining = game.free_stocks_this_turn

    scored: List[Tuple[float, str, int, int]] = []
    for chain in game.active_chains:
        price = prices.get(chain, 0)
        available = game.stock_counts.get(chain, 0)
        if price <= 0 or available <= 0:
            continue

        owned = player.stocks.get(chain, 0)
        size = sizes.get(chain, 0)
        tier = _chain_tier(chain)
        holders = _holders_ranked(game, chain)

        if difficulty == "Easy":
            score = random.random() * 10.0 # Completely random priorities
        else:
            score = tier * 3.0
            if size < SAFE_CHAIN_SIZE:
                score += 2.0 

            is_majority = bool(holders) and holders[0][0] == player.name and (
                len(holders) == 1 or holders[1][1] < holders[0][1]
            )
            if is_majority:
                score += 8.0 if difficulty == "Hard" else 4.0
            elif holders:
                gap = holders[0][1] - owned
                if 0 < gap <= 2:
                    score += 6.0
                    if difficulty == "Hard" and gap == 1:
                        score += 15.0 # Extreme priority to tie or overtake leader
            elif owned == 0:
                score += 1.0 

        scored.append((score, chain, price, available))

    scored.sort(key=lambda x: -x[0])

    purchases: List[Tuple[str, int]] = []
    
    if difficulty == "Easy":
        CASH_BUFFER = 1200 # Hoards cash needlessly
    elif difficulty == "Hard":
        CASH_BUFFER = 0 # Willing to drain cash to $0 to secure majorities
    else:
        CASH_BUFFER = 250

    for score, chain, price, available in scored:
        if remaining_shares <= 0 or score <= 0:
            break

        if free_remaining > 0:
            affordable = max(cash - 0, 0) // price + free_remaining
        else:
            affordable = max(cash - CASH_BUFFER, 0) // price

        qty = min(remaining_shares, available, max(affordable, 0), 2)
        if qty <= 0:
            continue

        purchases.append((chain, qty))
        cost = max(0, qty * price - free_remaining * price)
        cash -= cost
        free_remaining = max(0, free_remaining - qty)
        remaining_shares -= qty

    return purchases


# --- Merger stock resolution -------------------------------------------------

def decide_stock_resolution(
    game: "Game",
    player: Player,
    survivor: str,
    defunct_chain: str,
    owned_shares: int,
    pre_merger_sizes: Dict[str, int],
) -> Dict[str, int]:
    
    # SPECIAL CASE: 1 stock lock bypass
    if owned_shares == 1:
        return {"trade": 0, "sell": 1, "hold": 0}
        
    difficulty = _get_bot_difficulty(player)
    
    if difficulty == "Easy":
        # Easy bots panic and sell everything for immediate cash
        return {"trade": 0, "sell": owned_shares, "hold": 0}

    bank_survivor_available = game.stock_counts.get(survivor, 0)
    max_tradeable_pairs = owned_shares // 2
    trade_pairs = min(max_tradeable_pairs, bank_survivor_available)

    survivor_tier = _chain_tier(survivor)
    defunct_tier = _chain_tier(defunct_chain)

    if player.cash < 1500 and survivor_tier <= defunct_tier:
        trade_pairs = trade_pairs // 2
        
    if difficulty == "Hard":
        survivor_holders = _holders_ranked(game, survivor)
        if survivor_holders and survivor_holders[0][0] != player.name:
            gap = survivor_holders[0][1] - player.stocks.get(survivor, 0)
            if gap > 0 and trade_pairs * 2 >= gap:
                # Trade exactly enough to tie or overtake the leader in the surviving chain
                trade_pairs = min(max_tradeable_pairs, (gap + 1) // 2 + 1)

    trade_amt = trade_pairs * 2
    remaining = owned_shares - trade_amt
    return {"trade": trade_amt, "sell": remaining, "hold": 0}


def decide_should_end_game(game: "Game", player: Player) -> bool:
    if not game.is_end_game_possible:
        return False
        
    difficulty = _get_bot_difficulty(player)
    if difficulty == "Easy":
        # Easy bot might randomly delay ending the game
        return random.random() > 0.5

    prices = game.get_stock_prices()
    net_worths = []
    for p in game.players:
        stock_value = sum(prices.get(chain, 0) * count for chain, count in p.stocks.items())
        net_worths.append((p.name, p.cash + stock_value))
    net_worths.sort(key=lambda x: -x[1])

    my_rank = next((i for i, (name, _) in enumerate(net_worths) if name == player.name), len(net_worths) - 1)
    return my_rank < max(1, len(net_worths) // 2)


# --- Trade 2 power -----------------------------------------------------------

def decide_trade_power(game: "Game", player: Player) -> Optional[Tuple[str, str]]:
    if _get_bot_difficulty(player) == "Easy" and random.random() < 0.6:
        return None # Often forgets to use Trade 2 effectively
        
    active = game.active_chains
    if len(active) < 2:
        return None

    sizes = game.get_chain_sizes()

    def strength(chain: str) -> float:
        return _chain_tier(chain) * 10.0 + min(sizes.get(chain, 0), SAFE_CHAIN_SIZE)

    best_chain = max(active, key=strength)
    if game.stock_counts.get(best_chain, 0) < 1:
        return None

    candidates = [c for c in active if c != best_chain and player.stocks.get(c, 0) >= 2]
    if not candidates:
        return None

    weakest = min(candidates, key=strength)
    if strength(weakest) >= strength(best_chain):
        return None

    return weakest, best_chain


# --- Special powers ----------------------------------------------------------

def decide_special_power(game: "Game", player: Player) -> Optional[SpecialPower]:
    powers = player.special_powers
    if not powers:
        return None
        
    difficulty = _get_bot_difficulty(player)
    if difficulty == "Easy" and random.random() < 0.7:
        return None # Usually forgets to pop special powers

    playable = [t for t in player.tiles if game.is_tile_playable(t)]

    if SpecialPower.TAKE_5 in powers and len(playable) <= 2 and game.tile_deck:
        return SpecialPower.TAKE_5

    if SpecialPower.PLACE_4 in powers:
        good_plays = [t for t in playable if evaluate_tile_placement(game, player, t) >= 15.0]
        if len(good_plays) >= 2:
            return SpecialPower.PLACE_4

    if SpecialPower.BUY_5 in powers and game.active_chains:
        prices = game.get_stock_prices()
        can_go_big = any(
            prices.get(c, 0) > 0
            and game.stock_counts.get(c, 0) > 0
            and player.cash >= prices[c] * 4
            for c in game.active_chains
        )
        if can_go_big:
            return SpecialPower.BUY_5

    if SpecialPower.FREE_3 in powers and game.active_chains:
        if any(game.stock_counts.get(c, 0) > 0 for c in game.active_chains):
            return SpecialPower.FREE_3

    if SpecialPower.TRADE_2 in powers and decide_trade_power(game, player) is not None:
        return SpecialPower.TRADE_2

    return None


# --- Per-phase step execution ------------------------------------------------

def get_acting_player_name(game: "Game") -> Optional[str]:
    if game.game_over or game.turn_phase == TurnPhase.GAME_OVER:
        return None

    if game.turn_phase == TurnPhase.TRADE_STOCKS:
        info = game.pending_stock_resolution
        if not info:
            return None
        queue = info.get("resolution_queue", [])
        idx = info.get("current_resolver_idx", 0)
        if idx >= len(queue):
            return None
        return queue[idx]

    return game.current_player


def is_bot_turn(game: "Game") -> bool:
    name = get_acting_player_name(game)
    if not name:
        return False
    try:
        player = game.find_player(name)
    except HTTPException:
        return False
    return bool(getattr(player, "is_bot", False))


def _bot_place_tile_phase(game: "Game", player: Player, scratch: Dict[str, Any], turn_key: str) -> None:
    power_key = f"power_checked:{turn_key}"
    discard_key = f"discard_used:{turn_key}"

    if not game.power_used_this_turn and player.special_powers and not scratch.get(power_key):
        scratch[power_key] = True
        power = decide_special_power(game, player)
        if power is not None:
            try:
                game.use_special_power(player.name, power.value, token=player.token)
                return 
            except HTTPException:
                pass 

    playable = [t for t in player.tiles if game.is_tile_playable(t)]

    if not playable:
        try:
            game.discard_and_draw_tiles(player.name, token=player.token)
        except HTTPException:
            game.end_tile_placement(player.name, token=player.token)
        return

    dead = [t for t in player.tiles if game.is_tile_dead(t)]
    if dead and not scratch.get(discard_key):
        scratch[discard_key] = True
        try:
            game.discard_and_draw_tiles(player.name, token=player.token)
            return
        except HTTPException:
            pass 

    best_tile = max(playable, key=lambda t: evaluate_tile_placement(game, player, t))
    try:
        game.place_tile(player.name, best_tile[0], best_tile[1], token=player.token)
        return
    except HTTPException:
        pass

    for tile in playable:
        try:
            game.place_tile(player.name, tile[0], tile[1], token=player.token)
            return
        except HTTPException:
            continue


def _bot_choose_chain(game: "Game", player: Player) -> None:
    pending = game.pending_chain_selection
    if not pending or not pending.get("options"):
        return
    chain = choose_founding_chain(player, pending["options"])
    try:
        game.choose_chain(player.name, chain, token=player.token)
    except HTTPException:
        game.choose_chain(player.name, pending["options"][0], token=player.token)


def _bot_choose_merger(game: "Game", player: Player) -> None:
    pending = game.pending_merger_choice
    if not pending or not pending.get("options"):
        return
    chain = choose_merger_survivor(player, pending["options"])
    try:
        game.choose_merger(player.name, chain, token=player.token)
    except HTTPException:
        game.choose_merger(player.name, pending["options"][0], token=player.token)


def _bot_choose_defunct(game: "Game", player: Player) -> None:
    pending = getattr(game, "pending_defunct_choice", None)
    if not pending or not pending.get("options"):
        return
    chain = choose_defunct_resolution_order(player, pending["options"])
    try:
        game.choose_defunct(player.name, chain, token=player.token)
    except HTTPException:
        game.choose_defunct(player.name, pending["options"][0], token=player.token)


def _bot_resolve_merger_stocks(game: "Game", player: Player) -> None:
    info = game.pending_stock_resolution
    if not info:
        return
    survivor = info["survivor"]
    defunct_chains = info["defunct_chains"]
    pre_sizes = info["pre_merger_sizes"]

    decisions: Dict[str, Dict[str, int]] = {}
    for chain in defunct_chains:
        owned = player.stocks.get(chain, 0)
        if owned > 0:
            decisions[chain] = decide_stock_resolution(game, player, survivor, chain, owned, pre_sizes)

    try:
        game.resolve_merger_stocks(player.name, decisions, token=player.token)
    except HTTPException as e:
        logger.warning("bot %s: resolve_merger_stocks rejected (%s), falling back to hold-everything", player.name, e.detail)
        fallback: Dict[str, Dict[str, int]] = {}
        for c in defunct_chains:
            owned = player.stocks.get(c, 0)
            if owned > 0:
                if owned == 1:
                    fallback[c] = {"trade": 0, "sell": 1, "hold": 0}
                else:
                    fallback[c] = {"trade": 0, "sell": 0, "hold": owned}
        
        try:
            game.resolve_merger_stocks(player.name, fallback, token=player.token)
        except HTTPException as e2:
            logger.error("bot %s: fallback resolve_merger_stocks also rejected (%s). Force advancing queue.", player.name, e2.detail)
            info["current_resolver_idx"] += 1
            if info["current_resolver_idx"] >= len(info.get("resolution_queue", [])):
                game.pending_stock_resolution = None
                game._next_defunct_chain_resolution()


def _bot_trade_power(game: "Game", player: Player) -> None:
    if game.trade_actions_remaining <= 0:
        try:
            game.end_power_trade(player.name, token=player.token)
        except HTTPException:
            pass
        return

    trade = decide_trade_power(game, player)
    if trade is None:
        try:
            game.end_power_trade(player.name, token=player.token)
        except HTTPException:
            pass
        return

    chain_from, chain_to = trade
    try:
        game.trade_stock_power(player.name, chain_from, chain_to, token=player.token)
    except HTTPException:
        try:
            game.end_power_trade(player.name, token=player.token)
        except HTTPException:
            pass


def _bot_buy_stock_phase(game: "Game", player: Player, scratch: Dict[str, Any], turn_key: str) -> None:
    plan_key = f"buy_plan:{turn_key}"
    if plan_key not in scratch:
        scratch[plan_key] = decide_stock_purchases(game, player)

    plan: List[Tuple[str, int]] = scratch[plan_key]
    while plan:
        chain, qty = plan.pop(0)
        if qty <= 0:
            continue
        try:
            game.buy_stock(player.name, chain, qty, token=player.token)
            return
        except HTTPException:
            continue

    if game.turn_phase == TurnPhase.BUY_STOCK and game.current_player == player.name:
        if game.is_end_game_possible and decide_should_end_game(game, player):
            try:
                game.request_end_game(player.name, token=player.token)
                return
            except HTTPException:
                pass
        try:
            game.end_turn(player.name, token=player.token)
        except HTTPException:
            pass


def perform_bot_step(game: "Game", player: Player, scratch: Dict[str, Any]) -> None:
    turn_key = f"{game.turn_number}:{player.name}"
    phase = game.turn_phase

    if phase == TurnPhase.PLACE_TILE:
        _bot_place_tile_phase(game, player, scratch, turn_key)
    elif phase == TurnPhase.CHOOSE_CHAIN:
        _bot_choose_chain(game, player)
    elif phase == TurnPhase.CHOOSE_MERGER:
        _bot_choose_merger(game, player)
    elif phase == TurnPhase.CHOOSE_DEFUNCT:
        _bot_choose_defunct(game, player)
    elif phase == TurnPhase.TRADE_STOCKS:
        _bot_resolve_merger_stocks(game, player)
    elif phase == TurnPhase.TRADE_STOCKS_POWER:
        _bot_trade_power(game, player)
    elif phase == TurnPhase.BUY_STOCK:
        _bot_buy_stock_phase(game, player, scratch, turn_key)


def _bot_emergency_recover(game: "Game", player: Player) -> None:
    phase = game.turn_phase
    try:
        if phase == TurnPhase.PLACE_TILE:
            playable = [t for t in player.tiles if game.is_tile_playable(t)]
            if playable:
                game.place_tile(player.name, playable[0][0], playable[0][1], token=player.token)
            else:
                try:
                    game.discard_and_draw_tiles(player.name, token=player.token)
                except HTTPException:
                    game.end_tile_placement(player.name, token=player.token)
        elif phase == TurnPhase.CHOOSE_CHAIN and game.pending_chain_selection:
            options = game.pending_chain_selection["options"]
            game.choose_chain(player.name, options[0], token=player.token)
        elif phase == TurnPhase.CHOOSE_MERGER and game.pending_merger_choice:
            options = game.pending_merger_choice["options"]
            game.choose_merger(player.name, options[0], token=player.token)
        elif phase == TurnPhase.CHOOSE_DEFUNCT and getattr(game, "pending_defunct_choice", None):
            options = game.pending_defunct_choice["options"]
            game.choose_defunct(player.name, options[0], token=player.token)
        elif phase == TurnPhase.TRADE_STOCKS and game.pending_stock_resolution:
            info = game.pending_stock_resolution
            decisions = {}
            for c in info.get("defunct_chains", []):
                owned = player.stocks.get(c, 0)
                if owned > 0:
                    if owned == 1:
                        decisions[c] = {"trade": 0, "sell": 1, "hold": 0}
                    else:
                        decisions[c] = {"trade": 0, "sell": 0, "hold": owned}
            try:
                game.resolve_merger_stocks(player.name, decisions, token=player.token)
            except HTTPException as e:
                logger.error("bot %s: emergency resolve_merger_stocks failed (%s). Force advancing queue.", player.name, e.detail)
                info["current_resolver_idx"] += 1
                if info["current_resolver_idx"] >= len(info.get("resolution_queue", [])):
                    game.pending_stock_resolution = None
                    game._next_defunct_chain_resolution()
        elif phase == TurnPhase.TRADE_STOCKS_POWER:
            game.end_power_trade(player.name, token=player.token)
        elif phase == TurnPhase.BUY_STOCK:
            game.end_turn(player.name, token=player.token)
    except Exception:
        logger.exception("bot %s: emergency recovery itself failed in phase %s", player.name, phase)


def _progress_fingerprint(game: "Game", acting_name: str) -> Tuple:
    info = game.pending_stock_resolution
    resolver_idx = info.get("current_resolver_idx") if info else None
    total_cash = sum(p.cash for p in game.players)
    total_bank_shares = sum(game.stock_counts.values())
    board_tile_count = sum(1 for row in game.board for cell in row if cell is not None)
    total_hand_tiles = sum(len(p.tiles) for p in game.players)
    return (
        game.turn_number,
        game.turn_phase,
        acting_name,
        resolver_idx,
        game.current_turn_stock_count,
        game.trade_actions_remaining,
        game.power_used_this_turn,
        len(game.tile_deck) if hasattr(game, "tile_deck") else None,
        total_cash,
        total_bank_shares,
        board_tile_count,
        total_hand_tiles,
    )


def _run_one_bot_step(game: "Game", scratch: Dict[str, Any], stall_state: Dict[str, Any]) -> Optional[Dict]:
    name = get_acting_player_name(game)
    if not name:
        return None
    try:
        player = game.find_player(name)
    except HTTPException:
        return None
    if not getattr(player, "is_bot", False):
        return None

    fingerprint = _progress_fingerprint(game, name)
    if fingerprint == stall_state["last_fingerprint"]:
        stall_state["stall_count"] += 1
    else:
        stall_state["stall_count"] = 0
    stall_state["last_fingerprint"] = fingerprint

    if stall_state["stall_count"] >= 2:
        logger.error(
            "bot %s made no progress in phase %s (stall #%d) — forcing emergency recovery",
            player.name, game.turn_phase, stall_state["stall_count"],
        )
        _bot_emergency_recover(game, player)
        stall_state["stall_count"] = 0
        stall_state["last_fingerprint"] = None
    else:
        try:
            perform_bot_step(game, player, scratch)
        except HTTPException as e:
            logger.warning("bot %s: %s raised %s, recovering", player.name, game.turn_phase, e.detail)
            _bot_emergency_recover(game, player)
        except Exception:
            logger.exception("bot %s: unexpected error in phase %s, recovering", player.name, game.turn_phase)
            _bot_emergency_recover(game, player)

    return game.to_dict()


async def run_bot_turns(game: "Game", manager, lock: Optional[asyncio.Lock] = None) -> None:
    scratch: Dict[str, Any] = {}
    stall_state: Dict[str, Any] = {"stall_count": 0, "last_fingerprint": None}

    for step in range(MAX_BOT_STEPS_PER_CALL):
        if lock is not None:
            async with lock:
                state = _run_one_bot_step(game, scratch, stall_state)
        else:
            state = _run_one_bot_step(game, scratch, stall_state)

        if state is None:
            return

        await manager.broadcast({"type": "game_update", "game_state": state})
        await asyncio.sleep(BOT_STEP_DELAY_SECONDS)

        if (step + 1) % BOT_STEPS_LOG_CHECKPOINT == 0:
            logger.info(
                "run_bot_turns: %d bot actions so far this call, still in progress (turn %d, phase %s)",
                step + 1, game.turn_number, game.turn_phase,
            )

    logger.error(
        "run_bot_turns hit MAX_BOT_STEPS_PER_CALL (%d) without reaching a human turn or game over "
        "(turn %d, phase %s) — this should not happen in normal play. Rescheduling a continuation "
        "so the game doesn't get stuck.",
        MAX_BOT_STEPS_PER_CALL, game.turn_number, game.turn_phase,
    )
    if lock is not None:
        # FIX (soft lock): same asyncio.create_task() gotcha as main.py's
        # _spawn_bot_turns — an unreferenced task is only weakly held by
        # the event loop and can be garbage collected mid-run. This
        # rollover path is rare, but it's the exact same bug class, so it
        # gets the exact same fix: hold a strong reference until done.
        task = asyncio.create_task(run_bot_turns(game, manager, lock))
        _background_continuation_tasks.add(task)
        task.add_done_callback(_background_continuation_tasks.discard)
    else:
        await run_bot_turns(game, manager, lock)