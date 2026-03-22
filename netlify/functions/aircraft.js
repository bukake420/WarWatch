const CACHE_TTL = 300_000; // 5 minutes — keeps us within the 400 req/day anonymous limit
let cache = null, cacheTs = 0;

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return { statusCode: 200, headers, body: cache };
  }

  try {
    // Middle East conflict zone bounding box
    const url = 'https://opensky-network.org/api/states/all?lamin=12&lomin=25&lamax=42&lomax=75';
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`OpenSky ${resp.status}`);

    const data = await resp.json();
    const aircraft = (data.states || [])
      .filter(s => !s[8] && s[6] != null && s[5] != null) // exclude on-ground and no-position
      .map(s => ({
        id:      s[0],
        callsign: (s[1]?.trim()) || s[0],
        country:  s[2] || 'Unknown',
        lat:      s[6],
        lng:      s[5],
        alt:      s[7]  != null ? Math.round(s[7]  * 3.28084)  : null, // m → ft
        spd:      s[9]  != null ? Math.round(s[9]  * 1.94384)  : null, // m/s → knots
        hdg:      s[10] ?? 0,
        vrate:    s[11] ?? 0, // m/s, positive = climbing
      }));

    const body = JSON.stringify({ aircraft, timestamp: Date.now(), count: aircraft.length });
    cache = body;
    cacheTs = Date.now();
    return { statusCode: 200, headers, body };
  } catch (err) {
    // Return stale cache on error rather than breaking the UI
    if (cache) return { statusCode: 200, headers, body: cache };
    return { statusCode: 502, headers, body: JSON.stringify({ aircraft: [], error: err.message }) };
  }
};
