// src/AddBotControls.tsx
import { useState } from "react";

interface AddBotControlsProps {
  canAddBot: boolean;
  botActionPending: boolean;
  onAddBot: (difficulty: string) => void;
}
 
function AddBotControls({ canAddBot, botActionPending, onAddBot }: AddBotControlsProps) {
  const [botDifficulty, setBotDifficulty] = useState<string>("Medium");

  return (
    <div className="add-bot-row">
      <select
        className="bot-difficulty-select"
        aria-label="Bot difficulty"
        value={botDifficulty}
        onChange={(e) => setBotDifficulty(e.target.value)}
        disabled={!canAddBot || botActionPending}
      >
        <option value="Easy">Easy</option>
        <option value="Medium">Medium</option>
        <option value="Hard">Hard</option>
      </select>

      <button
        type="button"
        className="button-primary add-bot-button"
        onClick={() => onAddBot(botDifficulty)}
        disabled={!canAddBot || botActionPending}
        title={canAddBot ? "Add a computer opponent" : "Lobby is full"}
      >
        🤖 Add Bot
      </button>
    </div>
  );
}

export default AddBotControls;
