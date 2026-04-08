# GRAHAM PLATNER 2026 — Maine Senate Dashboard

Bloomberg Terminal-inspired PWA for real-time campaign data exploration.
**Race:** Maine U.S. Senate 2026 | **Candidate:** Graham Platner (D)

## Stack
- Next.js 15 (App Router, TypeScript, Tailwind v4)
- shadcn/ui (New York style, Zinc base)
- Zustand (state + localStorage persistence)
- Recharts (charts/sparklines)
- Berkeley Mono (licensed woff2 fonts in `public/fonts/`, gitignored)

## Commands
```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture
- **No `src/` dir** - flat structure
- **Single page with tab navigation** - 6 views switched via Zustand, not routing:
  - Markets (polling + prediction markets)
  - Finance (FEC data — Graham Platner C00916437, Susan Collins C00385070)
  - Internet (Wikipedia pageviews, Google Trends, YouTube, social)
  - Field (doors knocked, RCV breakdown, county coverage, volunteer pace)
  - Operations (staff directory + links)
  - Queries (Gemini 2.0 Flash natural language Q&A)
- **All monospace** - `font-sans` IS Berkeley Mono. The entire app uses monospace.
- **Dark-only** - Bloomberg terminal aesthetic, no light mode
- **No database** - All data served from `data/*.json` files via Next.js API routes

## Data Sources
- `data/campaign-summary.json` — FEC.gov (C00916437 Platner, C00385070 Collins)
- `data/campaign-geography.json` — FEC Schedule A by state
- `data/campaign-spending.json` — FEC Schedule B disbursements
- `data/campaign-filings.json` — FEC quarterly F3 filings
- `data/campaign-timeline.json` — FEC quarterly timeline
- `data/campaign-debts.json` — FEC Schedule D debts/loans
- `data/independent-expenditures.json` — FEC Schedule E + press reports
- `data/polls.json` — Public Maine polling (Emerson, UNH, Impact Research, Pan Atlantic)
- `data/wiki-pageviews.json` — Wikimedia REST API (Platner, Collins, Mills)
- `data/google-trends.json` — Google Trends US-ME (Platner, Collins, Mills)
- `data/social-stats.json` — Platner social accounts (Instagram, X, Facebook, TikTok)
- `data/youtube-content.json` — YouTube Data API v3

## Key Files
- `app/globals.css` — Bloomberg theme (colors, font faces, glow utilities, scanlines)
- `components/shell/` — Terminal shell, nav tabs, status bar
- `components/markets/` — Polling + prediction market cards
- `components/finance/` — FEC finance tabs (summary, fundraising, spending, geography, etc.)
- `components/internet/` — Wikipedia, Google Trends, YouTube, social charts
- `components/field/` — Field campaign tracker (mock data, ready for GP Field app API)
- `components/operations/` — Staff directory with password-protected Add Contact (GP2026)
- `components/queries/` — Gemini 2.0 Flash natural language Q&A
- `lib/store/` — Zustand stores (app state, directory)

## GitHub Actions Pipelines (`.github/workflows/`)
- `update-data.yml` — Runs every 6h: Wikipedia pageviews, YouTube stats, Google Trends (Maine)
- `ci.yml` — Build/lint on push
- `update-finance.yml` — **DISABLED** (was California CAL-ACCESS; replaced by FEC JSON files)

## Gotchas
- Fonts are in `.gitignore` - copy from `enigma/console/public/fonts/berkeley-mono/woff2/`
- App is dark-only, `:root` CSS vars are set to dark values directly (no `.dark` class needed)
- Port 3000 may be in use; dev server auto-picks next available
- No DATABASE_URL needed — all API routes read from `data/*.json` files
- Queries tab requires `GEMINI_API_KEY` environment variable (Vercel env vars)
