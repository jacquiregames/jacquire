// src/player/TileHand.tsx
import { m, AnimatePresence } from "motion/react";
import "../styles/TileSelector.css";

type Tile = [number, number];

export type HandAvailability = 'available' | 'busy' | 'locked';

interface TileHandProps {
  tiles: Tile[];
  playableTiles: Tile[];
  deadTiles: Tile[];
  hasWildTile: boolean;
  isPlacingWild: boolean;
  availability: HandAvailability;
  onToggleWildPlacement: () => void;
}

function TileHand({
  tiles,
  playableTiles,
  deadTiles,
  hasWildTile,
  isPlacingWild,
  availability,
  onToggleWildPlacement,
}: TileHandProps) {
  const sortedTiles = tiles.toSorted((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  const handLocked = availability !== 'available';

  return (
    <div className="tile-selector-row">
      <div className="tile-selector-grid">
        <AnimatePresence initial={true}>
          {sortedTiles.map(([r, c]) => {
            const label = `${String.fromCharCode(65 + r)}${c + 1}`;
            const id = `tile-selector-${label}`;
            const isPlayable = playableTiles.some(([vr, vc]) => vr === r && vc === c);
            const isDead = deadTiles.some(([dr, dc]) => dr === r && dc === c);

            let buttonClass = "tile-button";
            if (!isPlayable && availability !== 'locked') {
              buttonClass += isDead ? " tile-dead" : " tile-unplayable";
            }

            return (
              <m.button
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
                disabled={!isPlayable || handLocked || isPlacingWild}
                title={isDead ? `Tile ${label} (Permanently Dead)` : `Tile ${label}`}
                onClick={() => {}}
              >
                {label}
              </m.button>
            );
          })}
        </AnimatePresence>
      </div>

      {hasWildTile && (
        <button
          id="wild-tile-selector-button"
          className={`tile-button wild-tile-button ${isPlacingWild ? 'selected' : ''}`}
          onClick={onToggleWildPlacement}
          disabled={handLocked}
          title="Place Wild Tile"
        >
          <img src="/images/variant/wildtile.webp" alt="Wild Tile" />
        </button>
      )}
    </div>
  );
}

export default TileHand;
