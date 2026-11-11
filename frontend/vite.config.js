import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..', // read VITE_* values from the root .env file
  server: { port: 5173 },
});
