// vite.config.ts
import { defineConfig } from 'vite'
import react from "@vitejs/plugin-react";
 
export default defineConfig({
    plugins: [
      react(), 
    ],
    server: {
        host: true, 
        port: 5173,
        strictPort: true,
    },
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    particles: ['@tsparticles/confetti', '@fireworks-js/react'],
                    motion: ['motion']
                }
            }
        }
    }
});