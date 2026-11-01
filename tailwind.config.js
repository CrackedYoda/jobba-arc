/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        canvas: '#F5F2EC',
        ink: '#0E1A2E',
        mute: '#5D6A7D',
        line: '#E3DED4',
        steel: '#ACC6E9',
        navy: '#1B3158',
      },
    },
  },
  plugins: [],
}

