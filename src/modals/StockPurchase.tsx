// src/modal/StockPurchase.tsx
import { triggerChainConfetti } from "../hooks/useChainConfetti";
import { GameState } from '../types';
import "../styles/StockPurchase.css"; 
import "../styles/shared-panels.css";

interface StockPurchaseProps {
  activeChains: string[];
  stockPrices: Record<string, number>;
  stockCounts: Record<string, number>;
  onBuyStock: (chain: string, quantity: number) => void;
  loading?: boolean;
  playerCash: number;
  gameState: Pick<GameState, 'current_turn_stock_count' | 'max_stocks_to_buy_this_turn' | 'free_stocks_this_turn'>;
  children?: React.ReactNode;
}

export default function StockPurchase({
  activeChains,
  stockPrices,
  stockCounts,
  onBuyStock,
  loading,
  playerCash,
  gameState,
  children,
}: StockPurchaseProps) {
  const { 
    current_turn_stock_count: currentTurnStockCount = 0, 
    max_stocks_to_buy_this_turn: maxBuys = 3, 
    free_stocks_this_turn: freeStocksAvailable = 0 
  } = gameState;

  const remainingBuys = maxBuys - currentTurnStockCount;

  const handleBuy = (chain: string, qty: number) => {
    if (!chain || qty < 1) return; 
    triggerChainConfetti(chain);
    onBuyStock(chain, qty);
  };

  // Filter out any active chains that have 0 stock available in the bank
  const purchasableChains = activeChains.filter(chain => stockCounts[chain] > 0);

  return (
    <div className="stock-panel">
      <div className="panel-banner-container panel-banner-container--stock-purchase">
        <img src="/images/banner/buy.webp" alt="Buy Stocks" className="panel-title-image panel-title-image--stock-purchase" />
        <h2 className="panel-title-overlay">
          Buy Stocks
          <span className="panel-subtitle-overlay panel-subtitle-overlay--stock-purchase">
            {remainingBuys} Left
          </span>
        </h2>
      </div>

      <div className="panel-content stock-purchase-list">
        {purchasableChains.length === 0 && (
          <p className="no-stocks-msg">No stocks available to purchase.</p>
        )}

        {purchasableChains.map((chain) => {
          const price = stockPrices[chain] || 0;
          const available = stockCounts[chain] || 0;

          // Determine which buttons (Buy 1, Buy 2, Buy 3) are valid
          const buttons = [1, 2, 3].map((qty) => {
            // Cannot buy more than allowed in a turn
            if (qty > remainingBuys) return null;
            // Cannot buy more than what's available in the bank
            if (qty > available) return null;
            
            // Calculate actual cost with free stock power interactions
            const freeQty = Math.min(freeStocksAvailable, qty);
            const paidQty = qty - freeQty;
            const cost = paidQty * price;

            // Hide the button if the player can't afford it
            if (playerCash < cost) return null;

            return (
              <button
                key={qty}
                className={`sp-buy-button bg-${chain.toLowerCase()}`}
                onClick={() => handleBuy(chain, qty)}
                disabled={loading}
              >
                {qty} - ${cost.toLocaleString()}
              </button>
            );
          }).filter(Boolean); // Filter out the nulls

          return (
            <div className="sp-chain-card" key={chain}>
              <div className={`sp-row-1 bg-${chain.toLowerCase()}`}>
                <img 
                  src={`/images/hotel/${chain.toLowerCase()}.webp`} 
                  alt={chain} 
                  className="sp-chain-logo"
                />
                <span className="sp-chain-name">{chain} [{available}]</span>
                <span className="sp-chain-price">${price}</span>
              </div>
              {buttons.length > 0 ? (
                <div className="sp-row-2">
                  {buttons}
                </div>
              ) : (
                <div className="sp-row-2-empty">
                  <span>{remainingBuys <= 0 ? 'No buys remaining' : 'Cannot afford'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
