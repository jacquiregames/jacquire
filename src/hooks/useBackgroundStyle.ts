// src/hooks/useBackgroundStyle.ts
import { useState, useMemo } from "react";
import { GameState } from '../types';

 
export default function useBackgroundStyle(gameStarted: boolean, gameState: GameState | null) {
  const [showBackground, setShowBackground] = useState<boolean>(true);
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState<number>(1);

  const handleNextBackground = () => {
    setCurrentBackgroundIndex(prev => (prev % 5) + 1);
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

  return { showBackground, setShowBackground, currentBackgroundIndex, handleNextBackground, backgroundClass };
}
