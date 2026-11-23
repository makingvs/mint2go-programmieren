import { defineConfig } from 'vite';

// Statische Webseite: Ausgabe dist/. base './' : läuft unter jedem Pfad (z. B. GitHub Pages unter /mint2go-programmieren/).
export default defineConfig({
  base: './',
  server: { host: true, port: 5175 },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
});
