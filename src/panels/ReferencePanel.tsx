// src/panels/ReferencePanel.tsx 
import React, { useState, useMemo } from "react";
import Switch from "react-switch"; 
import { m, AnimatePresence } from "motion/react";
import { ReferenceChart } from "./ReferenceChart";
import { StockAvailability } from "./StockAvailability";
import StockCardView from "./StockCardView"; 
import { useCountUp } from '../hooks/useCountUp';
import HowToPlay from "../ui/HowToPlay";
import { GameState } from "../types";
import { getColorObject } from '../utils/playerColors';
import { HOTEL_CHAINS } from '../utils/constants';
import "../styles/ReferencePanel.css";
import "../styles/GameSummaryPanel.css";

interface ReferencePanelProps {
  gameState: GameState;
  animationPhase: string;
  setAnimationPhase: (phase: string) => void;
  showBackground: boolean; 
  onToggleBackground: (enabled: boolean) => void; 
  onNextBackground: () => void;  
}

const AnimatedRowCell: React.FC<{ value: number }> = ({ value }) => {
  const displayValue = useCountUp(value, 2000);
  return <td>{value > 0 ? `$${displayValue.toLocaleString()}` : '-'}</td>;
};

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
  gameState,
  animationPhase,
  showBackground,
  onToggleBackground,
  onNextBackground,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showStockCards, setShowStockCards] = useState<boolean>(false); 
  const { game_over, players, stock_counts, chain_sizes, stock_prices, current_player, final_bonus_payouts = [] } = gameState;
  
  const specialPowersVariantActive = gameState.players.some(p => p.special_powers.length > 0);

  const finalBonusTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    players.forEach(p => {
        totals[p.name] = final_bonus_payouts
            .filter(b => b.player_name === p.name)
            .reduce((sum, b) => sum + b.amount, 0);
    });
    return totals;
  }, [final_bonus_payouts, players]);

  const renderContent = () => {
    if (game_over) {
      const showSummaryData = ['show_bonuses', 'show_liquidation', 'show_net_worth', 'highlights', 'done'].includes(animationPhase);
      
      return (
        <AnimatePresence>
            <m.div
              key="game-summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="game-summary-tab-content">
                <div className="summary-panel bonus-summary-panel">
                    <h3 className="summary-panel-title">Shareholder Bonuses</h3>
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
                            return(
                              <tr key={p.name}>
                                <td className="player-name-cell" style={{ background, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>{p.name}</td>
                                {HOTEL_CHAINS.map(chain => {
                                  const bonus = final_bonus_payouts.filter(b => b.player_name === p.name && b.chain === chain).reduce((sum, b) => sum + b.amount, 0);
                                  return showSummaryData ? <AnimatedRowCell key={chain} value={bonus} /> : <td key={chain}>-</td>
                                })}
                                {showSummaryData ? <AnimatedRowCell value={finalBonusTotals[p.name] ?? 0} /> : <td>-</td>}
                              </tr>
                            );
                          })}
                        </tbody>
                    </table>
                </div>
              </div>
            </m.div>
        </AnimatePresence>
      );
    }
    
    if (showStockCards) {
      return <StockCardView players={players} specialPowersVariantActive={specialPowersVariantActive} />;
    }

    return (
      <AnimatePresence mode="wait">
        <m.div
          key="price-chart"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          <ReferenceChart />
        </m.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="reference-panel-container">
      <HowToPlay show={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <StockAvailability
        game_over={game_over} 
        stockCounts={stock_counts}
        players={players}
        chainSizes={chain_sizes}
        stockPrices={stock_prices}
        currentPlayerName={current_player}
        highlightedCells={null} 
      />
      <div className="tabbed-section">
        {!game_over && (
            <div className="tabs-and-toggle-container">  
              <button 
                className="button-primary" 
                onClick={() => setShowHowToPlay(true)}
                style={{ padding: '4px 16px', fontSize: '0.9rem', margin: 0, height: '32px', borderRadius: '4px' }}
              >
                How To Play
              </button>
              <div className="auto-end-turn-container">
                <div className="toggle-switch-wrapper">
                  <Switch
                    onChange={onToggleBackground}
                    checked={showBackground}
                    onColor="#05fa22"
                    offColor="#ff0000"
                    handleDiameter={28}
                    uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "right", height: "100%", fontSize: 15, color: "white", paddingRight: 4, paddingTop: 1 }}>Off</div>}
                    checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "left", height: "100%", fontSize: 15, color: "black", paddingLeft: 2, paddingTop: 1 }}>On</div>}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
                    activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
                    height={24}
                    width={62}
                  />
                </div>
                <span className="auto-end-turn-label">Background</span>
                {showBackground && (
                  <button className="next-bg-button" onClick={onNextBackground}>Next</button>
                )}
              </div>
              <div className="auto-end-turn-container">
                <div className="toggle-switch-wrapper">
                  <Switch
                    onChange={setShowStockCards}
                    checked={showStockCards}
                    onColor="#05fa22"
                    offColor="#ff0000"
                    handleDiameter={28}
                    uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "right", height: "100%", fontSize: 15, color: "white", paddingRight: 4, paddingTop: 1 }}>Off</div>}
                    checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "left", height: "100%", fontSize: 15, color: "black", paddingLeft: 2, paddingTop: 1 }}>On</div>}
                    boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
                    activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
                    height={24}
                    width={62}
                  />
                </div>
                <span className="auto-end-turn-label">Cards</span>
              </div>
            </div>
            )}
            <div className="tab-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
