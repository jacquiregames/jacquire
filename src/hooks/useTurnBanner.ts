// src/hooks/useTurnBanner.ts
import { useState, useEffect, useRef } from 'react';

export function useTurnBanner(isMyTurn: boolean) {
  const [showTurnBanner, setShowTurnBanner] = useState(false);
  const prevIsMyTurn = useRef(isMyTurn);

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      setShowTurnBanner(true);
      const timer = setTimeout(() => setShowTurnBanner(false), 3500);
      return () => clearTimeout(timer);
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  return showTurnBanner;
}