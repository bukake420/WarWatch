// Base events — always returned as anchor data
const BASE_EVENTS = [
  { id:1,  lat:35.6892, lng:51.3890, title:"Tehran — IRGC HQ & Palace Complex",      type:"us_il",     date:"2026-03-20", confidence:"confirmed", desc:"Large explosions near Saadabad Palace complex. Series of strikes on military C2 infrastructure. IRGC confirms multiple sites hit.", verified:true },
  { id:2,  lat:35.7500, lng:51.4200, title:"Tehran — Khamenei Killed (Day 1)",        type:"hvt",       date:"2026-02-28", confidence:"confirmed", desc:"Supreme Leader Ali Khamenei killed in Israeli airstrike. Confirmed by IRIB, Fars News, Trump, and Netanyahu. Son Mojtaba named successor.", verified:true },
  { id:3,  lat:35.6892, lng:51.3890, title:"Tehran — Larijani Assassinated",          type:"hvt",       date:"2026-03-17", confidence:"confirmed", desc:"Israel assassinated Ali Larijani, Secretary of Iran's Supreme National Security Council. IRGC vowed 'zero restraint' in response.", verified:true },
  { id:4,  lat:38.0962, lng:46.2738, title:"Tabriz — 2nd Artesh Airbase Cratered",   type:"us_il",     date:"2026-03-03", confidence:"confirmed", desc:"Satellite imagery: 11 craters on runway of 2nd Artesh Air Force Tactical Airbase. Rendered inoperable. IAF destroyed F-4 and two F-5s.", verified:true },
  { id:5,  lat:37.4000, lng:47.0000, title:"Tabriz — 6th Artesh Aviation Base",      type:"us_il",     date:"2026-03-03", confidence:"confirmed", desc:"Satellite imagery shows damaged logistics facility near 6th Artesh Ground Forces Aviation Base.", verified:true },
  { id:6,  lat:29.5918, lng:52.5837, title:"Shiraz — 7th Artesh Airbase",            type:"us_il",     date:"2026-03-02", confidence:"confirmed", desc:"Satellite imagery: two craters and damaged building in southern section of 7th Artesh Air Force Tactical Airbase.", verified:true },
  { id:7,  lat:32.6546, lng:51.6680, title:"Isfahan — Nuclear & Air Defense Sites",  type:"us_il",     date:"2026-02-28", confidence:"confirmed", desc:"Opening US strike package targeted nuclear facilities and air defense near Isfahan. GBU-57 bunker-busters deployed.", verified:true },
  { id:8,  lat:33.7244, lng:51.7252, title:"Natanz — Enrichment Facility",           type:"us_il",     date:"2026-02-28", confidence:"confirmed", desc:"Natanz uranium enrichment facility targeted in Day 1 strikes. IAEA reported 460kg of 60% enriched uranium on site.", verified:true },
  { id:9,  lat:29.2569, lng:50.3243, title:"Kharg Island — Oil Export Terminal",     type:"us_il",     date:"2026-03-01", confidence:"confirmed", desc:"US/Israeli strikes on Kharg Island, Iran's primary oil export terminal.", verified:true },
  { id:10, lat:27.1500, lng:52.6000, title:"South Pars — Gas Field Strike",          type:"us_il",     date:"2026-03-18", confidence:"confirmed", desc:"Israel struck South Pars gasfield, Iran's largest natural gas reserve. Iran warned 'zero restraint'.", verified:true },
  { id:11, lat:34.3277, lng:47.0650, title:"Kermanshah — Missile Launchers",         type:"us_il",     date:"2026-03-01", confidence:"confirmed", desc:"300+ Iranian ballistic missile launchers destroyed across Iran by Mar 3. Iranian missile fire dropped ~90% by day 10.", verified:true },
  { id:12, lat:34.6416, lng:50.8746, title:"Arak — Civilian Strike",                 type:"us_il",     date:"2026-03-17", confidence:"confirmed", desc:"3-day-old infant and 2-year-old sister killed in strike on residential home in Arak. Mother and grandmother also killed.", verified:true },
  { id:13, lat:27.1500, lng:57.0833, title:"Minab — Girls School (170+ Dead)",       type:"us_il",     date:"2026-03-10", confidence:"confirmed", desc:"Deadliest single incident. Airstrike on elementary girls' school in Minab killed 170+. Confirmed by Amnesty International.", verified:true },
  { id:14, lat:31.7517, lng:34.9896, title:"Beit Shemesh — 9 Civilians Killed",      type:"iran",      date:"2026-03-01", confidence:"confirmed", desc:"Deadliest Iranian strike on Israel. Ballistic missile hit residential neighborhood, killing 9 civilians.", verified:true },
  { id:15, lat:32.0786, lng:34.8207, title:"Ramat Gan — Cluster Warhead",            type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iranian cluster warhead killed two residents in their 70s. IRGC called it 'revenge for Larijani.'", verified:true },
  { id:16, lat:32.7940, lng:34.9896, title:"Haifa — Iranian Retaliatory Strike",     type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iran struck Haifa in retaliation for South Pars attack. Arrow system intercepted majority of barrage.", verified:true },
  { id:17, lat:31.8928, lng:35.0266, title:"Ben Gurion Airport — Hit",               type:"iran",      date:"2026-03-15", confidence:"confirmed", desc:"Missile struck three private planes on tarmac. Israeli authorities capped outbound flights at 130 passengers.", verified:true },
  { id:18, lat:31.7683, lng:35.2137, title:"Jerusalem — Holy Site Debris",           type:"iran",      date:"2026-03-17", confidence:"confirmed", desc:"Missile fragments found near Al-Aqsa Mosque and Church of Holy Sepulchre. No casualties.", verified:true },
  { id:19, lat:25.9000, lng:51.5500, title:"Ras Laffan, Qatar — LNG Terminal Hit",  type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iran struck Qatar's LNG export hub. 13 of 14 ballistic missiles intercepted.", verified:true },
  { id:20, lat:25.1222, lng:56.3367, title:"Fujairah, UAE — Oil Zone Attack",        type:"iran",      date:"2026-03-18", confidence:"confirmed", desc:"Drone attack ignited fire in UAE oil industry zone. Debris killed one Pakistani national in Abu Dhabi.", verified:true },
  { id:21, lat:33.1000, lng:35.6333, title:"Nahariya — Hezbollah Attack",            type:"hezbollah", date:"2026-03-17", confidence:"confirmed", desc:"Hezbollah launched attack on northern Israel. One man wounded. 1M+ Lebanese displaced.", verified:true },
  { id:22, lat:24.6877, lng:46.7219, title:"Riyadh — Saudi Intercepts",              type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Saudi Arabia intercepting Iranian missiles in own airspace. KSA says 'trust gone.'", verified:true },
];

// In-memory cache (persists between warm Lambda invocations)
let cache = { data: null, ts: 0 };
const TTL = 3600 * 1000; // 1 hour

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600",
  };

  // Return cached data if fresh
  if (cache.data && Date.now() - cache.ts < TTL) {
    return { statusCode: 200, body: JSON.stringify(cache.data), headers };
  }

  let liveEvents = [];

  try {
    // 1. Fetch GDELT Doc 2.0 — Iran/Israel/Gulf conflict headlines, last 24h
    const gdeltUrl =
      "https://api.gdeltproject.org/api/v2/doc/doc" +
      "?query=iran+israel+military+strike+IRGC+IDF" +
      "&mode=artlist&maxrecords=20&format=json&timespan=24h&sort=DateDesc";

    const gdeltRes = await fetch(gdeltUrl);
    const gdelt = gdeltRes.ok ? await gdeltRes.json() : { articles: [] };
    const articles = (gdelt.articles || []).slice(0, 15);

    if (articles.length > 0) {
      const headlines = articles
        .map((a, i) => `${i + 1}. ${a.title} [${a.domain}, ${a.seendate?.slice(0,8) || "today"}]`)
        .join("\n");

      // 2. Claude: classify headlines → typed event objects
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
            max_tokens: 1500,
            system: [
              "You are a military OSINT analyst processing news headlines about the Iran-Israel-US conflict.",
              "For each relevant headline, return a JSON event object. Ignore unrelated headlines.",
              "Return ONLY a raw JSON array — no markdown, no explanation, no code fences.",
              "Each object must have exactly these fields:",
              '{ "id": <integer 2000-2999>, "lat": <float>, "lng": <float>,',
              '  "title": "<City/Location — brief event title>",',
              '  "type": "<us_il|iran|hezbollah|hvt>",',
              '  "date": "<YYYY-MM-DD>",',
              '  "confidence": "<confirmed|reported|unverified>",',
              '  "desc": "<2-3 sentences with source attribution>",',
              '  "verified": <true|false> }',
              "Use accurate lat/lng for the specific location mentioned.",
              "type = us_il for US or Israeli strikes/ops; iran for Iranian strikes/ops; hezbollah for Hezbollah; hvt for high-value target eliminations.",
              "If no headlines are relevant to the Iran-Israel-Gulf conflict, return [].",
            ].join(" "),
            messages: [{
              role: "user",
              content: `Classify these headlines into OSINT events:\n\n${headlines}`,
            }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = claudeData?.content?.[0]?.text?.trim() || "";
          // Strip any accidental markdown fences
          const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          try {
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) liveEvents = parsed;
          } catch (e) {
            // Claude returned non-JSON — skip live events, use base only
          }
        }
      }
    }
  } catch (err) {
    // Network failure — fall back to base events only
  }

  // 3. Merge base events + live events (base always wins on id conflicts)
  const merged = [...BASE_EVENTS, ...liveEvents];
  cache = { data: merged, ts: Date.now() };

  return { statusCode: 200, body: JSON.stringify(merged), headers };
};
