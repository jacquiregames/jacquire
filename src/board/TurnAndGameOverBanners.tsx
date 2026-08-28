// src/board/TurnAndGameOverBanners.tsx

interface TurnAndGameOverBannersProps {
  myTurn: boolean;
  gameOver: boolean;
}

function TurnAndGameOverBanners({ myTurn, gameOver }: TurnAndGameOverBannersProps) {
  if (gameOver) {
    return (
      <div className="game-over-animation-container">
        <img src="/images/gameover/gameover_right.webp" alt="Game Over" className="game-over-image game-over-image-1" />
        <img src="/images/gameover/gameover_left.webp" alt="Game Over" className="game-over-image game-over-image-2" />
      </div>
    );
  }

  if (myTurn) {
    return (
      <div className="your-turn-animation-container">
        <img src="/images/yourturn/yourturn_left.webp" alt="Your Turn!" className="your-turn-image your-turn-image-1" />
        <img src="/images/yourturn/yourturn_right.webp" alt="Your Turn!" className="your-turn-image your-turn-image-2" />
      </div>
    );
  }

  return null;
}

export default TurnAndGameOverBanners;
