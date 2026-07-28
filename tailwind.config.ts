import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mercantil: {
          navy: "#003B71",
          blue: "#005CA9",
          sky: "#EAF4FB",
          yellow: "#F4C542",
          orange: "#F28C28",
          success: "#15803D",
          error: "#C62828",
          text: "#374151",
          muted: "#6B7280",
          background: "#F5F7FA",
          border: "#DDE3EA",
          white: "#FFFFFF"
        }
      },
      boxShadow: {
        portal: "0 18px 45px rgba(0, 59, 113, 0.09)"
      }
    }
  },
  plugins: []
} satisfies Config;
