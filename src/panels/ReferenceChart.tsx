// src/panels/ReferenceChart.tsx
import React from "react";
import "../styles/ReferenceChart.css";

const formatUSD = (num: number): string =>
  num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

export const ReferenceChart: React.FC = () => {
  return (
    <div className="reference-chart-container">
      <table className="reference-chart">
        <thead>
          <tr>
            <th className="border-bottom-none"></th>
            <th className="stock-name-cell border-bottom-none" data-stock="festival">
              <img
                src="/images/hotel/festival.webp"
                alt="Festival"
                title="Festival"
                className="stock-icon"
              />
              Festival
            </th>
            <th className="border-bottom-none"></th>
            <th className="border-bottom-none"></th>
            <th colSpan={2} className="border-bottom-none">Shareholder</th>
          </tr>
          <tr>
            <th className="stock-name-cell border-bottom-none border-top-none" data-stock="tower">
              <img
                src="/images/hotel/tower.webp"
                alt="Tower"
                title="Tower"
                className="stock-icon"
              />
              Tower
            </th>
            <th className="stock-name-cell border-bottom-none border-top-none" data-stock="worldwide">
              <img
                src="/images/hotel/worldwide.webp"
                alt="Worldwide"
                title="Worldwide"
                className="stock-icon"
              />
              Worldwide
            </th>
            <th className="stock-name-cell border-bottom-none border-top-none" data-stock="continental">
              <img
                src="/images/hotel/continental.webp"
                alt="Continental"
                title="Continental"
                className="stock-icon"
              />
              Continental
            </th>
            <th className="border-bottom-none border-top-none">Stock</th>
            <th colSpan={2} className="border-bottom-none border-top-none">Bonus</th>
          </tr>
          <tr>
            <th className="stock-name-cell border-top-none" data-stock="luxor">
              <img
                src="/images/hotel/luxor.webp"
                alt="Luxor"
                title="Luxor"
                className="stock-icon"
              />
              Luxor
            </th>
            <th className="stock-name-cell border-top-none" data-stock="american">
              <img
                src="/images/hotel/american.webp"
                alt="American"
                title="American"
                className="stock-icon"
              />
              American
            </th>
            <th className="stock-name-cell border-top-none" data-stock="imperial">
              <img
                src="/images/hotel/imperial.webp"
                alt="Imperial"
                title="Imperial"
                className="stock-icon"
              />
              Imperial
            </th>
            <th className="border-top-none">Price</th>
            <th className="border-top-none">Majority</th>
            <th className="border-top-none">Minority</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2 *</td>
            <td>_</td>
            <td>_</td>
            <td>{formatUSD(200)}</td>
            <td>{formatUSD(2000)}</td>
            <td>{formatUSD(1000)}</td>
          </tr>
          <tr>
            <td>3</td>
            <td>2</td>
            <td>_</td>
            <td>{formatUSD(300)}</td>
            <td>{formatUSD(3000)}</td>
            <td>{formatUSD(1500)}</td>
          </tr>
          <tr>
            <td>4</td>
            <td>3</td>
            <td>2</td>
            <td>{formatUSD(400)}</td>
            <td>{formatUSD(4000)}</td>
            <td>{formatUSD(2000)}</td>
          </tr>
          <tr>
            <td>5</td>
            <td>4</td>
            <td>3</td>
            <td>{formatUSD(500)}</td>
            <td>{formatUSD(5000)}</td>
            <td>{formatUSD(2500)}</td>
          </tr>
          <tr>
            <td>(6–10)</td>
            <td>5</td>
            <td>4</td>
            <td>{formatUSD(600)}</td>
            <td>{formatUSD(6000)}</td>
            <td>{formatUSD(3000)}</td>
          </tr>
          <tr>
            <td>(11–20)</td>
            <td>(6–10)</td>
            <td>5</td>
            <td>{formatUSD(700)}</td>
            <td>{formatUSD(7000)}</td>
            <td>{formatUSD(3500)}</td>
          </tr>
          <tr>
            <td>(21–30)</td>
            <td>(11–20)</td>
            <td>(6–10)</td>
            <td>{formatUSD(800)}</td>
            <td>{formatUSD(8000)}</td>
            <td>{formatUSD(4000)}</td>
          </tr>
          <tr>
            <td>(31–40)</td>
            <td>(21-30)</td>
            <td>(11–20)</td>
            <td>{formatUSD(900)}</td>
            <td>{formatUSD(9000)}</td>
            <td>{formatUSD(4500)}</td>
          </tr>
          <tr>
            <td>(41–100)</td>
            <td>(31–40)</td>
            <td>(21–30)</td>
            <td>{formatUSD(1000)}</td>
            <td>{formatUSD(10000)}</td>
            <td>{formatUSD(5000)}</td>
          </tr>
          <tr>
            <td>_</td>
            <td>(41–100)</td>
            <td>(31–40)</td>
            <td>{formatUSD(1100)}</td>
            <td>{formatUSD(11000)}</td>
            <td>{formatUSD(5500)}</td>
          </tr>
          <tr>
            <td>_</td>
            <td>* Chain Length</td>
            <td>(41–100)</td>
            <td>{formatUSD(1200)}</td>
            <td>{formatUSD(12000)}</td>
            <td>{formatUSD(6000)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};