/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          btn: 'var(--primary-btn)',
          'btn-hover': 'var(--primary-btn-hover)',
        },
        secondary: 'var(--secondary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: {
          DEFAULT: 'var(--danger)',
          btn: 'var(--danger-btn)',
          'btn-hover': 'var(--danger-btn-hover)',
        },
      },
      borderRadius: {
        button: '10px',
        input: '10px',
        card: '16px',
        modal: '20px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '300ms',
      },
      boxShadow: {
        modal: '0 20px 50px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
};
