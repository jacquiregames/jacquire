// src/panels/StockAvailability.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { getColorObject } from '../utils/playerColors';
import { getStockPricing } from "../utils/stockPricing";
import { truncateName } from "../utils/uiHelpers";
import { useCountUp } from "../hooks/useCountUp";
import '../styles/StockAvailability.css';

interface Player {
  name: string;
  stocks: Record<string, number>;
  color: string;
  cash: number;
  net_worth: number;
  cash_before_scoring?: number;
}

interface StockAvailabilityProps {
  stockCounts: Record<string, number>;
  players: Player[];
  chainSizes: Record<string, number>;
  stockPrices: Record<string, number>;
  currentPlayerName: string;
  highlightedCells?: any;
  game_over: boolean;
}

const AnimatedAmountCell: React.FC<{ value: number; isCurrency: boolean; className?: string; isHighlighted?: boolean }> = ({ value, isCurrency, className, isHighlighted }) => {
  const displayedValue = useCountUp(value, 1000);
  const prevValueRef = useRef(value);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    const delta = value - prevValueRef.current;
    if (delta !== 0 && cellRef.current && !isHighlighted) { 
      const animationClass = delta > 0 ? 'cash-change-up' : 'cash-change-down';
      const cell = cellRef.current;
      
      cell.classList.remove('cash-change-up', 'cash-change-down');
      void cell.offsetWidth; 
      cell.classList.add(animationClass);

      const timer = setTimeout(() => {
        if(cell) cell.classList.remove(animationClass);
      }, 800);
      
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
     prevValueRef.current = value;
  }, [value, isHighlighted]);

  const formattedValue = isCurrency
    ? displayedValue.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 })
    : displayedValue.toLocaleString();

  return <td ref={cellRef} className={`${className || ''} ${isHighlighted ? 'value-changed-highlight' : ''}`}>{formattedValue}</td>;
};

const PriceCell: React.FC<{ price: number; isHighlighted: boolean; dataStock: string }> = ({ price, isHighlighted, dataStock }) => {
  const displayedPrice = useCountUp(price, 1000);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    const delta = price - prevPriceRef.current;
    if (delta !== 0) {
      const dir = delta > 0 ? 'up' : 'down';
      const cell = cellRef.current;
      if (cell) {
        cell.classList.remove('price-flash-up', 'price-flash-down');
        void cell.offsetWidth; // restart the animation even if it fires again quickly
        cell.classList.add(dir === 'up' ? 'price-flash-up' : 'price-flash-down');
      }
      prevPriceRef.current = price;
      return;
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <td data-stock={dataStock} className={isHighlighted ? 'value-changed-highlight' : ''}>
      {displayedPrice > 0 ? displayedPrice.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }) : "$0"}
    </td>
  );
};

export const StockAvailability: React.FC<StockAvailabilityProps> = ({ stockCounts, players, chainSizes, stockPrices, currentPlayerName, highlightedCells, game_over }) => {

  // Calculate current bonuses for Net Worth projection
  const currentBonusesByPlayer = useMemo(() => {
    const bonuses: Record<string, number> = {};
    players.forEach(p => {
      bonuses[p.name] = 0;
    });

    const activeChains = Object.keys(chainSizes).filter(chain => chainSizes[chain] > 0);

    activeChains.forEach(chain => {
      const { majority, minority } = getStockPricing(chain, chainSizes[chain]);
      
      const holders = players
        .reduce<{ name: string; stockCount: number }[]>((acc, p) => {
          const stockCount = p.stocks[chain] || 0;
          if (stockCount > 0) acc.push({ name: p.name, stockCount });
          return acc;
        }, [])
        .toSorted((a, b) => b.stockCount - a.stockCount);

      if (holders.length === 0) return;

      const topShareCount = holders[0].stockCount;
      const majorityWinners = holders.filter(h => h.stockCount === topShareCount);

      if (majorityWinners.length > 1) {
        // Tie for Majority: Split Majority + Minority (Round up to nearest 100)
        const splitBonus = Math.ceil((majority + minority) / majorityWinners.length / 100) * 100;
        majorityWinners.forEach(winner => {
          bonuses[winner.name] += splitBonus;
        });
      } else {
        // Single Majority Winner
        const majorityWinner = majorityWinners[0];
        bonuses[majorityWinner.name] += majority;

        // Check Minority
        const remainingHolders = holders.filter(h => h.stockCount < topShareCount);
        if (remainingHolders.length > 0) {
          const secondShareCount = remainingHolders[0].stockCount;
          const minorityWinners = remainingHolders.filter(h => h.stockCount === secondShareCount);
          
          if (minorityWinners.length > 0) {
            // Tie for Minority: Split Minority (Round up to nearest 100)
            const splitMinorityBonus = Math.ceil((minority / minorityWinners.length) / 100) * 100;
            minorityWinners.forEach(winner => {
              bonuses[winner.name] += splitMinorityBonus;
            });
          }
        } else if (holders.length === 1) {
            // Only one shareholder gets both if no one else has stock
            bonuses[majorityWinner.name] += minority;
        }
      }
    });
    return bonuses;
  }, [players, chainSizes]);

  return (
    <div className="stock-availability-container">
      <table className="stock-availability-table">
        <thead>
          <tr>
            <th>Stock</th>
            <th colSpan={players.length}>Stock Owned</th>
            <th>Hotel Chain</th>
            <th>Chain</th>
            <th>Stock</th>
            <th colSpan={2}>Current Bonus</th>
          </tr>
          <tr>
            <th>Available</th>
            {players.map((player) => {
              const colorObj = getColorObject(player.color); 
              return (
                <th 
                  key={`header-${player.name}`} 
                  style={{ 
                    background: colorObj?.gradient || player.color, 
                    color: 'white', 
                    textShadow: '1px 1px 3px rgba(0,0,0,0.5)' 
                  }} 
                  className={`player-name-header ${player.name === currentPlayerName ? 'current-player-column' : ''}`}
                >
                  {truncateName(player.name)} 
                </th>
              );
            })}
            <th>Stock</th>
            <th>Length</th>
            <th>Price</th>
            <th>Majority</th>
            <th>Minority</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(stockCounts).map(([chain, count]) => {
            const size = chainSizes?.[chain] ?? 0;
            const price = stockPrices?.[chain] ?? 0;
            const { majority, minority } = getStockPricing(chain, size);
            const isSafe = size >= 11;
            
            const isPriceHighlighted = highlightedCells?.type === 'liquidation' && highlightedCells?.chain === chain;
            const isBonusHighlighted = highlightedCells?.type === 'bonus' && highlightedCells?.chain === chain;

            // Logic for styling right-hand bonus columns
            const holders = players
              .reduce<{ name: string; color: string; stockCount: number }[]>((acc, p) => {
                const stockCount = p.stocks?.[chain] || 0;
                if (stockCount > 0) acc.push({ name: p.name, color: p.color, stockCount });
                return acc;
              }, [])
              .toSorted((a, b) => b.stockCount - a.stockCount);

            let majorityStyle = {};
            let minorityStyle = {};

            if (holders.length > 0) {
              const topShareCount = holders[0].stockCount;
              const majorityWinners = holders.filter(h => h.stockCount === topShareCount);

              if (majorityWinners.length === 1) {
                const winnerColorObj = getColorObject(majorityWinners[0].color);
                if (winnerColorObj) {
                  majorityStyle = {
                    background: winnerColorObj.gradient,  
                    color: 'white', 
                    textShadow: '1px 1px 3px rgba(0,0,0,0.5)' 
                  };
                }

                const remainingHolders = holders.filter(h => h.stockCount < topShareCount);
                if (remainingHolders.length > 0) {
                  const secondShareCount = remainingHolders[0].stockCount;
                  const minorityWinners = remainingHolders.filter(h => h.stockCount === secondShareCount);
                  if (minorityWinners.length === 1) {
                    const minorityWinnerColorObj = getColorObject(minorityWinners[0].color);
                    if (minorityWinnerColorObj) {
                      minorityStyle = {
                        background: minorityWinnerColorObj.gradient, 
                        color: 'white', 
                        textShadow: '1px 1px 3px rgba(0,0,0,0.5)' 
                      };
                    }
                  }
                } else if (holders.length === 1) {
                  minorityStyle = { ...majorityStyle };
                }
              }
            }

            // Logic for badges in player columns
            const rowId = `stock-row-${chain}`;
            const activeStocks = players.reduce<number[]>((acc, p) => {
              const count = p.stocks?.[chain] || 0;
              if (count > 0) acc.push(count);
              return acc;
            }, []);
            const sorted = activeStocks.toSorted((a, b) => b - a);
            const top = sorted[0] || 0;
            const distinct = [...new Set(sorted)];
            const second = distinct[1] || 0;
            const majors = activeStocks.filter(c => c === top).length;
            const minors = activeStocks.filter(c => c === second).length;
            const isTiedMajor = majors > 1;
            const isTiedMinor = minors > 1;

            return (
              <tr key={chain} id={rowId}>
                <td className="stock-name-cell" data-stock={chain.toLowerCase()}>
                  <img src={`/images/hotel/${chain.toLowerCase()}.webp`} alt={chain} className="stock-icon" />
                  {count}
                </td>

                {players.map((player) => {
                  const owned = player.stocks?.[chain] || 0;
                  const cellId = `stock-cell-${chain}-${player.name.replace(/\s+/g, '-')}`;
                  const isOwnedHighlighted = isPriceHighlighted;
                  
                  let badges: React.ReactNode = null;
                  if (owned > 0) {
                    const isMajor = owned === top;
                    const isMinor = !isMajor && owned === second;

                    const goldIcon = <img src="/images/cards/gold.webp" alt="Majority" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;
                    const silverIcon = <img src="/images/cards/silver.webp" alt="Minority" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;

                    if (isMajor && isTiedMajor) badges = <>{goldIcon}{silverIcon}</>;
                    else if (isMajor && sorted.length === 1) badges = <>{goldIcon}{silverIcon}</>;
                    else if (isMajor) badges = <>{goldIcon}</>;
                    else if (isMinor && isTiedMinor) badges = <>{silverIcon}</>;
                    else if (isMinor) badges = <>{silverIcon}</>;
                  }

                  return (
                    <td 
                        key={`${chain}-${player.name}`} 
                        id={cellId} 
                        className={`${player.name === currentPlayerName ? 'current-player-column' : ''} ${isOwnedHighlighted ? 'value-changed-highlight' : ''}`}
                    >
                      {owned > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {badges} <span>{owned}</span>
                        </div>
                      ) : "0"}
                    </td>
                  );
                })}
                <td className="stock-name-cell" data-stock={chain.toLowerCase()}>
                  <img src={`/images/hotel/${chain.toLowerCase()}.webp`} alt={chain} className="stock-icon" />
                  {chain}
                </td>
                
                <td data-stock={chain.toLowerCase()} style={{ fontWeight: isSafe ? 'bold' : 'normal' }}>
                  {size > 0 ? size : "0"}
                </td>

                <PriceCell price={price} isHighlighted={isPriceHighlighted} dataStock={chain.toLowerCase()} />

                <td style={majorityStyle} className={isBonusHighlighted ? 'value-changed-highlight' : ''}>
                  {majority > 0 ? majority.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }) : "$0"}
                </td>
                <td style={minorityStyle} className={isBonusHighlighted ? 'value-changed-highlight' : ''}>
                  {minority > 0 ? minority.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }) : "$0"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="cell-transparent"></td>
            {players.map((player) => (
              <AnimatedAmountCell
                key={`cash-${player.name}`}
                value={game_over ? (player.cash_before_scoring ?? player.cash) : player.cash}
                isCurrency={true}
                isHighlighted={!game_over && highlightedCells?.type === 'cash'}
              />
            ))}
            <td className="stock-name-cell" data-stock="cash">💵 Cash</td>
            <td colSpan={4} className="cell-transparent"></td>
          </tr>
          <tr>
            <td className="cell-transparent"></td>
            {players.map((player) => {
              // Calculate Net Worth including current potential bonuses
              const currentBonus = currentBonusesByPlayer[player.name] || 0;
              // If game is over, the net_worth from backend usually is final. 
              // If not, we take backend net_worth (Cash + Stock Value) and add projected bonus.
              const displayNetWorth = (player.net_worth ?? 0) + (game_over ? 0 : currentBonus);
              
              return (
                <AnimatedAmountCell
                  key={`net-worth-${player.name}`}
                  value={displayNetWorth}
                  isCurrency={true}
                  isHighlighted={!game_over && highlightedCells?.type === 'net_worth'}
                />
              );
            })}
            <td className="stock-name-cell" data-stock="net-worth">💰 Net Worth</td>
            <td colSpan={4} className="cell-transparent"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

