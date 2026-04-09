// stats.js — Public stats endpoint (no auth required)
// Fetches live Brent crude futures price from Yahoo Finance.
// GET /api/stats → { brentCrude, warDay, fetched }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const WAR_START = new Date("2026-02-28T00:00:00Z");

// 4-hour server-side cache
let cache = null;
let cacheTs = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const warDay = Math.max(1, Math.floor((Date.now() - WAR_START.getTime()) / 86400000) + 1);

  // Serve from cache if fresh
  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ...cache, warDay }),
    };
  }

  let brentCrude = null;

  try {
    // Brent crude futures (BZ=F) from Yahoo Finance — works server-side (no CORS restriction)
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/BZ%3DF?range=1d&interval=1d",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (r.ok) {
      const data = await r.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) {
        brentCrude = `$${Number(price).toFixed(2)}`;
      }
    }
  } catch (e) {
    console.warn("Yahoo Finance fetch failed:", e.message);
  }

  const result = {
    ...(brentCrude ? { brentCrude } : {}),
    warDay,
    fetched: new Date().toISOString(),
  };

  // Update cache only when we got a price (don't cache failures)
  if (brentCrude) {
    cache = result;
    cacheTs = Date.now();
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(result),
  };
};
