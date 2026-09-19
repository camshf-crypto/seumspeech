import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "세움스피치",
        short_name: "세움스피치",
        description: "세움스피치 - 스피치·면접 전문 학원",
        theme_color: "#12315f",
        background_color: "#12315f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // 서비스 워커가 이 주소들은 index.html 로 바꿔치기하지 않게 한다.
        // 스케줄 전용 PWA(schedule.html + schedule.webmanifest)가 따로 뜨려면 필요하다.
        navigateFallbackDenylist: [
          /^\/api/,
          /supabase/,
          /^\/schedule\.html/,
          /^\/schedule\.webmanifest/,
        ],
        importScripts: ["push-sw.js"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});