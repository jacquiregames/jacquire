// src/board/ChainGridOverlays.tsx

interface ChainGridOverlaysProps {
  twoByTwoGrids: Record<string, [number, number]>;
  fourByOneGrids: Record<string, [number, number]>;
}

function ChainGridOverlays({ twoByTwoGrids, fourByOneGrids }: ChainGridOverlaysProps) {
  return (
    <>
      {Object.entries(twoByTwoGrids).map(([chain, [r, c]]) => (
        <img
          key={`${chain}-2x2`}
          src={`/images/hotel/${chain.toLowerCase()}2.webp`}
          alt={`${chain} 2x2`}
          className="two-by-two-image"
          style={{
            top: `${r * 3.75 + 0.34375}rem`,
            left: `${c * 3.75 + 0.34375}rem`,
          }}
        />
      ))}

      {Object.entries(fourByOneGrids).map(([chain, [r, c]]) => (
        <img
          key={`${chain}-4x1`}
          src={`/images/hotel/${chain.toLowerCase()}4.webp`}
          alt={`${chain} 4x1`}
          className="four-by-one-image"
          style={{
            top: `${r * 3.75 + 0.34375}rem`,
            left: `${c * 3.75 + 0.34375}rem`,
          }}
        />
      ))}
    </>
  );
}

export default ChainGridOverlays;