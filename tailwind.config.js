/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // True-grey dark system (Linear/Vercel-style): layered near-black
        // surfaces, never pure black; one saturated violet accent.
        ink: {
          950: "#07080c", // page base
          900: "#0a0c10", // app background
          850: "#0e1118", // sunken panel
          800: "#10141b", // panel
          750: "#141926", // raised panel
          700: "#171c29", // hover / elevated
          600: "#1e2434", // borders-strong / chips
        },
        mist: {
          100: "#e9ecf3", // primary text
          300: "#c3c9d6", // secondary text
          500: "#9aa3b5", // muted text
          600: "#6b7386", // faint text / labels
        },
        accent: {
          300: "#b7adff",
          400: "#9d8fff",
          500: "#8b7cff", // primary accent
          600: "#6d5df6", // accent deep (buttons)
          700: "#5a4ae0",
        },
        aurum: {
          300: "#e6c887",
          400: "#d4af5f",
          500: "#c09a3e", // muted gold — brand moments only (wordmark, orb)
          600: "#9a7c2e",
        },
        warn: "#fbbf24",
        danger: "#f87171",
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,124,255,0.35), 0 8px 32px -8px rgba(139,124,255,0.45)",
        "glow-gold":
          "0 0 0 1px rgba(192,154,62,0.35), 0 8px 32px -8px rgba(192,154,62,0.4)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.8)",
        "node-running": "0 0 0 1px rgba(251,191,36,0.5), 0 0 24px -4px rgba(251,191,36,0.45)",
        "node-done": "0 0 0 1px rgba(52,211,153,0.25), 0 0 20px -8px rgba(52,211,153,0.35)",
      },
      borderRadius: {
        card: "1rem",
      },
    },
  },
  plugins: [],
};
