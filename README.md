# ⚔ WARWATCH — Iran War 2026 OSINT Dashboard

Real-time OSINT dashboard tracking the 2026 Iran War.

## Deploy to Netlify

### Option A — Drag & Drop (easiest)
1. Unzip this archive
2. `npm install && npm run build` (requires Node 18+)
3. Drag the `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)

### Option B — Git Deploy (recommended for updates)
1. Push this folder to a GitHub repo
2. Connect repo in Netlify → Build command: `npm run build` → Publish dir: `dist`
3. Add environment variable (see below)

## API Key Setup (required for AI features)

The SitRep, Live Feed, and OSINT tabs use the Anthropic Claude API.

1. Get a key at [console.anthropic.com](https://console.anthropic.com)
2. In Netlify: **Site Settings → Environment Variables → Add variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...`
3. Redeploy — AI features will work automatically

Your API key is never exposed to the browser. All requests are proxied through `netlify/functions/anthropic.js`.

## Local Development

```bash
npm install
cp .env.example .env.local
# Add your key to .env.local
npm run dev
```

## Features
- 22 verified OSINT strike events on interactive map
- 12 aircraft tracked with live simulated ADS-B movement
- 8 vessels tracked in Hormuz region with shipping status
- War simulation: 25-scene cinematic timeline with animated arcs
- Leadership posts from Trump, Netanyahu, Pezeshkian, Starmer, Macron, Modi + more
- AI SitRep generator (ISW/CTP methodology)
- AI Live Feed aggregator
- AI OSINT channel monitor
- Timeline scrubber Feb 28 → Mar 21 with live casualty scaling
- Satellite map toggle (ArcGIS World Imagery)
