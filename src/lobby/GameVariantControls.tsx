// src/lobby/GameVariantControls.tsx
import VariantToggle from "../ui/VariantToggle";

interface GameVariantControlsProps {
  wildTileVariant: boolean;
  setWildTileVariant: (enabled: boolean) => void;
  specialPowersVariant: boolean;
  setSpecialPowersVariant: (enabled: boolean) => void;
  fastGameVariant: boolean;
  setFastGameVariant: (enabled: boolean) => void;
  hasJoined: boolean;
  canStart: boolean;
  onStartGame: () => void;
}

/**
 * The host-only "Game Variants" column: the three variant toggles plus the
 * Start Game button. Extracted out of UnifiedIntro as part of the
 * no-giant-component cleanup.
 */
function GameVariantControls({
  wildTileVariant,
  setWildTileVariant,
  specialPowersVariant,
  setSpecialPowersVariant,
  fastGameVariant,
  setFastGameVariant,
  hasJoined,
  canStart,
  onStartGame,
}: GameVariantControlsProps) {
  return (
    <div className="host-controls">
      <h2 className="lobby-title">Game Variants</h2>
      <div className="variant-toggles">
        <VariantToggle
          icon="/images/variant/wildtile.webp"
          label="Wild Tile"
          checked={wildTileVariant}
          onChange={setWildTileVariant}
        />
        <VariantToggle
          icon="/images/variant/fast.webp"
          label="Fast Game"
          checked={fastGameVariant}
          onChange={setFastGameVariant}
        />
        <VariantToggle
          icon="/images/variant/specialpowers.webp"
          label="Special Powers"
          checked={specialPowersVariant}
          onChange={setSpecialPowersVariant}
        />
      </div>
      {hasJoined && (
        canStart ? (
          <button className="button-primary start-game-button" onClick={onStartGame}>
            Start Game
          </button>
        ) : (
          <p className="waiting-message">Waiting for players...</p>
        )
      )}
    </div>
  );
}

export default GameVariantControls;
