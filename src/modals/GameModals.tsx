// src/modal/GameModals.tsx
import { m, AnimatePresence } from "motion/react";
import ChainChoiceModal from "./ChainChoiceModal";
import MergerChoiceModal from "./MergerChoiceModal";
import StockPurchase from "./StockPurchase";
import { TradeStockPowerModal } from "./TradeStockPowerModal";
import MergerResolutionModal from "./MergerResolutionModal";
import { GameState, Player } from "../types";

interface GameModalsProps {
  gameState: GameState;
  myTurn: boolean;
  playerName: string;
  playerInfo: Player;
  loading: boolean;
  isStockModalVisible: boolean;
  onApiCall: (endpoint: string, body: object) => Promise<void>;
  onEndTurn: () => void;
}
 
function GameModals({
  gameState,
  myTurn,
  playerName,
  playerInfo,
  loading,
  isStockModalVisible,
  onApiCall,
  onEndTurn,
}: GameModalsProps) {
  return (
    <AnimatePresence>
      {myTurn && gameState.turn_phase === "choose_chain" && (
        <ChainChoiceModal
          key="modal-choose-chain"
          isOpen
          onSelect={(chain) => onApiCall("/choose_chain", { player_name: playerName, chain })}
          availableChains={gameState.available_chains}
        />
      )}

      {myTurn && gameState.turn_phase === "choose_defunct" && (
        <ChainChoiceModal
          key="modal-choose-defunct"
          isOpen
          title="Resolution Order"
          bannerImage="/images/banner/resolution.webp"
          onSelect={(chain) => onApiCall("/choose_defunct", { player_name: playerName, chain })}
          availableChains={gameState.available_chains}
        />
      )}

      {myTurn && gameState.turn_phase === "choose_merger" && gameState.pending_merger_choice?.options && (
        <MergerChoiceModal
          key="modal-choose-merger"
          onSelect={(chain) => onApiCall("/choose_merger", { player_name: playerName, chain })}
          options={gameState.pending_merger_choice.options}
        />
      )}

      {isStockModalVisible && (
        <m.div
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
              onBuyStock={(chain, quantity) => onApiCall("/buy_stock", { player_name: playerName, chain, quantity })}
              loading={loading}
              playerCash={playerInfo.cash}
              gameState={gameState}
            >
              <div className="endturn-button-container">
                {gameState.can_undo_placement && (
                  <button
                    className="button-primary button-undo"
                    onClick={() => onApiCall("/undo_tile_placement", { player_name: playerName })}
                    disabled={loading}
                  >
                    Undo Placement
                  </button>
                )}
                <button
                  className="button-primary button-end-turn"
                  onClick={onEndTurn}
                  disabled={loading}
                >
                  End Turn
                </button>
                {gameState.is_end_game_possible && myTurn && (
                  <button
                    className="button-primary button-end-game"
                    onClick={() => onApiCall("/request_end_game", { player_name: playerName })}
                    disabled={loading}
                  >
                    End Game
                  </button>
                )}
              </div>
            </StockPurchase>
          </div>
        </m.div>
      )}

      {myTurn && gameState.turn_phase === 'trade_stocks_power' && (
        <TradeStockPowerModal
          key="modal-trade-stocks-power"
          gameState={gameState}
          playerName={playerName}
          onTrade={(chainFrom, chainTo) => onApiCall("/trade_stock_power", { player_name: playerName, chain_from: chainFrom, chain_to: chainTo })}
          onEndTrading={() => onApiCall("/end_power_trade", { player_name: playerName })}
          loading={loading}
        />
      )}

      {gameState.turn_phase === "trade_stocks" && !!gameState.pending_stock_resolution && (
        <MergerResolutionModal
          key="modal-trade-stocks"
          mergerData={gameState.pending_stock_resolution ?? {}}
          playerInfo={playerInfo}
          stockCounts={gameState.stock_counts}
          onConfirm={(decisions) => onApiCall("/resolve_merger_stocks", { player_name: playerName, decisions })}
          loading={loading}
          playerName={playerName}
        />
      )}
    </AnimatePresence>
  );
}

export default GameModals;
