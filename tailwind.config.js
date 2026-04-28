/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        surface: 'rgba(23, 23, 23, 0.65)',
        primary: '#10b981', // Shark Fit primary green (Emerald)
        secondary: '#0ea5e9',
        accent: '#34d399',
        danger: '#ef4444',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
