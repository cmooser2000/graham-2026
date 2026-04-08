# SWALLWELL 2026

Bloomberg Terminal-inspired PWA for real-time data exploration. iPhone-first, all-monospace terminal aesthetic.

## Setup

```bash
npm install
npm run dev
```

**Fonts:** Copy Berkeley Mono woff2 files to `public/fonts/` (licensed, not in repo):
```bash
cp ../console/public/fonts/berkeley-mono/woff2/BerkeleyMono-{Regular,Bold,Medium,SemiBold,Light}.woff2 public/fonts/
```

## Features

- **Dashboard** - 10 live-updating metric cards with sparklines
- **Data Explorer** - Sortable/filterable data tables with detail drawer
- **Watchlist** - Star metrics to track them with live values
- **Alerts** - Configure threshold alerts with toast notifications
- **Command Bar** - `Cmd+K` or `/` to search and navigate

## Deploy

Vercel (planned). Currently localhost only.
