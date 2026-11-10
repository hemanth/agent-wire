/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#09090b',
        panel: '#111113',
        surface: '#18181b',
        subtle: '#27272a',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(255, 255, 255, 0.16)',
        zinc: {
          150: '#ececee',
          750: '#333338',
          850: '#1f1f23',
        },
        pastel: {
          mint: '#D3F8E2',     // Edge runtime & live health
          lilac: '#E4C1F9',    // OpenRouter models & fallback
          rose: '#F694C1',     // cURL endpoints & requests
          custard: '#EDE7B1',  // Attached skills & guardrails
          sky: '#A9DEF9',      // Remote MCP connectors & wire protocols
          ink: '#121316',      // Deep contrast ink
          cream: '#FAF8F5',    // Soft pastel canvas
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        xs: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      },
      spacing: {
        '0.2': '0.05rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
