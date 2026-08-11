/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)', foreground: 'var(--foreground)', ink: 'var(--ink)', cream: 'var(--cream)', warm: 'var(--warm)',
        gold: 'var(--gold)', 'gold-lt': 'var(--gold-lt)', purple: 'var(--purple)', 'purple-lt': 'var(--purple-lt)',
        green: 'var(--green)', 'green-lt': 'var(--green-lt)', rust: 'var(--rust)', text: 'var(--text)', muted: 'var(--muted)', border: 'var(--border)',
      },
      fontFamily: { display: ["'Playfair Display'", 'serif'], sans: ["'DM Sans'", 'sans-serif'], mono: ["'DM Mono'", 'monospace'] },
    },
  },
  plugins: [],
}
