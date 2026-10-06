/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7dbff',
          300: '#9ec2ff',
          400: '#6ea0ff',
          500: '#437dfc',
          600: '#255ef0',
          700: '#1b47d8',
          800: '#1c3bb0',
          900: '#1b358c',
          950: '#132155',
        },
      },
    },
  },
  plugins: [],
}
