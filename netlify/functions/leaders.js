// leaders.js — real posts/statements from world leaders and official sources.
// All URLs verified working. No API keys required.
//
// Optional: TELEGRAM_BOT_TOKEN (see .env.example)

const { getStore } = require("@netlify/blobs");

// Verified-working RSS/Atom sources as of 2026-03
const RSS_SOURCES = [
  // White House — Trump's official statements and communications
  {
    person:"Donald Trump", role:"US President", country:"🇺🇸", color:"#ef4444",
    platform:"White House", handle:"@POTUS",
    url:"https://www.whitehouse.gov/news/feed/",
    useDesc:false,
  },
  // UK Government — Keir Starmer official readouts (highly active on Middle East conflict)
  {
    person:"Keir Starmer", role:"UK Prime Minister", country:"🇬🇧", color:"#a78bfa",
    platform:"Gov.uk", handle:"@Keir_Starmer",
    url:"https://www.gov.uk/search/news-and-communications.atom?people%5B%5D=keir-starmer",
    useDesc:false,
  },
  // US Department of Defense — Hegseth/Pentagon official releases
  {
    person:"US Dept of Defense", role:"Pentagon", country:"🇺🇸", color:"#f97316",
    platform:"Defense.gov", handle:"@DeptofDefense",
    url:"https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10",
    useDesc:false,
  },
  // UN Press — Secretary-General Guterres statements and Security Council coverage
  {
    person:"António Guterres", role:"UN Secretary-General", country:"🇺🇳", color:"#94a3b8",
    platform:"UN.org", handle:"@antonioguterres",
    url:"https://press.un.org/en/rss.xml",
    useDesc:false,
  },
  // Al Jazeera — broad Middle East war coverage including direct leader quotes
  {
    person:"Al Jazeera", role:"Middle East Coverage", country:"🌍", color:"#eab308",
    platform:"Al Jazeera", handle:"@AJEnglish",
    url:"https://www.aljazeera.com/xml/rss/all.xml",
    useDesc:true,
  },
];

const TELEGRAM_CHANNELS = {
  "@IDFSpokesperson": { person:"IDF Spokesperson",  role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6" },
  "@KhameneiOfficial":{ person:"Ali Khamenei",       role:"Iran Supreme Leader",   country:"🇮🇷", color:"#22c55e" },
  "@PezeshkianIR":    { person:"Masoud Pezeshkian", role:"Iranian President",      country:"🇮🇷", color:"#22c55e" },
};

// Short in-memory cache to absorb burst traffic
let memCache = { posts: null, ts: 0 };
const MEM_TTL = 5 * 60 * 1000;

// ── RSS / Atom XML parser ────────────────────────────────────────────────────
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
    .replace(/&#\d+;/g, c => { try { return String.fromCharCode(parseInt(c.slice(2,-1))); } catch { return ""; } })
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${source.url}`);
  const items = parseRSS(await r.text());
  return items.map(item => {
    const headline = stripHtml(item.title);
    const body     = stripHtml(item.desc);
    let text;
    if (source.useDesc) {
      text = body || headline;
    } else {
      const snippet = body ? body.slice(0, 280) + (body.length > 280 ? "…" : "") : "";
      text = snippet ? `${headline} — ${snippet}` : headline;
    }
    if (!text) return null;
    const { date, time } = parseDate(item.pubDate);
    return {
      id:       `${source.handle}-${item.link || item.pubDate}`,
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

async function fetchTelegram(token) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    return (await r.json()).result?.flatMap(u => {
      const msg  = u.channel_post || u.message;
      if (!msg) return [];
      const text = msg.text || msg.caption || "";
      if (!text) return [];
      const uname = msg.chat?.username ? `@${msg.chat.username}` : null;
      const meta  = (uname && TELEGRAM_CHANNELS[uname]) || { person: msg.chat?.title || "Telegram", role: uname || "", country:"🌍", color:"#94a3b8" };
      const d     = new Date(msg.date * 1000);
      return [{
        id:`tg-${msg.chat.id}-${msg.message_id}`, person:meta.person, role:meta.role,
        country:meta.country, platform:"Telegram", handle: uname || String(msg.chat.id),
        date:d.toISOString().slice(0,10), time:d.toISOString().slice(11,16),
        color:meta.color, verified:true, text:text.slice(0,500),
        url: uname ? `https://t.me/${uname.slice(1)}/${msg.message_id}` : "",
      }];
    }) || [];
  } catch { return []; }
}

// ── Claude Haiku relevance filter ────────────────────────────────────────────
async function filterRelevant(posts, apiKey) {
  if (!posts.length) return [];
  if (!apiKey)       return posts;

  const prompt = posts.map((p, i) => `[${i}] ${p.person}: ${p.text.slice(0, 220)}`).join("\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: "You are a relevance classifier. Respond with ONLY a JSON array of indices, e.g. [0,2,5]. Nothing else.",
        messages: [{ role:"user", content:
          `Which posts are directly relevant to the ongoing Israel/Iran/Gaza/Middle East military conflict — military operations, ceasefire negotiations, hostages, Iran nuclear program, US military involvement, Strait of Hormuz, or Israeli/Palestinian conflict?\n\nPosts:\n${prompt}\n\nReturn ONLY a JSON array of relevant indices.`
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return posts;
    const raw  = ((await r.json()).content?.[0]?.text || "").trim();
    const s    = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s === -1) return posts;
    const idxs = JSON.parse(raw.slice(s, e + 1));
    const filtered = idxs.filter(i => i >= 0 && i < posts.length).map(i => posts[i]);
    // If Claude filtered everything out, return the originals (better than empty)
    return filtered.length > 0 ? filtered : posts;
  } catch { return posts; }
}

// ── Netlify Blobs helpers ────────────────────────────────────────────────────
async function loadStoredPosts() {
  try {
    const data = await getStore("leaders-posts").get("posts", { type:"json" });
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveStoredPosts(posts) {
  try { await getStore("leaders-posts").setJSON("posts", posts); }
  catch (e) { console.warn("Blobs save:", e.message); }
}

// ── Main handler ─────────────────────────────────────────────────────────────
exports.handler = async () => {
  if (memCache.posts && Date.now() - memCache.ts < MEM_TTL) {
    return ok(memCache.posts, true);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const stored    = await loadStoredPosts();
  const storedIds = new Set(stored.map(p => p.url || p.id));

  // Fetch all RSS sources in parallel — failures don't break others
  const settled  = await Promise.allSettled(RSS_SOURCES.map(fetchSource));
  let freshPosts = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);

  // Log failures for debugging
  settled.forEach((r, i) => {
    if (r.status === "rejected") console.warn(`Feed failed [${RSS_SOURCES[i].handle}]:`, r.reason?.message);
  });

  // Add Telegram if configured
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    const tgPosts = await fetchTelegram(tgToken);
    freshPosts = [...freshPosts, ...tgPosts];
  }

  // Only process posts we haven't seen before
  const newPosts = freshPosts.filter(p => !storedIds.has(p.url || p.id));

  let toAdd = [];
  if (newPosts.length > 0) {
    const batch = newPosts.slice(0, 30);
    toAdd = await filterRelevant(batch, apiKey);
  }

  const seen   = new Set();
  const merged = [...toAdd, ...stored].filter(p => {
    const key = p.url || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) =>
    new Date(`${b.date}T${b.time || "00:00"}Z`) - new Date(`${a.date}T${a.time || "00:00"}Z`)
  );

  if (toAdd.length > 0) await saveStoredPosts(merged.slice(0, 200));

  const posts = merged.slice(0, 50);
  memCache = { posts, ts: Date.now() };
  return ok(posts, false);
};

function ok(posts, cached) {
  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ posts, cached }),
  };
}

exports.config = { path: "/api/leaders" };
