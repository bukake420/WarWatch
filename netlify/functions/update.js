// update.js — AI-powered site update engine
// Claude Sonnet + web search researches real news and returns structured update data.
// POST /api/update { token: "..." }
// Returns: { success, update: { stats, leaderPosts, osintPosts, events, sitrep }, generatedAt }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};
const ok  = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const fail = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST required");

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

  // Token check — if ADMIN_TOKEN env var is set, require it; otherwise open
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  if (ADMIN_TOKEN && body.token !== ADMIN_TOKEN) return fail(401, "Unauthorized");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail(500, "ANTHROPIC_API_KEY not configured");

  const today  = new Date().toISOString().slice(0, 10);
  const warMs  = Date.now() - new Date("2026-02-28").getTime();
  const warDay = Math.max(1, Math.floor(warMs / 86400000) + 1);

  const system = `You are a senior military OSINT analyst for WarWatch — a real-time tracker of the ongoing Israel-Iran-US conflict (Operation Epic Fury). The war began Feb 28 2026. Today is ${today}, approximately war day ${warDay}.

ESTABLISHED SCENARIO FACTS:
- Khamenei killed day 1 by IAF F-35I strike, son Mojtaba named successor
- Natanz, Isfahan nuclear sites struck by US/Israel day 1
- Kharg Island oil terminal struck, disrupting 90% of Iran oil exports
- 300+ IRGC ballistic missile launchers destroyed by day 3
- Brent crude spiked; Strait of Hormuz partially restricted
- USS Gerald R. Ford CSG operating in Persian Gulf/Arabian Sea
- Indirect ceasefire talks began in Muscat, Oman on Mar 22
- Iranian proxies (Hezbollah, Houthis) remain active
- Israeli Iron Dome, Arrow, David's Sling actively intercepting

Use web search to find:
1. Current Brent crude oil price (search "Brent crude oil price today")
2. Recent statements by world leaders about Iran, Israel, Middle East conflict
3. Latest OSINT/military developments in the region
4. Current casualty and displacement figures from similar conflicts for scaling

Return ONLY a single valid JSON object — no markdown fences, no explanation before or after, starting with { and ending with }:
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
    {
      "id": "up-${Date.now()}-0",
      "person": "Full Name",
      "role": "Title",
      "country": "🇺🇸",
      "platform": "Platform name",
      "handle": "@handle",
      "date": "${today}",
      "time": "HH:MM",
      "color": "#hexcolor",
      "verified": true,
      "text": "Actual statement or paraphrase (max 300 chars)",
      "url": "https://source-url.com"
    }
  ],
  "osintPosts": [
    {
      "channel": "@Handle",
      "date": "${today}",
      "time": "HH:MM",
      "text": "OSINT finding (1-3 sentences, intelligence style)",
      "views": 12345,
      "type": "text",
      "verified": true
    }
  ],
  "events": [
    {
      "id": 3001,
      "lat": 00.0000,
      "lng": 00.0000,
      "title": "City/Location — Brief event title",
      "type": "us_il",
      "date": "${today}",
      "confidence": "confirmed",
      "desc": "2-3 sentences with source attribution.",
      "verified": true,
      "wikiPage": "Relevant_Wikipedia_Article"
    }
  ],
  "sitrep": "Full 400-600 word situation report covering executive summary, key developments last 24h (5-7 bullets), strategic assessment, and 3-4 critical indicators. Professional ISW/CTP methodology."
}

REQUIREMENTS:
- leaderPosts: exactly 5, from real world leaders who have spoken about the conflict (Trump, Netanyahu, Macron, Erdogan, UN SG, Iranian FM, Saudi FM, etc.)
- osintPosts: exactly 5, using these channels: @IDFSpokesperson, @CENTCOMNews, @OSINTdefender, @IntelDoge, @IRNA_NEWS or @HouthiMilSpo
- events: 2-3 new events, each with unique id 3001-3999, accurate coordinates
- type field: us_il (US/Israeli ops), iran (Iranian ops/responses), hezbollah, hvt (high-value target)
- color guide: Trump/US=#ef4444, UK=#a78bfa, France=#60a5fa, Iran=#22c55e, UN=#94a3b8, Saudi=#f59e0b, Israel=#3b82f6
- All content must be coherent with the established scenario and today's date`;

  const userMsg = `Today is ${today} (war day ~${warDay}). Search for: current Brent crude price, recent statements from world leaders about the Iran-Israel conflict, and any new military/diplomatic developments. Then compile and return the complete JSON update object.`;

  try {
    const text = await runWithWebSearch(apiKey, system, userMsg);
    if (!text) throw new Error("Empty response from Claude");

    // Extract outermost JSON object
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in response");

    let update;
    try {
      update = JSON.parse(text.slice(start, end + 1));
    } catch (parseErr) {
      throw new Error("JSON parse failed: " + parseErr.message);
    }

    return ok({ success: true, update, generatedAt: new Date().toISOString() });

  } catch (e) {
    console.error("Update error:", e.message);
    return fail(500, e.message);
  }
};

// Runs Claude Sonnet with web search in an agentic loop until end_turn.
async function runWithWebSearch(apiKey, system, userContent) {
  const headers = {
    "Content-Type":    "application/json",
    "x-api-key":       apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta":  "web-search-2025-03-05",
  };

  let messages = [{ role: "user", content: userContent }];
  let maxIter  = 12;

  while (maxIter-- > 0) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model:   "claude-sonnet-4-6",
        max_tokens: 4096,
        system,
        tools:   [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages,
      }),
      signal: AbortSignal.timeout(52000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 300)}`);
    }

    const data = await resp.json();

    if (data.stop_reason === "end_turn") {
      return data.content?.find(b => b.type === "text")?.text || "";
    }

    if (data.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: data.content });

      // Build tool_results — for web_search_20250305 Anthropic fills results server-side;
      // we acknowledge each tool_use so the loop continues.
      const toolResults = data.content
        .filter(b => b.type === "tool_use")
        .map(tu => ({
          type:        "tool_result",
          tool_use_id: tu.id,
          // If the response already carries search results in tu.content, pass them back;
          // otherwise send an empty acknowledgement.
          content: Array.isArray(tu.content) && tu.content.length
            ? tu.content
            : [{ type: "text", text: "Search executed. Please continue." }],
        }));

      if (toolResults.length) {
        messages.push({ role: "user", content: toolResults });
      }
      continue;
    }

    // max_tokens or other stop — extract whatever text is available
    return data.content?.find(b => b.type === "text")?.text || "";
  }

  return "";
}
