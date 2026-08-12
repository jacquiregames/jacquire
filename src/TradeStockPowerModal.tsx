// src/TradeStockPowerModal.tsx
import React, { useState, useMemo } from 'react';
import { GameState, Player } from './types';
import { motion } from "motion/react";
import { HOTEL_CHAINS, HOTEL_COLORS } from './utils/constants';
import './styles/TradeStockPowerModal.css';
import './styles/shared-panels.css';

interface TradeStockPowerModalProps {
  gameState: Pick<GameState, 'players' | 'active_chains' | 'stock_counts' | 'trade_actions_remaining' | 'stock_prices'>;
  playerName: string;
  onTrade: (chainFrom: string, chainTo: string) => void;
  onEndTrading: () => void;
  loading?: boolean;
}

export const TradeStockPowerModal: React.FC<TradeStockPowerModalProps> = ({
  gameState,
  playerName,
  onTrade,
  onEndTrading,
  loading,
}) => {
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);

  const player = useMemo(() => gameState.players.find(p => p.name === playerName) as Player, [gameState.players, playerName]);

  const handleTrade = () => {
    if (selectedFrom && selectedTo && !loading) {
      onTrade(selectedFrom, selectedTo);
      setSelectedFrom(null);
      setSelectedTo(null);
    }
  };

  return (
    <motion.div 
      className="floating-panel modal-backdrop-bottom-right"
      initial={{ opacity: 0, scale: 0.5, y: 100 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 100 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="stock-panel trade-power-panel">
        <div className="panel-banner-container panel-banner-container--trade-power">
          <img src="/images/banner/trade.png" alt="Trade Stocks" className="panel-title-image" style={{ height: 'auto' }} />
          <h2 className="panel-title-overlay">
             Trade Stocks
             <span className="panel-subtitle-overlay panel-subtitle-overlay--trade-power">
               {gameState.trade_actions_remaining} left
             </span>
          </h2>
        </div>
        
        <div className="trade-power-grid-container">
          {/* Column 1: Trade From */}
          <div className="trade-column">
            <h3 className="column-title">Trade 2</h3>
            {HOTEL_CHAINS.map(chain => {
              const owned = player.stocks[chain] || 0;
              const price = gameState.stock_prices[chain] || 0;
              const isTradable = owned >= 2;
              const isSelected = selectedFrom === chain;
              
              return (
                <div 
                  key={`from-${chain}`}
                  className={`trade-cell left-layout ${isSelected ? 'selected' : ''} ${!isTradable ? 'disabled' : ''}`}
                  style={{ background: HOTEL_COLORS[chain], color: 'white' }}
                  onClick={() => isTradable && setSelectedFrom(chain)}
                >
                  {/* Col 1: Icon */}
                  <div className="tc-col-icon">
                    <img src={`/images/hotel/${chain.toLowerCase()}.png`} alt={chain} />
                  </div>
                  {/* Col 2: Name */}
                  <div className="tc-col-name">
                    {chain}
                  </div>
                  {/* Col 3: Stats */}
                  <div className="tc-col-stats">
                    <div>Own: {owned}</div>
                    <div>${price}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Column 2: Trade To */}
          <div className="trade-column">
            <h3 className="column-title">Get 1</h3>
            {HOTEL_CHAINS.map(chain => {
              const available = gameState.stock_counts[chain] || 0;
              const isActive = gameState.active_chains.includes(chain);
              const isDisabled = available === 0 || !isActive || selectedFrom === chain;
              const isSelected = selectedTo === chain;
              
              return (
                <div
                  key={`to-${chain}`}
                  className={`trade-cell right-layout ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  style={{ background: HOTEL_COLORS[chain], color: 'white' }}
                  onClick={() => !isDisabled && setSelectedTo(chain)}
                >
                  {/* Col 1: Available */}
                  <div className="tc-col-avail">
                    {available} Left
                  </div>
                  {/* Col 2: Name */}
                  <div className="tc-col-name right-align">
                    {chain}
                  </div>
                  {/* Col 3: Icon */}
                  <div className="tc-col-icon">
                    <img src={`/images/hotel/${chain.toLowerCase()}.png`} alt={chain} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="trade-actions-container">
          <button className="button-primary button-trade" onClick={handleTrade} disabled={loading || !selectedFrom || !selectedTo}>
            {loading ? 'Trading...' : 'Confirm Trade'}
          </button>
          <button className="button-primary" onClick={onEndTrading} disabled={loading}>    Proceed to Buy/Sell
          </button>
        </div>
      </div>
    </motion.div>
  );
};