# src/server/models.py
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum
from pydantic import BaseModel 


class HotelChain(str, Enum):
    LUXOR = "Luxor"
    TOWER = "Tower"
    FESTIVAL = "Festival"
    WORLDWIDE = "Worldwide"
    AMERICAN = "American"
    CONTINENTAL = "Continental"
    IMPERIAL = "Imperial"

class TurnPhase(str, Enum):
    PLACE_TILE = "place_tile"
    CHOOSE_CHAIN = "choose_chain"
    BUY_STOCK = "buy_stock"
    CHOOSE_MERGER = "choose_merger"
    TRADE_STOCKS = "trade_stocks"
    TRADE_STOCKS_POWER = "trade_stocks_power" 
    GAME_OVER = "game_over"
    CHOOSE_DEFUNCT = "choose_defunct"

class SpecialPower(str, Enum):
    TRADE_2 = "Trade 2"
    FREE_3 = "Free 3"
    PLACE_4 = "Place 4"
    BUY_5 = "Buy 5"
    TAKE_5 = "Take 5"

class Player:
    def __init__(self, name: str, color: str, token: str = "", is_bot: bool = False):
        self.name = name
        self.color = color
        self.cash = 6000
        self.tiles: List[Tuple[int, int]] = []
        self.stocks: Dict[str, int] = {chain.value: 0 for chain in HotelChain}
        self.has_wild_tile: bool = False 
        self.special_powers: List[SpecialPower] = []
        # FIX: declare net_worth so it is always present on the object,
        # not just set dynamically in _end_game_sequence.
        self.net_worth: int = 0
        # FIX (trust model): every mutating endpoint previously trusted
        # whatever player_name a request body claimed, with nothing binding
        # a caller to the player they claimed to be. Anyone on the LAN could
        # act as any player just by knowing their name. A token is minted at
        # /join and must be presented on every subsequent action for that
        # player.
        self.token: str = token
        # Bot opponents: the server itself calls the same Game methods a
        # human's request would, using this token — see bot_ai.py. Nothing
        # about validation changes for a bot; this flag only tells
        # run_bot_turns() who it's allowed to act on behalf of.
        self.is_bot: bool = is_bot

# --- API Request & Response Models ---

class PlayerResponse(BaseModel):
    name: str
    cash: int
    tiles: List[Tuple[int, int]]
    stocks: Dict[str, int]
    color: str
    net_worth: int
    has_wild_tile: bool 
    special_powers: List[str] 
    cash_before_scoring: Optional[int] = None 
    is_bot: bool = False

class GameStateResponse(BaseModel):
    players: List[PlayerResponse]
    board: List[List[Optional[str]]]
    current_player: str
    message: str
    game_started: bool
    game_over: bool
    is_end_game_possible: bool
    stock_prices: Dict[str, int]
    chain_sizes: Dict[str, int]
    active_chains: List[str]
    available_chains: List[Dict[str, Any]]
    stock_counts: Dict[str, int]
    turn_phase: str
    current_turn_stock_count: int
    pending_merger_choice: Optional[Dict[str, Any]]
    pending_stock_resolution: Optional[Dict[str, Any]] = None
    can_undo_placement: bool
    winners: List[str]
    last_animation_event: Optional[Dict[str, Any]]
    formatted_log: List[str]
    game_log: List[Dict[str, Any]]
    final_bonus_payouts: List[Dict[str, Any]] = []
    final_stats: Optional[Dict[str, Any]] = None
    two_by_two_grids: Dict[str, Tuple[int, int]] = {} 
    four_by_one_grids: Dict[str, Tuple[int, int]] = {}
    power_used_this_turn: bool = False  
    max_stocks_to_buy_this_turn: int = 3
    tiles_to_place_this_turn: int = 1  
    free_stocks_this_turn: int = 0
    trade_actions_remaining: int = 0
    turn_number: int = 1
    # FIX (soft lock, part 2): see the matching comment on Game._state_version
    # in game_logic.py — lets the frontend detect and discard a stale
    # snapshot instead of letting it overwrite newer state.
    state_version: int = 0

class BuyStockRequest(BaseModel):
    player_name: str
    chain: str
    quantity: int
    token: str = ""

class ChooseChainRequest(BaseModel):
    player_name: str
    chain: str
    token: str = ""

class ChooseMergerRequest(BaseModel):
    player_name: str
    chain: str
    token: str = ""

class EndTurnRequest(BaseModel):
    player_name: str
    token: str = ""

class JoinRequest(BaseModel):
    player_name: str
    color: str

class PlaceTileRequest(BaseModel):
    player_name: str
    row: int
    col: int
    token: str = ""

class ResolveStocksRequest(BaseModel):
    player_name: str
    decisions: Dict[str, Dict[str, Any]]
    token: str = ""

class StartGameRequest(BaseModel):
    # FIX: was List[Dict[str, str]]. Lobby entries now carry is_bot (a bool,
    # not a str) alongside name/color, since the client sends its whole
    # lobbyPlayers list straight through to /start_game. A strict
    # Dict[str, str] rejects that payload outright (422) the moment any
    # entry contains a bool. The server still authoritatively resolves each
    # player's real token/is_bot from its own lobby_players record in
    # start_game() — this loosened type only affects what shape of JSON
    # pydantic will accept, not what's trusted from it.
    players: List[Dict[str, Any]]
    wild_tile_variant: bool = False 
    special_powers_variant: bool = False  
    fast_game_variant: bool = False
 
class PlaceWildTileRequest(BaseModel):
    player_name: str
    row: int
    col: int
    token: str = ""
    
class UseSpecialPowerRequest(BaseModel):
    player_name: str
    power: str
    token: str = ""
 
class PlayerNameRequest(BaseModel):
    player_name: str
    token: str = ""
    
class TradeStockPowerRequest(BaseModel): 
    player_name: str
    chain_from: str
    chain_to: str
    token: str = ""

class AddBotRequest(BaseModel):
    color: str = ""
    host_token: str = ""
    difficulty: str = "Medium" 

class RemoveBotRequest(BaseModel):
    name: str
    host_token: str = ""

class ResetGameRequest(BaseModel):
    host_token: str = ""




