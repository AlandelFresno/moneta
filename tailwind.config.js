/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'surface-page': 'var(--surface-page)',
        'surface-card': 'var(--surface-card)',
        'surface-input': 'var(--surface-input)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        income: 'var(--income)',
        expense: 'var(--expense)',
      },
    },
  },
  plugins: [],
}
