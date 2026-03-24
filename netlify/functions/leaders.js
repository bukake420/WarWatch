// leaders.js — pulls real posts from official RSS/Atom feeds + Truth Social.
// Zero API keys required for RSS feeds — works immediately on deploy.
//
// Optional env vars (Netlify → Site Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN — create a free bot via @BotFather on Telegram, then add it
//                        as admin to a Telegram channel you control. Any posts in that
//                        channel will appear here. To cover IDF/Khamenei, forward their
//                        public channel posts into your own channel.

const RSS_SOURCES = [
  // Trump posts on Truth Social — public RSS feed, no auth needed
  { person:"Donald Trump",       role:"US President",          country:"🇺🇸", color:"#ef4444", platform:"Truth Social", handle:"@realDonaldTrump", url:"https://truthsocial.com/@realDonaldTrump.rss",                    useDesc:true  },
  // IDF official English press releases
  { person:"IDF Spokesperson",   role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6", platform:"IDF Press",    handle:"@IDF",             url:"https://www.idf.il/en/rss/",                                      useDesc:false },
  // US CENTCOM press releases
  { person:"US CENTCOM",         role:"US Central Command",    country:"🇺🇸", color:"#ef4444", platform:"CENTCOM",      handle:"@CENTCOM",         url:"https://www.centcom.mil/RSS/",                                    useDesc:false },
  // Israeli PM office
  { person:"Benjamin Netanyahu", role:"Israeli PM",            country:"🇮🇱", color:"#3b82f6", platform:"Gov.il",       handle:"@netanyahu",       url:"https://www.gov.il/en/rss/PM",                                    useDesc:false },
  // UN Secretary-General statements
  { person:"António Guterres",   role:"UN Secretary-General",  country:"🇺🇳", color:"#94a3b8", platform:"UN.org",       handle:"@antonioguterres", url:"https://www.un.org/sg/en/media/statements.xml",                   useDesc:false },
  // UK PM (Atom feed)
  { person:"Keir Starmer",       role:"UK Prime Minister",     country:"🇬🇧", color:"#a78bfa", platform:"Gov.uk",       handle:"@Keir_Starmer",    url:"https://www.gov.uk/government/people/keir-starmer.atom",          useDesc:false },
  // French President
  { person:"Emmanuel Macron",    role:"French President",      country:"🇫🇷", color:"#60a5fa", platform:"Élysée",       handle:"@EmmanuelMacron",  url:"https://www.elysee.fr/rss",                                      useDesc:false },
];

// Keywords that indicate a post is relevant to this conflict
const KEYWORDS = /iran|israel|military|strike|ceasefire|nuclear|hezbollah|hostage|war|hormuz|idf|hamas|irgc|missile|attack|gaza|beirut|tehran|jerusalem|weapons|sanctions|airstrike/i;

// Telegram channel metadata — used when TELEGRAM_BOT_TOKEN is set
const TELEGRAM_CHANNELS = {
  "@IDFSpokesperson": { person:"IDF Spokesperson",   role:"Israel Defense Forces", country:"🇮🇱", color:"#3b82f6" },
  "@KhameneiOfficial":{ person:"Ali Khamenei",        role:"Iran Supreme Leader",   country:"🇮🇷", color:"#22c55e" },
  "@PezeshkianIR":    { person:"Masoud Pezeshkian",  role:"Iranian President",     country:"🇮🇷", color:"#22c55e" },
};

// 30-minute server-side cache (shared across Lambda warm invocations)
let cache = { posts: null, ts: 0 };
const CACHE_TTL = 30 * 60 * 1000;

// ── RSS / Atom XML parser (no npm dependencies) ─────────────────────────────
function parseRSS(xml) {
  // Atom feeds use <entry>; RSS 2.0 uses <item>
  const isAtom = /<entry[\s>]/.test(xml);
  const tag = isAtom ? "entry" : "item";
  const itemRx = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, "g");
  const items = [];
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const body = m[1];
    // Extracts tag content supporting CDATA, plain text, and Atom <link href="..."/>
    const get = (t) => {
      const rx = new RegExp(
        `<${t}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${t}>|<${t}[^>]*href="([^"]*)"[^>]*\\/?>`,
        "i"
      );
      const r = rx.exec(body);
      return r ? (r[1] || r[2] || r[3] || "").trim() : "";
    };
    const title   = get("title");
    const desc    = get("description") || get("summary") || get("content");
    // Atom canonical URL lives in <id>; RSS uses <link>
    const link    = get("link") || get("id");
    const pubDate = get("published") || get("updated") || get("pubDate") || get("dc:date");
    items.push({ title, desc, link, pubDate });
  }
  return items;
}

// Strip HTML tags and unescape common entities
function stripHtml(str) {
  return (str || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Parse an RSS/HTTP date string into { date: "YYYY-MM-DD", time: "HH:MM" }
function parseDate(dateStr) {
  if (!dateStr) return { date: "", time: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return { date: "", time: "" };
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
  } catch { return { date: "", time: "" }; }
}

// Fetch one RSS/Atom source and return normalised post objects
async function fetchSource(source) {
  const r = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WarWatch/1.0)",
      "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${source.url}`);
  const xml   = await r.text();
  const items = parseRSS(xml);
  const posts = [];

  for (const item of items) {
    // For Truth Social we want the post body (description); for press releases, the headline
    const headline = stripHtml(item.title);
    const body     = stripHtml(item.desc);
    let   text;
    if (source.useDesc) {
      // Truth Social: description IS the post
      text = body || headline;
    } else {
      // Press release: headline + first sentence of body as context
      const snippet = body ? body.slice(0, 220) + (body.length > 220 ? "…" : "") : "";
      text = snippet ? `${headline} — ${snippet}` : headline;
    }
    if (!text) continue;
    // Filter out posts that don't mention the conflict
    if (!KEYWORDS.test(text)) continue;

    const { date, time } = parseDate(item.pubDate);
    posts.push({
      id:       `${source.handle}-${item.link || item.pubDate || Math.random()}`,
      person:   source.person,
      role:     source.role,
      country:  source.country,
      platform: source.platform,
      handle:   source.handle,
      date,
      time,
      color:    source.color,
      verified: true,
      text:     text.slice(0, 500) + (text.length > 500 ? "…" : ""),
      url:      item.link || "",
    });
  }
  return posts;
}

// Fetch posts from Telegram channels the bot is a member/admin of.
// Note: Telegram Bot API getUpdates only returns messages received AFTER the bot joined.
// For public channels you don't control (IDF, Khamenei), forward their posts into a
// private channel where your bot IS an admin. The bot will then see those forwarded messages.
async function fetchTelegram(token) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const posts = [];
    for (const u of data.result || []) {
      const msg = u.channel_post || u.message;
      if (!msg) continue;
      const text = msg.text || msg.caption || "";
      if (!text || !KEYWORDS.test(text)) continue;

      const username = msg.chat?.username ? `@${msg.chat.username}` : null;
      // Look up metadata for known channels; fall back to chat title
      const meta = (username && TELEGRAM_CHANNELS[username]) || {
        person:  msg.chat?.title || "Telegram Channel",
        role:    username || "",
        country: "🌍",
        color:   "#94a3b8",
      };

      const d   = new Date(msg.date * 1000);
      const url = username ? `https://t.me/${username.slice(1)}/${msg.message_id}` : "";
      posts.push({
        id:       `tg-${msg.chat.id}-${msg.message_id}`,
        person:   meta.person,
        role:     meta.role,
        country:  meta.country,
        platform: "Telegram",
        handle:   username || String(msg.chat.id),
        date:     d.toISOString().slice(0, 10),
        time:     d.toISOString().slice(11, 16),
        color:    meta.color,
        verified: true,
        text:     text.slice(0, 500),
        url,
      });
    }
    return posts;
  } catch {
    return [];
  }
}

exports.handler = async () => {
  // Serve from warm cache
  if (cache.posts && Date.now() - cache.ts < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ posts: cache.posts, cached: true }),
    };
  }

  // Fetch all RSS feeds in parallel — individual failures don't break the rest
  const settled = await Promise.allSettled(RSS_SOURCES.map(fetchSource));
  let allPosts  = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);

  // Merge Telegram posts if bot token is configured
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  if (tgToken) {
    const tgPosts = await fetchTelegram(tgToken);
    allPosts = [...allPosts, ...tgPosts];
  }

  // Deduplicate by URL, sort newest-first, cap at 35
  const seen  = new Set();
  const posts = allPosts
    .filter(p => {
      if (!p.url) return true; // keep posts without URL (deduplicate by id instead)
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    })
    .sort((a, b) => {
      const da = new Date(`${a.date}T${a.time || "00:00"}Z`);
      const db = new Date(`${b.date}T${b.time || "00:00"}Z`);
      return db - da;
    })
    .slice(0, 35);

  cache = { posts, ts: Date.now() };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ posts }),
  };
};

exports.config = { path: "/api/leaders" };
