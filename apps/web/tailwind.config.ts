import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B4F72',
          50: '#EAF2F8',
          100: '#D5E8F3',
          200: '#AAD1E7',
          300: '#7FBADB',
          400: '#55A3CF',
          500: '#1B4F72',
          600: '#174466',
          700: '#123859',
          800: '#0E2D4D',
          900: '#0A2240',
        },
        secondary: {
          DEFAULT: '#F39C12',
          50: '#FEF9EC',
          100: '#FDF3D9',
          200: '#FAE7B3',
          300: '#F8DB8D',
          400: '#F5CF67',
          500: '#F39C12',
          600: '#D4880F',
          700: '#B5740D',
          800: '#96600A',
          900: '#774C08',
        },
        success: '#27AE60',
        warning: '#F1C40F',
        danger: '#E74C3C',
        neutral: {
          dark: '#2C3E50',
          mid: '#7F8C8D',
          light: '#ECF0F1',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}

export default config
