// leaders.js — fetches real posts from 12 verified government/military/news RSS feeds.
// Claude Haiku filters for conflict relevance (optional — works without API key too).
// No database required; in-memory cache refreshes every 15 minutes.

const RSS_SOURCES = [
  // ── US / Western ──────────────────────────────────────────────────────────
  {
    person:"Donald Trump", role:"US President", country:"🇺🇸", color:"#ef4444",
    platform:"White House", handle:"@POTUS",
    url:"https://www.whitehouse.gov/news/feed/",
    useDesc:false,
  },
  {
    person:"US Dept of Defense", role:"Pentagon", country:"🇺🇸", color:"#f97316",
    platform:"Defense.gov", handle:"@DeptofDefense",
    url:"https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=15",
    useDesc:false,
  },
  {
    person:"US CENTCOM", role:"US Central Command", country:"🇺🇸", color:"#ef4444",
    platform:"CENTCOM", handle:"@CENTCOM",
    url:"https://www.centcom.mil/RSS/",
    useDesc:false,
  },
  {
    person:"Keir Starmer", role:"UK Prime Minister", country:"🇬🇧", color:"#a78bfa",
    platform:"Gov.uk", handle:"@Keir_Starmer",
    url:"https://www.gov.uk/search/news-and-communications.atom?people%5B%5D=keir-starmer",
    useDesc:false,
  },
  // ── United Nations ────────────────────────────────────────────────────────
  {
    person:"António Guterres", role:"UN Secretary-General", country:"🇺🇳", color:"#94a3b8",
    platform:"UN Press", handle:"@antonioguterres",
    url:"https://press.un.org/en/rss.xml",
    useDesc:false,
  },
  {
    person:"UN News", role:"Middle East Desk", country:"🇺🇳", color:"#94a3b8",
    platform:"UN News", handle:"@UN_News",
    url:"https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml",
    useDesc:true,
  },
  // ── Israel ────────────────────────────────────────────────────────────────
  {
    person:"Israeli PM Office", role:"Israeli Government", country:"🇮🇱", color:"#3b82f6",
    platform:"Gov.il", handle:"@IsraeliPM",
    url:"https://www.gov.il/en/api/DataGovProxy/GetPage?databaseId=news&searchFilters%5BofficeId%5D%5B%5D=d98e0cd5-55b4-4817-ba44-90e04b5ad93d&take=15&skip=0&format=rss",
    useDesc:false,
  },
  // ── News coverage ─────────────────────────────────────────────────────────
  {
    person:"Al Jazeera", role:"Middle East Coverage", country:"🌍", color:"#eab308",
    platform:"Al Jazeera", handle:"@AJEnglish",
    url:"https://www.aljazeera.com/xml/rss/all.xml",
    useDesc:true,
  },
  {
    person:"Reuters", role:"Wire Service", country:"🌍", color:"#f87171",
    platform:"Reuters", handle:"@Reuters",
    url:"https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best",
    useDesc:true,
  },
  {
    person:"BBC World", role:"International News", country:"🇬🇧", color:"#a78bfa",
    platform:"BBC", handle:"@BBCWorld",
    url:"https://feeds.bbci.co.uk/news/world/rss.xml",
    useDesc:true,
  },
  {
    person:"AP News", role:"Wire Service", country:"🌍", color:"#60a5fa",
    platform:"AP News", handle:"@AP",
    url:"https://rsshub.app/apnews/topics/world-news",
    useDesc:true,
  },
  {
    person:"IAEA", role:"Nuclear Watchdog", country:"🌐", color:"#22c55e",
    platform:"IAEA", handle:"@iaeaorg",
    url:"https://www.iaea.org/feeds/topstories.rss",
    useDesc:false,
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
    let   text;
    if (source.useDesc) {
      text = body || headline;
    } else {
      const snippet = body ? body.slice(0, 280) + (body.length > 280 ? "…" : "") : "";
      text = snippet ? `${headline} — ${snippet}` : headline;
    }
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
// If Claude fails or filters everything out, originals are returned as fallback.
async function filterRelevant(posts, apiKey) {
  if (!posts.length || !apiKey) return posts;

  try {
    const prompt = posts.map((p, i) => `[${i}] ${p.person}: ${p.text.slice(0, 200)}`).join("\n");
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
        system:     "Respond with ONLY a JSON array of integer indices, e.g. [0,2,5]. Nothing else. Never return an empty array — always include at least the most relevant items.",
        messages: [{
          role:    "user",
          content: `You are filtering posts for a conflict intelligence dashboard tracking the Israel-Iran-US war (Operation Epic Fury, since Feb 28 2026).\n\nInclude posts about: military strikes/operations, ceasefire/diplomacy, Iran nuclear program, US military/CENTCOM statements, Israeli military (IDF) ops, Strait of Hormuz/oil/energy, sanctions, Hezbollah/Houthi proxy activity, casualties, humanitarian crisis, aircraft carriers, rescue missions, troop movements, missile launches, air defense.\n\nAlso include: any official government statements that set geopolitical context (UN, NATO, EU statements about the conflict region).\n\nPosts:\n${prompt}\n\nReturn ONLY a JSON array of relevant indices. Include at least the 5 most relevant if any exist.`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) return posts;
    const raw    = ((await r.json()).content?.[0]?.text || "").trim();
    const s = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s === -1) return posts;
    const idxs   = JSON.parse(raw.slice(s, e + 1));
    const result = idxs.filter(i => Number.isInteger(i) && i >= 0 && i < posts.length).map(i => posts[i]);
    return result.length > 0 ? result : posts; // fallback: never return empty
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
