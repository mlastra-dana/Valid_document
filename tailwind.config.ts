import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mercantil: {
          navy: "#0F3D6E",
          blue: "#1D4F8C",
          sky: "#F6F8FB",
          yellow: "#F4C542",
          orange: "#F28C28",
          success: "#15803D",
          error: "#B91C1C",
          text: "#374151",
          muted: "#6B7280",
          background: "#F6F8FB",
          surface: "#F9FAFB",
          border: "#E5E7EB",
          white: "#FFFFFF"
        }
      },
      boxShadow: {
        portal: "0 4px 18px rgba(15, 23, 42, 0.06)"
      }
    }
  },
  plugins: []
} satisfies Config;
