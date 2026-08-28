// src/player/TileSelector.tsx
import "../styles/TileSelector.css";
import TileHand, { type HandAvailability } from "./TileHand";
import StockHoldings from "./StockHoldings";
import TilePlacementActions from "./TilePlacementActions";

type Tile = [number, number];

interface TileSelectorProps {
  tiles: Tile[];
  stocks: Record<string, number>;
  canPlaceTile: boolean;
  loading: boolean;
  playableTiles: Tile[];
  deadTiles: Tile[];
  hasWildTile: boolean;
  isPlacingWild: boolean;
  onToggleWildPlacement: () => void;
  onDiscardAndDraw: () => void;
  onSkipPlacement: () => void;
}

function computeHandAvailability(canPlaceTile: boolean, loading: boolean): HandAvailability {
  if (!canPlaceTile) return 'locked';
  if (loading) return 'busy';
  return 'available';
}

function TileSelector({
  tiles,
  stocks,
  canPlaceTile,
  loading,
  playableTiles,
  deadTiles,
  hasWildTile,
  isPlacingWild,
  onToggleWildPlacement,
  onDiscardAndDraw,
  onSkipPlacement,
}: TileSelectorProps) {
  const availability = computeHandAvailability(canPlaceTile, loading);
  const showPlacementActions = canPlaceTile && playableTiles.length === 0;

  return (
    <div className="tile-selector-container">
      <div className="tile-selector-header">
        <h3 className="tile-selector-title">Your Tiles</h3>
      </div>

      <TileHand
        tiles={tiles}
        playableTiles={playableTiles}
        deadTiles={deadTiles}
        hasWildTile={hasWildTile}
        isPlacingWild={isPlacingWild}
        availability={availability}
        onToggleWildPlacement={onToggleWildPlacement}
      />

      <StockHoldings stocks={stocks} />

      {showPlacementActions && (
        <TilePlacementActions
          loading={loading}
          onDiscardAndDraw={onDiscardAndDraw}
          onSkipPlacement={onSkipPlacement}
        />
      )}
    </div>
  );
}

export default TileSelector;
