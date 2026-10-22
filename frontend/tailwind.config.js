/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          gold: '#c8a456',
          goldLight: '#dfc27d',
          goldDark: '#9e7d37',
          red: '#b91c1c',
          redLight: '#dc2626',
          redDark: '#991b1b',
        },
        cinema: {
          dark: '#0a0a0b',
          darker: '#050506',
          card: '#131316',
          cardHover: '#1c1c21',
          border: '#26262b',
          borderLight: '#383840',
          text: '#ffffff',
          textMuted: '#b8b8b8',
          textLight: '#e0e0e0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'cinema': '0 4px 20px -4px rgba(0, 0, 0, 0.45)',
        'cinema-lg': '0 12px 32px -8px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
};
