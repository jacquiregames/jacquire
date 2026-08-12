// src/StockCardView.tsx
import React from 'react';
import { Player } from './types';
import { getColorObject } from './utils/playerColors';
import { useCountUp } from './hooks/useCountUp';
import { truncateName } from './utils/uiHelpers';
import { HOTEL_CHAINS } from './utils/constants';
import './styles/StockCardView.css';

interface StockCardViewProps {
  players: Player[];
  specialPowersVariantActive: boolean;
}

const SMALL_POWER_ICONS: Record<string, string> = {
  "Trade 2": "/images/variant/t2.png",
  "Free 3": "/images/variant/f3.png",
  "Place 4": "/images/variant/p4.png",
  "Buy 5": "/images/variant/b5.png",
  "Take 5": "/images/variant/t5.png",
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
        
        const ownedStocks = HOTEL_CHAINS
          .map(chain => ({ chain, count: player.stocks[chain] || 0 }))
          .filter(stock => stock.count > 0);

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
                      src={`/images/cards/card_${chain.toLowerCase()}.png`}
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