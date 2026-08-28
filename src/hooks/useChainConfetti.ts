// src/hooks/useChainConfetti.ts
import { confetti } from "@tsparticles/confetti";
import { prefersReducedMotion } from "../utils/motionTokens";

export function triggerChainConfetti(chain: string): void {
  if (!chain || prefersReducedMotion()) return;

  const imageUrl = `/images/particles/${chain.toLowerCase()}.webp`;

  // Array of 15 to safely overwrite global shape cache
  const imageArray = Array(15).fill({
    src: imageUrl,
    width: 50,
    height: 50,
  });

  confetti({
    particleCount: 12,      // Fewer particles so it's not visually cluttered
    spread: 100,            // Moderate spread
    origin: { y: 0.4 },     // Start higher up the screen
    startVelocity: 14,      // Gentle toss upwards (was 35)
    decay: 0.96,            // Minimal friction so they keep drifting
    gravity: 0.7,          // Very low gravity so they float down slowly
    scalar: 6,              // Large and visible
    ticks: 500,             // Live longer on screen
    shapes: ["image"],
    shapeOptions: {
      image: imageArray,
    },
  });
}
