// src/panels/StockCardView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useCountUp } from '../hooks/useCountUp';
import { Player } from '../types';
import { PLAYER_COLORS, getColorObject } from '../utils/playerColors';
import { truncateName } from '../utils/uiHelpers';
import { HOTEL_CHAINS } from '../utils/constants';
import '../styles/GameSummaryPanel.css';

interface StockCardViewProps {
  players: Player[];
  specialPowersVariantActive: boolean;
}

const SMALL_POWER_ICONS: Record<string, string> = {
  "Trade 2": "/images/variant/t2.webp",
  "Free 3": "/images/variant/f3.webp",
  "Place 4": "/images/variant/p4.webp",
  "Buy 5": "/images/variant/b5.webp",
  "Take 5": "/images/variant/t5.webp",
};

const AnimatedCash: React.FC<{ value: number }> = ({ value }) => {
  const displayedValue = useCountUp(value, 1000);
  return <span className="player-card-cash-text">${displayedValue.toLocaleString()}</span>;
};

const StockCardView: React.FC<StockCardViewProps> = ({ players, specialPowersVariantActive }) => {
  return (
    <div className="stock-card-view-container">
      {players.map(player => {
        const colorObj = getColorObject(player.color);
        const background = colorObj?.gradient || player.color;
        
        const ownedStocks = HOTEL_CHAINS.reduce<{ chain: string; count: number }[]>((acc, chain) => {
          const count = player.stocks[chain] || 0;
          if (count > 0) acc.push({ chain, count });
          return acc;
        }, []);

        return (
          <div key={player.name} className="player-card-row">
            {/* Integrated Status Pill */}
            <div
              className="player-card-name-pill"
              style={{ '--player-pill-bg': background } as React.CSSProperties}
            >
              <span className="player-card-name-text">{truncateName(player.name)}</span>
              
              {specialPowersVariantActive ? (
                <div className="player-card-powers">
                  {player.special_powers.map(powerName => (
                    <img
                      key={powerName}
                      src={SMALL_POWER_ICONS[powerName]}
                      alt={powerName}
                      title={powerName}
                    />
                  ))}
                </div>
              ) : (
                <AnimatedCash value={player.cash} />
              )}
            </div>

            {/* Stocks Section */}
            <div className="player-card-holdings">
              {ownedStocks.map(({ chain, count }) => (
                <div key={chain} className="stock-card-stack" title={`${chain}: ${count} shares`}>
                  {Array.from({ length: count }).map((_, i) => (
                    <img
                      key={i}
                      src={`/images/cards/card_${chain.toLowerCase()}.webp`}
                      alt={`${chain} stock card`}
                      className="stock-card-image"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StockCardView;
