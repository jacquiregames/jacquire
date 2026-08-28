// src/modal/ChainChoiceModal.tsx
import { useState } from "react";
import { m } from "motion/react";
import { triggerChainConfetti } from "../hooks/useChainConfetti";
import "../styles/ChainChoiceModal.css"; 
import "../styles/shared-panels.css";

interface ChainChoiceModalProps {
  isOpen: boolean;
  availableChains: { name: string; color?: string }[];
  onSelect: (chain: string) => void;
  title?: string;          // NEW
  bannerImage?: string;    // NEW
}

export default function ChainChoiceModal({ 
  availableChains, 
  onSelect,
  title = "Choose New Chain", 
  bannerImage = "/images/banner/newchain.webp" 
}: ChainChoiceModalProps) {
  const [selectedChain, setSelectedChain] = useState<string>("");

  const handleChoose = () => {
    if (selectedChain) onSelect(selectedChain);
    triggerChainConfetti(selectedChain);
  };
 
  return (
    <m.div 
      className="floating-panel modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <m.div 
        className="chain-choice-modal"
        initial={{ opacity: 0, scale: 0.8, rotateX: -10 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <div className="panel-banner-container panel-banner-container--chain-choice">
          <img src={bannerImage} alt={title} className="panel-title-image" />
          <h2 className="panel-title-overlay panel-title-overlay--chain-choice">{title}</h2>
        </div>
        
        <div className="merger-options-grid">
          {availableChains.map(({ name, color }) => {
            const isSelected = selectedChain === name;
            return (
              <div
                key={name}
                className="merger-option"
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelectedChain(name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedChain(name);
                  }
                }}
                style={{
                  backgroundColor: color || "#ccc",
                  // Change: Glow instead of background color change
                  boxShadow: isSelected 
                    ? "0 0 20px 5px #ffd700, 0 0 10px 2px white" // Gold glow
                    : "0 4px 6px rgba(0,0,0,0.3)",
                  transform: isSelected ? "scale(1.1)" : "scale(1)",
                  border: isSelected ? "2px solid black" : "2px solid transparent",
                  zIndex: isSelected ? 2 : 1,
                }}
              >
                <img
                  src={`/images/hotel/${name.toLowerCase()}.webp`}
                  alt={name}
                  className="merger-chain-logo"
                />
                <div className="merger-chain-name">{name}</div>
              </div>
            );
          })}
        </div>
        <button
          className="button-primary button-choose"
          onClick={handleChoose}
          disabled={!selectedChain}
        >
          Choose Chain
        </button>
      </m.div>
    </m.div>
  );
}

