// src/player/SpecialPowersPanel.tsx
import React from 'react';
import '../styles/SpecialPowersPanel.css';

interface SpecialPowersPanelProps {
  playerPowers: string[];
  onUsePower: (power: string) => void;
  isMyTurn: boolean;
  powerUsedThisTurn: boolean;
}

const POWER_MAP: Record<string, { image: string, title: string }> = {
  "Trade 2": { image: "/images/variant/trade2.webp", title: "Trade two of your stocks for one from the market, up to three times." },
  "Free 3": { image: "/images/variant/free3.webp", title: "The three stocks you purchase this turn are free." },
  "Place 4": { image: "/images/variant/place4.webp", title: "Place up to four tiles this turn." },
  "Buy 5": { image: "/images/variant/buy5.webp", title: "You may purchase up to five stocks this turn." },
  "Take 5": { image: "/images/variant/take5.webp", title: "Take five extra tiles at the start of your turn." },
};
 
export const SpecialPowersPanel: React.FC<SpecialPowersPanelProps> = ({
  playerPowers,
  onUsePower,
  isMyTurn,
  powerUsedThisTurn,
}) => {
  return (
    <div className="special-powers-container">
      {playerPowers.map(powerName => {
        const powerAsset = POWER_MAP[powerName];
        if (!powerAsset) return null;

        return (
          <button
            key={powerName}
            className="power-banner-button"
            onClick={() => onUsePower(powerName)} 
            disabled={!isMyTurn || powerUsedThisTurn} 
          >
            <img src={powerAsset.image} alt={powerName} />
          </button>
        );
      })}
    </div>
  );
};