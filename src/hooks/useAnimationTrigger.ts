// src/hooks/useAnimationTrigger.ts
import { useEffect, useRef } from "react";

export default function useAnimationTrigger(
  targetSelector: string | HTMLElement | null,
  classNames: string[],
  deps: any[]
) {
  const lastRef = useRef<any[] | undefined>(undefined);

  useEffect(() => {
    const el = typeof targetSelector === 'string' 
      ? document.querySelector(targetSelector) 
      : targetSelector;

    if (!el) {
      return;
    }

    const hasChanged = JSON.stringify(deps) !== JSON.stringify(lastRef.current);
    
    if (hasChanged) {
      el.classList.remove(...classNames);
      void (el as HTMLElement).offsetWidth;
      el.classList.add(...classNames);
    }
    
    lastRef.current = deps;
    
  }, [deps, targetSelector, classNames]);
}