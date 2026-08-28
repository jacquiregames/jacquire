// src/ImagePreloader.tsx
import React, { useEffect } from 'react';

interface ImagePreloaderProps {
  imageUrls: string[];
  onComplete: () => void;
}

const ImagePreloader: React.FC<ImagePreloaderProps> = ({ imageUrls, onComplete }) => {
  useEffect(() => {
    let isMounted = true;

    const preloadImages = async () => {
      const promises = imageUrls.map((url) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.src = url;
          // Resolve on both load and error so one missing image doesn't hang the game
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn(`Failed to load image: ${url}`);
            resolve(); 
          };
        });
      });

      await Promise.all(promises);

      if (isMounted) {
        onComplete();
      }
    };

    preloadImages();

    return () => {
      isMounted = false;
    };
  }, [imageUrls, onComplete]);

  return null;
};

export default ImagePreloader;