// src/SafeStampAnimation.tsx
import React, { useEffect } from 'react';
import { prefersReducedMotion } from './utils/motionTokens';
import './styles/SafeStampAnimation.css';

interface SafeStampAnimationProps {
  onComplete: () => void;
}

function RubberStampSvg() {
  return (
    <svg className="stamp-svg" viewBox="-280 -180 560 360" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="woodBase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a35a" />
          <stop offset="30%" stopColor="#b07a32" />
          <stop offset="70%" stopColor="#7a4e18" />
          <stop offset="100%" stopColor="#4a2c0c" />
        </linearGradient>
        <linearGradient id="woodSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b3f14" />
          <stop offset="100%" stopColor="#2e1806" />
        </linearGradient>
        <linearGradient id="woodBevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6e0" stopOpacity="0.55" />
          <stop offset="18%" stopColor="#fff6e0" stopOpacity="0.18" />
          <stop offset="50%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <filter id="woodGrain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="4" seed="12" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.35 0 0 0 0 0.18 0 0 0 0 0.05 0 0 0 0.45 0" result="tinted" />
          <feBlend in="SourceGraphic" in2="tinted" mode="multiply" />
        </filter>
        <filter id="stampDrop" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.45" />
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.3" />
        </filter>
        <linearGradient id="brassPlate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0e0a8" />
          <stop offset="35%" stopColor="#c9a84c" />
          <stop offset="70%" stopColor="#8a6a22" />
          <stop offset="100%" stopColor="#5a4210" />
        </linearGradient>
        <linearGradient id="brassRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4c8" />
          <stop offset="40%" stopColor="#d4b060" />
          <stop offset="100%" stopColor="#6a4e14" />
        </linearGradient>
        <linearGradient id="rubberFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a342e" />
          <stop offset="50%" stopColor="#1e1a16" />
          <stop offset="100%" stopColor="#0c0a08" />
        </linearGradient>
        <filter id="rubberTex" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0 0.04 0 0 0 0.35 0" result="speckle" />
          <feBlend in="SourceGraphic" in2="speckle" mode="screen" />
        </filter>
        <filter id="inkResidue" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="knobGrad" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#f5f0e6" />
          <stop offset="28%" stopColor="#d4cbb8" />
          <stop offset="60%" stopColor="#8a8274" />
          <stop offset="100%" stopColor="#3a362e" />
        </radialGradient>
        <radialGradient id="knobRing" cx="50%" cy="50%" r="50%">
          <stop offset="75%" stopColor="#2a2620" stopOpacity="0" />
          <stop offset="88%" stopColor="#1a1610" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0a0806" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id="stemWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c49240" />
          <stop offset="50%" stopColor="#8a5a1e" />
          <stop offset="100%" stopColor="#4a2c0a" />
        </linearGradient>
        <linearGradient id="ferrule" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e2d4" />
          <stop offset="40%" stopColor="#b0a898" />
          <stop offset="100%" stopColor="#4a463e" />
        </linearGradient>
        <radialGradient id="screwHead" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f0e8c8" />
          <stop offset="55%" stopColor="#a88830" />
          <stop offset="100%" stopColor="#4a3810" />
        </radialGradient>
        <filter id="innerEdge" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
      </defs>
      <g>
        <rect x="-256" y="-152" width="512" height="312" rx="16" ry="16" fill="url(#woodSide)" />
        <rect x="-252" y="-156" width="504" height="304" rx="14" ry="14" fill="url(#woodBase)" filter="url(#woodGrain)" />
        <rect x="-252" y="-156" width="504" height="304" rx="14" ry="14" fill="url(#woodBevel)" />
        <rect x="-248" y="-152" width="496" height="8" rx="4" fill="#fff8e8" fillOpacity="0.28" />
        <path d="M 252,-142 Q 252,-156 238,-156 L 238,148 Q 238,148 224,148 L -238,148 Q -252,148 -252,134 L -252,148 Q -252,156 -244,156 L 238,156 Q 252,156 252,142 Z" fill="#2a1606" fillOpacity="0.55" />
        <rect x="-228" y="-132" width="456" height="264" rx="8" ry="8" fill="url(#brassPlate)" />
        <rect x="-228" y="-132" width="456" height="264" rx="8" ry="8" fill="none" stroke="url(#brassRim)" strokeWidth="3" />
        <rect x="-222" y="-126" width="444" height="252" rx="5" ry="5" fill="none" stroke="#3a2c0a" strokeOpacity="0.35" strokeWidth="1" />
        <rect x="-216" y="-120" width="432" height="240" rx="4" ry="4" fill="url(#rubberFace)" filter="url(#rubberTex)" />
        <rect x="-216" y="-120" width="432" height="240" rx="4" ry="4" fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="2.5" />
        <rect x="-214" y="-118" width="428" height="6" rx="2" fill="#5a5248" fillOpacity="0.35" />

        {([
          [-210, -114], [210, -114], [-210, 114], [210, 114],
        ] as [number, number][]).map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill="#2a2008" fillOpacity="0.5" />
            <circle cx={cx} cy={cy} r="7.5" fill="url(#screwHead)" />
            <circle cx={cx} cy={cy} r="7.5" fill="none" stroke="#3a2c0a" strokeWidth="0.8" />
            <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="#2a1e08" strokeWidth="1.4" strokeLinecap="round" />
            <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke="#2a1e08" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx={cx - 2} cy={cy - 2.5} r="1.5" fill="#fff8d0" fillOpacity="0.55" />
          </g>
        ))}

        <ellipse cx="2" cy="4" rx="62" ry="58" fill="#000" fillOpacity="0.35" />
        <circle cx="0" cy="0" r="56" fill="url(#stemWood)" filter="url(#woodGrain)" />
        <circle cx="0" cy="0" r="56" fill="none" stroke="#3a2408" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="50" fill="none" stroke="#e8c070" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx="0" cy="0" r="42" fill="url(#ferrule)" />
        <circle cx="0" cy="0" r="42" fill="none" stroke="#2a2620" strokeWidth="1.2" />
        <circle cx="0" cy="0" r="37" fill="none" stroke="#f0ebe0" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="34" fill="#2e2a24" />
        <circle cx="0" cy="0" r="30" fill="url(#stemWood)" />
        <circle cx="0" cy="0" r="30" fill="none" stroke="#2a1606" strokeWidth="1" />
        <circle cx="0" cy="0" r="24" fill="none" stroke="#5a3810" strokeOpacity="0.4" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="18" fill="none" stroke="#5a3810" strokeOpacity="0.3" strokeWidth="0.8" />
        <circle cx="0" cy="0" r="22" fill="url(#knobGrad)" />
        <circle cx="0" cy="0" r="22" fill="url(#knobRing)" />
        <ellipse cx="-7" cy="-8" rx="9" ry="5.5" fill="#ffffff" fillOpacity="0.55" transform="rotate(-25 -7 -8)" />
        <ellipse cx="-5" cy="-5" rx="3.5" ry="2" fill="#ffffff" fillOpacity="0.75" transform="rotate(-25 -5 -5)" />
        <ellipse cx="6" cy="8" rx="6" ry="3.5" fill="#c8b898" fillOpacity="0.2" />
      </g>
    </svg>
  );
}

function SafeImpressionSvg() {
  return (
    <svg className="impression-svg" viewBox="-260 -160 520 320" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <filter id="stampDistress" x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="4" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0" result="alphaNoise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feComposite in="displaced" in2="alphaNoise" operator="out" result="eroded" />
          <feGaussianBlur in="eroded" stdDeviation="0.35" />
        </filter>
      </defs>

      <g filter="url(#stampDistress)">
        
        {/* Outer Frame Background (Black Border) */}
        <rect x="-230" y="-120" width="460" height="240" fill="none" stroke="#000" strokeWidth="15" rx="4" />
        {/* Outer Frame Foreground (Solid Red Ink) */}
        <rect x="-230" y="-120" width="460" height="240" fill="none" stroke="#ff0000" strokeWidth="10" rx="4" />
        
        {/* Inner Frame Background (Black Border) */}
        <rect x="-218" y="-108" width="436" height="216" fill="none" stroke="#000" strokeWidth="7.5" rx="2" />
        {/* Inner Frame Foreground (Solid Red Ink) */}
        <rect x="-218" y="-108" width="436" height="216" fill="none" stroke="#ff0000" strokeWidth="2.5" rx="2" />
        
        {/* Text with Black Stroke drawn underneath the Solid Red Fill */}
        <text
          x="0" y="55" textAnchor="middle" fontSize="150"
          fontFamily="Georgia, 'Times New Roman', 'Book Antiqua', serif"
          fontWeight="900" letterSpacing="8" 
          fill="#ff0000" 
          stroke="#000" 
          strokeWidth="5" 
          paintOrder="stroke fill"
        >
          SAFE
        </text>
      </g>
    </svg>
  );
} 

export default function SafeStampAnimation({ onComplete }: SafeStampAnimationProps) {
  useEffect(() => {
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }

    // Safely unmount 100ms after the 4.6s CSS animation finishes
    const timer = setTimeout(() => onComplete(), 4700);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (prefersReducedMotion()) return null;

  return (
    <div className="safe-stamp-overlay" aria-hidden="true">
      <div className="contact-shadow" />
      <div className="ink-flash" />
      <div className="impression-wrap">
        <SafeImpressionSvg />
      </div>
      <div className="stamp-anchor">
        <div className="stamp-tilt">
          <RubberStampSvg />
        </div>
      </div>
    </div>
  );
}