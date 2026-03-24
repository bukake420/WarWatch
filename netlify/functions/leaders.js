// Fetches real social media posts from world leaders using X (Twitter) API v2.
// Requires TWITTER_BEARER_TOKEN in Netlify environment variables.
// X API Basic tier ($100/mo) needed for recent search; free tier is write-only.
//
// Netlify env vars to set:
//   TWITTER_BEARER_TOKEN  — Bearer token from developer.twitter.com

const ACCOUNTS = [
  { handle: "realDonaldTrump", name: "Donald Trump",        role: "US President",              country: "🇺🇸", color: "#ef4444" },
  { handle: "netanyahu",       name: "Benjamin Netanyahu",  role: "Israeli PM",                country: "🇮🇱", color: "#3b82f6" },
  { handle: "IDF",             name: "IDF Spokesperson",    role: "Israel Defense Forces",     country: "🇮🇱", color: "#3b82f6" },
  { handle: "CENTCOM",         name: "US CENTCOM",          role: "US Central Command",        country: "🇺🇸", color: "#ef4444" },
  { handle: "PeteHegseth",     name: "Pete Hegseth",        role: "US Secretary of Defense",   country: "🇺🇸", color: "#ef4444" },
  { handle: "EmmanuelMacron",  name: "Emmanuel Macron",     role: "French President",          country: "🇫🇷", color: "#60a5fa" },
  { handle: "Keir_Starmer",    name: "Keir Starmer",        role: "UK Prime Minister",         country: "🇬🇧", color: "#a78bfa" },
  { handle: "antonioguterres", name: "António Guterres",    role: "UN Secretary-General",      country: "🇺🇳", color: "#94a3b8" },
  { handle: "narendramodi",    name: "Narendra Modi",       role: "Indian PM",                 country: "🇮🇳", color: "#f59e0b" },
];

// Build a quick lookup map: lowercase handle → account metadata
const ACCOUNT_MAP = {};
ACCOUNTS.forEach(a => { ACCOUNT_MAP[a.handle.toLowerCase()] = a; });

// Server-side in-memory cache — refresh every 30 minutes
let cache = { posts: null, ts: 0 };
const CACHE_TTL = 30 * 60 * 1000;

exports.handler = async () => {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ posts: [], error: "TWITTER_BEARER_TOKEN not configured in Netlify environment variables" }),
    };
  }

  // Serve from cache if still fresh
  if (cache.posts && Date.now() - cache.ts < CACHE_TTL) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ posts: cache.posts, cached: true }),
    };
  }

  try {
    const fromClause = ACCOUNTS.map(a => `from:${a.handle}`).join(" OR ");
    // Search for posts from these accounts mentioning war/conflict topics
    const query = `(${fromClause}) (iran OR israel OR war OR ceasefire OR military OR strike OR hostage OR hezbollah OR hormuz OR nuclear) -is:retweet lang:en`;

    const url = new URL("https://api.twitter.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "25");
    url.searchParams.set("tweet.fields", "created_at,author_id,text,entities,public_metrics");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username,verified");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const err = await r.text();
      return {
        statusCode: r.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ posts: [], error: `X API error ${r.status}: ${err}` }),
      };
    }

    const data = await r.json();

    // Build user ID → metadata map from the includes
    const usersById = {};
    (data.includes?.users || []).forEach(u => { usersById[u.id] = u; });

    const posts = (data.data || []).map(tweet => {
      const user = usersById[tweet.author_id] || {};
      const account = ACCOUNT_MAP[user.username?.toLowerCase()] || {};
      return {
        id: tweet.id,
        person:   account.name    || user.name     || "Unknown",
        role:     account.role    || "",
        country:  account.country || "🌍",
        platform: "X",
        handle:   `@${user.username || "unknown"}`,
        date:     tweet.created_at?.slice(0, 10) || "",
        time:     tweet.created_at?.slice(11, 16) || "",
        color:    account.color   || "#94a3b8",
        verified: user.verified   || false,
        text:     tweet.text,
        url:      `https://x.com/${user.username}/status/${tweet.id}`,
        likes:    tweet.public_metrics?.like_count    || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
      };
    });

    cache = { posts, ts: Date.now() };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ posts }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ posts: [], error: e.message }),
    };
  }
};

exports.config = { path: "/api/leaders" };
