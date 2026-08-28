// src/player/StockHoldings.tsx
import "../styles/TileSelector.css";
import "../styles/StockCardView.css";
import { HOTEL_CHAINS } from "../utils/constants";

interface StockHoldingsProps {
  stocks: Record<string, number>;
}

function StockHoldings({ stocks }: StockHoldingsProps) {
  const ownedStocks = HOTEL_CHAINS.reduce<{ chain: string; count: number }[]>((acc, chain) => {
    const count = stocks[chain] || 0;
    if (count > 0) acc.push({ chain, count });
    return acc;
  }, []);

  if (ownedStocks.length === 0) return null;

  return (
    <>
      <div className="tile-selector-header your-stocks-header">
        <h3 className="tile-selector-title">Your Stocks</h3>
      </div>
      <div className="player-card-holdings tile-selector-stock-holdings">
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
    </>
  );
}

export default StockHoldings;
