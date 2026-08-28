// src/utils/AnimationManager.ts
import { prefersReducedMotion, EASE } from "./motionTokens";

export function animateElement(selector: string | HTMLElement | null, classes: string[], duration: number = 1500): () => void {
  const el = typeof selector === "string"
    ? document.querySelector(selector) || document.getElementById(selector)
    : selector;
  if (!el || !classes?.length) return () => {};
  classes.forEach((cls) => cls && el.classList.add(cls));
  const timerId = setTimeout(() => {
    classes.forEach((cls) => cls && el.classList.remove(cls));
  }, duration);
  return () => {
    clearTimeout(timerId);
    classes.forEach((cls) => cls && el.classList.remove(cls));
  };
}

export function animateById(elementId: string, classNames: string[], duration: number = 1000): void {
  const element = document.getElementById(elementId);
  if (element) {
    animateElement(element, classNames, duration);
  }
}

export function getDistance(tile1: [number, number], tile2: [number, number]): number {
    const [r1, c1] = tile1;
    const [r2, c2] = tile2;
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(c1 - c2, 2));
}

export function animateMerge(survivorChain: string, defunctTiles: Record<string, [number, number][]>, mergingTile: [number, number]): void {
  if (!survivorChain || !defunctTiles || !mergingTile) return;
  // The clone-flight is purely decorative — the board already reflects the
  // merge result via React state. Reduced-motion users skip straight past it
  // rather than getting a CSS-throttled-to-1ms version of a flying clone.
  if (prefersReducedMotion()) return;

  const survivorElements = document.querySelectorAll(`.chain-${survivorChain.toLowerCase()}`);
  
  for (const defunctChainName in defunctTiles) {
    const tilesToAnimate = defunctTiles[defunctChainName];
    
    tilesToAnimate.forEach(([r, c]) => {
      const originalEl = document.getElementById(`tile-${r}-${c}`);
      if (!originalEl) return;
      
      const rect = originalEl.getBoundingClientRect();
      const clone = originalEl.cloneNode(true) as HTMLElement;
      
      clone.className = `tile-button chain-${defunctChainName.toLowerCase()}`;
      clone.style.position = 'fixed';
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.zIndex = '9999';
      clone.style.margin = '0';
      clone.style.transition = 'none';
      
      document.body.appendChild(clone);
      
      let closestSurvivorEl: Element | null = null;
      let minDistance = Infinity;
      
      survivorElements.forEach(survivorEl => {
        const survivorRect = survivorEl.getBoundingClientRect();
        const dist = Math.sqrt(Math.pow(rect.x - survivorRect.x, 2) + Math.pow(rect.y - survivorRect.y, 2));
        if (dist < minDistance) {
          minDistance = dist;
          closestSurvivorEl = survivorEl;
        }
      });

      if (closestSurvivorEl) {
        const targetRect = (closestSurvivorEl as HTMLElement).getBoundingClientRect();
        const dx = targetRect.left - rect.left;
        const dy = targetRect.top - rect.top;
        
        // INCREASED DELAY: Spreads out the start time of the tiles more (was 100)
        const delay = getDistance([r, c], mergingTile) * 150; 
        
        // Flight duration for each tile — 2000ms (was 700, then 1200)
        const duration = 2000; 

        // Direction-aware tumble (spins the way it's traveling, not a fixed
        // 270deg for every tile) plus a slight arc lift at the midpoint so
        // tiles read as "flying" rather than sliding in a straight line.
        const travelAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const spin = travelAngle + 720;
        const arcLift = Math.max(30, Math.min(80, Math.hypot(dx, dy) * 0.12));
        const midX = dx * 0.5;
        const midY = dy * 0.5 - arcLift;

        const animation = clone.animate([
          { transform: 'translate(0px, 0px) scale(1.2) rotate(0deg)', opacity: 1, offset: 0 },
          { transform: `translate(${midX}px, ${midY}px) scale(0.7) rotate(${spin * 0.5}deg)`, opacity: 0.95, offset: 0.6 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(${spin}deg)`, opacity: 0, offset: 1 }
        ], {
          duration: duration,
          delay: delay,
          easing: EASE.decelerate,
          fill: 'forwards'
        });
        
        animation.onfinish = () => clone.remove();
        
        // Fallback cleanup in case the animation is interrupted
        setTimeout(() => {
          if (document.body.contains(clone)) clone.remove();
        }, duration + delay + 100);

      } else {
        clone.remove();
      }
    });
  }
}

/**
 * Creates a clone of a source element and animates it to a target element's position.
 * @param sourceSelector CSS selector for the source element (e.g., a tile in the hand).
 * @param targetSelector CSS selector for the target element (e.g., a cell on the board).
 */
export function animateTilePlacement(sourceSelector: string, targetSelector: string): void {
  const sourceEl = document.querySelector(sourceSelector) as HTMLElement;
  const targetEl = document.querySelector(targetSelector) as HTMLElement;

  if (!sourceEl || !targetEl) {
    console.warn("Animation failed: Source or target element not found.", { sourceSelector, targetSelector });
    return;
  }
  if (prefersReducedMotion()) return;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  
  // Create a clone to animate
  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.zIndex = '10000';
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none'; // Prevent interaction with the clone
  clone.style.visibility = 'visible'; // Ensure the clone is visible

  document.body.appendChild(clone);

  // Define keyframes for the animation with a "pop"
  const keyframes = [
    { transform: 'scale(1.2)', opacity: 1, offset: 0.1 },
    { transform: `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px) scale(1)`, opacity: 1 }
  ];

  const duration = 800; // ms
  const options: KeyframeAnimationOptions = {
    duration: duration, 
    easing: EASE.emphasized,
    fill: 'forwards'
  };
  
  // Run the animation
  const animation = clone.animate(keyframes, options);

  // Clean up the clone after the animation finishes
  animation.onfinish = () => clone.remove();
  
  // Fallback cleanup in case the animation is interrupted
  setTimeout(() => {
    if (document.body.contains(clone)) clone.remove();
  }, duration + 100);
}
