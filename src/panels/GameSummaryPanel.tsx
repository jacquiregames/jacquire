// src/panels/GameSummaryPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useCountUp } from '../hooks/useCountUp';
import { GameState, Player, FinalStats } from '../types';
import { PLAYER_COLORS, getColorObject } from '../utils/playerColors';
import { truncateName } from '../utils/uiHelpers';
import { HOTEL_CHAINS } from '../utils/constants';
import '../styles/GameSummaryPanel.css';

interface GameSummaryPanelProps {
  gameState: GameState;
  animationPhase: string;
  setAnimationPhase: (phase: string) => void; 
  isHost: boolean;
  onReset: () => void;
}

const AnimatedCell: React.FC<{ value: number }> = ({ value }) => {
  const displayValue = useCountUp(value, 2000); 
  return <td className="final-standings-value">${displayValue.toLocaleString()}</td>;
};
 
const getWinnerPillStyle = (color: string) => {
  const colorObj = PLAYER_COLORS.find(c => c.primary === color);
  return { background: colorObj?.gradient || color };
};

export const StockLiquidationTable: React.FC<{ gameState: GameState, animationPhase: string }> = ({ gameState, animationPhase }) => {
  const { players, stock_prices } = gameState;
  const showSummaryData = ['show_liquidation', 'show_net_worth', 'highlights', 'done'].includes(animationPhase);

  const finalLiquidationTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach(p => {
      totals[p.name] = Object.entries(p.stocks).reduce((sum, [chain, count]) => {
        return sum + (count * (stock_prices[chain] || 0));
      }, 0);
    });
    return totals;
  }, [players, stock_prices]);
     
    
  return (
    <div className="summary-panel liquidation-summary-panel" style={{ width: 'fit-content', marginTop: '16px', boxSizing: 'border-box' }}>
      <h3 className="summary-panel-title">Stock Liquidation</h3>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Player</th>
            {HOTEL_CHAINS.map(chain => (
              <th key={chain} className={`hotel-header-${chain.toLowerCase()}`}>
                <img src={`/images/hotel/${chain.toLowerCase()}.webp`} alt={chain} className="hotel-icon-header" />
              </th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const colorObj = getColorObject(p.color);
            const background = colorObj?.gradient || p.color; 
            return (
              <tr key={p.name}>
                <td className="player-name-cell" style={{ background, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>{p.name}</td>
                {HOTEL_CHAINS.map(chain => {
                  const stockPrice = stock_prices[chain] || 0;
                  const value = (p.stocks[chain] || 0) * stockPrice;
                  return showSummaryData ? <AnimatedCell key={chain} value={value} /> : <td key={chain}>-</td>;
                })}
                {showSummaryData ? <AnimatedCell value={finalLiquidationTotals[p.name] ?? 0} /> : <td>-</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const highlightsContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.5,
      delayChildren: 0.3,
    },
  },
};

const highlightCardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: 'spring' as any, stiffness: 100 }
  },
};

export const GameSummaryPanel: React.FC<GameSummaryPanelProps> = ({
  gameState,
  animationPhase,
  setAnimationPhase,
  isHost,
  onReset,
}) => {
  const [showReset, setShowReset] = useState(false);
 
  const { 
    players, 
    final_bonus_payouts = [],
    stock_prices = {}
  } = gameState;

  // Safely fallback if final_stats is null
  const final_stats = gameState.final_stats || { 
    bonuses_earned: {}, 
    chains_founded: {}, 
    longest_turn: { player_name: null, duration: 0 } 
  } as FinalStats;

  const finalBonusTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach(p => {
        totals[p.name] = final_bonus_payouts
            .filter(b => b.player_name === p.name)
            .reduce((sum, b) => sum + b.amount, 0);
    });
    return totals;
  }, [final_bonus_payouts, players]);

  const finalLiquidationTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach(p => {
      totals[p.name] = Object.entries(p.stocks).reduce((sum, [chain, count]) => {
        return sum + (count * (stock_prices[chain] || 0));
      }, 0);
    });
    return totals;
  }, [players, stock_prices]);

  const winners = useMemo(() =>
    players.filter(p => gameState.winners.includes(p.name)),
  [players, gameState.winners]);

  const highlights = useMemo(() => {
    if (!final_stats.bonuses_earned || !final_stats.chains_founded || !final_stats.longest_turn) return [];
    const getPlayer = (name: string | null): Player | undefined => players.find((p: Player) => p.name === name);

    const bonusKingName = Object.keys(final_stats.bonuses_earned).length > 0
    ? Object.keys(final_stats.bonuses_earned).reduce((a, b) => final_stats.bonuses_earned[a] > final_stats.bonuses_earned[b] ? a : b)
    : null;
    const bonusKing = getPlayer(bonusKingName);

    const hotelTycoonName = Object.keys(final_stats.chains_founded).length > 0
    ? Object.keys(final_stats.chains_founded).reduce((a, b) => final_stats.chains_founded[a] > final_stats.chains_founded[b] ? a : b)
    : null;
    const hotelTycoon = getPlayer(hotelTycoonName);

    const slowPoke = getPlayer(final_stats.longest_turn.player_name);

    return [
      bonusKing && {
        key: 'bonus-king',
        title: "Bonus King",
        image: "/images/gameover/bonus.webp",
        player: bonusKing,
        detail: `$${final_stats.bonuses_earned[bonusKing.name].toLocaleString()} earned`,
      },
      hotelTycoon && {
        key: 'hotel-tycoon',
        title: "Hotel Tycoon",
        image: "/images/gameover/hotel.webp",
        player: hotelTycoon,
        detail: `${final_stats.chains_founded[hotelTycoon.name]} chains founded`,
      },
      slowPoke && {
        key: 'slowpoke',
        title: "Slowpoke",
        image: "/images/gameover/slowpoke.webp",
        player: slowPoke,
        detail: `Longest turn: ${final_stats.longest_turn.duration}s`,
      },
    ].filter(Boolean);
  }, [final_stats, players]);


  useEffect(() => {
    const phaseDurations: { [key: string]: number } = {
      show_summary: 1000,
      show_cash: 1500,
      show_bonuses: 1500,
      show_liquidation: 1500,
      show_net_worth: 2000,
      highlights: highlights.length * 500 + 300,
    };
    const phaseOrder = ['show_summary', 'show_cash', 'show_bonuses', 'show_liquidation', 'show_net_worth', 'highlights', 'done'];

    const currentIndex = phaseOrder.indexOf(animationPhase);
    if (currentIndex > -1 && currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      const duration = phaseDurations[animationPhase];
      const timer = setTimeout(() => {
        setAnimationPhase(nextPhase);
      }, duration);
      return () => clearTimeout(timer);
    } else if (animationPhase === 'done') {
      setShowReset(true);
    }
  }, [animationPhase, highlights.length, setAnimationPhase]);
  
  const showCash = ['show_cash', 'show_bonuses', 'show_liquidation', 'show_net_worth', 'highlights', 'done'].includes(animationPhase);
  const showBonuses = ['show_bonuses', 'show_liquidation', 'show_net_worth', 'highlights', 'done'].includes(animationPhase);
  const showLiquidation = ['show_liquidation', 'show_net_worth', 'highlights', 'done'].includes(animationPhase);
  const showNetWorth = ['show_net_worth', 'highlights', 'done'].includes(animationPhase);

  return (
    <div className="game-summary-panel-container">
      <div className="summary-panel final-standings-panel">
        <h2 className="summary-panel-title">Final Standings</h2>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Cash</th>
              <th>Bonuses</th>
              <th>Liquidated</th>
              <th>Net Worth</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
                const colorObj = getColorObject(p.color);
                const background = colorObj?.gradient || p.color;
                return (
                    <tr key={p.name}>
                        <td className="player-name-cell" style={{ background, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>{truncateName(p.name)}</td>
                        {showCash ? <AnimatedCell value={p.cash - (finalBonusTotals[p.name] ?? 0)} /> : <td>-</td>}
                        {showBonuses ? <AnimatedCell value={finalBonusTotals[p.name] ?? 0} /> : <td>-</td>}
                        {showLiquidation ? <AnimatedCell value={finalLiquidationTotals[p.name] ?? 0} /> : <td>-</td>}
                        {showNetWorth ? <AnimatedCell value={p.net_worth} /> : <td>-</td>}
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      <m.div 
        className="highlights-container"
        variants={highlightsContainerVariants}
        initial="hidden"
        animate={animationPhase === 'highlights' || animationPhase === 'done' ? 'visible' : 'hidden'}
      >
        {highlights.map((h: any) => {
          const colorObj = getColorObject(h.player.color);
          const background = colorObj?.gradient || h.player.color;
          const cardStyle = {
              '--card-bg': background,
              '--card-text': 'white'
          } as React.CSSProperties;

          return (
            <m.div 
              key={h.key} 
              className="highlight-card"
              style={{
                ...cardStyle,
                color: 'var(--color-white)',
                textShadow: 'var(--shadow-text-heavy)'
              }}
              variants={highlightCardVariants}
            >
              <h3 className="highlight-title">{h.title}</h3>
              <img src={h.image} alt={h.title} className="highlight-image" />
              <p className="highlight-player-name">{truncateName(h.player.name)}</p>
              <span className="highlight-detail">{h.detail}</span>
            </m.div>
          );
        })}
      </m.div>

      <AnimatePresence>
        {animationPhase === 'done' && winners.length > 0 && (
          <m.div
            key="winner-podium"
            className="winner-podium-container"
            initial={{ opacity: 0, scale: 0.7, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 50 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100, delay: 0.5 }}
          >
            <img src="/images/gameover/podium.webp" alt="Winner's Podium" className="winner-podium-image" />
            <div className="winner-pill-overlay">
              {winners.map(winner => (
                <div key={winner.name} className="winner-display">
                  <img src="/images/gameover/crown.webp" alt="Winner" className="winner-crown" />
                  <div className="winner-pill" style={getWinnerPillStyle(winner.color)}>
                    <span className="winner-pill-name">{winner.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReset && isHost && (
          <m.div
            key="reset-button"
            className="reset-button-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <button onClick={onReset} className="button-primary">
              Reset Game
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
