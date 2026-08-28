import { useState, useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../utils/motionTokens';

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const useCountUp = (endValue: number, duration: number = 1000) => {
    const [count, setCount] = useState(endValue);
    const prevEndValueRef = useRef(endValue);

    useEffect(() => {
        if (duration <= 0 || prefersReducedMotion()) {
            setCount(endValue);
            prevEndValueRef.current = endValue;
            return;
        }

        const startValue = count; // Start from current count to handle mid-animation updates
        const startTime = performance.now();
        let animationFrameId: number;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easedProgress = easeOutExpo(progress);
            const currentValue = Math.round(startValue + (endValue - startValue) * easedProgress);
            
            setCount(currentValue);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                prevEndValueRef.current = endValue;
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [endValue, duration]); // Removed 'count' from deps to avoid infinite loops

    return count;
};