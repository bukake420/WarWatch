// leaders.js — real leader posts via RSS feeds + Claude AI relevance filtering
// + Netlify Blobs for persistent accumulation (history grows over time).
//
// Zero required env vars — works on first deploy.
// Optional: TELEGRAM_BOT_TOKEN (see .env.example)

const { getStore } = require("@netlify/blobs");

const RSS_SOURCES = [
  { person:"Donald Trump",       role:"US President",          country:"🇺🇸", color:"#ef4444", platform:"Truth Social", handle:"@realDonaldTrump", url:"https://truthsocial.com/@realDonaldTrump.rss",           useDesc:true  },
  { person:"IDF Spokesperson",   role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6", platform:"IDF Press",    handle:"@IDF",             url:"https://www.idf.il/en/rss/",                             useDesc:false },
  { person:"US CENTCOM",         role:"US Central Command",    country:"🇺🇸", color:"#ef4444", platform:"CENTCOM",      handle:"@CENTCOM",         url:"https://www.centcom.mil/RSS/",                           useDesc:false },
  { person:"Benjamin Netanyahu", role:"Israeli PM",            country:"🇮🇱", color:"#3b82f6", platform:"Gov.il",       handle:"@netanyahu",       url:"https://www.gov.il/en/rss/PM",                          useDesc:false },
  { person:"António Guterres",   role:"UN Secretary-General",  country:"🇺🇳", color:"#94a3b8", platform:"UN.org",       handle:"@antonioguterres", url:"https://www.un.org/sg/en/media/statements.xml",          useDesc:false },
  { person:"Keir Starmer",       role:"UK Prime Minister",     country:"🇬🇧", color:"#a78bfa", platform:"Gov.uk",       handle:"@Keir_Starmer",    url:"https://www.gov.uk/government/people/keir-starmer.atom", useDesc:false },
  { person:"Emmanuel Macron",    role:"French President",      country:"🇫🇷", color:"#60a5fa", platform:"Élysée",       handle:"@EmmanuelMacron",  url:"https://www.elysee.fr/rss",                             useDesc:false },
];

const TELEGRAM_CHANNELS = {
  "@IDFSpokesperson": { person:"IDF Spokesperson",  role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6" },
  "@KhameneiOfficial":{ person:"Ali Khamenei",       role:"Iran Supreme Leader",   country:"🇮🇷", color:"#22c55e" },
  "@PezeshkianIR":    { person:"Masoud Pezeshkian", role:"Iranian President",      country:"🇮🇷", color:"#22c55e" },
};

// Short in-memory cache to absorb burst traffic without re-hitting Blobs
let memCache = { posts: null, ts: 0 };
const MEM_TTL = 5 * 60 * 1000; // 5 minutes

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
    headers: { "User-Agent":"Mozilla/5.0 (compatible; WarWatch/1.0)", "Accept":"application/rss+xml,application/atom+xml,text/xml,*/*" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const items = parseRSS(await r.text());
  return items.map(item => {
    const headline = stripHtml(item.title);
    const body     = stripHtml(item.desc);
    const text     = source.useDesc
      ? (body || headline)
      : (body ? `${headline} — ${body.slice(0, 220)}${body.length > 220 ? "…" : ""}` : headline);
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
    const updates = (await r.json()).result || [];
    return updates.flatMap(u => {
      const msg  = u.channel_post || u.message;
      if (!msg) return [];
      const text = msg.text || msg.caption || "";
      if (!text) return [];
      const uname = msg.chat?.username ? `@${msg.chat.username}` : null;
      const meta  = (uname && TELEGRAM_CHANNELS[uname]) || { person: msg.chat?.title || "Telegram", role: uname || "", country:"🌍", color:"#94a3b8" };
      const d     = new Date(msg.date * 1000);
      return [{
        id:`tg-${msg.chat.id}-${msg.message_id}`, person:meta.person, role:meta.role,
        country:meta.country, platform:"Telegram", handle:uname || String(msg.chat.id),
        date:d.toISOString().slice(0,10), time:d.toISOString().slice(11,16),
        color:meta.color, verified:true,
        text:text.slice(0,500),
        url: uname ? `https://t.me/${uname.slice(1)}/${msg.message_id}` : "",
      }];
    });
  } catch { return []; }
}

// ── Claude Haiku relevance filter ────────────────────────────────────────────
// Sends up to 30 new posts to Claude and asks it to return only relevant ones.
async function filterRelevant(posts, apiKey) {
  if (!posts.length) return [];
  if (!apiKey)       return posts; // no key → keep all (better than showing nothing)

  const prompt = posts.map((p, i) => `[${i}] ${p.person}: ${p.text.slice(0, 220)}`).join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: "You are a relevance classifier. Respond with ONLY a JSON array of indices, e.g. [0,2,5]. Nothing else.",
        messages: [{ role:"user", content:
          `Which posts are directly relevant to the ongoing Israel/Iran/Gaza/Middle East military conflict — military ops, ceasefire talks, hostages, Iran nuclear program, US military involvement, or Israeli/Palestinian conflict? Exclude posts about domestic economy, weather, sports, unrelated policy.\n\nPosts:\n${prompt}\n\nReturn ONLY a JSON array of relevant indices.`
        }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return posts;
    const d    = await r.json();
    const raw  = (d.content?.[0]?.text || "").trim();
    const s    = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s === -1) return posts;
    const idxs = JSON.parse(raw.slice(s, e + 1));
    return idxs.filter(i => i >= 0 && i < posts.length).map(i => posts[i]);
  } catch { return posts; }
}

// ── Netlify Blobs helpers ────────────────────────────────────────────────────
async function loadStoredPosts() {
  try {
    const store = getStore("leaders-posts");
    const data  = await store.get("posts", { type:"json" });
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveStoredPosts(posts) {
  try {
    const store = getStore("leaders-posts");
    await store.setJSON("posts", posts);
  } catch (e) { console.warn("Blobs save failed:", e.message); }
}

// ── Main handler ─────────────────────────────────────────────────────────────
exports.handler = async () => {
  // Serve from in-memory cache if fresh
  if (memCache.posts && Date.now() - memCache.ts < MEM_TTL) {
    return ok(memCache.posts, true);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // 1. Load what we've already accumulated
  const stored    = await loadStoredPosts();
  const storedIds = new Set(stored.map(p => p.url || p.id));

  // 2. Fetch fresh RSS posts from all sources in parallel
  const settled   = await Promise.allSettled(RSS_SOURCES.map(fetchSource));
  let freshPosts  = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);

  // 3. Add Telegram if configured
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    const tgPosts = await fetchTelegram(tgToken);
    freshPosts = [...freshPosts, ...tgPosts];
  }

  // 4. Identify posts not yet in the store
  const newPosts = freshPosts.filter(p => !storedIds.has(p.url || p.id));

  // 5. If there are new posts, send them to Claude to filter for relevance (batch of 30)
  let toAdd = [];
  if (newPosts.length > 0) {
    const batch = newPosts.slice(0, 30);
    toAdd = await filterRelevant(batch, apiKey);
  }

  // 6. Merge: new relevant posts + existing stored posts, dedup by url/id, newest-first
  const seen    = new Set();
  const merged  = [...toAdd, ...stored].filter(p => {
    const key = p.url || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || "00:00"}Z`);
    const db = new Date(`${b.date}T${b.time || "00:00"}Z`);
    return db - da;
  });

  // 7. Persist updated list (cap stored at 200 posts to stay lean)
  if (toAdd.length > 0) {
    await saveStoredPosts(merged.slice(0, 200));
  }

  // 8. Return top 50 to the client
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
