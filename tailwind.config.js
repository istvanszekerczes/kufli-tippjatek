/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pitch: {
          50: '#effef6',
          100: '#d9ffec',
          200: '#b5fdda',
          300: '#7cf9bf',
          400: '#3cec9d',
          500: '#12d47f',
          600: '#06b067',
          700: '#098a54',
          800: '#0c6d45',
          900: '#0c593b',
          950: '#02321f'
        },
        night: {
          800: '#141a24',
          850: '#0f141c',
          900: '#0b0f16',
          950: '#070a10'
        }
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', 'Inter var', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(18,212,127,0.25), 0 8px 40px -8px rgba(18,212,127,0.35)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-live': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'pulse-live': 'pulse-live 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
