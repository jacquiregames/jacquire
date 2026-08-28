// src/App.tsx
import { useState, useReducer, useEffect, useRef } from "react";
import axios, { AxiosError } from "axios";
import { LazyMotion, MotionConfig } from "motion/react";
import UnifiedIntro from "./lobby/UnifiedIntro";
import { GameBoard } from "./board/GameBoard";
import useWebSocketWithReconnect from "./hooks/useWebSocketWithReconnect";
import useVideoTransition from "./hooks/useVideoTransition";
import useBackgroundStyle from "./hooks/useBackgroundStyle";
import { Fireworks } from "@fireworks-js/react";
import { GameState } from './types'; 
import { sessionReducer, initialSessionState } from './state/sessionReducer';
import { loadServerPriceTables } from './utils/stockPricing';
import { motionFeatures } from './utils/motionFeatures';
import "./styles/UnifiedIntro.css";
import "./styles/App.css";
import "./styles/GameSummaryPanel.css";

// --- DYNAMIC URL CONFIGURATION --- 
const backendPort = 3000;  
const hostname = window.location.hostname;  
const API_URL = `http://${hostname}:${backendPort}`;
const WS_URL = `ws://${hostname}:${backendPort}/ws`; 

interface LobbyPlayer {
  name: string;
  color: string;
  is_bot?: boolean;
}

export default function App() {
  // FIX (react-doctor: prefer-useReducer): see sessionReducer.ts for the
  // full reasoning — playerName/playerToken/gameStarted/gameState always
  // changed together in practice, just via repeated setState clusters.
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const { playerName, playerToken, gameStarted, gameState } = session;
  const setPlayerName = (name: string) => dispatch({ type: 'NAME_EDITED', name });

  // FIX (react-doctor: rerender-state-only-in-handlers): hostToken is never
  // shown on screen — it's only read inside handleAddBot/handleRemoveBot/
  // handleReset when the host takes one of those actions. Storing it in
  // useState meant every update (on join, on session_status resync, on
  // reset) triggered a re-render of the whole App tree for a value nothing
  // ever renders. A ref updates it without that — reads inside the handlers
  // below still always see the latest value, same as state would.
  const hostTokenRef = useRef<string>(sessionStorage.getItem("hostToken") || "");
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [joining, setJoining] = useState<boolean>(false);

  // FIX (soft lock): game state arrives from two independent channels —
  // the WebSocket broadcast, and (per GameBoard's handleApiCall) the raw
  // HTTP response of whatever action this client itself just took, applied
  // immediately so this client's own view doesn't depend on the socket
  // surviving a drop. Nothing previously enforced any ordering between
  // those two channels. In particular: a human action that hands the turn
  // to one or more bots (e.g. resolving a merger) triggers a fire-and-forget
  // background task that plays out the bots' turns and broadcasts each step
  // over the socket — and that can finish, and be received here, *before*
  // the slower-to-serialize HTTP response for the original human action
  // arrives. That HTTP response is for an earlier, already-superseded
  // moment; applying it after the fact silently dragged the UI backward to
  // "waiting on BotX" even though the backend had already moved on, with
  // nothing left to ever send another update — a soft lock. state_version
  // is a monotonic counter bumped once per snapshot on the backend, always
  // increasing in true chronological order regardless of delivery order;
  // refusing to apply a snapshot older than the one already shown closes
  // that race without needing to change how/when either channel delivers.
  const latestStateVersionRef = useRef<number>(-1);
  // `restoredPlayerName` is only passed by the session-restore path in the
  // mount/reconnect effect below — every other caller (WS broadcasts, the
  // poll interval, GameBoard's own HTTP-response-driven updates) just wants
  // "apply this newer snapshot", which is also all that ever happens with
  // a null state in practice (nothing calls this with null; SESSION_CLEARED
  // is dispatched directly wherever the session actually needs clearing).
  const applyGameState = (state: GameState | null, restoredPlayerName?: string) => {
    if (!state) return;
    if (typeof state.state_version === "number") {
      if (state.state_version <= latestStateVersionRef.current) {
        return;
      }
      latestStateVersionRef.current = state.state_version;
    }
    if (restoredPlayerName) {
      dispatch({ type: 'SESSION_RESTORED', playerName: restoredPlayerName, gameState: state });
    } else {
      dispatch({ type: 'GAME_STATE_RECEIVED', gameState: state });
    }
  };
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [wildTileVariant, setWildTileVariant] = useState<boolean>(false);
  const [specialPowersVariant, setSpecialPowersVariant] = useState<boolean>(false);
  const [fastGameVariant, setFastGameVariant] = useState<boolean>(false);
  const [reconnectFailed, setReconnectFailed] = useState<boolean>(false);
  const [botActionPending, setBotActionPending] = useState<boolean>(false);

  const { showBackground, setShowBackground, currentBackgroundIndex, handleNextBackground, backgroundClass } =
    useBackgroundStyle(gameStarted, gameState);
  const { videoState, videoRef, play: playVideoTransition, reset: resetVideoTransition, handleVideoEnd } =
    useVideoTransition();

  useEffect(() => {
    loadServerPriceTables(API_URL);
  }, []);
  
  const { connectionStatus } = useWebSocketWithReconnect({
    url: WS_URL,
    onMessage: (msg: any) => {
      if (msg.type === "lobby_update") {
        setLobbyPlayers(msg.players);
      } else if (msg.type === "game_started") {
        playVideoTransition();
        latestStateVersionRef.current = -1; // fresh game: reset ordering baseline
        applyGameState(msg.game_state);
      } else if (msg.type === "game_update") {
        applyGameState(msg.game_state);
      } else if (msg.type === "game_reset") {
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("hostToken");
        hostTokenRef.current = "";
        setLobbyPlayers([]);
        latestStateVersionRef.current = -1;
        dispatch({ type: 'SESSION_CLEARED' });
        resetVideoTransition();
      }
    },
    onFailedReconnect: () => {
      setReconnectFailed(true);
    },
    shouldMonitorConnection: true,
    dependencies: [], 
  });

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setReconnectFailed(false);
      return;
    }

    const storedPlayerName = sessionStorage.getItem("playerName");
    if (!storedPlayerName || !gameStarted) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/game_state`);
        applyGameState(res.data);
      } catch {
        // server may be briefly unreachable; the next poll will retry
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [connectionStatus, gameStarted]);

  useEffect(() => {
    // FIX (react-doctor: no-set-state-after-await-in-effect): this effect
    // re-runs on every connectionStatus change, and fires three async
    // calls that each set state after an await with no ownership check.
    // If connectionStatus flaps quickly (a brief reconnect blip), an older
    // run's response can resolve *after* a newer run's and stomp it — most
    // dangerously in fetchAndSetGameState's "session not found" branch,
    // which clears playerName/playerToken/hostToken/gameState entirely: a
    // stale "not found" arriving late could wipe out a session a newer,
    // successful check had just restored. `cancelled` lets a superseded
    // run's callbacks no-op instead of applying their (possibly stale)
    // result.
    let cancelled = false;
    const storedPlayerName = sessionStorage.getItem("playerName");

    const fetchLobbyState = async () => {
      try {
        const res = await axios.get(`${API_URL}/lobby`);
        if (cancelled) return;
        setLobbyPlayers(res.data.players);
      } catch (error) {
        if (!cancelled) console.error("Failed to fetch lobby state");
      }
    };

    const fetchAndSetGameState = async () => {
      try {
        const res = await axios.get(`${API_URL}/game_state`);
        if (cancelled) return;
        const serverState: GameState = res.data;
        if (serverState && serverState.game_started) {  
          const playerInGame = serverState.players.some(p => p.name === storedPlayerName);
          if (storedPlayerName && playerInGame) {
            applyGameState(serverState, storedPlayerName);
          } else {
            sessionStorage.removeItem("playerName");
            sessionStorage.removeItem("playerToken");
            sessionStorage.removeItem("hostToken");
            hostTokenRef.current = "";
            latestStateVersionRef.current = -1;
            dispatch({ type: 'SESSION_CLEARED' });
          }
        }
      } catch (error) {
        if (cancelled) return;
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("hostToken");
        hostTokenRef.current = "";
        latestStateVersionRef.current = -1;
        dispatch({ type: 'SESSION_CLEARED' });
      }
    };

    const syncHostStatus = async (name: string) => {
      const storedPlayerToken = sessionStorage.getItem("playerToken");
      if (!storedPlayerToken) return;
      try {
        const res = await axios.get(`${API_URL}/session_status`, {
          params: { player_name: name, token: storedPlayerToken },
        });
        if (cancelled) return;
        if (res.data.is_host && res.data.host_token) {
          sessionStorage.setItem("hostToken", res.data.host_token);
          hostTokenRef.current = res.data.host_token;
        } else {
          sessionStorage.removeItem("hostToken");
          hostTokenRef.current = "";
        }
      } catch (error) {
      }
    };

    if (connectionStatus === 'connected') {
      fetchLobbyState();
      if (storedPlayerName) {
        fetchAndSetGameState();
        syncHostStatus(storedPlayerName);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [connectionStatus]);

  const handleJoin = async (color: string) => {
    if (!playerName.trim()) { setErrorMessage("Please enter a name"); return; }
    if (!color) { setErrorMessage("Please select a color"); return; }
    setJoining(true);
    setErrorMessage("");
    try {
      const res = await axios.post(`${API_URL}/join`, { player_name: playerName, color: color });
      setLobbyPlayers(res.data.players);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("playerToken", res.data.token);
      dispatch({ type: 'TOKEN_ISSUED', token: res.data.token });
      if (res.data.host_token) {
        sessionStorage.setItem("hostToken", res.data.host_token);
        hostTokenRef.current = res.data.host_token;
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ detail: string }>;
      setErrorMessage(axiosError.response?.data?.detail || "Failed to join game");
    } finally {
      setJoining(false);
    }
  };
    
  const handleStartGame = async () => {
    if (lobbyPlayers.length < 2) {
      return setErrorMessage("Need at least 2 players.");
    }
    try { 
      await axios.post(`${API_URL}/start_game`, { 
                players: lobbyPlayers,
                wild_tile_variant: wildTileVariant, 
                special_powers_variant: specialPowersVariant,
                fast_game_variant: fastGameVariant
            });
      setErrorMessage("");
    } catch (e) {
      const axiosError = e as AxiosError<{ detail: string }>;
      const errorMsg = axiosError.response?.data?.detail || "Start failed";
      setErrorMessage(`Error: ${errorMsg}`);
    }
  };

  const handleAddBot = async (difficulty: string) => {  
    setBotActionPending(true);
    setErrorMessage("");
    try {
      const res = await axios.post(`${API_URL}/add_bot`, { host_token: hostTokenRef.current, difficulty });
      setLobbyPlayers(res.data.players);
    } catch (e) {
      const axiosError = e as AxiosError<{ detail: string }>;
      setErrorMessage(axiosError.response?.data?.detail || "Failed to add bot");
    } finally {
      setBotActionPending(false);
    }
  };

  const handleRemoveBot = async (botName: string) => {
    setBotActionPending(true);
    setErrorMessage("");
    try {
      const res = await axios.post(`${API_URL}/remove_bot`, { name: botName, host_token: hostTokenRef.current });
      setLobbyPlayers(res.data.players);
    } catch (e) {
      const axiosError = e as AxiosError<{ detail: string }>;
      setErrorMessage(axiosError.response?.data?.detail || "Failed to remove bot");
    } finally {
      setBotActionPending(false);
    }
  };

  const handleReset = async () => {
    try {
      await axios.post(`${API_URL}/reset_game`, { host_token: hostTokenRef.current });
    } catch (e) {
      const axiosError = e as AxiosError<{ detail: string }>;
      setErrorMessage(axiosError.response?.data?.detail || "Reset failed");
    }
  };

  return (
    <LazyMotion features={motionFeatures} strict>
    <MotionConfig reducedMotion="user">
    <div className={backgroundClass}> 
      <div id="background-flash-container"></div>
      
      {/* Video Transition Overlay */}
      <video
        ref={videoRef}
        src="/videos/jacquire.mp4"
        muted
        playsInline
        preload="auto"
        className={`transition-video ${videoState}`}
        onEnded={handleVideoEnd}
      />

      {(!gameStarted || gameState?.game_over) && (
        <Fireworks
          options={{
            opacity: 0.5, 
            intensity: 15,
            friction: 0.97,
            acceleration: 1.05,
            hue: { min: 10, max: 290 },
            delay: { min: 30, max: 60 }
          }}
          style={{
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            position: "fixed",
            zIndex: 2,
            filter: "brightness(1.2)",
          }}
        />
      )}

      {!gameState || !gameStarted ? (
        <UnifiedIntro
          playerName={playerName}
          setPlayerName={setPlayerName}
          handleJoin={handleJoin}
          joining={joining}
          lobbyPlayers={lobbyPlayers}
          isHost={lobbyPlayers[0]?.name === playerName}
          handleStartGame={handleStartGame}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
          botActionPending={botActionPending}
          errorMessage={errorMessage}
          wildTileVariant={wildTileVariant} 
          setWildTileVariant={setWildTileVariant} 
          specialPowersVariant={specialPowersVariant}  
          setSpecialPowersVariant={setSpecialPowersVariant} 
          fastGameVariant={fastGameVariant}
          setFastGameVariant={setFastGameVariant}
          apiUrl={API_URL}          
        />
      ) : (
        <div className="game-content-wrapper">
          {connectionStatus !== "connected" && !reconnectFailed && (
            <div className="connection-banner">
              Connection lost. Reconnecting...
            </div>
          )}
          {reconnectFailed && (
            <div className="connection-banner">
              Lost connection to the server. Still trying in the background — refresh this page if the game doesn't update.
            </div>
          )}
          <GameBoard
            playerName={playerName}
            playerToken={playerToken}
            apiUrl={API_URL}
            gameState={gameState}
            onGameStateUpdate={applyGameState}
            onReset={handleReset}
            showBackground={showBackground}        
            onToggleBackground={setShowBackground} 
            onNextBackground={handleNextBackground}
          />
        </div>
      )}
    </div>
    </MotionConfig>
    </LazyMotion>
  );
}

