/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* deep navy-teal from the Kufli crest — surfaces & background */
        night: {
          700: '#173946',
          800: '#123039',
          850: '#0e2731',
          900: '#0a1f28',
          950: '#06141b'
        },
        /* the crest green — primary accent (keeps the `pitch` name to avoid churn) */
        pitch: {
          50: '#ecfdf3',
          100: '#d2f9e0',
          200: '#a8f1c6',
          300: '#71e3a6',
          400: '#41cf86',
          500: '#2fb56e',
          600: '#249457',
          700: '#1f7548',
          800: '#1c5c3b',
          900: '#184b33',
          950: '#06301d'
        },
        /* the crest orange — secondary accent, live state, highlights */
        flame: {
          300: '#fdbb7a',
          400: '#fb9a46',
          500: '#f47c20',
          600: '#df6410',
          700: '#b64e11'
        }
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', 'Inter var', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(47,181,110,0.28), 0 8px 40px -8px rgba(47,181,110,0.4)',
        flame: '0 0 0 1px rgba(244,124,32,0.3), 0 8px 40px -8px rgba(244,124,32,0.4)'
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
