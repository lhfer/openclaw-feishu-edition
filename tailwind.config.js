/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{ts,tsx}', './index.html'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        feishu: {
          blue: '#3370FF',
          light: '#5A8FFF',
          dark: '#1A56DB',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.72)',
          dark: 'rgba(40, 40, 40, 0.72)',
          border: 'rgba(255, 255, 255, 0.3)',
          'border-dark': 'rgba(255, 255, 255, 0.1)',
        },
      },
      borderRadius: {
        'glass': '20px',
        'glass-sm': '12px',
        'glass-xs': '8px',
      },
      backdropBlur: {
        'glass': '40px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'PingFang SC',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-left': 'slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'check-bounce': 'checkBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        checkBounce: {
          '0%': { transform: 'scale(0)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
