// src/PlayerBanner.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCountUp } from './hooks/useCountUp';
import { getColorObject } from './utils/playerColors';
import { truncateName } from './utils/uiHelpers';
import { GameState, Player } from './types';
import './styles/PlayerBanner.css';

interface PlayerBannerProps {
  myTurn: boolean;
  gameState: Pick<GameState, 'turn_phase' | 'current_player' | 'players' | 'tiles_to_place_this_turn'>;  
  playerInfo: Player;
  floatingTexts: { id: number; amount: number; type: 'gain' | 'cost' }[];
  onTextAnimationEnd: (id: number) => void;
}

const PHASE_DISPLAY_NAMES: Record<string, string> = {
  place_tile: "Place Tile",
  choose_chain: "Found Chain",
  buy_stock: "Buy Stocks",
  choose_merger: "Choose Survivor",
  trade_stocks: "Resolve Merger",
  trade_stocks_power: "Trade Stock Power",
  game_over: "Game Over",
  choose_defunct: "Resolution Order" // NEW
};

// A pill whose *background color* crossfades on turn change instead of
// snapping, while its content (passed as children) stays put and doesn't
// itself re-mount/flicker. Defined at module scope (not inside PlayerBanner)
// so its component identity stays stable across re-renders — if it were
// declared inside PlayerBanner, React would treat it as a brand-new
// component type on every re-render (e.g. every mousemove over a board
// tile, which updates hover state in a parent) and fully remount it,
// replaying its enter animation as a visible flash/disappear.
const ColorPill: React.FC<{ className: string; background: string; animKey: string; children: React.ReactNode }> = ({ className, background, animKey, children }) => (
  <div className={`banner-pill ${className}`} style={{ position: 'relative', overflow: 'hidden' }}>
    <AnimatePresence>
      <motion.div
        key={animKey}
        className="banner-pill-bg"
        style={{ position: 'absolute', inset: 0, background }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      />
    </AnimatePresence>
    <div style={{ position: 'relative', color: 'var(--color-white)', textShadow: 'var(--shadow-text-heavy)' }}>{children}</div>
  </div>
);

const PlayerBanner: React.FC<PlayerBannerProps> = ({
  myTurn,
  gameState,
  playerInfo,
  floatingTexts,
  onTextAnimationEnd
}) => {
  const displayedCash = useCountUp(playerInfo?.cash ?? 0, 1000);
  
  const rawPhase = gameState.turn_phase;
  const phaseText = PHASE_DISPLAY_NAMES[rawPhase] || rawPhase.replace(/_/g, ' ');
  const placeTilesLeft = gameState.tiles_to_place_this_turn;
  
  const currentPlayerObject = gameState.players.find(p => p.name === gameState.current_player);
  const isCurrentPlayerBot = !!currentPlayerObject?.is_bot;
  const playerColorObject = getColorObject(currentPlayerObject?.color ?? '');
  const primaryColor = playerColorObject?.primary || currentPlayerObject?.color || '#333';
  const pillBackground = playerColorObject?.gradient || primaryColor;

  return (
    // Remounting on current_player gives every pill a quick spring "pop" the
    // instant the turn changes, on top of the background crossfade above.
    <motion.div
      key={gameState.current_player}
      className="banner-container"
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 16 }}
    >
      {/* Left Pill: Player Info */}
      <ColorPill className="player-info-pill" background={pillBackground} animKey={gameState.current_player}>
        <div style={{ position: 'relative' }}>
          <span className="player-cash" id="player-cash-value">
            ${displayedCash.toLocaleString()}
          </span>
          {floatingTexts.map(text => (
            <div key={text.id} className={`floating-text ${text.type}`} onAnimationEnd={() => onTextAnimationEnd(text.id)}>
              {text.amount > 0 ? `+` : ''}{text.amount.toLocaleString()}
            </div>
          ))}
        </div>
      </ColorPill>

      {/* Center Pill: Game Phase */}
      <ColorPill className="phase-pill" background={pillBackground} animKey={gameState.current_player}>
        <AnimatePresence mode="wait">
          <motion.span
            key={rawPhase}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-block' }}
          >
            {myTurn && placeTilesLeft > 1 && gameState.turn_phase === 'place_tile'
              ? `${phaseText} (${placeTilesLeft} LEFT)`
              : phaseText
            }
          </motion.span>
        </AnimatePresence>
      </ColorPill>

      {/* Right Pill: Turn Status */}
      <ColorPill className="turn-status-pill" background={pillBackground} animKey={gameState.current_player}>
        <AnimatePresence mode="wait">
          <motion.span
            key={gameState.current_player}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            style={{ display: 'inline-block' }}
          >
            {myTurn
              ? "Your Turn!"
              : `${isCurrentPlayerBot ? "🤖 " : ""}Waiting for ${truncateName(gameState.current_player)}`}
          </motion.span>
        </AnimatePresence>
      </ColorPill>
    </motion.div>
  );
};

export default PlayerBanner;

