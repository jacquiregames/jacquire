// src/lobby/LobbyPlayerList.tsx
import { m } from "motion/react";
import { PLAYER_COLORS } from "../utils/playerColors";

interface LobbyPlayer {
  name: string;
  color: string;
  is_bot?: boolean;
}

interface LobbyPlayerListProps {
  lobbyPlayers: LobbyPlayer[];
  playerName: string;
  allowBotRemoval: boolean;
  onRemoveBot: (botName: string) => void;
  botActionPending: boolean;
}

const lobbyListVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const lobbyItemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

/**
 * The "who's in the lobby" list. Extracted out of UnifiedIntro as part of
 * the no-giant-component cleanup — this was rendered from two near-
 * identical spots (the host view, which also shows a remove-bot button per
 * bot, and the read-only non-host view). `allowBotRemoval` toggles that one
 * difference instead of keeping two copies in sync by hand.
 */
function LobbyPlayerList({ lobbyPlayers, playerName, allowBotRemoval, onRemoveBot, botActionPending }: LobbyPlayerListProps) {
  return (
    <m.div className="player-list-container" variants={lobbyListVariants} initial="hidden" animate="visible">
      {lobbyPlayers.map((p, i) => {
        const pColorObj = PLAYER_COLORS.find(c => c.primary === p.color);
        return (
          <m.div
            key={p.name}
            className={`player-pill ${p.name === playerName ? "current-player-pill" : ""}`}
            style={{ background: pColorObj?.gradient || p.color, color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}
            variants={lobbyItemVariants}
          >
            <span className="player-pill-name">{p.is_bot ? "🤖 " : ""}{p.name}</span>
            {i === 0 && <span className="host-badge" style={{ color: 'white', borderColor: 'white' }}>HOST</span>}
            {allowBotRemoval && p.is_bot && (
              <button
                type="button"
                className="bot-remove-btn"
                aria-label={`Remove ${p.name}`}
                title="Remove bot"
                disabled={botActionPending}
                onClick={() => onRemoveBot(p.name)}
                style={{
                  marginLeft: 6,
                  background: 'rgba(0,0,0,0.35)',
                  border: 'none',
                  borderRadius: '50%',
                  color: 'white',
                  width: 20,
                  height: 20,
                  lineHeight: '18px',
                  cursor: botActionPending ? 'default' : 'pointer',
                }}
              >
                ×
              </button>
            )}
          </m.div>
        );
      })}
    </m.div>
  );
}

export default LobbyPlayerList;
