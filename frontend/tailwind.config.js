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
        // Couleurs principales du thème cinéma
        primary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        accent: {
          gold: '#d4af37',      // Doré Pathé / Oscars
          goldLight: '#f4e4bc',
          goldDark: '#b8860b',
          red: '#b91c1c',       // Rouge cinéma
          redLight: '#e53e3e',
          redDark: '#991b1b',
          purple: '#7c3aed',    // Violet Netflix
          purpleLight: '#a855f7',
          purpleDark: '#581c87',
        },
        cinema: {
          dark: '#0a0a0a',     // Noir profond (fond principal)
          darker: '#000000',
          card: '#1a1a1a',      // Fond des cartes
          cardHover: '#252525',
          border: '#2a2a2a',   // Bordures
          borderLight: '#3a3a3a',
          text: '#ffffff',     // Texte principal
          textMuted: '#a0a0a0',
          textLight: '#d0d0d0',
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
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(212, 175, 55, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      boxShadow: {
        'cinema': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
        'cinema-lg': '0 20px 60px -15px rgba(0, 0, 0, 0.6)',
        'gold': '0 0 20px rgba(212, 175, 55, 0.3)',
        'gold-lg': '0 0 40px rgba(212, 175, 55, 0.5)',
        'red': '0 0 20px rgba(185, 28, 28, 0.3)',
        'inner-gold': 'inset 0 0 30px rgba(212, 175, 55, 0.1)',
      },
      backgroundImage: {
        'gradient-cinema': 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
        'gradient-gold': 'linear-gradient(135deg, #d4af37 0%, #f4e4bc 50%, #d4af37 100%)',
        'gradient-red': 'linear-gradient(135deg, #b91c1c 0%, #e53e3e 50%, #b91c1c 100%)',
        'gradient-purple': 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #7c3aed 100%)',
        'radial-gold': 'radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, transparent 70%)',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
};
