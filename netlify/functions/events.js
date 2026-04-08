// events.js — live conflict events from GDELT + BBC + Reuters + Claude classification
// BASE_EVENTS are the scenario premise (fictional war, clearly marked scenario:true).
// Live events from real news sources are merged on top with verified:true only when
// they come from a real classified headline with a source URL.

// ⚠ SCENARIO BASIS — these events define the fictional 2026 Iran war premise.
// They are NOT real historical events. scenario:true marks them as such.
const BASE_EVENTS = [
  { id:1,  lat:35.6892, lng:51.3890, title:"Tehran — IRGC HQ & Palace Complex",      type:"us_il",     date:"2026-03-20", confidence:"reported",   desc:"[SCENARIO] Large explosions near Saadabad Palace complex. Series of strikes on military C2 infrastructure. IRGC confirms multiple sites hit.", verified:false, scenario:true },
  { id:2,  lat:35.7500, lng:51.4200, title:"Tehran — Khamenei (Scenario Day 1)",      type:"hvt",       date:"2026-02-28", confidence:"reported",   desc:"[SCENARIO] Supreme Leader Ali Khamenei killed in Israeli airstrike per scenario premise. Son Mojtaba named successor.", verified:false, scenario:true },
  { id:3,  lat:35.6892, lng:51.3890, title:"Tehran — Larijani (Scenario)",            type:"hvt",       date:"2026-03-17", confidence:"reported",   desc:"[SCENARIO] Ali Larijani, Secretary of Iran's Supreme National Security Council, targeted per scenario premise.", verified:false, scenario:true },
  { id:4,  lat:38.0962, lng:46.2738, title:"Tabriz — 2nd Artesh Airbase",             type:"us_il",     date:"2026-03-03", confidence:"reported",   desc:"[SCENARIO] Scenario premise: 11 craters on runway of 2nd Artesh Air Force Tactical Airbase. Rendered inoperable.", verified:false, scenario:true },
  { id:5,  lat:37.4000, lng:47.0000, title:"Tabriz — 6th Artesh Aviation Base",       type:"us_il",     date:"2026-03-03", confidence:"reported",   desc:"[SCENARIO] Scenario premise: damaged logistics facility near 6th Artesh Ground Forces Aviation Base.", verified:false, scenario:true },
  { id:6,  lat:29.5918, lng:52.5837, title:"Shiraz — 7th Artesh Airbase",             type:"us_il",     date:"2026-03-02", confidence:"reported",   desc:"[SCENARIO] Scenario premise: two craters and damaged building in southern section of 7th Artesh Air Force Tactical Airbase.", verified:false, scenario:true },
  { id:7,  lat:32.6546, lng:51.6680, title:"Isfahan — Nuclear & Air Defense Sites",   type:"us_il",     date:"2026-02-28", confidence:"reported",   desc:"[SCENARIO] Scenario premise: US strike package targeted nuclear facilities and air defense near Isfahan. GBU-57 bunker-busters.", verified:false, scenario:true },
  { id:8,  lat:33.7244, lng:51.7252, title:"Natanz — Enrichment Facility",            type:"us_il",     date:"2026-02-28", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Natanz uranium enrichment facility targeted in Day 1 strikes.", verified:false, scenario:true },
  { id:9,  lat:29.2569, lng:50.3243, title:"Kharg Island — Oil Export Terminal",      type:"us_il",     date:"2026-03-01", confidence:"reported",   desc:"[SCENARIO] Scenario premise: strikes on Kharg Island, Iran's primary oil export terminal.", verified:false, scenario:true },
  { id:10, lat:27.1500, lng:52.6000, title:"South Pars — Gas Field (Scenario)",       type:"us_il",     date:"2026-03-18", confidence:"reported",   desc:"[SCENARIO] Scenario premise: South Pars gasfield, Iran's largest natural gas reserve, targeted.", verified:false, scenario:true },
  { id:11, lat:34.3277, lng:47.0650, title:"Kermanshah — Missile Launchers",          type:"us_il",     date:"2026-03-01", confidence:"reported",   desc:"[SCENARIO] Scenario premise: 300+ Iranian ballistic missile launchers destroyed across Iran.", verified:false, scenario:true },
  { id:12, lat:34.6416, lng:50.8746, title:"Arak — Civilian Strike (Scenario)",       type:"us_il",     date:"2026-03-17", confidence:"reported",   desc:"[SCENARIO] Scenario premise: civilian casualties in residential area of Arak.", verified:false, scenario:true },
  { id:13, lat:27.1500, lng:57.0833, title:"Minab — School Strike (Scenario)",        type:"us_il",     date:"2026-03-10", confidence:"reported",   desc:"[SCENARIO] Scenario premise: airstrike on school in Minab per scenario parameters.", verified:false, scenario:true },
  { id:14, lat:31.7517, lng:34.9896, title:"Beit Shemesh — Iranian Strike (Scenario)",type:"iran",      date:"2026-03-01", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Iranian ballistic missile hit residential neighborhood.", verified:false, scenario:true },
  { id:15, lat:32.0786, lng:34.8207, title:"Ramat Gan — Scenario Strike",             type:"iran",      date:"2026-03-19", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Iranian munition in Ramat Gan area.", verified:false, scenario:true },
  { id:16, lat:32.7940, lng:34.9896, title:"Haifa — Iranian Strike (Scenario)",       type:"iran",      date:"2026-03-19", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Iran struck Haifa. Arrow system intercepted majority of barrage.", verified:false, scenario:true },
  { id:17, lat:31.8928, lng:35.0266, title:"Ben Gurion Airport — Scenario",           type:"iran",      date:"2026-03-15", confidence:"reported",   desc:"[SCENARIO] Scenario premise: missile struck private planes on tarmac.", verified:false, scenario:true },
  { id:18, lat:31.7683, lng:35.2137, title:"Jerusalem — Holy Site Debris (Scenario)", type:"iran",      date:"2026-03-17", confidence:"reported",   desc:"[SCENARIO] Scenario premise: missile fragments near Al-Aqsa and Church of Holy Sepulchre.", verified:false, scenario:true },
  { id:19, lat:25.9000, lng:51.5500, title:"Ras Laffan, Qatar — LNG Terminal",        type:"iran",      date:"2026-03-19", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Iran struck Qatar's LNG export hub.", verified:false, scenario:true },
  { id:20, lat:25.1222, lng:56.3367, title:"Fujairah, UAE — Oil Zone (Scenario)",     type:"iran",      date:"2026-03-18", confidence:"reported",   desc:"[SCENARIO] Scenario premise: drone attack on UAE oil industry zone.", verified:false, scenario:true },
  { id:21, lat:33.1000, lng:35.6333, title:"Nahariya — Hezbollah (Scenario)",         type:"hezbollah", date:"2026-03-17", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Hezbollah attack on northern Israel.", verified:false, scenario:true },
  { id:22, lat:24.6877, lng:46.7219, title:"Riyadh — Saudi Intercepts (Scenario)",    type:"iran",      date:"2026-03-19", confidence:"reported",   desc:"[SCENARIO] Scenario premise: Saudi Arabia intercepting missiles in own airspace.", verified:false, scenario:true },
];

// In-memory cache — 15 minutes (was 1 hour; faster refresh for live data)
let cache = { data: null, ts: 0 };
const TTL = 15 * 60 * 1000;

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=900",
  };

  if (cache.data && Date.now() - cache.ts < TTL) {
    return { statusCode: 200, body: JSON.stringify(cache.data), headers };
  }

  let liveEvents = [];

  try {
    // Fetch from GDELT + BBC + Reuters in parallel
    const [gdeltResult, bbcResult, reutersResult] = await Promise.allSettled([
      fetchGdelt(),
      fetchRSSHeadlines("https://feeds.bbci.co.uk/news/world/rss.xml", "BBC"),
      fetchRSSHeadlines("https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best", "Reuters"),
    ]);

    const headlineBlocks = [];

    if (gdeltResult.status === "fulfilled") headlineBlocks.push(gdeltResult.value);
    if (bbcResult.status === "fulfilled") headlineBlocks.push(bbcResult.value);
    if (reutersResult.status === "fulfilled") headlineBlocks.push(reutersResult.value);

    const headlines = headlineBlocks.join("\n\n");

    if (headlines.trim()) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            system: [
              "You are a military OSINT analyst processing news headlines about the Israel-Iran-US conflict (Operation Epic Fury, ongoing since Feb 28 2026).",
              "For each RELEVANT headline (strikes, military ops, diplomacy, nuclear, Hormuz, proxies), return a typed event object.",
              "ONLY classify headlines that are GENUINELY related to this conflict. Ignore unrelated news.",
              "Return ONLY a raw JSON array — no markdown, no explanation.",
              "Each object: { \"id\": <int 2000-2999>, \"lat\": <float>, \"lng\": <float>,",
              "  \"title\": \"<City — brief title>\",",
              "  \"type\": \"<us_il|iran|hezbollah|hvt>\",",
              "  \"date\": \"<YYYY-MM-DD>\",",
              "  \"confidence\": \"<confirmed|reported|unverified>\",",
              "  \"desc\": \"<2-3 sentences with source>\",",
              "  \"verified\": <true|false>,",
              "  \"sourceUrl\": \"<article URL if available>\" }",
              "Use type=us_il for US/Israeli ops; iran for Iranian ops; hezbollah; hvt for HVT kills.",
              "Use accurate coordinates. If no relevant headline, return [].",
            ].join(" "),
            messages: [{
              role: "user",
              content: `Classify conflict-relevant events from these headlines:\n\n${headlines}`,
            }],
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = (claudeData?.content?.[0]?.text || "").trim();
          const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          try {
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) liveEvents = parsed;
          } catch {}
        }
      }
    }
  } catch {}

  const existIds = new Set(BASE_EVENTS.map(e => e.id));
  const newEvents = liveEvents.filter(e => !existIds.has(e.id));
  const merged = [...BASE_EVENTS, ...newEvents];
  cache = { data: merged, ts: Date.now() };

  return { statusCode: 200, body: JSON.stringify(merged), headers };
};

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchGdelt() {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    "?query=iran+israel+military+strike+IRGC+IDF+Gulf+Hormuz+ceasefire+nuclear" +
    "&mode=artlist&maxrecords=20&format=json&timespan=24h&sort=DateDesc";
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  const articles = (data.articles || []).slice(0, 15);
  if (!articles.length) throw new Error("No articles");
  return "GDELT (last 24h):\n" +
    articles.map((a, i) =>
      `${i + 1}. ${a.title} [${a.domain}, ${a.seendate?.slice(0, 10) || "today"}, ${a.url || ""}]`
    ).join("\n");
}

async function fetchRSSHeadlines(url, label) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept":     "application/rss+xml, text/xml, */*",
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

  while ((m = rx.exec(xml)) !== null && items.length < 12) {
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
    const pubDate = get("published") || get("updated") || get("pubDate") || "";
    if (title) items.push(`${items.length + 1}. ${title} [${pubDate.slice(0, 10)}, ${link}]`);
  }

  if (!items.length) throw new Error("No items");
  return `${label}:\n${items.join("\n")}`;
}
