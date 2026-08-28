// src/board/ChainGridOverlays.tsx

interface ChainGridOverlaysProps {
  twoByTwoGrids: Record<string, [number, number]>;
  fourByOneGrids: Record<string, [number, number]>;
}

/**
 * Renders the large "2x2" and "4x1" hotel logo overlays that sit on top of
 * the board grid once a chain occupies one of those special shapes.
 * Extracted out of GameBoard as part of the no-giant-component cleanup —
 * purely presentational, positions itself entirely from the two grid maps
 * it's handed.
 */
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
            top: `${r * 60 + 5.5}px`,
            left: `${c * 60 + 5.5}px`,
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
            top: `${r * 60 + 5.5}px`,
            left: `${c * 60 + 5.5}px`,
          }}
        />
      ))}
    </>
  );
}

export default ChainGridOverlays;
