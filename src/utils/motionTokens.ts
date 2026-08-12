// src/utils/motionTokens.ts
//
// JS-side mirror of the motion tokens defined in styles/base.css. Anything
// that animates via JS (WAAPI in AnimationManager.ts, confetti bursts,
// useCountUp) reads duration/easing from here instead of hardcoding numbers,
// and checks prefersReducedMotion() before doing anything that a CSS-only
// `@media (prefers-reduced-motion: reduce)` block can't reach (already-queued
// setTimeout/rAF work, Web Animations API calls, particle bursts).

export const EASE = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
} as const;

/**
 * Reads the OS/browser "reduce motion" preference. Safe to call anywhere
 * (SSR-safe guard included, though this app is client-only).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

