/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA — ORANGE CREW
   Autor: JAVIER ILLAN GONZALEZ · ILLANJAVIER9@GMAIL.COM
   Prohibida su reproducción o uso comercial sin autorización escrita.
   ============================================================================ */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
