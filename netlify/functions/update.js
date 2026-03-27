// update.js — AI-powered site update engine
// Fetches live news from GDELT + Al Jazeera RSS, passes to Claude Sonnet in ONE call.
// Single-call design keeps total runtime ~15-20s — well within Netlify's timeout.
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
    // ── 1. Fetch live news context in parallel ────────────────────────────────
    const [gdeltText, ajText] = await Promise.allSettled([
      fetchGdelt(),
      fetchAlJazeera(),
    ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : ""));

    const newsContext = [gdeltText, ajText].filter(Boolean).join("\n\n");

    // ── 2. Single Claude Sonnet call ──────────────────────────────────────────
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

    // Extract outermost JSON object
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in response");

    const update = JSON.parse(text.slice(start, end + 1));
    return ok({ success: true, update, generatedAt: new Date().toISOString() });

  } catch (e) {
    console.error("Update error:", e.message);
    return fail(500, e.message);
  }
};

// ── News fetchers ─────────────────────────────────────────────────────────────

async function fetchGdelt() {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    "?query=iran+israel+war+military+ceasefire+IRGC+IDF+Gulf+Hormuz" +
    "&mode=artlist&maxrecords=25&format=json&timespan=24h&sort=DateDesc";
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return "";
  const data = await r.json();
  const articles = (data.articles || []).slice(0, 20);
  if (!articles.length) return "";
  return "RECENT NEWS HEADLINES (GDELT, last 24h):\n" +
    articles.map((a, i) =>
      `${i + 1}. [${a.seendate?.slice(0, 8) || "today"} · ${a.domain}] ${a.title}`
    ).join("\n");
}

async function fetchAlJazeera() {
  const r = await fetch("https://www.aljazeera.com/xml/rss/all.xml", {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, text/xml, */*" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return "";
  const xml = await r.text();
  // Extract up to 15 <item> titles + descriptions
  const items = [];
  const rx = /<item[\s>]([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null && items.length < 15) {
    const get = tag => {
      const tr = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, "i").exec(m[1]);
      return tr ? (tr[1] || tr[2] || "").trim() : "";
    };
    const title = get("title");
    const desc  = get("description").slice(0, 120);
    if (title) items.push(`- ${title}${desc ? ": " + desc : ""}`);
  }
  if (!items.length) return "";
  return "AL JAZEERA RSS (latest):\n" + items.join("\n");
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystem(today, warDay) {
  return `You are a senior military OSINT analyst for WarWatch, a real-time tracker of the ongoing Israel-Iran-US conflict (Operation Epic Fury, began Feb 28 2026). Today is ${today}, war day ${warDay}.

ESTABLISHED SCENARIO FACTS:
- Khamenei killed day 1 by IAF F-35I; son Mojtaba named successor
- Natanz, Isfahan nuclear sites struck day 1; Kharg Island oil terminal hit
- 300+ IRGC ballistic missile launchers destroyed by day 3; missile rate ↓ ~90%
- Brent crude spiked sharply; Strait of Hormuz partially restricted
- USS Gerald R. Ford CSG in Persian Gulf/Arabian Sea
- Indirect ceasefire talks began Muscat, Oman Mar 22
- Hezbollah and Houthis remain active proxy forces

You will be given real current news headlines. Use them to inform the update — adapt real-world developments (sanctions talks, oil prices, diplomatic moves, military statements) into the scenario context. Where specific current prices or figures are mentioned in the headlines, use them. Where not available, make informed estimates consistent with the scenario.

Return ONLY a single valid JSON object. No markdown fences, no explanation. Start with { end with }.`;
}

function buildUserMsg(today, warDay, newsContext) {
  return `${newsContext || "No live headlines available — use scenario knowledge and current date."}

Based on the above real news context and today's date (${today}, war day ${warDay}), generate the complete site update JSON:

{
  "stats": {
    "brentCrude": "$XXX",
    "killed": XXXXX,
    "injured": XXXXX,
    "displaced": "X.XM",
    "currentDay": ${warDay},
    "missiles": "↓ XX%",
    "launchers": "XXX+"
  },
  "leaderPosts": [
    { "id": "up-${Date.now()}-1", "person": "Full Name", "role": "Title", "country": "🇺🇸", "platform": "Platform", "handle": "@handle", "date": "${today}", "time": "HH:MM", "color": "#ef4444", "verified": true, "text": "Statement based on real news (max 300 chars)", "url": "https://source.com" }
  ],
  "osintPosts": [
    { "channel": "@IDFSpokesperson", "date": "${today}", "time": "HH:MM", "text": "Intelligence finding based on real developments", "views": 45000, "type": "text", "verified": true }
  ],
  "events": [
    { "id": 3100, "lat": 0.0, "lng": 0.0, "title": "Location — Event", "type": "us_il", "date": "${today}", "confidence": "confirmed", "desc": "2-3 sentences.", "verified": true, "wikiPage": "Article" }
  ],
  "sitrep": "400-600 word situation report. Sections: EXECUTIVE SUMMARY / KEY DEVELOPMENTS LAST 24H (5-7 bullets) / STRATEGIC ASSESSMENT / CRITICAL INDICATORS (3-4 items). ISW/CTP style."
}

REQUIREMENTS:
- leaderPosts: exactly 5, varied leaders (Trump, Netanyahu, Macron/EU, UN SG, Iranian/Saudi FM, Starmer, Erdogan)
- osintPosts: exactly 5, varied channels (@IDFSpokesperson, @CENTCOMNews, @OSINTdefender, @IntelDoge, @IRNA_NEWS or @HouthiMilSpo)
- events: 2-3 items, unique ids 3100-3199, accurate real-world coordinates
- type values: us_il · iran · hezbollah · hvt
- colors: US/Trump=#ef4444 · UK=#a78bfa · France/EU=#60a5fa · Israel=#3b82f6 · Iran=#22c55e · UN=#94a3b8 · Saudi/Gulf=#f59e0b
- If real Brent crude price appears in headlines, use it exactly; otherwise estimate near scenario level`;
}
