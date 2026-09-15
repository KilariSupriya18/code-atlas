/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8FA',
        background: '#F7F8FA',
        surface: '#FFFFFF',
        'text-primary': '#172033',
        'text-secondary': '#526077',
        border: '#DEE4ED',
        indigo: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          tint: '#EEEDFF',
          border: '#C7D2FE',
        },
        teal: {
          DEFAULT: '#087F73',
          hover: '#065F56',
          tint: '#E8F6F1',
          border: '#A7F3D0',
        },
        amber: {
          DEFAULT: '#9A5B0A',
          hover: '#824D08',
          tint: '#FFF4DE',
          border: '#FDE68A',
        },
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: '#EEEDFF',
          border: '#C7D2FE',
        },
        success: {
          DEFAULT: '#087F73',
          light: '#E8F6F1',
          border: '#A7F3D0',
        },
        warning: {
          DEFAULT: '#9A5B0A',
          light: '#FFF4DE',
          border: '#FDE68A',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEF2F2',
          border: '#FECACA',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
