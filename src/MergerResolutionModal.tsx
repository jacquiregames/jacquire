// src/MergerResolutionModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from "motion/react";
import './styles/MergerResolutionModal.css'; 
import './styles/shared-panels.css';
import { truncateName } from './utils/uiHelpers';
import { getStockPricing } from './utils/stockPricing';
import { HOTEL_COLORS } from './utils/constants';

interface MergerData {
  survivor?: string;
  defunct_chains?: string[];
  resolution_queue?: string[];
  current_resolver_idx?: number;
  pre_merger_sizes?: Record<string, number>;
} 

interface PlayerInfo {
  stocks: Record<string, number>;
}

interface MergerResolutionModalProps {
  mergerData: MergerData;
  playerInfo: PlayerInfo;
  stockCounts: Record<string, number>;
  onConfirm: (decisions: Record<string, { trade: number; sell: number; hold: number }>) => void;
  loading: boolean;
  playerName: string;
}

const MergerResolutionModal: React.FC<MergerResolutionModalProps> = ({
  mergerData,
  playerInfo,
  stockCounts,
  onConfirm,
  loading,
  playerName,
}) => {
  const [decisions, setDecisions] = useState<Record<string, { trade: number; sell: number; hold: number }>>({});
  // FIX: this used to re-initialize `decisions` any time playerInfo.stocks
  // (or myDefunctStocks) got a new object reference — which happens on
  // *every* game_state refresh, including the 10s HTTP poll fallback used
  // when the WebSocket is briefly down. That silently wiped out whatever
  // trade/sell amounts the player had already typed in, right in the middle
  // of the one interaction where losing your inputs is most costly. Track
  // the identity of the resolution *step* itself (which chain(s), which
  // point in the queue) and only re-initialize when that step actually
  // changes, not when an unrelated state refresh hands us new-but-equal
  // data.
  const lastInitializedKeyRef = React.useRef<string | null>(null);

  const {
    survivor = '',
    defunct_chains = [],
    resolution_queue = [],
    current_resolver_idx = 0,
  } = mergerData || {};

  const resolutionStepKey = `${survivor}|${defunct_chains.join(',')}|${current_resolver_idx}`;
  const currentResolver = resolution_queue[current_resolver_idx];
  const isMyTurnToResolve = playerName === currentResolver;
  const survivorAvailable = stockCounts[survivor] || 0;

  const myDefunctStocks = useMemo(() => {
    return defunct_chains.filter(chain => (playerInfo.stocks[chain] || 0) > 0);
  }, [defunct_chains, playerInfo.stocks]);

  useEffect(() => {
    if (isMyTurnToResolve && lastInitializedKeyRef.current !== resolutionStepKey) {
      lastInitializedKeyRef.current = resolutionStepKey;
      const initialDecisions: Record<string, { trade: number; sell: number; hold: number }> = {};
      
      let survivorSharesCommitted = 0;

      myDefunctStocks.forEach(chain => {
        const owned = playerInfo.stocks[chain];
        const remainingBank = Math.max(0, survivorAvailable - survivorSharesCommitted);
        const maxTradeByBank = remainingBank * 2;

        const maxTrade = Math.floor(Math.min(owned, maxTradeByBank) / 2) * 2;

        const trade = maxTrade;
        const sell = owned - trade;
        const hold = 0;

        survivorSharesCommitted += trade / 2;
        initialDecisions[chain] = { trade, sell, hold };
      });

      setDecisions(initialDecisions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurnToResolve, resolutionStepKey]);

  // TWEAK: Calculate projected cash
  const projectedCash = useMemo(() => {
    let totalSellValue = 0;
    for (const chain in decisions) {
      const sellCount = decisions[chain]?.sell || 0;
      if (sellCount > 0) {
        const preMergerSize = mergerData.pre_merger_sizes?.[chain] || 0;
        const { price } = getStockPricing(chain, preMergerSize);
        totalSellValue += sellCount * price;
      }
    }
    return playerInfo.cash + totalSellValue;
  }, [decisions, playerInfo.cash, mergerData.pre_merger_sizes]);

  const handleDecisionChange = (chain: string, field: 'trade' | 'sell', value: number) => {
    setDecisions(prev => {
      const newDecisions = { ...prev };
      const currentDecision = { ...newDecisions[chain] };
      const owned = playerInfo.stocks[chain];

      if (field === 'trade') {
        currentDecision.trade = value;
        if (currentDecision.trade + currentDecision.sell > owned) {
          currentDecision.sell = owned - currentDecision.trade;
        }
      } else if (field === 'sell') {
        currentDecision.sell = value;
        if (currentDecision.trade + currentDecision.sell > owned) {
          let adjustedTrade = owned - currentDecision.sell;
          if (adjustedTrade % 2 !== 0) adjustedTrade -= 1;
          currentDecision.trade = Math.max(0, adjustedTrade);
        }
      }

      currentDecision.hold = owned - currentDecision.trade - currentDecision.sell;
      newDecisions[chain] = currentDecision;
      return newDecisions;
    });
  };

  const handleSubmit = () => {
    let totalTradesRequested = 0;

    for (const chain in decisions) {
      const { trade, sell, hold } = decisions[chain];
      const owned = playerInfo.stocks[chain];
      if (trade + sell + hold !== owned) {
        alert(`Decisions for ${chain} do not add up to your owned shares.`);
        return;
      }
      if (trade % 2 !== 0) {
        alert(`Trade amount for ${chain} must be an even number.`);
        return;
      }
      totalTradesRequested += trade / 2;
    }

    if (totalTradesRequested > survivorAvailable) {
        alert(`Not enough ${survivor} shares in the bank! You are trying to get ${totalTradesRequested}, but only ${survivorAvailable} are left.`);
        return;
    }

    onConfirm(decisions);
  };

return (
    <motion.div 
      className="floating-panel modal-backdrop-centered"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="stock-panel merger-resolution-panel"
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="panel-banner-container">
          <img src="/images/banner/resolution.png" alt="Merger Resolution" className="panel-title-image" />
          <h2 className="panel-title-overlay">Merger Resolution</h2>
        </div>

        {!isMyTurnToResolve ? (
          <div className="waiting-for-player panel-content">
            <p>Waiting for <strong>{truncateName(currentResolver)}</strong> to resolve their stocks...</p>
            <img src="/images/waiting.png" />
          </div>
        ) : (
          <div className="resolver-content panel-content">
            <div className="merger-info">
              <div className="chain-display-group">
                <div 
                  className="chain-display-item survivor-item"
                  style={{ backgroundColor: HOTEL_COLORS[survivor] || '#ccc' }}
                >
                  <img 
                    src={`/images/banner/${survivor.toLowerCase()}_logo.webp`} 
                    alt={survivor} 
                    className="merger-chain-logo-wide"
                  />
                </div>
              </div>
              <div className="merger-transition">
                <img src="/images/banner/jacquired.webp" alt="jAcquired" className="acquired-by-image" />
              </div>
              <div className="chain-display-group">
                {defunct_chains.map(chain => (
                  <div 
                    key={chain} 
                    className="chain-display-item survivor-item"
                    style={{ backgroundColor: HOTEL_COLORS[chain] || '#ccc' }}
                  >
                    <img 
                      src={`/images/banner/${chain.toLowerCase()}_logo.webp`} 
                      alt={chain} 
                      className="merger-chain-logo-wide"
                    />
                  </div>
                ))}
              </div>
            </div> 
            
            {myDefunctStocks.map(chain => {
              const owned = playerInfo.stocks[chain];
              const decision = decisions[chain] || { trade: 0, sell: 0, hold: owned };

              const otherChainsTradeTotal = Object.entries(decisions)
                .filter(([c]) => c !== chain)
                .reduce((sum, [, d]) => sum + (d.trade / 2), 0);

              const remainingBankForThisChain = Math.max(0, survivorAvailable - otherChainsTradeTotal);
              const maxTradesAllowedByBank = remainingBankForThisChain * 2;
              
              const preMergerSize = mergerData.pre_merger_sizes?.[chain] || 0;
              const { price } = getStockPricing(chain, preMergerSize);

              return (
                <div key={chain} className="decision-block">
                  <h4 className="chain-title">{chain} (You own: {owned})</h4>
                  
                  <div className="action-grid">
                    <label>Trade (2:1):</label>
                    <select
                      value={decision.trade}
                      onChange={(e) => handleDecisionChange(chain, 'trade', parseInt(e.target.value, 10))}
                      disabled={loading}
                    >
                      {Array.from({ length: Math.floor(Math.min(owned, maxTradesAllowedByBank) / 2) + 1 }, (_, i) => i * 2).map(val => (
                        <option key={val} value={val}>
                          {val} {val > 0 ? `(Get ${val / 2} ${survivor})` : ''}
                        </option>
                      ))}
                    </select>

                    <label>Sell:</label>
                    <select
                      value={decision.sell}
                      onChange={(e) => handleDecisionChange(chain, 'sell', parseInt(e.target.value, 10))}
                      disabled={loading}
                    >
                      {Array.from({ length: owned + 1 }, (_, i) => i).map(val => (
                        <option key={val} value={val}>
                          {val} {val > 0 ? `(+$${(val * price).toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>

                    <label>Hold:</label>
                    <div className="hold-display">{decision.hold}</div>
                  </div>
                </div>
              );
            })}
            <button className="button-primary button-confirm" onClick={handleSubmit} disabled={loading}> 
              {loading ? 'Processing...' : 'Confirm Decisions'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MergerResolutionModal;
