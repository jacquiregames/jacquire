// src/lobby/JoinForm.tsx
import { PlayerColor, PLAYER_COLORS } from "../utils/playerColors";

interface JoinFormProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  selectedColor: PlayerColor | null;
  hoveredColor: PlayerColor | null;
  setHoveredColor: (color: PlayerColor | null) => void;
  takenColors: string[];
  onSelectColor: (colorObj: PlayerColor) => void;
  isNameValid: boolean;
  joining: boolean;
  onJoin: () => void;
  joinBtnRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Name entry + color picker + Join button. Extracted out of UnifiedIntro
 * as part of the no-giant-component cleanup — this exact block used to be
 * duplicated near-verbatim between the host and non-host branches (only
 * the surrounding layout differed), including a `key={i}` on the color
 * swatches that had already been fixed in one copy but not the other. One
 * definition now, used from both places.
 */
function JoinForm({
  playerName,
  setPlayerName,
  selectedColor,
  hoveredColor,
  setHoveredColor,
  takenColors,
  onSelectColor,
  isNameValid,
  joining,
  onJoin,
  joinBtnRef,
}: JoinFormProps) {
  const displayColor = selectedColor || hoveredColor;

  return (
    <div className="join-form">
      {displayColor && isNameValid ? (
        <div
          className="player-pill color-preview-pill"
          style={{ background: displayColor.gradient, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}
        >
          <span className="player-pill-name">{playerName}</span>
        </div>
      ) : (
        <input
          type="text"
          className="name-input"
          aria-label="Your name"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          minLength={2}
          maxLength={12}
        />
      )}
      {isNameValid && (
        <>
          <h3 className="color-picker-title">Select a Color</h3>
          <div className="color-picker" onMouseLeave={() => setHoveredColor(null)}>
            {PLAYER_COLORS.map((colorObj) => {
              const isTaken = takenColors.includes(colorObj.primary);
              return (
                <button
                  type="button"
                  key={colorObj.id}
                  className={`color-swatch ${isTaken ? "taken" : ""} ${selectedColor?.id === colorObj.id ? "selected" : ""}`}
                  style={{ background: colorObj.gradient }}
                  aria-label={`${colorObj.id}${isTaken ? " (taken)" : ""}`}
                  aria-pressed={selectedColor?.id === colorObj.id}
                  aria-disabled={isTaken}
                  tabIndex={isTaken ? -1 : 0}
                  onMouseEnter={() => !isTaken && setHoveredColor(colorObj)}
                  onClick={() => onSelectColor(colorObj)}
                  data-tooltip={isTaken ? "Taken" : colorObj.id}
                />
              );
            })}
          </div>
          <button ref={joinBtnRef} id="join-btn" onClick={onJoin} disabled={!selectedColor || joining} className="button-primary">
            {joining ? "Joining..." : "Join Game"}
          </button>
        </>
      )}
    </div>
  );
}

export default JoinForm;
