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
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom')) {
                            return 'vendor';
                        }
                        if (id.includes('@tsparticles') || id.includes('@fireworks-js')) {
                            return 'particles';
                        }
                        if (id.includes('motion')) {
                            return 'motion';
                        }
                    }
                }
            }
        }
    }
});