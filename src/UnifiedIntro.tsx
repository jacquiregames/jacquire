// src/UnifiedIntro.tsx
import { useState, useEffect, useRef } from "react";
import { confetti } from "@tsparticles/confetti";
import Particles from "@tsparticles/react";
import { prefersReducedMotion } from "./utils/motionTokens";
import Switch from "react-switch";
import { motion } from "motion/react";
import { PLAYER_COLORS, PlayerColor } from "./utils/playerColors";
import HowToPlay from "./HowToPlay";
import ImagePreloader from './ImagePreloader';
import LoadingScreen from './LoadingScreen';
import { ALL_IMAGE_URLS } from './utils/imageUrls';
import HighScore from './HighScore';
import "./styles/UnifiedIntro.css";

interface UnifiedIntroProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  handleJoin: (color: string) => void;
  joining: boolean;
  lobbyPlayers: { name: string; color: string; is_bot?: boolean }[];
  isHost: boolean;
  handleStartGame: () => void;
  onAddBot: (difficulty: string) => void;
  onRemoveBot: (botName: string) => void;
  botActionPending: boolean;
  errorMessage?: string;
  wildTileVariant: boolean;
  setWildTileVariant: (enabled: boolean) => void;
  specialPowersVariant: boolean;
  setSpecialPowersVariant: (enabled: boolean) => void;
  fastGameVariant: boolean;
  setFastGameVariant: (enabled: boolean) => void;
  apiUrl: string;
}

const lobbyListVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const lobbyItemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

export default function UnifiedIntro({
  playerName,
  setPlayerName,
  handleJoin,
  joining,
  lobbyPlayers,
  isHost,
  handleStartGame,
  onAddBot,
  onRemoveBot,
  botActionPending,
  errorMessage,
  wildTileVariant,
  setWildTileVariant,
  specialPowersVariant,
  setSpecialPowersVariant,
  fastGameVariant,
  setFastGameVariant,
  apiUrl,
}: UnifiedIntroProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<PlayerColor | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [hoveredColor, setHoveredColor] = useState<PlayerColor | null>(null);
  const [botDifficulty, setBotDifficulty] = useState<string>("Medium");
  const trimmedName = playerName.trim();
  const hasJoined = lobbyPlayers.some(p => p.name === trimmedName);
  const takenColors = lobbyPlayers.map(p => p.color);
  const isNameValid = trimmedName.length >= 2 && trimmedName.length <= 12;

  const MAX_LOBBY_SIZE = 6;
  const canAddBot = lobbyPlayers.length < MAX_LOBBY_SIZE && !botActionPending;

  // If another player joins and snatches your selected color before you hit Join, deselect it!
  useEffect(() => {
    if (selectedColor && takenColors.includes(selectedColor.primary)) {
      setSelectedColor(null);
    }
  }, [takenColors, selectedColor]);

  const handleSelectColor = (colorObj: PlayerColor) => {
    if (!takenColors.includes(colorObj.primary)) {
      setSelectedColor(colorObj);
    }
  };
  
  const joinBtnRef = useRef<HTMLButtonElement>(null);
   
  const onJoin = () => {
    if (selectedColor) {
      const baseHotelImages = [
        "american", "continental", "festival",
        "imperial", "luxor", "tower", "worldwide"
      ].map(chain => ({
        src: `/images/particles/${chain.toLowerCase()}.png`,
        width: 50,
        height: 50
      }));

      // Repeat the array to ensure we overwrite any single-chain arrays perfectly
      const hotelImages = [...baseHotelImages, ...baseHotelImages, ...baseHotelImages];

      if (!prefersReducedMotion()) {
        confetti({
          particleCount: 21,      // 3 of each hotel
          spread: 120,
          origin: { y: 0.4 },
          startVelocity: 15,
          decay: 0.96,
          gravity: 0.35,
          scalar: 4,
          ticks: 250,
          shapes: ["image"],
          shapeOptions: { image: hotelImages },
          colors: [selectedColor.primary],
          particles: {
            rotate: { value: 0, random: false, animation: { enable: false } },
            tilt: { enable: false },
            roll: { enable: false },
            wobble: { enable: false }
          }
        });
      }
      handleJoin(selectedColor.primary);
    }
  };

  const displayColor = selectedColor || hoveredColor;

  if (isLoading) {
    return (
      <>
        <ImagePreloader
          imageUrls={ALL_IMAGE_URLS}
          onComplete={() => setIsLoading(false)}
        />
        <LoadingScreen />
      </>
    );
  }

  return (
    <div className="unified-intro-container">
      <HowToPlay show={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      
      <div className="how-to-play-container">
        <button onClick={() => setShowHowToPlay(true)} className="button-primary how-to-play-btn">
          How To Play
        </button>
      </div>
      
      <img src="/images/banner/gamelogo.png" alt="Jacquire Game Logo" className="intro-logo" />
      <div className="intro-card">
        {isHost ? (
          <div className="host-lobby-layout">
            {/* Column 1: Player Selection & Lobby */}
            <div className="lobby-container">
              {!hasJoined ? (
                <div className="join-form">
                  {displayColor && isNameValid ? (
                    <div className="player-pill color-preview-pill" style={{ background: displayColor.gradient, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>
                      <span className="player-pill-name">{playerName}</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="name-input"
                      placeholder="Enter your name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      minLength={2}
                      maxLength={12}
                    />
                  )}
                  {isNameValid && (
                    <>
                      <h3 className="color-picker-title">Select a Color</h3>
                      <div className="color-picker" onMouseLeave={() => setHoveredColor(null)}>
                        {PLAYER_COLORS.map((colorObj) => {
                          const isTaken = takenColors.includes(colorObj.primary);
                          return (
                            <div
                              key={colorObj.id}
                              className={`color-swatch ${isTaken ? "taken" : ""} ${selectedColor?.id === colorObj.id ? "selected" : ""}`}
                              style={{ background: colorObj.gradient }}
                              onMouseEnter={() => !isTaken && setHoveredColor(colorObj)}
                              onClick={() => handleSelectColor(colorObj)}
                              data-tooltip={isTaken ? "Taken" : colorObj.id}
                            />
                          );
                        })}
                      </div>
                      <button ref={joinBtnRef} id="join-btn" onClick={onJoin} disabled={!selectedColor || joining} className="button-primary">
                        {joining ? "Joining..." : "Join Game"}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="lobby-title">Lobby</h2>
                  <motion.div className="player-list-container" variants={lobbyListVariants} initial="hidden" animate="visible">
                    {lobbyPlayers.map((p, i) => {
                      const pColorObj = PLAYER_COLORS.find(c => c.primary === p.color);
                      return (
                        <motion.div
                          key={i}
                          className={`player-pill ${p.name === playerName ? "current-player-pill" : ""}`}
                          style={{ background: pColorObj?.gradient || p.color, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}
                          variants={lobbyItemVariants}
                        >
                          <span className="player-pill-name">{p.is_bot ? "🤖 " : ""}{p.name}</span>
                          {i === 0 && <span className="host-badge" style={{color: 'white', borderColor: 'white'}}>HOST</span>}
                          {p.is_bot && (
                            <button
                              type="button"
                              className="bot-remove-btn"
                              aria-label={`Remove ${p.name}`}
                              title="Remove bot"
                              disabled={botActionPending}
                              onClick={() => onRemoveBot(p.name)}
                              style={{
                                marginLeft: 6,
                                background: 'rgba(0,0,0,0.35)',
                                border: 'none',
                                borderRadius: '50%',
                                color: 'white',
                                width: 20,
                                height: 20,
                                lineHeight: '18px',
                                cursor: botActionPending ? 'default' : 'pointer',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>

                  {/* NEW: Updated Add Bot controls with Dropdown */}
                  <div className="add-bot-row">
                    <select 
                      className="bot-difficulty-select" 
                      value={botDifficulty} 
                      onChange={(e) => setBotDifficulty(e.target.value)}
                      disabled={!canAddBot || botActionPending}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>

                    <button
                      type="button"
                      className="button-primary add-bot-button"
                      onClick={() => onAddBot(botDifficulty)}
                      disabled={!canAddBot || botActionPending}
                      title={canAddBot ? "Add a computer opponent" : "Lobby is full"}
                    >
                      🤖 Add Bot
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Column 2: Game Variant Controls (Host Only) */}
            <div className="host-controls">
              <h2 className="lobby-title">Game Variants</h2>
              <div className="variant-toggles">
                <div className="variant-toggle-container">
                  <img src="/images/variant/wildtile.png" alt="Wild Tile" className="variant-icon" />
                  <span className="variant-label">Wild Tile</span>
                  <Switch
                    onChange={setWildTileVariant}
                    checked={wildTileVariant}
                    onColor="#05fa22"
                    offColor="#ff0000"
                    handleDiameter={30}
                    uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "white", paddingRight: 2 }}>Off</div>}
                    checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "black", paddingRight: 2 }}>On</div>}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
                    activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
                    height={24}
                    width={62}
                  />
                </div>
                <div className="variant-toggle-container">
                  <img src="/images/variant/fast.png" alt="Fast Game" className="variant-icon" />
                  <span className="variant-label">Fast Game</span>
                  <Switch
                    onChange={setFastGameVariant}
                    checked={fastGameVariant}
                    onColor="#05fa22"
                    offColor="#ff0000"
                    handleDiameter={30}
                    uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "white", paddingRight: 2 }}>Off</div>}
                    checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "black", paddingRight: 2 }}>On</div>}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
                    activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
                    height={24}
                    width={62}
                  />
                </div>
                <div className="variant-toggle-container">
                  <img src="/images/variant/specialpowers.png" alt="Special Powers" className="variant-icon" />
                  <span className="variant-label">Special Powers</span>
                  <Switch
                    onChange={setSpecialPowersVariant}
                    checked={specialPowersVariant}
                    onColor="#05fa22"
                    offColor="#ff0000"
                    handleDiameter={30}
                    uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "white", paddingRight: 2 }}>Off</div>}
                    checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "black", paddingRight: 2 }}>On</div>}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
                    activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
                    height={24}
                    width={62}
                  />
                </div>
              </div>
              {/* START GAME BUTTON LOGIC FOR HOST */}
              {hasJoined && (
                lobbyPlayers.length >= 2 ? (
                  <button className="button-primary start-game-button" onClick={handleStartGame}>
                    Start Game
                  </button>
                ) : (
                  <p className="waiting-message">Waiting for players...</p>
                )
              )}
            </div>
          </div>
        ) : (
          // NON-HOST VIEW
          <div className="join-section">
            {!hasJoined ? (
              <div className="join-form">
                {displayColor && isNameValid ? (
                  <div className="player-pill color-preview-pill" style={{ background: displayColor.gradient, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>
                    <span className="player-pill-name">{playerName}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="name-input"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    minLength={2}
                    maxLength={12}
                    disabled={hasJoined}
                  />
                )}
                {isNameValid && (
                  <>
                    <h3 className="color-picker-title">Select a Color</h3>
                    <div className="color-picker" onMouseLeave={() => setHoveredColor(null)}>
                      {PLAYER_COLORS.map((colorObj) => {
                        const isTaken = takenColors.includes(colorObj.primary);
                        return (
                          <div
                            key={colorObj.id}
                            className={`color-swatch ${isTaken ? "taken" : ""} ${selectedColor?.id === colorObj.id ? "selected" : ""}`}
                            style={{ background: colorObj.gradient }}
                            onMouseEnter={() => !isTaken && setHoveredColor(colorObj)}
                            onClick={() => handleSelectColor(colorObj)}
                            data-tooltip={isTaken ? "Taken" : colorObj.id}
                          />
                        );
                      })}
                    </div>
                    <button ref={joinBtnRef} id="join-btn" onClick={onJoin} disabled={!selectedColor || joining} className="button-primary">
                      {joining ? "Joining..." : "Join Game"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="lobby-container">
                <h2 className="lobby-title">Lobby</h2>
                <motion.div className="player-list-container" variants={lobbyListVariants} initial="hidden" animate="visible">
                  {lobbyPlayers.map((p, i) => {
                    const pColorObj = PLAYER_COLORS.find(c => c.primary === p.color);
                    return (
                      <motion.div
                        key={i}
                        className={`player-pill ${p.name === playerName ? "current-player-pill" : ""}`}
                        style={{ background: pColorObj?.gradient || p.color, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}
                        variants={lobbyItemVariants}
                      >
                        <span className="player-pill-name">{p.is_bot ? "🤖 " : ""}{p.name}</span>
                        {i === 0 && <span className="host-badge" style={{color: 'white', borderColor: 'white'}}>HOST</span>}
                      </motion.div>
                    );
                  })}
                </motion.div>
                <p className="waiting-message">Waiting for host to start the game...</p>
              </div>
            )}
          </div>
        )}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>
      <HighScore apiUrl={apiUrl} />
    </div>
  );
}

