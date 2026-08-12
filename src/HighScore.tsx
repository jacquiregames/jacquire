import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './styles/HighScore.css';
import './styles/shared-panels.css';

interface ScoreEntry {
  name: string;
  score: number;
  players: number;
}

export default function HighScore({ apiUrl }: { apiUrl: string }) {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [currentPlayerCount, setCurrentPlayerCount] = useState<number>(2);

  useEffect(() => {
    axios.get(`${apiUrl}/highscores`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setScores(res.data);
        }
      })
      .catch(err => console.error("Error fetching high scores:", err));
  }, [apiUrl]);

  useEffect(() => {
    if (scores.length === 0) return;
    const interval = setInterval(() => {
      setCurrentPlayerCount(prev => (prev >= 6 ? 2 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [scores.length]);

  const displayScores = useMemo(() => {
    const filtered = scores.filter(s => s.players === currentPlayerCount);
    return filtered.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [scores, currentPlayerCount]);

  if (scores.length === 0) return null;

  const formatUSD = (val: number) =>
    val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  return (
    <div className="floating-panel highscore-container">
      <div className="highscore-glow-wrap">
        <div className="highscore-panel">
          {/* Scanner animation */}
          <div className="scanner-line" />
          
          {/* Title */}
          <div className="highscore-title">HIGH SCORES [{currentPlayerCount}P]</div>

          {/* Leaderboard rows */}
          <div>
            {displayScores.length > 0 ? (
              displayScores.map((entry, idx) => (
                <div 
                  className="score-row" 
                  key={`${currentPlayerCount}-${idx}`}
                  style={{ animationDelay: `${idx * 0.15}s` }}
                >
                  <div className="rank-badge">{idx + 1}</div>
                  
                  <div className="score-info">
                    <div className="score-value">{formatUSD(entry.score)}</div>
                    <div className="player-name">{entry.name}</div>
                  </div>

                  {/* Status indicator */}
                  <div className="flex-indicator">
                    <div className="pulse-dot" />
                  </div>
                </div>
              ))
            ) : (
              <div className="score-row" key={`empty-${currentPlayerCount}`}>
                <div className="score-info" style={{ textAlign: 'center', opacity: 0.5 }}>
                   <div className="player-name">NO RECORDS FOUND</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}