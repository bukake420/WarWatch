// news.js — real-time news aggregation from 6 sources.
// Fetches actual articles, uses Claude only to classify type/side per item.
// NEVER generates or fabricates content. Every item has a real source URL.
// GET /api/news

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=1800",
};

// 30-minute server cache
let cache = { data: null, ts: 0 };
const TTL = 30 * 60 * 1000;

exports.handler = async () => {
  if (cache.data && Date.now() - cache.ts < TTL) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify(cache.data) };
  }

  // ── 1. Fetch all sources in parallel ────────────────────────────────────────
  const [gdeltResult, ajResult, bbcResult, reutersResult, apResult, unResult] =
    await Promise.allSettled([
      fetchGdelt(),
      fetchRSS("https://www.aljazeera.com/xml/rss/all.xml", "Al Jazeera"),
      fetchRSS("https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", "BBC Middle East"),
      fetchRSS("https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best", "Reuters"),
      fetchRSS("https://rsshub.app/apnews/topics/world-news", "AP News"),
      fetchRSS("https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml", "UN News"),
    ]);

  // Collect raw items with source attribution
  const raw = [];
  for (const [label, res] of [
    ["GDELT",       gdeltResult],
    ["Al Jazeera",  ajResult],
    ["BBC ME",      bbcResult],
    ["Reuters",     reutersResult],
    ["AP News",     apResult],
    ["UN News",     unResult],
  ]) {
    if (res.status === "fulfilled") {
      res.value.forEach(item => raw.push({ ...item, source: label }));
    }
  }

  if (!raw.length) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify([]) };
  }

  // Deduplicate by URL
  const seen = new Set();
  const deduped = raw.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // ── 2. Claude classifies type + side for each item (optional) ──────────────
  // If no API key, items are returned unclassified (type="analysis", side="intl")
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let classified = deduped;

  if (apiKey && deduped.length > 0) {
    try {
      const numbered = deduped.map((item, i) =>
        `[${i}] ${item.source}: ${item.title} — ${item.desc || ""}`.slice(0, 200)
      ).join("\n");

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system:     "Respond ONLY with a valid JSON array. No markdown, no explanation.",
          messages: [{
            role:    "user",
            content: `For each news item, classify it. Return a JSON array of objects with keys: i (index), type (one of: strike|intercept|diplomatic|humanitarian|energy|analysis), side (one of: us_il|iran|intl|hezbollah).\n\nItems:\n${numbered}\n\nReturn JSON array only, one entry per item.`,
          }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (r.ok) {
        const txt  = ((await r.json()).content?.[0]?.text || "").trim();
        const s    = txt.indexOf("["), e = txt.lastIndexOf("]");
        if (s !== -1) {
          const labels = JSON.parse(txt.slice(s, e + 1));
          const labelMap = {};
          for (const l of labels) if (typeof l.i === "number") labelMap[l.i] = l;
          classified = deduped.map((item, idx) => ({
            ...item,
            type: labelMap[idx]?.type || "analysis",
            side: labelMap[idx]?.side || "intl",
          }));
        }
      }
    } catch {}
  }

  // Sort newest-first
  const items = classified
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 60)
    .map(item => ({
      source:  item.source,
      title:   item.title,
      text:    item.desc ? `${item.title} — ${item.desc}`.slice(0, 400) : item.title,
      url:     item.url,
      date:    item.date,
      time:    item.time,
      type:    item.type  || "analysis",
      side:    item.side  || "intl",
    }));

  cache = { data: items, ts: Date.now() };
  return { statusCode: 200, headers: CORS, body: JSON.stringify(items) };
};

// ── GDELT fetcher ─────────────────────────────────────────────────────────────
async function fetchGdelt() {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    "?query=iran+israel+war+military+ceasefire+IRGC+IDF+Gulf+Hormuz+nuclear+hezbollah" +
    "&mode=artlist&maxrecords=25&format=json&timespan=72h&sort=DateDesc";
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`GDELT HTTP ${r.status}`);
  const data = await r.json();
  return (data.articles || []).slice(0, 20).map(a => {
    const pd = a.seendate || "";
    return {
      title:   a.title || "",
      desc:    "",
      url:     a.url || "",
      pubDate: pd ? pd.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z") : "",
      date:    pd.slice(0, 4) + "-" + pd.slice(4, 6) + "-" + pd.slice(6, 8),
      time:    pd.slice(9, 11) + ":" + pd.slice(11, 13),
    };
  }).filter(a => a.title);
}

// ── Generic RSS/Atom fetcher ──────────────────────────────────────────────────
async function fetchRSS(url, _label) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept":     "application/rss+xml, application/atom+xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();

  const isAtom = /<entry[\s>]/.test(xml);
  const tag    = isAtom ? "entry" : "item";
  const rx     = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, "g");
  const items  = [];
  let m;

  while ((m = rx.exec(xml)) !== null && items.length < 15) {
    const body = m[1];
    const get  = t => {
      const r2 = new RegExp(
        `<${t}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${t}>|<${t}[^>]*href="([^"]*)"[^>]*\\/?>`,
        "i"
      ).exec(body);
      return r2 ? (r2[1] || r2[2] || r2[3] || "").trim() : "";
    };
    const title   = get("title").replace(/<[^>]+>/g, "").trim();
    const link    = get("link") || get("id") || "";
    const rawDesc = get("description") || get("summary") || get("content");
    const desc    = rawDesc.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
    const pubDate = get("published") || get("updated") || get("pubDate") || "";

    if (!title) continue;

    let date = "", time = "";
    if (pubDate) {
      try {
        const d = new Date(pubDate);
        if (!isNaN(d)) {
          date = d.toISOString().slice(0, 10);
          time = d.toISOString().slice(11, 16);
        }
      } catch {}
    }

    items.push({ title, desc, url: link, pubDate, date, time });
  }

  if (!items.length) throw new Error("No items parsed");
  return items;
}
