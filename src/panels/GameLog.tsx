// src/panels/GameLog.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import '../styles/GameLog.css';
import '../styles/shared-panels.css';
import { Player } from '../types';
import { getColorObject } from '../utils/playerColors';
import { truncateName } from '../utils/uiHelpers';
import { HOTEL_CHAINS, HOTEL_COLORS } from '../utils/constants';

interface GameLogProps {
  logEntries: string[];
  players: Player[];
}

// Map icon keys to their image paths
const LOG_ICON_MAP: Record<string, string> = {
  "b5": "/images/variant/b5.webp",
  "f3": "/images/variant/f3.webp",
  "p4": "/images/variant/p4.webp",
  "t5": "/images/variant/t5.webp",
  "t2": "/images/variant/t2.webp",
  "wildtile": "/images/variant/wildtile.webp",
};

const parseLogMessage = (message: string) => {
  const lines = message.split('\n');
  
  return lines.map((line, lineIndex) => {
    if (!line.trim()) {
      return <div key={lineIndex} className="log-line-spacer"></div>;
    }

    const parts = line.split(/(\[\[.*?\]\])/g);
    
    const parsedLine = parts.filter(part => part).map((part, index) => {
      if (part.startsWith('[[ICON:')) {
        // It's a special icon (power or wild tile)
        const iconKey = part.substring(7, part.length - 2); 
        const iconSrc = LOG_ICON_MAP[iconKey];
        if (iconSrc) {
          return (
            <img
              key={index}
              src={iconSrc}
              alt={iconKey}
              className="log-icon"
            />
          );
        }
      } else if (part.startsWith('[[LOGO:')) {
        const chainName = part.substring(7, part.length - 2);
        return (
          <span key={index} className="log-chain-tag">
            <img
              src={`/images/banner/${chainName.toLowerCase()}_logo.webp`}
              alt={chainName}
              title={chainName}
              className="log-chain-logo-inline"
            />
          </span>
        );
      } else if (part === '[[JACQUIRED]]') {
        return (
          <span key={index} className="log-chain-tag">
            <img
              src="/images/banner/jacquired.webp"
              alt="jAcquired"
              className="log-jacquired-inline"
            />
          </span>
        );
      } else if (part.startsWith('[[CARD:')) {
        const chainName = part.substring(7, part.length - 2);
        return (
          <span key={index} className="log-chain-tag">
            <img
              src={`/images/cards/card_${chainName.toLowerCase()}.webp`}
              alt={`${chainName} Stock`}
              title={`${chainName} Stock`}
              className="log-stock-card-inline"
            />
          </span>
        );
      } else if (part.startsWith('[[')) {
        // It's a hotel chain name
        const chainName = part.substring(2, part.length - 2);
        return (
          <span key={index} className="log-chain-tag">
            {chainName}
          </span>
        );
      }
      // It's a regular text part
      return <span key={index}>{part}</span>;
    });

    let lineClass = "log-line-standard";
    if (lineIndex === 0 && lines.length > 1) {
      lineClass = "log-line-header";
    } else if (line.includes('Resolution:')) {
      lineClass = "log-line-header";
    }
    
    if (line.trim().startsWith('►')) {
      lineClass = "log-line-bullet";
    }

    return (
      <div key={lineIndex} className={lineClass}>
        {parsedLine}
      </div>
    );
  });
};

// Extracts an exact semantic class based on the text action
const getLogEntryClass = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes('used special power')) return 'log-action-special-power';
  if (lower.includes('wild tile')) return 'log-action-wild-tile';
  if (lower.includes('founded')) return 'log-action-founded';
  if (lower.includes('expanded')) return 'log-action-expanded';
  if (lower.includes('purchased')) return 'log-action-purchased';
  if (lower.includes('is now safe')) return 'log-action-safe';
  if (lower.includes('to resolve first')) return 'log-action-defunct-choice';
  if (lower.includes('survivor')) return 'log-action-survivor';
  if (lower.includes('jacquired')) return 'log-action-merger';
  if (lower.includes('majority')) return 'log-action-bonus-majority';
  if (lower.includes('minority shareholder bonus')) return 'log-action-bonus-minority';
  if (lower.includes('resolution:')) return 'log-action-resolution';
  if (lower.includes('undid')) return 'log-action-undo';
  if (lower.includes('defunct tile') || lower.includes('discarded') || lower.includes('skip')) return 'log-action-discard';
  if (lower.includes('sold') || lower.includes('liquidated')) return 'log-action-sold';
  if (lower.includes('traded')) return 'log-action-traded';
  if (lower.includes('held')) return 'log-action-held';
  return 'log-action-default';
};

export const GameLog: React.FC<GameLogProps> = ({ logEntries, players }) => {
  const logPanelRef = useRef<HTMLDivElement>(null);
  
  const playerColorMap = useMemo(() => {
    return (players || []).reduce((acc, player) => {
      acc[player.name] = player.color;
      return acc;
    }, {} as Record<string, string>);
  }, [players]);

  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logEntries]);
  
  return (
    <div className="floating-panel game-log-container">
      <div className="game-log-panel"> 
        <div className="game-log-banner-item">
          <img src="/images/gamelog/gamelog.webp" alt="Game Log" />
        </div>

        <div className="game-log-scroll-area" ref={logPanelRef}>
          <ul>
            {logEntries.map((entry, index) => {
              if (entry.startsWith("Turn")) { 
                const match = entry.match(/Turn (\d+): (.+?) - ([A-Z]\d+)(.*)/);
                if (match) {
                  const [, turn, playerName, tile, rest] = match;
                  const playerColor = playerColorMap[playerName] || '#ffffff';
                  const playerColorObject = getColorObject(playerColor);
                  const background = playerColorObject?.gradient || playerColor; 
                  return (
                    <li 
                      key={index} 
                      className="game-log-turn-header game-log-turn-header--player" 
                      style={{ background }}
                    >
                      <span>Turn {turn}: </span>
                      <b>{truncateName(playerName)}</b> 
                      <span> - {tile}</span>
                      {rest && rest.includes('ICON:wildtile') && (
                        <img 
                          src={LOG_ICON_MAP["wildtile"]} 
                          alt="Wild Tile" 
                          className="log-icon" 
                          style={{ marginLeft: '4px' }}
                        />
                      )}
                    </li>
                  );
                }
                return <li key={index} className="game-log-turn-header">{entry}</li>;
              }
              
              const entryClass = getLogEntryClass(entry);
              let primaryChain = "";

              // Find the first valid hotel to extract its color
              const matches = [...entry.matchAll(/\[\[(.*?)\]\]/g)];
              for (const match of matches) {
                let chainName = match[1];
                if (chainName.startsWith('LOGO:')) {
                  chainName = chainName.substring(5);
                } else if (chainName.startsWith('CARD:')) {
                  chainName = chainName.substring(5);
                }
                if (!chainName.startsWith('ICON:') && chainName !== 'JACQUIRED' && HOTEL_CHAINS.includes(chainName as any)) {
                  primaryChain = chainName;
                  break; 
                }
              }

              // Build dynamic CSS variable for the hotel color
              const chainColor = primaryChain ? HOTEL_COLORS[primaryChain] : undefined;
              const dynamicStyle = chainColor ? { '--chain-theme': chainColor } as React.CSSProperties : {};

              return (
                <li key={index} className={`log-entry ${entryClass}`} style={dynamicStyle}>
                  {(entryClass === 'log-action-founded' || 
                    entryClass === 'log-action-purchased' || 
                    entryClass === 'log-action-expanded' || 
                    entryClass === 'log-action-survivor' || 
                    entryClass === 'log-action-defunct-choice') && primaryChain && (
                    <div className="log-side-logo-container">
                      <img 
                        src={`/images/hotel/${primaryChain.toLowerCase()}.webp`}
                        alt={primaryChain} 
                        className="log-side-logo" 
                      />
                    </div>
                  )}
                  <div className="log-entry-content-wrapper">
                    {parseLogMessage(entry)}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};