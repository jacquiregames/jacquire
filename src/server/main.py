# src/server/main.py
import asyncio
import logging
import os
import json
import secrets
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Local imports from our new modules
from .game_logic import Game
from .connection_manager import manager
from . import bot_ai
from .models import (
    GameStateResponse, BuyStockRequest, ChooseChainRequest, ResolveStocksRequest, 
    ChooseMergerRequest, EndTurnRequest, JoinRequest, PlaceTileRequest,
    StartGameRequest, PlaceWildTileRequest, UseSpecialPowerRequest,
    PlayerNameRequest, TradeStockPowerRequest, AddBotRequest, RemoveBotRequest,
    ResetGameRequest
)
from .utils import get_price_tables_for_client

app = FastAPI()

# --- Global State Management ---
state_lock = asyncio.Lock()
lobby_players = []
game_instance: Game | None = None

# FIX (trust model): minted once for whoever is first to join an empty
# lobby (see /join). Required by /add_bot, /remove_bot, and /reset_game so
# those endpoints have the same "prove you're who you say you are"
# guarantee every gameplay endpoint already has via each player's own
# token. Cleared by /reset_game so the next session's first joiner becomes
# the new host. Deliberately NOT required by /start_game — starting the
# game is left available to any lobby member, matching how it worked
# before this fix; only the three endpoints that can disrupt other
# people's lobby/game state without any per-player token to check against
# are gated.
host_token: str | None = None
# FIX (restore-on-refresh): who host_token belongs to, so /session_status
# can answer "is this player the host?" for a reconnecting client without
# that client needing to have kept its own copy of host_token around.
host_player_name: str | None = None

MAX_PLAYERS = 6

# FIX: removed allow_credentials=True — browsers reject credentials with a
# wildcard allow_origins, making the combination invalid per the CORS spec.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper for Accessing Global Game ---
def get_game() -> Game:
    global game_instance
    if game_instance is None:
        raise HTTPException(status_code=404, detail="No active game")
    return game_instance

def _public_lobby_players():
    """Strips tokens (and anything else server-private) before this ever
    goes out over the wire, same trust boundary as the rest of /join."""
    return [{"name": p["name"], "color": p["color"], "is_bot": p.get("is_bot", False)} for p in lobby_players]

def _verify_host(token: str):
    """Raise if `token` doesn't match the current session's host_token.
    Must be called from inside `async with state_lock` like every other
    state-touching check, since host_token can change between the caller
    reading it and this check running otherwise."""
    if not host_token or token != host_token:
        raise HTTPException(status_code=403, detail="Host-only action.")

# FIX (soft lock): asyncio.create_task() only hands back a Task; the event
# loop itself only holds a *weak* reference to it. If nothing else keeps a
# strong reference, the task is eligible for garbage collection at any
# point before it finishes — silently, with no exception and no log line —
# per the asyncio docs' own warning on create_task(). A short bot turn
# (place a tile, buy stock, end turn) usually completes fast enough that
# this was rarely observed. A merger resolution is exactly the opposite:
# several sequential awaits and BOT_STEP_DELAY_SECONDS sleeps strung
# together while the resolution queue works through however many players
# hold the defunct chain, which is a much longer window for gc to collect
# the task mid-resolution and leave turn_phase stuck on TRADE_STOCKS (or
# CHOOSE_MERGER/CHOOSE_DEFUNCT) forever, since nothing else will ever spawn
# a fresh task to resume it. Keeping every spawned task in this set (and
# discarding it only once it's actually done) is the standard fix.
_background_bot_tasks: set[asyncio.Task] = set()

def _spawn_bot_turns(game: Game) -> None:
    task = asyncio.create_task(bot_ai.run_bot_turns(game, manager, state_lock))
    _background_bot_tasks.add(task)
    task.add_done_callback(_background_bot_tasks.discard)

async def _finalize_and_broadcast(game: Game):
    """
    Bot integration point. Computes the new state, broadcasts it, and returns it.
    Then, fires a background task to let bots play if it's their turn.
    """
    state = game.to_dict()
    await manager.broadcast({"type": "game_update", "game_state": state})

    # FIX: only spawn the bot-turn task when there's actually a bot to act.
    # This used to fire unconditionally after every single mutating
    # endpoint call, even ones that obviously hand control to a human next
    # (e.g. a human buying stock on their own turn) — each such task did
    # one lock acquisition, confirmed there was nothing to do via
    # `_run_one_bot_step` returning None, and exited immediately. Harmless,
    # but it's pure churn under fast play with several humans acting in
    # quick succession. bot_ai.is_bot_turn() is the same cheap,
    # side-effect-free check run_bot_turns would make on its first
    # iteration anyway, so this doesn't change behavior — it just avoids
    # creating a task that would immediately no-op.
    if bot_ai.is_bot_turn(game):
        _spawn_bot_turns(game)

    return state


# --- API Routes ---

@app.get("/")
async def root():
    return {"message": "Acquire Game Server", "status": "running"}

@app.post("/join")
async def join_lobby(request: JoinRequest):
    async with state_lock:
        global lobby_players, host_token, host_player_name
        if len(lobby_players) >= MAX_PLAYERS:
            raise HTTPException(status_code=400, detail="Lobby is full.")
        if any(p['name'] == request.player_name for p in lobby_players):
            raise HTTPException(status_code=400, detail="Player name already in lobby")
        if any(p['color'] == request.color for p in lobby_players):
            raise HTTPException(status_code=400, detail="Color is already taken")

        # FIX (trust model): whoever is first to join an empty lobby becomes
        # this session's host and gets a host_token, required by
        # /add_bot, /remove_bot, and /reset_game (see _verify_host). Only
        # returned in this caller's own response — never broadcast, and
        # never attached to the lobby_players entries that go out over
        # /lobby or lobby_update, for the same reason player tokens aren't.
        is_host = len(lobby_players) == 0
        if is_host:
            host_token = secrets.token_hex(16)
            host_player_name = request.player_name

        # FIX (trust model): mint a token for this player now, carry it in
        # lobby_players so /start_game can attach it to their Player object,
        # and hand it back so the client can present it on every future
        # action as proof it's really that player. Note: lobby_players
        # itself (server-side) keeps every player's token so /start_game can
        # look them up, but nothing sent back over the wire may include
        # anyone's token but the caller's own — otherwise this endpoint
        # would leak every other lobby member's token to whoever joins next.
        player_token = secrets.token_hex(16)
        lobby_players.append({"name": request.player_name, "color": request.color, "token": player_token, "is_bot": False})
        public_players = _public_lobby_players()
        await manager.broadcast({"type": "lobby_update", "players": public_players})

    response = {"message": f"{request.player_name} joined the lobby", "players": public_players, "token": player_token}
    if is_host:
        response["host_token"] = host_token
    return response

@app.post("/add_bot")
async def add_bot(request: AddBotRequest):
    """
    Adds a computer-controlled player to the lobby. Bots never connect over
    the wire — the server mints their token and drives their turns itself
    (see bot_ai.run_bot_turns), so nothing here needs to be handed back to
    any client the way /join's token is.
    """
    async with state_lock:
        global lobby_players
        _verify_host(request.host_token)
        if game_instance is not None:
            raise HTTPException(status_code=400, detail="Cannot add a bot after the game has started.")
        if len(lobby_players) >= MAX_PLAYERS:
            raise HTTPException(status_code=400, detail="Lobby is full.")

        existing_names = {p["name"] for p in lobby_players}
        existing_colors = {p["color"] for p in lobby_players}

        bot_name = bot_ai.pick_bot_name(existing_names, request.difficulty) # <-- PASSED HERE
        bot_color = request.color if (request.color and request.color not in existing_colors) else None
        if bot_color is None:
            bot_color = bot_ai.pick_bot_color(existing_colors)
        if bot_color is None or bot_color in existing_colors:
            raise HTTPException(status_code=400, detail="No colors available for a new bot.")

        lobby_players.append({
            "name": bot_name,
            "color": bot_color,
            "token": secrets.token_hex(16),
            "is_bot": True,
        })
        public_players = _public_lobby_players()
        await manager.broadcast({"type": "lobby_update", "players": public_players})

    return {"message": f"{bot_name} added to the lobby", "players": public_players}

@app.post("/remove_bot")
async def remove_bot(request: RemoveBotRequest):
    async with state_lock:
        global lobby_players
        _verify_host(request.host_token)
        if game_instance is not None:
            raise HTTPException(status_code=400, detail="Cannot remove a bot after the game has started.")
        entry = next((p for p in lobby_players if p["name"] == request.name and p.get("is_bot")), None)
        if not entry:
            raise HTTPException(status_code=404, detail="Bot not found in lobby.")
        lobby_players.remove(entry)
        public_players = _public_lobby_players()
        await manager.broadcast({"type": "lobby_update", "players": public_players})

    return {"message": f"{request.name} removed from the lobby", "players": public_players}

@app.post("/start_game", response_model=GameStateResponse)
async def start_game(request: StartGameRequest):
    global game_instance, lobby_players
    async with state_lock:
        if game_instance is not None:
            raise HTTPException(status_code=400, detail="Game already in progress")
        if len(request.players) < 2 or len(request.players) > 6:
            raise HTTPException(status_code=400, detail="Game requires 2-6 players") 

        # FIX (trust model): request.players is entirely client-supplied. If
        # we trusted a client-provided "token" field here, anyone could
        # fabricate a start_game request naming another lobby member with a
        # token of their own choosing and take over that player for the
        # whole game. Instead, resolve each named player's real token from
        # the server-side lobby_players record (set at /join) and ignore
        # anything the client submitted for that field.
        lobby_by_name = {p["name"]: p for p in lobby_players}
        resolved_players = []
        for p in request.players:
            lobby_entry = lobby_by_name.get(p.get("name", ""))
            resolved_players.append({
                "name": p.get("name", ""),
                "color": p.get("color", ""),
                "token": lobby_entry["token"] if lobby_entry else secrets.token_hex(16),
                # Bot status also comes from the server-side lobby record,
                # never from the client-supplied payload, for the same
                # reason the token does: a client could otherwise claim any
                # human player is a bot (or vice versa) and hijack them.
                "is_bot": bool(lobby_entry.get("is_bot", False)) if lobby_entry else False,
            })

        game_instance = Game(
            resolved_players,
            wild_tile_variant=request.wild_tile_variant,
            special_powers_variant=request.special_powers_variant,
            fast_game_variant=request.fast_game_variant
        )
        lobby_players = []
        state = game_instance.to_dict()
        await manager.broadcast({"type": "game_started", "game_state": state})
        # FIX: same is_bot_turn() guard as _finalize_and_broadcast — only
        # worth spawning the task if the very first player is a bot. Uses
        # _spawn_bot_turns (not a raw create_task) for the same reason:
        # keeping a strong reference so this task can't be garbage
        # collected mid-execution.
        if bot_ai.is_bot_turn(game_instance):
            _spawn_bot_turns(game_instance)

        return state
 
@app.post("/place_wild_tile", response_model=GameStateResponse)
async def place_wild_tile_endpoint(request: PlaceWildTileRequest):
    async with state_lock:
        game = get_game()
        game.place_wild_tile(request.player_name, request.row, request.col, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/use_special_power", response_model=GameStateResponse)
async def use_special_power_endpoint(request: UseSpecialPowerRequest):
    async with state_lock:
        game = get_game()
        game.use_special_power(request.player_name, request.power, request.token)
        return await _finalize_and_broadcast(game)

@app.get("/lobby")
async def get_lobby():
    async with state_lock:
        return {"players": _public_lobby_players()}

@app.get("/session_status")
async def session_status(player_name: str, token: str):
    """
    FIX (restore-on-refresh): lets a reconnecting client re-derive its host
    status from the server, rather than depending solely on a hostToken it
    happened to still have sitting in sessionStorage. A page refresh alone
    was already fine (sessionStorage survives it), but anything that lost
    that one cached value specifically — a browser that scopes storage
    differently, a "clear site data" click, opening the game in a second
    tab pointed at the same session — would otherwise leave a real host
    stuck without host-only controls, with no way back short of a full
    /reset_game (which itself needs a host_token to call). This endpoint
    fixes that by making player_name + the player's own token (already
    reliably restorable — every /join response includes it, and it's
    exactly as sensitive as any other gameplay request already trusts)
    sufficient to re-derive everything, including host_token itself when
    the caller genuinely is the host.

    Never discloses host_token to anyone who hasn't first proven their own
    identity via a token that matches server records for that exact name —
    same trust boundary as every mutating endpoint.
    """
    async with state_lock:
        verified = False
        in_game = False
        if game_instance is not None:
            try:
                player = game_instance.find_player(player_name)
                verified = bool(player.token) and player.token == token
                in_game = verified
            except HTTPException:
                verified = False
        if not verified:
            entry = next((p for p in lobby_players if p["name"] == player_name), None)
            verified = bool(entry) and bool(entry["token"]) and entry["token"] == token

        if not verified:
            raise HTTPException(status_code=403, detail="Could not verify player session.")

        is_host = bool(host_token) and player_name == host_player_name
        return {
            "in_game": in_game,
            "is_host": is_host,
            # Only ever included when is_host is true, i.e. only ever
            # handed back to the one caller who's allowed to have it.
            "host_token": host_token if is_host else None,
        }

@app.get("/game_state", response_model=GameStateResponse)
async def get_game_state():
    async with state_lock:
        game = get_game()
        return game.to_dict()

@app.get("/price_table")
async def get_price_table():
    """
    FIX: single source of truth for hotel share pricing. The frontend used to
    hardcode its own copy of these tables (src/utils/stockPricing.ts) for
    display-only calculations (merger previews, majority/minority estimates).
    That copy could silently drift from the tables actually used to settle
    money server-side. The frontend now fetches this once and caches it.
    """
    return get_price_tables_for_client()

@app.get("/highscores")
async def get_highscores():
    scores = []
    scores_file = os.path.join(os.path.dirname(__file__), "highscore.txt")
    if os.path.exists(scores_file):
        try:
            with open(scores_file, "r") as f:
                for line in f:
                    if line.strip():
                        scores.append(json.loads(line.strip()))
        except Exception as e:
            logging.error(f"Error reading high scores: {e}")
    return scores

@app.post("/place_tile", response_model=GameStateResponse)
async def place_tile_endpoint(request: PlaceTileRequest):
    async with state_lock:
        game = get_game()
        game.place_tile(request.player_name, request.row, request.col, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/choose_chain", response_model=GameStateResponse)
async def choose_chain_endpoint(req: ChooseChainRequest):
    async with state_lock:
        game = get_game()
        game.choose_chain(req.player_name, req.chain, req.token)
        return await _finalize_and_broadcast(game)

@app.post("/buy_stock", response_model=GameStateResponse)
async def buy_stock_endpoint(request: BuyStockRequest):
    async with state_lock:
        game = get_game()
        game.buy_stock(request.player_name, request.chain, request.quantity, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/end_tile_placement", response_model=GameStateResponse)
async def end_tile_placement_endpoint(request: PlayerNameRequest):
    """Endpoint for when a player using Place 4 wants to end their placement phase early."""
    async with state_lock:
        game = get_game()
        game.end_tile_placement(request.player_name, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/end_turn", response_model=GameStateResponse)
async def end_turn_endpoint(request: EndTurnRequest):
    async with state_lock:
        game = get_game()
        game.end_turn(request.player_name, request.token)
        return await _finalize_and_broadcast(game)
    
@app.post("/choose_merger", response_model=GameStateResponse)
async def choose_merger_endpoint(req: ChooseMergerRequest):
    async with state_lock:
        game = get_game()
        game.choose_merger(req.player_name, req.chain, req.token)
        return await _finalize_and_broadcast(game)

@app.post("/choose_defunct", response_model=GameStateResponse)
async def choose_defunct_endpoint(req: ChooseChainRequest):
    async with state_lock:
        game = get_game()
        game.choose_defunct(req.player_name, req.chain, req.token)
        return await _finalize_and_broadcast(game)    

@app.post("/resolve_merger_stocks", response_model=GameStateResponse)
async def resolve_merger_stocks_endpoint(request: ResolveStocksRequest):
    async with state_lock:
        game = get_game()
        game.resolve_merger_stocks(request.player_name, request.decisions, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/trade_stock_power", response_model=GameStateResponse)
async def trade_stock_power_endpoint(request: TradeStockPowerRequest):
    """Endpoint for executing a 2-for-1 trade."""
    async with state_lock:
        game = get_game()
        game.trade_stock_power(request.player_name, request.chain_from, request.chain_to, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/end_power_trade", response_model=GameStateResponse)
async def end_power_trade_endpoint(request: PlayerNameRequest):
    """Endpoint for ending the trade phase early."""
    async with state_lock:
        game = get_game()
        game.end_power_trade(request.player_name, request.token)
        return await _finalize_and_broadcast(game)
    
@app.post("/undo_tile_placement", response_model=GameStateResponse)
async def undo_tile_placement_endpoint(request: EndTurnRequest):
    async with state_lock:
        game = get_game()
        game.undo_tile_placement(request.player_name, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/discard_and_draw", response_model=GameStateResponse)
async def discard_and_draw_endpoint(request: PlayerNameRequest):
    async with state_lock:
        game = get_game()
        game.discard_and_draw_tiles(request.player_name, request.token)
        return await _finalize_and_broadcast(game)

@app.post("/request_end_game", response_model=GameStateResponse)
async def request_end_game_endpoint(request: EndTurnRequest):
    async with state_lock:
        game = get_game()
        game.request_end_game(request.player_name, request.token)
        return await _finalize_and_broadcast(game)
    
@app.post("/reset_game")
async def reset_game(request: ResetGameRequest):
    async with state_lock:
        global game_instance, lobby_players, host_token, host_player_name
        _verify_host(request.host_token)
        game_instance = None
        lobby_players = []
        # FIX (trust model): clear so the next session's first joiner mints
        # a fresh host_token rather than inheriting this one.
        host_token = None
        host_player_name = None
        await manager.broadcast({"type": "game_reset"})
    return {"message": "Game reset"}

@app.get("/valid_tiles")
async def valid_tiles_endpoint():
    async with state_lock:
        game = get_game()
        return {
            "valid_tiles": game.get_all_playable_tiles(),
            "dead_tiles": game.get_all_dead_tiles()
        }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="info") 
