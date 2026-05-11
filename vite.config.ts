import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/our-wedding-day/',
  plugins: [react()],
});
