// src/HowToPlay.tsx
import { FC } from "react";
import { createPortal } from "react-dom";
import "./styles/HowToPlay.css";

interface HowToPlayProps {
  show: boolean;
  onClose: () => void;
}

const HowToPlay: FC<HowToPlayProps> = ({ show, onClose }) => {
  if (!show) {
    return null;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h1 className="how-to-play-heading">How to Play jAcquire</h1>
          <button className="modal-close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <article className="how-to-play-content">
            <div className="how-to-play-columns">

              {/* COLUMN 1 */}
              <div className="how-to-play-column">
                <section className="how-to-play-section">
                  <h2 className="how-to-play-subheading">🔄 Turn</h2>
                  <ul>
                    <li><strong>Place 1 tile:</strong> start, expand, or merge chains</li>
                    <li><strong>Buy</strong> up to 3 shares of any active chains.</li>
                    <li><strong>Draw</strong> a replacement tile.</li>
                  </ul>
                </section>
                <section className="how-to-play-section">
                  <h2 className="how-to-play-subheading">🏗️ Founding a Chain <img src="/images/cards/founded.png" className="founded"/> </h2> 
                  <ul>
                    <li><strong>Place a tile adjacent to an unassociated tile on the board.</strong></li>
                    <li>Choose an available hotel chain.</li>
                    <li><strong>Founder's Bonus: </strong>Receive 1 free bonus share of the new chain!</li>
                  </ul>
                </section>
                <section className="how-to-play-section">
                  <div className="how-to-play-stocks-header"> 
                    <h2 className="how-to-play-subheading how-to-play-stocks-title">💵 Stocks/Shares</h2>
                    <div className="how-to-play-stocks-cards">
                      {["luxor", "tower", "american", "festival", "worldwide", "continental", "imperial"].map((chain) => (
                        <img 
                          key={chain}
                          src={`/images/cards/card_${chain}.png`} 
                          alt={chain} 
                          title={chain}
                          className="how-to-play-stock-card"
                        />
                      ))}
                    </div>
                  </div>
                  <ul>
                    <li><strong> Stock Price is based on the Hotel Chain's current size.</strong> </li>
                    <li>25 Total Shares exist per Hotel.</li>
                    <li><strong>Only Active Hotel Shares can be purchased.</strong></li>
                    <li>
                      You cannot sell shares during a normal turn (only during mergers or
                      at game end).
                    </li>
                  </ul>
                </section>              
              </div>

              {/* COLUMN 2 */}
              <div className="how-to-play-column">
                <section className="how-to-play-section">
                  <h2 className="how-to-play-subheading">🏨 Mergers</h2>
                  <ul>
                    <li><strong>Connecting two or more chains causes a merger.</strong></li>
                    <li>The Largest Chain survives and jAcquires the Smaller Chain(s).</li>
                    <li><strong>Chains with 11+ tiles are "Safe" and cannot be jAcquired.</strong> </li>
                    <li>A tile that would merge two Safe chains is dead and unplayable. </li>                    
                    <li>
                      <strong>Survivor Ties:</strong> If the largest merging chains are tied 
                      in size, the player who placed the merging tile decides the survivor.
                    </li>
                    <li>
                      <strong>Multiple Acquisitions:</strong> If a chain jAcquires 2 or more 
                      hotels at the same time, the largest defunct chain is resolved first. 
                    </li>
                    <li>                      
                      If defunct chains are tied in size, the player who caused the merger 
                      chooses the resolution order.
                    </li>
                    <li>
                      Majority Bonus paid to Top Shareholder(s) of the defunct chain.
                    </li>
                    <li>Minority Bonus paid to Second Highest Shareholder(s).</li>
                    <li>
                      <strong> Defunct Stock Actions:</strong>  Hold, Sell, or Trade (2 defunct for 1
                      survivor).
                    </li>
                  </ul>
                </section>
              </div>

              {/* COLUMN 3 */}
              <div className="how-to-play-column">
                <section className="how-to-play-section">
                  <h2 className="how-to-play-subheading">⏳ Game Ending Conditions</h2>
                  <ul>
                    <li>A player may declare the game over during their turn if:</li>
                    <li><strong>Any Active Hotel Chain reaches 41+ tiles</strong></li>
                    <li>OR</li>
                    <li><strong>All Active Hotel Chains are Safe</strong></li>
                  </ul>
                </section>

                <section className="how-to-play-section">
                  <h2 className="how-to-play-subheading">💰 Final Scoring</h2>
                  <ul>
                    <li>
                      Majority &amp; Minority Bonuses are paid out for all Active Chains.
                    </li>
                    <li>
                      All shares are liquidated at their Final Stock Price.
                    </li>
                    <li>The Wealthiest Player Wins!</li>
                  </ul>
                  <img src="/images/cards/list.png" className="hotel-list" />
                </section>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HowToPlay;
