// src/GameBoard.tsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import TileSelector from "./TileSelector";
import { ReferencePanel } from "./ReferencePanel";
import StockPurchase from "./StockPurchase"; 
import ChainChoiceModal from "./ChainChoiceModal";
import MergerChoiceModal from "./MergerChoiceModal";
import MergerResolutionModal from "./MergerResolutionModal";
import PlayerBanner from "./PlayerBanner";
import { truncateName } from "./utils/uiHelpers";
import { SpecialPowersPanel } from "./SpecialPowersPanel";
import { TradeStockPowerModal } from "./TradeStockPowerModal"; 
import { GameSummaryPanel, StockLiquidationTable } from "./GameSummaryPanel";  
import { GameState } from './types';
import { animateById, animateMerge, getDistance, animateTilePlacement } from "./AnimationManager";
import { motion, AnimatePresence } from "motion/react";
import useAnimationTrigger from "./hooks/useAnimationTrigger";
import SafeStampAnimation from "./SafeStampAnimation";
import { GameLog } from "./GameLog";
import { HOTEL_COLORS } from './utils/constants';
import "./styles/SpecialPowersPanel.css";
import "./styles/GameBoard.css";
import "./styles/shared-panels.css";

interface GameBoardProps {
  playerName: string;
  // FIX (trust model): required so handleApiCall can attach it to every
  // mutating request; the server now rejects any action whose token
  // doesn't match the one issued to that player at /join.
  playerToken: string;
  apiUrl: string;
  gameState: GameState;
  onGameStateUpdate: (state: GameState) => void;
  onReset: () => void;
  showBackground: boolean; 
  onToggleBackground: (val: boolean) => void; 
  onNextBackground: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ playerName, playerToken, apiUrl, gameState, onGameStateUpdate, onReset, showBackground, onToggleBackground, onNextBackground  }) => {
  const [loading, setLoading] = useState(false);
  const [validTiles, setValidTiles] = useState<[number, number][]>([]); 
  const [deadTiles, setDeadTiles] = useState<[number, number][]>([]); 
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; amount: number; type: 'gain' | 'cost' }[]>([]);
  const playerInfo = useMemo(() => gameState?.players?.find((p) => p.name === playerName), [gameState, playerName]);
  const prevCashRef = useRef<number | undefined>(playerInfo?.cash);
  const [isPlacingWild, setIsPlacingWild] = useState(false);
  const prevStockCountRef = useRef(gameState.current_turn_stock_count);
  const latestPhaseRef = useRef(gameState?.turn_phase);
  const [animationPhase, setAnimationPhase] = useState('start');
  const [hoverData, setHoverData] = useState<{ cell: string | null, r: number, c: number, x: number, y: number } | null>(null);
  
  const handleMouseEnter = (e: React.MouseEvent, cell: string | null, r: number, c: number) => {
    // Only track hover state if it's an active hotel chain
    if (cell && cell !== "P" && HOTEL_COLORS[cell]) {
      setHoverData({ cell, r, c, x: e.clientX, y: e.clientY });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setHoverData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  };
  
  const handleMouseLeave = () => {
    setHoverData(null);
  };
  
  const myTurn = !!gameState && gameState.current_player === playerName;
  const shouldShowStockModal = myTurn && gameState?.turn_phase === "buy_stock" && !gameState?.game_over;
  const [isStockModalVisible, setIsStockModalVisible] = useState(shouldShowStockModal);
  const canPlace = myTurn && gameState.turn_phase === "place_tile" && !gameState.game_over;
  const specialPowersVariantActive = gameState.players.some(p => p.special_powers.length > 0);

  useEffect(() => {
    if (gameState?.turn_phase) {
      latestPhaseRef.current = gameState.turn_phase;
    }
  }, [gameState?.turn_phase]); 

  useEffect(() => {
    setIsStockModalVisible(shouldShowStockModal);
  }, [shouldShowStockModal]);

  const handleEndTurn = () => {
    if (loading) return;
    setIsStockModalVisible(false);
    setTimeout(() => {
        handleApiCall("/end_turn", { player_name: playerName });
    }, 300); 
  };
  
  useEffect(() => {
    if (gameState.game_over && animationPhase === 'start') {
      setTimeout(() => {
        setAnimationPhase('show_summary'); 
      }, 500); 
    }
  }, [gameState.game_over, animationPhase]);
  
  useEffect(() => {
    const previousCount = prevStockCountRef.current;
    const currentCount = gameState.current_turn_stock_count;
    const maxBuys = gameState.max_stocks_to_buy_this_turn || 3;

    if (
      gameState.current_player === playerName &&
      gameState.turn_phase === 'buy_stock'
    ) {
      // If the game can end, NEVER auto-end the turn!
      if (gameState.is_end_game_possible) {
        prevStockCountRef.current = currentCount;
        return;
      }

      const outOfBuys = currentCount >= maxBuys && previousCount < maxBuys;

      // Check if they are completely out of money/freebies to buy any available stock
      let cannotAfford = false;
      if (!outOfBuys && currentCount > previousCount) {
        const canAffordAny = gameState.active_chains.some(chain => {
          if (gameState.stock_counts[chain] <= 0) return false;
          if (gameState.free_stocks_this_turn > 0) return true;
          return (playerInfo?.cash ?? 0) >= (gameState.stock_prices[chain] ?? 0);
        });
        cannotAfford = !canAffordAny;
      }

      if (outOfBuys || cannotAfford) { 
        setIsStockModalVisible(false); // <--- Instantly animate the modal closing 
        setTimeout(() => {
          // Verify we didn't manually end the turn already
          if (latestPhaseRef.current === 'buy_stock') {
            handleApiCall("/end_turn", { player_name: playerName }).catch(() => {});
          }
        }, 500);
      }
    }
    prevStockCountRef.current = currentCount;
  }, [gameState, playerName, playerInfo]);

  useEffect(() => {
    if (canPlace) {
      const fetchValidTiles = async () => {
        try {
          const res = await fetch(`${apiUrl}/valid_tiles`);
          if (res.ok) {
            const data = await res.json();
            setValidTiles(data.valid_tiles || []);
            setDeadTiles(data.dead_tiles || []); // <-- NEW
          }
        } catch (error) {
          console.error("Failed to fetch valid tiles:", error);
          setValidTiles([]);
          setDeadTiles([]); // <-- NEW
        }
      };
      fetchValidTiles();
    } else {
      setValidTiles([]);
    }
  }, [canPlace, apiUrl]);
  
  const playableTilesInHand = useMemo(() => {
    if (!playerInfo) return [];
    return playerInfo.tiles.filter(tile =>
      validTiles.some(validTile => validTile[0] === tile[0] && validTile[1] === tile[1])
    );
  }, [playerInfo, validTiles]);

  // Determine the chronologically last placed tile on the board to glow red
  const lastPlacedTile = useMemo(() => {
    if (!gameState?.game_log) return null;
    let undosToSkip = 0;
    for (let i = gameState.game_log.length - 1; i >= 0; i--) {
      const entry = gameState.game_log[i];
      if (entry.action === 'undo_placement') {
        undosToSkip++;
      } else if (entry.action === 'place_tile') {
        if (undosToSkip > 0) {
          undosToSkip--; // Skip this placement because it was undone
        } else {
          return entry.details.tile as [number, number];
        }
      }
    }
    return null;
  }, [gameState?.game_log]);

  useEffect(() => {
    const event = gameState?.last_animation_event;
    if (!event) return;

    const triggerBackgroundFlash = (chainName: string | undefined) => {
      if (!chainName) return;
      const flashContainer = document.getElementById('background-flash-container');
      if (flashContainer) {
        flashContainer.style.setProperty('--flash-color', `var(--flash-${chainName.toLowerCase()}-color)`);
        flashContainer.classList.remove('flash-active');
        void flashContainer.offsetWidth;
        flashContainer.classList.add('flash-active');
      }
    };

    if (event.type === 'found' || event.type === 'expand') {
      triggerBackgroundFlash(event.chain);
    } else if (event.type === 'merge') {
      triggerBackgroundFlash(event.survivor);
    }
    
    if (event.type === "expand" && event.expanded_tiles && event.source_tile) {
      const sourceTileEl = document.getElementById(`tile-${event.source_tile[0]}-${event.source_tile[1]}`);
      if (sourceTileEl) {
        sourceTileEl.classList.add('tile-placed');
        setTimeout(() => sourceTileEl.classList.remove('tile-placed'), 500);
      }
      event.expanded_tiles.forEach(tile => {
        const el = document.getElementById(`tile-${tile[0]}-${tile[1]}`);
        if (!el) return;
        const delay = getDistance(event.source_tile!, tile) * 250;
        el.style.animationDelay = `${delay}ms`;
        el.classList.add('tile-ripple');
        setTimeout(() => {
          el.classList.remove('tile-ripple');
          el.style.animationDelay = '';
        }, delay + 800);
      });
    }

    if (event.type === "merge" && event.survivor && event.defunct_tiles && event.merging_tile) {
      animateMerge(event.survivor, event.defunct_tiles, event.merging_tile);
      setTimeout(() => {
        const survivorTiles = document.querySelectorAll(`.chain-${event.survivor!.toLowerCase()}`);
        survivorTiles.forEach(tile => {
          tile.classList.add('power-up-sheen');
          setTimeout(() => tile.classList.remove('power-up-sheen'), 1500);
        });
      }, 1400);

      // Big merger impact: only shake the board for a genuinely large
      // acquisition (5+ tiles absorbed across all defunct chains combined),
      // so routine 2-tile mergers stay calm and the shake reads as meaningful.
      const totalAbsorbed = Object.values(event.defunct_tiles).reduce((sum, tiles) => sum + tiles.length, 0);
      if (totalAbsorbed >= 5) {
        const boardEl = document.querySelector('.board-container');
        if (boardEl) {
          const delay = totalAbsorbed * 20; // let the flying tiles mostly land first
          setTimeout(() => {
            boardEl.classList.remove('board-shake');
            void (boardEl as HTMLElement).offsetWidth;
            boardEl.classList.add('board-shake');
            setTimeout(() => boardEl.classList.remove('board-shake'), 500);
          }, delay);
        }
      }
    }
  }, [gameState?.last_animation_event]);

  const safeChains = useMemo(() => {
    const chains = new Set<string>();
    if (!gameState?.chain_sizes) return chains;
    for (const chain in gameState.chain_sizes) {
      if (gameState.chain_sizes[chain] >= 11) chains.add(chain);
    }
    return chains;
  }, [gameState?.chain_sizes]);

  // NEW: Track when a chain crosses into "safe" territory to trigger the animation
  const isInitialMount = useRef(true);
  const prevSafeChainsRef = useRef<Set<string>>(new Set());
  const [safeStampQueue, setSafeStampQueue] = useState<string[]>([]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevSafeChainsRef.current = new Set(safeChains);
      return;
    }

    const newSafeChains = Array.from(safeChains).filter(c => !prevSafeChainsRef.current.has(c));
    
    if (newSafeChains.length > 0) {
      setSafeStampQueue(prev => [...prev, ...newSafeChains]);
    }
    
    prevSafeChainsRef.current = new Set(safeChains);
  }, [safeChains]);

  useAnimationTrigger(".turn-phase-indicator", ["phase-pulse"], [gameState?.turn_phase]);

  useEffect(() => {
    if (!playerInfo) return;
    if (prevCashRef.current === undefined) {
      prevCashRef.current = playerInfo.cash;
      return;
    }
    const cashDelta = playerInfo.cash - prevCashRef.current;
    if (cashDelta !== 0 && !gameState.game_over) {
      setFloatingTexts(texts => [...texts, { id: Date.now(), amount: cashDelta, type: cashDelta > 0 ? 'gain' : 'cost' }]);
      animateById('player-cash-value', [cashDelta > 0 ? 'cash-change-up' : 'cash-change-down'], 1000);
    }
    prevCashRef.current = playerInfo.cash;
  }, [playerInfo?.cash, gameState.game_over]);

  const handleTextAnimationEnd = (id: number) => {
    setFloatingTexts(texts => texts.filter(text => text.id !== id));
  };

  const getTileClass = (cell: string | null, r: number, c: number): string => {
    const base = !cell ? "empty" : cell === "P" ? "tile-placed" : `chain-${cell.toLowerCase()}`;
    const safe = cell && safeChains.has(cell) ? "safe-chain" : "";
    const isValid = canPlace && validTiles.some(([vr, vc]) => vr === r && vc === c);
    let flashingClass = "";
    if (isValid) {
      if (isPlacingWild) { 
        flashingClass = "wild-valid";
      } else {
        const isMine = playerInfo?.tiles.some(([rr, cc]) => rr === r && cc === c);
        if (isMine) { 
          flashingClass = "tile-valid";
        }
      }
    }
    return [base, safe, flashingClass].filter(Boolean).join(" ");
  }

  const getConnectedClassNames = (r: number, c: number, cell: string | null): string => {
    if (!cell || cell === 'P') return '';
    const board = gameState.board;
    const classes: string[] = [];
    const numRows = board.length;
    const numCols = board[0].length;
    if (r > 0 && board[r - 1][c] === cell) classes.push('connected-top');
    if (r < numRows - 1 && board[r + 1][c] === cell) classes.push('connected-bottom');
    if (c > 0 && board[r][c - 1] === cell) classes.push('connected-left');
    if (c < numCols - 1 && board[r][c + 1] === cell) classes.push('connected-right');
    return classes.join(' ');
  };

  class ApiError extends Error {
    alreadyAlerted = true;
  }

  const handleApiCall = async (endpoint: string, body: object) => {
    setLoading(true);
    try {
        // FIX (trust model): attach this client's token to every mutating
        // call in one place rather than at each of the ~15 call sites, so
        // no action can accidentally be sent unauthenticated.
        const authedBody = { ...body, token: playerToken };
        const res = await fetch(`${apiUrl}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(authedBody),
        });

        if (!res.ok) {
            const data = await res.json();
            let errorMessage = "An unknown error occurred.";
            if (data.detail) {
                errorMessage = typeof data.detail === 'string' ? data.detail : (data.detail[0]?.msg || data.detail.msg || errorMessage);
            }
            alert(errorMessage);
            throw new ApiError(errorMessage);
        }

        // Apply the server's response immediately rather than waiting on the
        // WebSocket broadcast. The WS message may still arrive and update
        // other connected clients, but this client's own view no longer
        // depends on that message surviving a dropped/reconnecting socket.
        const data = await res.json();
        onGameStateUpdate(data);
    } catch (e: unknown) {
        if (e instanceof ApiError && e.alreadyAlerted) {
            throw e; // alert already shown, just re-raise
        }
        const errorMessage = e instanceof Error ? e.message : "A network error occurred.";
        alert(errorMessage);
        throw e;
    } finally {
        setLoading(false);
    }
  };

  const handleTileClick = (r: number, c: number) => {
    const isValid = validTiles.some(([vr, vc]) => vr === r && vc === c);
    if (!canPlace || loading || !isValid) return;

    let sourceSelector = '';
    let apiEndpoint = '';
    let apiBody = {};

    if (isPlacingWild) {
        sourceSelector = '#wild-tile-selector-button';
        apiEndpoint = "/place_wild_tile";
        apiBody = { player_name: playerName, row: r, col: c };
    } else {
        const isMine = playerInfo?.tiles.some(([rr, cc]) => rr === r && cc === c);
        if (!isMine) return;
        
        const label = `${String.fromCharCode(65 + r)}${c + 1}`;
        sourceSelector = `#tile-selector-${label}`;
        apiEndpoint = "/place_tile";
        apiBody = { player_name: playerName, row: r, col: c };
    }

    const targetSelector = `#tile-${r}-${c}`;
    const sourceEl = document.querySelector(sourceSelector) as HTMLElement;

    if (sourceEl) {
        sourceEl.style.visibility = 'hidden';
        animateTilePlacement(sourceSelector, targetSelector);

        setTimeout(async () => {
            try {
                await handleApiCall(apiEndpoint, apiBody);
                if (isPlacingWild) setIsPlacingWild(false);
            } catch (error) {
                sourceEl.style.visibility = 'visible';
            }
        }, 100);
    }
  };

  const tileRows = useMemo(() => {
    if (!gameState?.board) return null;
    return gameState.board.map((rowArr, r) => (
      <div key={r} className="board-row">
        {rowArr.map((cell, c) => {
          const id = `tile-${r}-${c}`;
          const label = `${String.fromCharCode(65 + r)}${c + 1}`;
          const connectedClasses = getConnectedClassNames(r, c, cell);
          
          const isMine = playerInfo?.tiles.some(([rr, cc]) => rr === r && cc === c);
          const isValid = validTiles.some(([vr, vc]) => vr === r && vc === c);
          const isDead = deadTiles.some(([dr, dc]) => dr === r && dc === c);
          
          const isUnplayable = isMine && canPlace && !isValid && !isDead;
          const isDeadTileMine = isMine && canPlace && isDead;
          
          const isDisabled = loading || !canPlace || (isPlacingWild ? !isValid : !isMine);
          
          const isLastPlaced = lastPlacedTile && lastPlacedTile[0] === r && lastPlacedTile[1] === c;

          const isCoveredByGrid = (() => {
            if (!cell || cell === "P") return false;
            const tbt = gameState.two_by_two_grids[cell];
            if (tbt && r >= tbt[0] && r <= tbt[0] + 1 && c >= tbt[1] && c <= tbt[1] + 1) return true;
            const fbo = gameState.four_by_one_grids[cell];
            if (fbo && r >= fbo[0] && r <= fbo[0] + 3 && c === fbo[1]) return true;
            return false;
          })();

          return (
            <div
              key={id}
              onMouseEnter={(e) => handleMouseEnter(e, cell, r, c)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ width: '60px', height: '60px', display: 'flex' }}
            >
              <button
                id={id}
                className={`tile-button ${getTileClass(cell, r, c)} ${connectedClasses}${(isMine && isValid && !isPlacingWild) ? " my-tile" : ""} ${isUnplayable ? "tile-unplayable" : ""} ${isDeadTileMine ? "tile-dead" : ""} ${isLastPlaced ? "last-placed-tile" : ""}`}
                disabled={isDisabled}
                onClick={() => handleTileClick(r,c)}
                style={{ width: '100%', height: '100%', pointerEvents: isDisabled ? 'none' : 'auto' }}
              >
                {!cell || cell === "P" ? label : (isCoveredByGrid ? null : <img src={`/images/hotel/${cell.toLowerCase()}.png`} alt={cell} className="tile-image" />)}
              </button>
            </div>
          );
        })}
      </div>
    ));
  },[gameState.board, playerInfo?.tiles, canPlace, loading, validTiles, deadTiles, safeChains, isPlacingWild, gameState.two_by_two_grids, gameState.four_by_one_grids, lastPlacedTile]);

  const renderTooltip = () => {
    if (!hoverData) return null;
    const { cell, r, c, x, y } = hoverData;
    const label = `${String.fromCharCode(65 + r)}${c + 1}`;

    let content;
    let bgColor = "rgba(0,0,0,0.85)";

    if (cell && cell !== "P" && HOTEL_COLORS[cell]) {
      bgColor = HOTEL_COLORS[cell];
      const size = gameState.chain_sizes[cell] || 0;
      const price = gameState.stock_prices[cell] || 0;
      const available = gameState.stock_counts[cell] || 0;

      const activeStocks = gameState.players.map(p => p.stocks?.[cell] || 0).filter(count => count > 0);
      const sorted = [...activeStocks].sort((a, b) => b - a);
      const top = sorted[0] || 0;
      const distinct = [...new Set(sorted)];
      const second = distinct[1] || 0;
      const majors = activeStocks.filter(count => count === top).length;
      const minors = activeStocks.filter(count => count === second).length;
      const isTiedMajor = majors > 1;
      const isTiedMinor = minors > 1;

      content = (
        <div className="custom-tile-tooltip-content">
          <div className="tooltip-col-left">
            <div className="tooltip-header">
              <img src={`/images/hotel/${cell.toLowerCase()}.png`} alt={cell} className="tooltip-logo" />
              <span>{cell}</span>
            </div>
            <div className="tooltip-stat"><strong>Length:</strong> {size}</div>
            <div className="tooltip-stat"><strong>Price:</strong> ${price}</div>
            <div className="tooltip-stat"><strong>Available:</strong> {available}</div>
          </div>
          <div className="tooltip-col-right"> 
            {gameState.players.map(p => {
              const owned = p.stocks?.[cell] || 0;
              let badges: React.ReactNode = null;
              if (owned > 0) {
                const isMajor = owned === top;
                const isMinor = !isMajor && owned === second;

                const goldIcon = <img src="/images/toasts/gold.png" alt="Majority" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;
                const silverIcon = <img src="/images/toasts/silver.png" alt="Minority" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />;

                if (isMajor && isTiedMajor) badges = <>{goldIcon}{silverIcon}</>;
                else if (isMajor && sorted.length === 1) badges = <>{goldIcon}{silverIcon}</>;
                else if (isMajor) badges = <>{goldIcon}</>;
                else if (isMinor && isTiedMinor) badges = <>{silverIcon}</>;
                else if (isMinor) badges = <>{silverIcon}</>;
              }
              return (
                <div key={p.name} className="tooltip-player-row">
                  <span className="tooltip-player-name">{truncateName(p.name)}</span>
                  <span className="tooltip-player-stock">
                    {owned > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {badges} {owned}
                      </span>
                    ) : "0"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    } else {
      content = <div className="tooltip-simple">{cell === "P" ? `Placed Tile ${label}` : `Empty Tile ${label}`}</div>;
    }

    if (!content) return null;

    const tooltipWidth = 420;
    const tooltipHeight = 250;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let adjustedX = x + 15;
    let adjustedY = y + 15;

    if (adjustedX + tooltipWidth > windowWidth) {
      adjustedX = x - tooltipWidth - 15;
    }
    if (adjustedY + tooltipHeight > windowHeight) {
      adjustedY = y - tooltipHeight - 15;
    }

    return (
      <div
        className="custom-tile-tooltip"
        style={{
          left: adjustedX,
          top: adjustedY,
          backgroundColor: bgColor
        }}
      >
        {content}
      </div>
    );
  };

  const isHost = gameState.players[0]?.name === playerName;

  // Every hook above this point runs unconditionally on every render, per
  // the Rules of Hooks. Only now, after all hooks have been called, do we
  // bail out to a placeholder if we don't have enough data to render the
  // real board yet. (Previously this check sat in the middle of the hook
  // list, which meant the number of hooks called could vary between
  // renders whenever `playerInfo` briefly went from defined to undefined
  // or back — undefined behavior in React that showed up as state updates
  // "sticking" until some unrelated re-render happened to paper over it.)
  if (!gameState || !playerInfo) {
    return <div className="gameboard-container">Loading game data…</div>;
  }

  return (
    <>
      {renderTooltip()}
 
      <div className={`game-container ${gameState.game_over ? 'game-over-layout' : ''}`}> 
        {myTurn && !gameState.game_over && (
          <div className="your-turn-animation-container">
            <img src="/images/yourturn.png" alt="Your Turn!" className="your-turn-image your-turn-image-1" />
            <img src="/images/yourturn2.png" alt="Your Turn!" className="your-turn-image your-turn-image-2" />
          </div>
        )}    
        
        {gameState.game_over && (
          <div className="game-over-animation-container">
            <img src="/images/gameover_right.png" alt="Game Over" className="game-over-image game-over-image-1" />
            <img src="/images/gameover_left.png" alt="Game Over" className="game-over-image game-over-image-2" />
          </div>
        )}
        
        <div className="left-panel">
            {!gameState.game_over && (
              <PlayerBanner 
                  myTurn={myTurn}
                  gameState={gameState}
                  playerInfo={playerInfo}
                  floatingTexts={floatingTexts}
                  onTextAnimationEnd={handleTextAnimationEnd}
              />
            )}
            <div className="board-container">
                <div className="board-grid">{tileRows}</div>
                
                {Object.entries(gameState.two_by_two_grids).map(([chain, [r, c]]) => (
                <img
                    key={`${chain}-2x2`}
                    src={`/images/hotel/${chain.toLowerCase()}2.png`}
                    alt={`${chain} 2x2`}
                    className="two-by-two-image"
                    style={{
                      top: `${r * 60 + 5.5}px`,
                      left: `${c * 60 + 5.5}px`,
                    }}
                />
                ))}

                {Object.entries(gameState.four_by_one_grids).map(([chain, [r, c]]) => (
                <img
                    key={`${chain}-4x1`}
                    src={`/images/hotel/${chain.toLowerCase()}4.png`}
                    alt={`${chain} 4x1`}
                    className="four-by-one-image"
                    style={{
                      top: `${r * 60 + 5.5}px`,
                      left: `${c * 60 + 5.5}px`,
                    }}
                />
                ))}
                {/* NEW: Play stamp animations from the queue one at a time */}
                {safeStampQueue.length > 0 && (
                  <SafeStampAnimation
                    key={safeStampQueue[0]} 
                    onComplete={() => setSafeStampQueue(prev => prev.slice(1))}
                  />
                )}
            </div> 

            {!gameState.game_over && (
              <div className="action-buttons-container"> 
                  <TileSelector 
                      tiles={playerInfo.tiles}  
                      hasWildTile={playerInfo.has_wild_tile} 
                      stocks={playerInfo.stocks} // <-- ADD THIS LINE
                      isPlacingWild={isPlacingWild} 
                      onToggleWildPlacement={() => setIsPlacingWild(!isPlacingWild)} 
                      canPlaceTile={canPlace} 
                      loading={loading}  
                      playableTiles={playableTilesInHand}
                      deadTiles={deadTiles} // <-- NEW
                      onDiscardAndDraw={() => handleApiCall("/discard_and_draw", { player_name: playerName })}
                      onSkipPlacement={() => handleApiCall("/end_tile_placement", { player_name: playerName })}
                      canPlace={canPlace}
                  />
              </div> 
            )}
            
            {gameState.game_over && (
              <StockLiquidationTable 
                gameState={gameState} 
                animationPhase={animationPhase} 
              />
            )}
        </div>

        <div className="right-panel">
            <ReferencePanel
                gameState={gameState}
                animationPhase={animationPhase}
                setAnimationPhase={setAnimationPhase}
                showBackground={showBackground}
                onToggleBackground={onToggleBackground} 
                onNextBackground={onNextBackground}
            />
        </div>
      </div>

      <div className="powers-panel">
        {gameState.game_over ? (
          <GameSummaryPanel
            gameState={gameState}
            animationPhase={animationPhase}
            setAnimationPhase={setAnimationPhase}
            isHost={isHost}
            onReset={onReset}
          />
        ) : (
          <>
            {specialPowersVariantActive && (
              <SpecialPowersPanel
                  playerPowers={playerInfo.special_powers}
                  isMyTurn={myTurn}
                  powerUsedThisTurn={gameState.power_used_this_turn}
                  onUsePower={(power) => handleApiCall("/use_special_power", { player_name: playerName, power: power })}
              />
            )}
          </>
        )}
      </div>

      {!gameState.game_over && (
         <GameLog 
             logEntries={gameState.formatted_log} 
             players={gameState.players} 
         />
      )}
      
      <AnimatePresence>
        {myTurn && gameState.turn_phase === "choose_chain" && (
          <ChainChoiceModal
            key="modal-choose-chain"  
            isOpen
            onSelect={(chain) => handleApiCall("/choose_chain", { player_name: playerName, chain })}
            availableChains={gameState.available_chains}
          />
        )}

        {myTurn && gameState.turn_phase === "choose_defunct" && (
          <ChainChoiceModal
            key="modal-choose-defunct"  
            isOpen
            title="Resolution Order"
            bannerImage="/images/banner/resolution.png"
            onSelect={(chain) => handleApiCall("/choose_defunct", { player_name: playerName, chain })}
            availableChains={gameState.available_chains}
          />
        )}
        
        {myTurn && gameState.turn_phase === "choose_merger" && gameState.pending_merger_choice?.options && (
          <MergerChoiceModal
            key="modal-choose-merger"  
            onSelect={(chain) => handleApiCall("/choose_merger", { player_name: playerName, chain })}
            options={gameState.pending_merger_choice.options}
          />
        )}

        {isStockModalVisible && (
          <motion.div
            key="modal-stock-purchase"  
            className="floating-panel modal-backdrop-bottom-right"
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <div className="stock-modal-container">
              <StockPurchase
                activeChains={gameState.active_chains}
                stockPrices={gameState.stock_prices}
                stockCounts={gameState.stock_counts}
                onBuyStock={(chain, quantity) => handleApiCall("/buy_stock", { player_name: playerName, chain, quantity })}
                loading={loading}
                playerCash={playerInfo.cash}
                gameState={gameState}
              >
                <div className="endturn-button-container">
                  {gameState.can_undo_placement && (
                    <button
                      className="button-primary button-undo" 
                      onClick={() => handleApiCall("/undo_tile_placement", { player_name: playerName })}
                      disabled={loading}
                    >
                      Undo Placement
                    </button>
                  )}
                  <button
                    className="button-primary button-end-turn"
                    onClick={handleEndTurn}
                    disabled={loading}
                  >
                    End Turn
                  </button>
                  {gameState.is_end_game_possible && myTurn && (
                    <button
                      className="button-primary button-end-game" 
                      onClick={() => handleApiCall("/request_end_game", { player_name: playerName })}
                      disabled={loading}
                    >
                      End Game
                    </button>
                  )}
                </div>
              </StockPurchase>
            </div>
          </motion.div>
        )}
        
        {myTurn && gameState.turn_phase === 'trade_stocks_power' && (
          <TradeStockPowerModal
            key="modal-trade-stocks-power" // <-- ADD KEY
            gameState={gameState}
            playerName={playerName}
            onTrade={(chainFrom, chainTo) => handleApiCall("/trade_stock_power", { player_name: playerName, chain_from: chainFrom, chain_to: chainTo })}
            onEndTrading={() => handleApiCall("/end_power_trade", { player_name: playerName })}
            loading={loading}
          />
        )}

        {gameState.turn_phase === "trade_stocks" && !!gameState.pending_stock_resolution && (
          <MergerResolutionModal
            key="modal-trade-stocks" // <-- ADD KEY
            mergerData={gameState.pending_stock_resolution ?? {}}
            playerInfo={playerInfo}
            stockCounts={gameState.stock_counts}
            onConfirm={(decisions) => handleApiCall("/resolve_merger_stocks", { player_name: playerName, decisions })}
            loading={loading}
            playerName={playerName}
          />
        )}
      </AnimatePresence>
    </>
  );
};


