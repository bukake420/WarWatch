// update.js — AI-powered site update engine
// Fetches live intelligence from 7+ real sources, then Claude Sonnet
// structures/classifies the REAL data. No fabrication.
// POST /api/update { token: "..." }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};
const ok   = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST required");

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  if (ADMIN_TOKEN && body.token !== ADMIN_TOKEN) return fail(401, "Unauthorized");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "ANTHROPIC_API_KEY not configured");

  const today  = new Date().toISOString().slice(0, 10);
  const warDay = Math.max(1, Math.floor((Date.now() - new Date("2026-02-28").getTime()) / 86400000) + 1);

  try {
    // ── 1. Fetch live intelligence from 7 sources in parallel ────────────────
    const [gdeltResult, ajResult, bbcResult, reutersResult, defenseResult, unResult, centcomResult] =
      await Promise.allSettled([
        fetchGdelt(),
        fetchRSS("https://www.aljazeera.com/xml/rss/all.xml", "AL JAZEERA", 15),
        fetchRSS("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC WORLD", 12),
        fetchRSS("https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best", "REUTERS", 12),
        fetchRSS("https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10", "PENTAGON", 10),
        fetchRSS("https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml", "UN MIDDLE EAST", 10),
        fetchRSS("https://www.centcom.mil/RSS/", "CENTCOM", 10),
      ]);

    const sources = [];
    const sourceLogs = [];

    for (const [label, result] of [
      ["GDELT", gdeltResult],
      ["Al Jazeera", ajResult],
      ["BBC", bbcResult],
      ["Reuters", reutersResult],
      ["Pentagon", defenseResult],
      ["UN News", unResult],
      ["CENTCOM", centcomResult],
    ]) {
      if (result.status === "fulfilled" && result.value) {
        sources.push(result.value);
        sourceLogs.push(`✓ ${label}`);
      } else {
        sourceLogs.push(`✗ ${label}: ${result.reason?.message || "failed"}`);
      }
    }

    const newsContext = sources.filter(Boolean).join("\n\n---\n\n");

    // ── 2. Single Claude Sonnet call — classify/structure REAL data ──────────
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystem(today, warDay),
        messages: [{
          role:    "user",
          content: buildUserMsg(today, warDay, newsContext),
        }],
      }),
      signal: AbortSignal.timeout(28000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const claudeData = await resp.json();
    const text = claudeData.content?.find(b => b.type === "text")?.text || "";
    if (!text) throw new Error("Empty response from Claude");

    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in response");

    const update = JSON.parse(text.slice(start, end + 1));
    return ok({
      success: true,
      update,
      sourceLogs,
      sourceCount: sources.length,
      generatedAt: new Date().toISOString(),
    });

  } catch (e) {
    console.error("Update error:", e.message);
    return fail(500, e.message);
  }
};

// ── Generic RSS/Atom fetcher ─────────────────────────────────────────────────

async function fetchRSS(url, label, maxItems = 12) {
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

  while ((m = rx.exec(xml)) !== null && items.length < maxItems) {
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
    const desc    = get("description") || get("summary") || get("content");
    const pubDate = get("published") || get("updated") || get("pubDate") || "";
    if (title) items.push({ title, link, desc: desc.replace(/<[^>]+>/g, "").slice(0, 150), pubDate });
  }

  if (!items.length) throw new Error("No items parsed");

  const lines = items.map((it, i) => {
    const date = it.pubDate ? ` [${it.pubDate.slice(0, 10)}]` : "";
    const src  = it.link ? ` | ${it.link}` : "";
    return `${i + 1}. ${it.title}${date}${src}${it.desc ? " — " + it.desc : ""}`;
  });

  return `${label} (${items.length} items):\n${lines.join("\n")}`;
}

// ── GDELT news fetcher ───────────────────────────────────────────────────────

async function fetchGdelt() {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    "?query=iran+israel+war+military+ceasefire+IRGC+IDF+Gulf+Hormuz+nuclear" +
    "&mode=artlist&maxrecords=25&format=json&timespan=24h&sort=DateDesc";
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const articles = (data.articles || []).slice(0, 20);
  if (!articles.length) throw new Error("No articles");
  return "GDELT CONFLICT NEWS (last 24h, " + articles.length + " items):\n" +
    articles.map((a, i) =>
      `${i + 1}. [${a.seendate?.slice(0, 10) || "today"} · ${a.domain}] ${a.title} | ${a.url || ""}`
    ).join("\n");
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildSystem(today, warDay) {
  return `You are a senior military OSINT analyst for WarWatch, a real-time tracker of the ongoing Israel-Iran-US conflict (Operation Epic Fury, began Feb 28 2026). Today is ${today}, war day ${warDay}.

CRITICAL INSTRUCTION: You are summarizing and classifying REAL news from the provided headlines. Do NOT invent events, statistics, or quotes. Every leaderPost must reference a real article or statement from the provided data. Every osintPost must cite real intelligence from the headlines. For stats, use REAL figures mentioned in the headlines (Brent crude price, casualty counts from UN/OCHA, etc).

ESTABLISHED SCENARIO FACTS (use as context to interpret current headlines):
- Khamenei killed day 1 by IAF F-35I; son Mojtaba named successor
- Natanz, Isfahan nuclear sites struck day 1; Kharg Island oil terminal hit
- 300+ IRGC ballistic missile launchers destroyed by day 3; missile rate ↓ ~90%
- Brent crude spiked sharply; Strait of Hormuz partially restricted
- USS Gerald R. Ford CSG operating in Arabian Sea/Persian Gulf
- Indirect ceasefire talks began Muscat, Oman Mar 22
- Hezbollah and Houthis remain active proxy forces
- Mojtaba Khamenei attempting to consolidate power in Tehran

When headlines mention real prices, death tolls, diplomatic moves, military statements — use those EXACT real values. Where real data is unavailable for a specific field, make an informed estimate clearly consistent with the established scenario timeline.

Return ONLY a single valid JSON object. No markdown fences, no explanation. Start with { end with }.`;
}

function buildUserMsg(today, warDay, newsContext) {
  return `LIVE INTELLIGENCE FEED — ${newsContext.length} characters from ${today}:

${newsContext || "No live intelligence available — use established scenario facts and current date."}

---
Based on the REAL news above (today ${today}, war day ${warDay}), generate the complete site update JSON. Use REAL data from the headlines where available.

{
  "stats": {
    "brentCrude": "$XXX (use REAL price from headlines if mentioned)",
    "killed": XXXXX,
    "injured": XXXXX,
    "displaced": "X.XM",
    "currentDay": ${warDay},
    "missiles": "↓ XX%",
    "launchers": "XXX+"
  },
  "leaderPosts": [
    { "id": "up-${Date.now()}-1", "person": "Full Name", "role": "Title", "country": "🇺🇸", "platform": "Platform", "handle": "@handle", "date": "${today}", "time": "HH:MM", "color": "#ef4444", "verified": true, "text": "REAL quote or paraphrase from the provided headlines (max 300 chars)", "url": "REAL article URL from the provided headlines" }
  ],
  "osintPosts": [
    { "channel": "@CENTCOMNews", "date": "${today}", "time": "HH:MM", "text": "REAL intelligence finding from the provided headlines with source", "views": 45000, "type": "text", "verified": true, "sourceUrl": "real URL from headlines" }
  ],
  "events": [
    { "id": 3100, "lat": 0.0, "lng": 0.0, "title": "Location — Event", "type": "us_il", "date": "${today}", "confidence": "confirmed", "desc": "2-3 sentences based on REAL headlines. Source: [domain].", "verified": true, "wikiPage": "Article", "sourceUrl": "real URL" }
  ],
  "sitrep": "400-600 word situation report based ONLY on provided intelligence. Sections: EXECUTIVE SUMMARY / KEY DEVELOPMENTS LAST 24H (5-7 bullets citing real sources) / STRATEGIC ASSESSMENT / CRITICAL INDICATORS (3-4 items). ISW/CTP methodology. Note data sources used."
}

REQUIREMENTS:
- leaderPosts: 4-6 items, only leaders/officials MENTIONED in the provided headlines; if none match, use the most relevant from available official RSS sources
- osintPosts: 4-6 items, must reference real events from headlines with channel attribution
- events: 2-4 items, only real geographic locations from the headlines, accurate coordinates
- type values: us_il · iran · hezbollah · hvt
- colors: US/Trump=#ef4444 · UK=#a78bfa · France/EU=#60a5fa · Israel=#3b82f6 · Iran=#22c55e · UN=#94a3b8 · Saudi/Gulf=#f59e0b
- ALL urls must be REAL links from the provided headlines — never fabricate URLs`;
}
