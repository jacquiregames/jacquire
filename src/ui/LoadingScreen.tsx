// src/ui/LoadingScreen.tsx
import React from 'react';
import '../styles/LoadingScreen.css';

const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen-container">
      <div className="loader"></div>
      <div className="loading-text">LOADING ASSETS</div>
    </div>
  );
};

export default LoadingScreen;