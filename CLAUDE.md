# SWALLWELL 2026

Bloomberg Terminal-inspired PWA for real-time data exploration.

## Stack
- Next.js 15 (App Router, TypeScript, Tailwind v4)
- shadcn/ui (New York style, Zinc base)
- Zustand (state + localStorage persistence)
- Recharts (sparklines)
- Berkeley Mono (licensed woff2 fonts in `public/fonts/`, gitignored)

## Commands
```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture
- **No `src/` dir** - flat structure
- **Single page with tab navigation** - 4 views (DASH, EXPL, WATCH, ALRT) switched via Zustand, not routing
- **All monospace** - `font-sans` IS Berkeley Mono. The entire app uses monospace.
- **Dark-only** - Bloomberg terminal aesthetic, no light mode
- **Data layer abstraction** - `DataSourceAdapter` interface in `lib/data/types.ts`, currently uses mock provider
- **Mock data** - 3 datasets (Company Registry, Transaction Log, API Metrics), 10 dashboard metrics with simulated real-time ticking

## Key Files
- `app/globals.css` - Bloomberg theme (colors, font faces, glow utilities, scanlines)
- `components/shell/` - Terminal shell, command bar (cmdk), nav tabs, status bar
- `components/dashboard/` - Metric cards with sparklines
- `components/explorer/` - Data table with sort/filter, detail drawer
- `lib/data/mock-provider.ts` - Mock data generator + real-time subscription
- `lib/store/` - Zustand stores (app state, watchlist, alerts)

## Gotchas
- Fonts are in `.gitignore` - copy from `enigma/console/public/fonts/berkeley-mono/woff2/`
- App is dark-only, `:root` CSS vars are set to dark values directly (no `.dark` class needed)
- Port 3000 may be in use; dev server auto-picks next available
