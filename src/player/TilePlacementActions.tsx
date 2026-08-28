// src/player/TilePlacementActions.tsx
import "../styles/TileSelector.css";

interface TilePlacementActionsProps {
  loading: boolean;
  onDiscardAndDraw: () => void;
  onSkipPlacement: () => void;
}
 
function TilePlacementActions({ loading, onDiscardAndDraw, onSkipPlacement }: TilePlacementActionsProps) {
  return (
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
  );
}

export default TilePlacementActions;
