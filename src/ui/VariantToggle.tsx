// src/VariantToggle.tsx
import Switch from "react-switch";

interface VariantToggleProps {
  icon: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * One "icon + label + on/off switch" row. Extracted out of UnifiedIntro's
 * host-controls column as part of the no-giant-component cleanup — the
 * three variant toggles (Wild Tile, Fast Game, Special Powers) were
 * previously three copies of the same ~15-line Switch block, differing
 * only in icon/label/checked/onChange.
 */
function VariantToggle({ icon, label, checked, onChange }: VariantToggleProps) {
  return (
    <div className="variant-toggle-container">
      <img src={icon} alt={label} className="variant-icon" />
      <span className="variant-label">{label}</span>
      <Switch
        onChange={onChange}
        checked={checked}
        onColor="#05fa22"
        offColor="#ff0000"
        handleDiameter={30}
        uncheckedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "white", paddingRight: 2 }}>Off</div>}
        checkedIcon={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", fontSize: 15, color: "black", paddingRight: 2 }}>On</div>}
        boxShadow="0px 1px 5px rgba(0, 0, 0, 1)"
        activeBoxShadow="0px 0px 1px 5px rgba(0, 0, 0, 1)"
        height={24}
        width={62}
      />
    </div>
  );
}

export default VariantToggle;
