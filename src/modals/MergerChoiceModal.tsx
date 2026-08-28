// src/modal/MergerChoiceModal.tsx
import { useState } from "react";
import { m } from "motion/react";
import { HOTEL_COLORS } from "../utils/constants";
import "../styles/ChainChoiceModal.css";

interface MergerChoiceModalProps {
  options: string[];
  onSelect: (chain: string) => void;
}

export default function MergerChoiceModal({ options, onSelect }: MergerChoiceModalProps) {
  const [selectedChain, setSelectedChain] = useState<string>("");

  const handleConfirm = () => {
    if (selectedChain) {
      onSelect(selectedChain);
    }
  };

return (
    <m.div 
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <m.div 
        className="chain-choice-modal"
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="panel-banner-container">
          <img src="/images/banner/mergechain.webp" alt="Choose Surviving Chain" className="panel-title-image" />
          <h2 className="panel-title-overlay">Surviving Chain</h2>
        </div>

        <div className="merger-options-grid">
          {options.map((chain) => {
            const isSelected = selectedChain === chain;
            return (
              <button
                type="button"
                key={chain}
                className="merger-option"
                aria-pressed={isSelected}
                onClick={() => setSelectedChain(chain)}
                style={{
                  backgroundColor: HOTEL_COLORS[chain] || "#007BFF",
                  boxShadow: isSelected 
                    ? "0 0 20px 5px #ffd700, 0 0 10px 2px white" 
                    : "0 4px 6px rgba(0,0,0,0.3)",
                  transform: isSelected ? "scale(1.1)" : "scale(1)",
                  border: isSelected ? "2px solid white" : "2px solid transparent",
                  zIndex: isSelected ? 2 : 1,
                }}
              >
                <img
                  src={`/images/hotel/${chain.toLowerCase()}.webp`}
                  alt={chain}
                  className="merger-chain-logo"
                />
                <span className="merger-chain-name">{chain}</span>
              </button>
            );
          })}
        </div>

        <button
          className="button-primary button-merge"
          onClick={handleConfirm}
          disabled={!selectedChain}
          style={{ marginTop: '15px' }}
        >
          Confirm Survivor
        </button>
      </m.div>
    </m.div>
  );
}

