// src/TileSelector.tsx
import { motion, AnimatePresence } from "motion/react";
import "./styles/TileSelector.css"; 
import "./styles/StockCardView.css"; // <-- Import to reuse the existing stock card styling
import { HOTEL_CHAINS } from "./utils/constants";

type Tile = [number, number];

interface TileSelectorProps {
  tiles: Tile[];
  stocks: Record<string, number>; // <-- NEW: Accept player's stocks
  canPlaceTile: boolean;
  loading: boolean; 
  playableTiles: Tile[]; 
  deadTiles: Tile[]; 
  hasWildTile: boolean; 
  isPlacingWild: boolean;  
  onToggleWildPlacement: () => void;
  onDiscardAndDraw: () => void; 
  onSkipPlacement: () => void; 
  canPlace: boolean; 
}

function TileSelector({ 
  tiles, 
  stocks, // <-- NEW
  canPlaceTile, 
  loading, 
  playableTiles,
  deadTiles, 
  hasWildTile,
  isPlacingWild,
  onToggleWildPlacement,
  onDiscardAndDraw, 
  onSkipPlacement,  
  canPlace, 
}: TileSelectorProps) {
 
  // Sort hand alphanumerically
  const sortedTiles = [...tiles].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  // Calculate owned stocks to render on the right
  const ownedStocks = HOTEL_CHAINS
    .map(chain => ({ chain, count: stocks[chain] || 0 }))
    .filter(stock => stock.count > 0);

  return (
    <div className="tile-selector-container">
      <div className="tile-selector-header">
        <h3 className="tile-selector-title">Your Tiles</h3>
      </div>

      <div className="tile-selector-row">
        <div className="tile-selector-grid">
          <AnimatePresence initial={true}>
            {sortedTiles.map(([r, c]) => {
              const label = `${String.fromCharCode(65 + r)}${c + 1}`;
              const id = `tile-selector-${label}`; 
              const isPlayable = playableTiles.some(([vr, vc]) => vr === r && vc === c);
              const isDead = deadTiles.some(([dr, dc]) => dr === r && dc === c);

              let buttonClass = "tile-button";
              if (!isPlayable && canPlaceTile) {
                buttonClass += isDead ? " tile-dead" : " tile-unplayable";
              }

              return (
                <motion.button
                  id={id}
                  key={label}
                  layout
                  // "Dealt" in from below like a card being drawn, and
                  // reflows smoothly (via `layout`) when a neighboring
                  // tile is placed/discarded and the grid re-sorts.
                  initial={{ opacity: 0, y: 22, scale: 0.6, rotate: -6 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className={buttonClass} 
                  disabled={!isPlayable || !canPlaceTile || loading || isPlacingWild}
                  title={isDead ? `Tile ${label} (Permanently Dead)` : `Tile ${label}`} 
                  onClick={() => {}}
                >
                  {label}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {hasWildTile && (
            <button
                id="wild-tile-selector-button"
                className={`tile-button wild-tile-button ${isPlacingWild ? 'selected' : ''}`}
                onClick={onToggleWildPlacement}
                disabled={!canPlaceTile || loading}
                title="Place Wild Tile"
            >
                <img src="/images/variant/wildtile.png" alt="Wild Tile" />
            </button>
        )} 
      </div>

      {/* Your Stocks: stacked below Your Tiles rather than beside it */}
      {ownedStocks.length > 0 && (
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
                    src={`/images/cards/card_${chain.toLowerCase()}.png`}
                    alt={`${chain} stock card`}
                    className="stock-card-image"
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action Buttons */}
      {canPlace && playableTiles.length === 0 && (
        <div className="new-tiles-button-container">
          <button 
              className="button-primary new-tiles-button"
              onClick={onSkipPlacement}
              disabled={loading}
          >
              Skip Placement
          </button>
          <button 
              className="button-primary new-tiles-button"
              onClick={onDiscardAndDraw}
              disabled={loading}
              title="Only works if you hold permanently dead tiles (merges two safe chains)"
          >
              Discard Dead & Redraw
          </button>
        </div>
      )}
    </div>
  );
} 

export default TileSelector;
