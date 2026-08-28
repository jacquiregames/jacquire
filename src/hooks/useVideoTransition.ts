// src/hooks/useVideoTransition.ts
import { useState, useRef } from "react";

export default function useVideoTransition() {
  const [videoState, setVideoState] = useState<'idle' | 'playing' | 'fading'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = () => {
    setVideoState('playing');
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => {
        console.error("Video transition play failed", e);
        setVideoState('idle'); // Fallback if video fails to play
      });
    }
  };

  const reset = () => {
    setVideoState('idle');
  };

  const handleVideoEnd = () => {
    setVideoState('fading');
    setTimeout(() => {
      setVideoState('idle');
    }, 800); // Matches the CSS transition duration
  };

  return { videoState, videoRef, play, reset, handleVideoEnd };
}
