// src/App.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import axios, { AxiosError } from "axios";
import { MotionConfig } from "motion/react";
import UnifiedIntro from "./UnifiedIntro";
import { GameBoard } from "./GameBoard";
import useWebSocketWithReconnect from "./hooks/useWebSocketWithReconnect";
import { Fireworks } from "@fireworks-js/react";
import { GameState } from './types'; 
import { loadServerPriceTables } from './utils/stockPricing';
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
  const [playerName, setPlayerName] = useState<string>(() => sessionStorage.getItem("playerName") || "");
  const [playerToken, setPlayerToken] = useState<string>(() => sessionStorage.getItem("playerToken") || "");
  const [hostToken, setHostToken] = useState<string>(() => sessionStorage.getItem("hostToken") || "");
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [joining, setJoining] = useState<boolean>(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

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
  const applyGameState = (state: GameState | null) => {
    if (state && typeof state.state_version === "number") {
      if (state.state_version <= latestStateVersionRef.current) {
        return;
      }
      latestStateVersionRef.current = state.state_version;
    }
    setGameState(state);
  };
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [wildTileVariant, setWildTileVariant] = useState<boolean>(false);
  const [specialPowersVariant, setSpecialPowersVariant] = useState<boolean>(false);
  const [fastGameVariant, setFastGameVariant] = useState<boolean>(false);
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState<number>(1);
  const [reconnectFailed, setReconnectFailed] = useState<boolean>(false);
  const [botActionPending, setBotActionPending] = useState<boolean>(false);

  // Video transition states
  const [videoState, setVideoState] = useState<'idle' | 'playing' | 'fading'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleNextBackground = () => {
    setCurrentBackgroundIndex(prev => (prev % 5) + 1);
  };

  useEffect(() => {
    loadServerPriceTables(API_URL);
  }, []);
  
  const { connectionStatus } = useWebSocketWithReconnect({
    url: WS_URL,
    onMessage: (msg: any) => {
      if (msg.type === "lobby_update") {
        setLobbyPlayers(msg.players);
      } else if (msg.type === "game_started") {
        setVideoState('playing');
        setGameStarted(true);
        latestStateVersionRef.current = -1; // fresh game: reset ordering baseline
        applyGameState(msg.game_state);
      } else if (msg.type === "game_update") {
        setGameStarted(true);
        applyGameState(msg.game_state);
      } else if (msg.type === "game_reset") {
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("hostToken");
        setPlayerName("");
        setPlayerToken("");
        setHostToken("");
        setLobbyPlayers([]);
        setGameStarted(false);
        latestStateVersionRef.current = -1;
        setGameState(null);
        setVideoState('idle');
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
    const storedPlayerName = sessionStorage.getItem("playerName");

    const fetchLobbyState = async () => {
      try {
        const res = await axios.get(`${API_URL}/lobby`);
        setLobbyPlayers(res.data.players);
      } catch (error) {
        console.error("Failed to fetch lobby state");
      }
    };

    const fetchAndSetGameState = async () => {
      try {
        const res = await axios.get(`${API_URL}/game_state`);
        const serverState: GameState = res.data;
        if (serverState && serverState.game_started) {  
          const playerInGame = serverState.players.some(p => p.name === storedPlayerName);
          if (storedPlayerName && playerInGame) {
            setPlayerName(storedPlayerName);
            applyGameState(serverState);
            setGameStarted(true);
          } else {
            sessionStorage.removeItem("playerName");
            sessionStorage.removeItem("playerToken");
            sessionStorage.removeItem("hostToken");
            setPlayerName("");
            setPlayerToken("");
            setHostToken("");
            setGameStarted(false);
            latestStateVersionRef.current = -1;
            setGameState(null);
          }
        }
      } catch (error) {
        sessionStorage.removeItem("playerName");
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("hostToken");
        setPlayerName("");
        setPlayerToken("");
        setHostToken("");
        setGameStarted(false); 
        latestStateVersionRef.current = -1;
        setGameState(null);
      }
    };

    const syncHostStatus = async (name: string) => {
      const storedPlayerToken = sessionStorage.getItem("playerToken");
      if (!storedPlayerToken) return;
      try {
        const res = await axios.get(`${API_URL}/session_status`, {
          params: { player_name: name, token: storedPlayerToken },
        });
        if (res.data.is_host && res.data.host_token) {
          sessionStorage.setItem("hostToken", res.data.host_token);
          setHostToken(res.data.host_token);
        } else {
          sessionStorage.removeItem("hostToken");
          setHostToken("");
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
  }, [connectionStatus]);

  // Video playback effect
  useEffect(() => {
    if (videoState === 'playing' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => {
        console.error("Video transition play failed", e);
        setVideoState('idle'); // Fallback if video fails to play
      });
    }
  }, [videoState]);

  const handleVideoEnd = () => {
    setVideoState('fading');
    setTimeout(() => {
      setVideoState('idle');
    }, 800); // Matches the CSS transition duration
  };

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
      setPlayerToken(res.data.token);
      if (res.data.host_token) {
        sessionStorage.setItem("hostToken", res.data.host_token);
        setHostToken(res.data.host_token);
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
      const res = await axios.post(`${API_URL}/add_bot`, { host_token: hostToken, difficulty });
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
      const res = await axios.post(`${API_URL}/remove_bot`, { name: botName, host_token: hostToken });
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
      await axios.post(`${API_URL}/reset_game`, { host_token: hostToken });
    } catch (e) {
      const axiosError = e as AxiosError<{ detail: string }>;
      setErrorMessage(axiosError.response?.data?.detail || "Reset failed");
    }
  };

  const backgroundClass = useMemo(() => {
    if (!showBackground) {
      return 'app-container no-background-cyan';
    }

    if (!gameStarted || !gameState) {
      return 'app-container intro-background';
    }
    if (gameState.game_over) {
      return 'app-container game-over-background';
    }    
    return `app-container game-active-background game-bg-${currentBackgroundIndex}`;
  }, [gameState, gameStarted, showBackground, currentBackgroundIndex]);

  return (
    <MotionConfig reducedMotion="user">
    <div className={backgroundClass}> 
      <div id="background-flash-container"></div>
      
      {/* Video Transition Overlay */}
      <video
        ref={videoRef}
        src="/images/jacquire.mp4"
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
  );
}
