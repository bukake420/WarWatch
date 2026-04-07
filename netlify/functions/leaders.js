// leaders.js — fetches real posts from verified government, military, and official news RSS feeds.
// Prioritises direct leadership statements over news aggregators.
// Claude Haiku filters for conflict relevance (optional — falls back to all posts without API key).
// 15-minute in-memory cache.

const RSS_SOURCES = [
  // ── US Government / Military — direct official feeds ─────────────────────
  {
    person:"Donald Trump", role:"US President", country:"🇺🇸", color:"#ef4444",
    platform:"Truth Social", handle:"@realDonaldTrump",
    url:"https://truthsocial.com/@realDonaldTrump.rss",
    useDesc:true,
  },
  {
    person:"Donald Trump", role:"US President", country:"🇺🇸", color:"#ef4444",
    platform:"White House", handle:"@POTUS",
    url:"https://www.whitehouse.gov/news/feed/",
    useDesc:true,
  },
  {
    person:"US Dept of Defense", role:"Pentagon Press", country:"🇺🇸", color:"#f97316",
    platform:"Defense.gov", handle:"@PentagonPressSec",
    url:"https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=15",
    useDesc:true,
  },
  {
    person:"US CENTCOM", role:"US Central Command", country:"🇺🇸", color:"#60a5fa",
    platform:"CENTCOM", handle:"@CENTCOM",
    url:"https://www.centcom.mil/RSS/",
    useDesc:true,
  },
  {
    person:"US State Dept", role:"Secretary of State", country:"🇺🇸", color:"#3b82f6",
    platform:"State.gov", handle:"@StateDept",
    url:"https://www.state.gov/rss-feeds/press-releases/",
    useDesc:true,
  },
  // ── UK ────────────────────────────────────────────────────────────────────
  {
    person:"Keir Starmer", role:"UK Prime Minister", country:"🇬🇧", color:"#a78bfa",
    platform:"Gov.uk", handle:"@Keir_Starmer",
    url:"https://www.gov.uk/search/news-and-communications.atom?people%5B%5D=keir-starmer",
    useDesc:true,
  },
  // ── United Nations ────────────────────────────────────────────────────────
  {
    person:"António Guterres", role:"UN Secretary-General", country:"🇺🇳", color:"#94a3b8",
    platform:"UN Press", handle:"@antonioguterres",
    url:"https://press.un.org/en/rss.xml",
    useDesc:true,
  },
  {
    person:"UN News", role:"Middle East Desk", country:"🇺🇳", color:"#94a3b8",
    platform:"UN News", handle:"@UN_News_ME",
    url:"https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml",
    useDesc:true,
  },
  // ── Israel ────────────────────────────────────────────────────────────────
  {
    person:"Israeli PM Office", role:"Netanyahu / Israeli Govt", country:"🇮🇱", color:"#3b82f6",
    platform:"PMO", handle:"@IsraeliPM",
    url:"https://www.pmo.gov.il/English/MediaCenter/RSS/Pages/default.aspx",
    useDesc:true,
  },
  {
    person:"IDF Spokesperson", role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6",
    platform:"IDF Blog", handle:"@IDFSpokesperson",
    url:"https://www.idf.il/en/mini-sites/rss/",
    useDesc:true,
  },
  // ── NATO / European ───────────────────────────────────────────────────────
  {
    person:"NATO", role:"NATO Secretary-General", country:"🌐", color:"#60a5fa",
    platform:"NATO.int", handle:"@NATO",
    url:"https://www.nato.int/cps/en/natolive/news.rss.htm",
    useDesc:true,
  },
  // ── Regional ─────────────────────────────────────────────────────────────
  {
    person:"Saudi Press Agency", role:"Saudi Arabia Official", country:"🇸🇦", color:"#22c55e",
    platform:"SPA", handle:"@SPAregions",
    url:"https://www.spa.gov.sa/rss/En_Feeds.xml",
    useDesc:true,
  },
  // ── Nuclear / International bodies ───────────────────────────────────────
  {
    person:"IAEA", role:"Nuclear Watchdog", country:"🌐", color:"#22c55e",
    platform:"IAEA", handle:"@iaeaorg",
    url:"https://www.iaea.org/feeds/topstories.rss",
    useDesc:true,
  },
  // ── Middle East news (for context when official feeds are sparse) ─────────
  {
    person:"Al Jazeera", role:"Middle East Coverage", country:"🌍", color:"#eab308",
    platform:"Al Jazeera", handle:"@AJEnglish",
    url:"https://www.aljazeera.com/xml/rss/all.xml",
    useDesc:true,
  },
  {
    person:"BBC Middle East", role:"Regional Correspondent", country:"🇬🇧", color:"#a78bfa",
    platform:"BBC", handle:"@BBCMiddleEast",
    url:"https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    useDesc:true,
  },
];

// 15-minute in-memory cache (was 30-min; faster refresh for live conflict data)
let cache = { posts: null, ts: 0 };
const CACHE_TTL = 15 * 60 * 1000;

// ── RSS / Atom parser (no dependencies) ─────────────────────────────────────
function parseRSS(xml) {
  const isAtom = /<entry[\s>]/.test(xml);
  const tag    = isAtom ? "entry" : "item";
  const rx     = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, "g");
  const items  = [];
  let m;
  while ((m = rx.exec(xml)) !== null) {
    const body = m[1];
    const get  = (t) => {
      const r = new RegExp(
        `<${t}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${t}>|<${t}[^>]*href="([^"]*)"[^>]*\\/?>`,
        "i"
      ).exec(body);
      return r ? (r[1] || r[2] || r[3] || "").trim() : "";
    };
    items.push({
      title:   get("title"),
      desc:    get("description") || get("summary") || get("content"),
      link:    get("link") || get("id"),
      pubDate: get("published") || get("updated") || get("pubDate") || get("dc:date"),
    });
  }
  return items;
}

function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g," ").trim();
}

function parseDate(s) {
  if (!s) return { date:"", time:"" };
  try {
    const d = new Date(s);
    if (isNaN(d)) return { date:"", time:"" };
    return { date: d.toISOString().slice(0,10), time: d.toISOString().slice(11,16) };
  } catch { return { date:"", time:"" }; }
}

async function fetchSource(source) {
  const r = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept":     "application/rss+xml, application/atom+xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml   = await r.text();
  const items = parseRSS(xml);
  if (!items.length) throw new Error("No items parsed");

  return items.map(item => {
    const headline = stripHtml(item.title);
    const body     = stripHtml(item.desc);
    // Always combine headline + body for richer post text
    const snippet  = body ? body.slice(0, 350) + (body.length > 350 ? "…" : "") : "";
    const text     = snippet && snippet !== headline
      ? `${headline} — ${snippet}`
      : headline;
    if (!text) return null;
    const { date, time } = parseDate(item.pubDate);
    return {
      id:       `${source.handle}-${item.link || item.pubDate || Math.random()}`,
      person:   source.person,
      role:     source.role,
      country:  source.country,
      platform: source.platform,
      handle:   source.handle,
      date, time,
      color:    source.color,
      verified: true,
      text:     text.slice(0, 500) + (text.length > 500 ? "…" : ""),
      url:      item.link || "",
    };
  }).filter(Boolean);
}

// ── Claude Haiku relevance filter (optional) ─────────────────────────────────
// If ANTHROPIC_API_KEY is not set, ALL fetched posts are returned unfiltered.
// Guarantees a minimum of MIN_POSTS posts even if Claude scores nothing relevant.
const MIN_POSTS = 8;

async function filterRelevant(posts, apiKey) {
  if (!posts.length || !apiKey) return posts;

  // Pre-filter by keyword so we never send >60 posts to Claude (cost control)
  // Wide keyword set: anything geopolitically relevant passes pre-filter
  const KEYWORDS = [
    "iran","israel","idf","irgc","tehran","netanyahu","trump","hezbollah","houthi",
    "nuclear","uranium","hormuz","strait","gulf","sanction","ceasefire","diplomat",
    "missile","drone","strike","attack","military","troops","hostage","civilian",
    "oil","energy","crude","nato","un security","middle east","gaza","west bank",
    "saudi","qatar","uae","iraq","syria","lebanon","egypt","jordan","oman","muscat",
    "centcom","pentagon","state department","white house","iaea","un secretary",
  ];
  const lower = (p) => (p.person + " " + p.text).toLowerCase();
  const preFiltered = posts.filter(p => KEYWORDS.some(kw => lower(p).includes(kw)));

  // If pre-filter gives us enough, just use those without spending Claude tokens
  if (preFiltered.length >= MIN_POSTS) return preFiltered;

  // Not enough keyword matches — ask Claude to pick the most relevant from all posts
  try {
    const prompt = posts.map((p, i) => `[${i}] ${p.person} (${p.platform}): ${p.text.slice(0, 200)}`).join("\n");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system:     "Respond with ONLY a JSON array of integer indices, e.g. [0,2,5]. Nothing else.",
        messages: [{
          role:    "user",
          content: `Pick the most geopolitically relevant posts for a conflict intelligence dashboard covering the Israel-Iran-US war and related global security events.\n\nInclude: any military, diplomatic, nuclear, energy/oil, sanctions, humanitarian, or security-related content from ANY region. Cast a wide net — it is better to include than exclude.\n\nPosts:\n${prompt}\n\nReturn a JSON array of at least ${MIN_POSTS} indices (or all if fewer exist).`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) return posts;
    const raw  = ((await r.json()).content?.[0]?.text || "").trim();
    const s    = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s === -1) return posts;
    const idxs   = JSON.parse(raw.slice(s, e + 1));
    const result = idxs.filter(i => Number.isInteger(i) && i >= 0 && i < posts.length).map(i => posts[i]);
    // Always return at least MIN_POSTS — fill from front if Claude returned too few
    if (result.length >= MIN_POSTS) return result;
    const extra = posts.filter((_, i) => !idxs.includes(i));
    return [...result, ...extra].slice(0, Math.max(result.length, MIN_POSTS));
  } catch (err) {
    console.warn("Claude filter failed:", err.message);
    return posts; // fallback: return unfiltered
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
exports.handler = async () => {
  if (cache.posts && Date.now() - cache.ts < CACHE_TTL) {
    return ok(cache.posts);
  }

  // Fetch all RSS sources in parallel; collect per-source results and errors
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchSource));
  const debug   = [];
  let   allPosts = [];

  results.forEach((r, i) => {
    const src = RSS_SOURCES[i];
    if (r.status === "fulfilled") {
      debug.push(`${src.handle}: ${r.value.length} items`);
      allPosts = [...allPosts, ...r.value];
    } else {
      const msg = r.reason?.message || String(r.reason);
      debug.push(`${src.handle}: FAILED — ${msg}`);
      console.warn(`Feed failed [${src.handle}]: ${msg}`);
    }
  });

  // Telegram (optional)
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    try {
      const tgPosts = await fetchTelegram(tgToken);
      allPosts = [...allPosts, ...tgPosts];
      debug.push(`telegram: ${tgPosts.length} items`);
    } catch (e) {
      debug.push(`telegram: FAILED — ${e.message}`);
    }
  }

  // Filter for conflict relevance via Claude (falls back to all posts if key missing/fails)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const posts  = await filterRelevant(allPosts, apiKey);

  // Sort newest-first, deduplicate by URL
  const seen   = new Set();
  const sorted = posts.filter(p => {
    const key = p.url || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) =>
    new Date(`${b.date || "2000-01-01"}T${b.time || "00:00"}Z`) -
    new Date(`${a.date || "2000-01-01"}T${a.time || "00:00"}Z`)
  ).slice(0, 50);

  cache = { posts: sorted, ts: Date.now() };
  return ok(sorted, debug);
};

// Telegram Bot — reads channels bot is admin of
async function fetchTelegram(token) {
  const CHANNEL_MAP = {
    "@IDFSpokesperson": { person:"IDF Spokesperson",  role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6" },
    "@KhameneiOfficial":{ person:"Ali Khamenei",       role:"Iran Supreme Leader",   country:"🇮🇷", color:"#22c55e" },
    "@PezeshkianIR":    { person:"Masoud Pezeshkian", role:"Iranian President",      country:"🇮🇷", color:"#22c55e" },
  };
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Telegram HTTP ${r.status}`);
  return ((await r.json()).result || []).flatMap(u => {
    const msg   = u.channel_post || u.message;
    if (!msg) return [];
    const text  = msg.text || msg.caption || "";
    if (!text)  return [];
    const uname = msg.chat?.username ? `@${msg.chat.username}` : null;
    const meta  = (uname && CHANNEL_MAP[uname]) || { person: msg.chat?.title || "Telegram", role: uname || "", country:"🌍", color:"#94a3b8" };
    const d     = new Date(msg.date * 1000);
    return [{
      id:`tg-${msg.chat.id}-${msg.message_id}`, person:meta.person, role:meta.role,
      country:meta.country, platform:"Telegram", handle: uname || String(msg.chat.id),
      date:d.toISOString().slice(0,10), time:d.toISOString().slice(11,16),
      color:meta.color, verified:true, text:text.slice(0,500),
      url: uname ? `https://t.me/${uname.slice(1)}/${msg.message_id}` : "",
    }];
  });
}

function ok(posts, debug) {
  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ posts, debug }),
  };
}

exports.config = { path: "/api/leaders" };
