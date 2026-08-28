// src/lobby/UnifiedIntro.tsx
import { useState, useEffect, useRef } from "react";
import { confetti } from "@tsparticles/confetti";
import { prefersReducedMotion } from "../utils/motionTokens";
import { PlayerColor } from "../utils/playerColors";
import HowToPlay from "../ui/HowToPlay";
import ImagePreloader from '../ui/ImagePreloader';
import LoadingScreen from '../ui/LoadingScreen';
import { ALL_IMAGE_URLS } from '../utils/imageUrls';
import HighScore from './HighScore';
import JoinForm from "./JoinForm";
import LobbyPlayerList from "./LobbyPlayerList";
import GameVariantControls from "./GameVariantControls";
import AddBotControls from "./AddBotControls";
import "../styles/UnifiedIntro.css";

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
        src: `/images/particles/${chain.toLowerCase()}.webp`,
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
        });
      }
      handleJoin(selectedColor.primary);
    }
  };

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
      <HowToPlay show={showHowToPlay} onClose={() => setShowHowToPlay(false)} isIntro />
      
      <div className="how-to-play-container">
        <button onClick={() => setShowHowToPlay(true)} className="button-primary how-to-play-btn">
          How To Play
        </button>
      </div>
      
      <img src="/images/banner/gamelogo.webp" alt="Jacquire Game Logo" className="intro-logo" />
      <div className="intro-card">
        {isHost ? (
          <div className="host-lobby-layout">
            {/* Column 1: Player Selection & Lobby */}
            <div className="lobby-container">
              {!hasJoined ? (
                <JoinForm
                  playerName={playerName}
                  setPlayerName={setPlayerName}
                  selectedColor={selectedColor}
                  hoveredColor={hoveredColor}
                  setHoveredColor={setHoveredColor}
                  takenColors={takenColors}
                  onSelectColor={handleSelectColor}
                  isNameValid={isNameValid}
                  joining={joining}
                  onJoin={onJoin}
                  joinBtnRef={joinBtnRef}
                />
              ) : (
                <>
                  <h2 className="lobby-title">Lobby</h2>
                  <LobbyPlayerList
                    lobbyPlayers={lobbyPlayers}
                    playerName={playerName}
                    allowBotRemoval
                    onRemoveBot={onRemoveBot}
                    botActionPending={botActionPending}
                  />
                  <AddBotControls
                    canAddBot={canAddBot}
                    botActionPending={botActionPending}
                    onAddBot={onAddBot}
                  />
                </>
              )}
            </div>

            {/* Column 2: Game Variant Controls (Host Only) */}
            <GameVariantControls
              wildTileVariant={wildTileVariant}
              setWildTileVariant={setWildTileVariant}
              specialPowersVariant={specialPowersVariant}
              setSpecialPowersVariant={setSpecialPowersVariant}
              fastGameVariant={fastGameVariant}
              setFastGameVariant={setFastGameVariant}
              hasJoined={hasJoined}
              canStart={lobbyPlayers.length >= 2}
              onStartGame={handleStartGame}
            />
          </div>
        ) : (
          // NON-HOST VIEW
          <div className="join-section">
            {!hasJoined ? (
              <JoinForm
                playerName={playerName}
                setPlayerName={setPlayerName}
                selectedColor={selectedColor}
                hoveredColor={hoveredColor}
                setHoveredColor={setHoveredColor}
                takenColors={takenColors}
                onSelectColor={handleSelectColor}
                isNameValid={isNameValid}
                joining={joining}
                onJoin={onJoin}
                joinBtnRef={joinBtnRef}
              />
            ) : (
              <div className="lobby-container">
                <h2 className="lobby-title">Lobby</h2>
                <LobbyPlayerList
                  lobbyPlayers={lobbyPlayers}
                  playerName={playerName}
                  allowBotRemoval={false}
                  onRemoveBot={onRemoveBot}
                  botActionPending={botActionPending}
                />
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
