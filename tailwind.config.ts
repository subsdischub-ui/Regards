import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5B6B52',
        secondary: '#C4A882',
        accent: '#7B4F5C',
        bg: {
          DEFAULT: '#FAF8F5',
          card: '#FFFFFF',
          secondary: '#F3F0EB',
        },
        text: {
          DEFAULT: '#2C2A28',
          secondary: '#6B6560',
          tertiary: '#A39E98',
        },
        border: 'rgba(0,0,0,0.08)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};

export default config;