const CACHE_TTL = 60_000; // 1 minute cache
let cache = null, cacheTs = 0;

// Bounding box: Europe + Middle East + North Africa (wide net to ensure coverage)
const BBOX = { lamin: 5, lomin: -10, lamax: 65, lomax: 95 };

const FETCH_OPTS = {
  signal: AbortSignal.timeout(12000),
  headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
};

// Normalize an adsb.lol / airplanes.live aircraft object
function fromAdsbLol(ac) {
  const lat = ac.lat ?? ac.latitude;
  const lng = ac.lon ?? ac.lng ?? ac.longitude;
  if (lat == null || lng == null) return null;
  if (lat < BBOX.lamin || lat > BBOX.lamax) return null;
  if (lng < BBOX.lomin || lng > BBOX.lomax) return null;
  if (ac.alt_baro === 'ground' || ac.on_ground) return null;
  return {
    id:      ac.hex || ac.icao24,
    callsign: (ac.flight?.trim() || ac.callsign?.trim() || ac.hex || '').toUpperCase(),
    country:  ac.r || 'Unknown',
    lat,
    lng,
    alt:   typeof ac.alt_baro === 'number' ? Math.round(ac.alt_baro) : null, // already feet
    spd:   ac.gs   != null ? Math.round(ac.gs)   : null, // already knots
    hdg:   ac.track ?? ac.true_heading ?? 0,
    vrate: ac.baro_rate != null ? Math.round(ac.baro_rate / 196.85 * 10) / 10 : 0,
  };
}

// Normalize an OpenSky state vector array
function fromOpenSky(s) {
  if (!s[6] || !s[5] || s[8]) return null;
  if (s[6] < BBOX.lamin || s[6] > BBOX.lamax) return null;
  if (s[5] < BBOX.lomin || s[5] > BBOX.lomax) return null;
  return {
    id:      s[0],
    callsign: (s[1]?.trim() || s[0] || '').toUpperCase(),
    country:  s[2] || 'Unknown',
    lat:      s[6],
    lng:      s[5],
    alt:      s[7]  != null ? Math.round(s[7]  * 3.28084)  : null,
    spd:      s[9]  != null ? Math.round(s[9]  * 1.94384)  : null,
    hdg:      s[10] ?? 0,
    vrate:    s[11] ?? 0,
  };
}

async function fetchAirplanesLive() {
  // airplanes.live — community ADS-B, same API shape as adsb.lol
  const url = 'https://api.airplanes.live/v2/lat/45/lon/20/dist/4000';
  const resp = await fetch(url, FETCH_OPTS);
  if (!resp.ok) throw new Error(`airplanes.live HTTP ${resp.status}`);
  const data = await resp.json();
  const list = data.ac || [];
  if (!list.length) throw new Error('airplanes.live returned 0 aircraft');
  return { aircraft: list.map(fromAdsbLol).filter(Boolean), source: 'airplanes.live' };
}

async function fetchAdsbLol() {
  const url = 'https://api.adsb.lol/v2/lat/45/lon/20/dist/4000';
  const resp = await fetch(url, FETCH_OPTS);
  if (!resp.ok) throw new Error(`adsb.lol HTTP ${resp.status}`);
  const data = await resp.json();
  const list = data.ac || [];
  if (!list.length) throw new Error('adsb.lol returned 0 aircraft');
  return { aircraft: list.map(fromAdsbLol).filter(Boolean), source: 'adsb.lol' };
}

async function fetchOpenSky() {
  const url = `https://opensky-network.org/api/states/all?lamin=${BBOX.lamin}&lomin=${BBOX.lomin}&lamax=${BBOX.lamax}&lomax=${BBOX.lomax}`;
  const resp = await fetch(url, FETCH_OPTS);
  if (!resp.ok) throw new Error(`OpenSky HTTP ${resp.status}`);
  const data = await resp.json();
  const list = data.states || [];
  if (!list.length) throw new Error('OpenSky returned 0 states');
  return { aircraft: list.map(fromOpenSky).filter(Boolean), source: 'opensky' };
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return { statusCode: 200, headers, body: cache };
  }

  const errors = [];

  for (const fn of [fetchAirplanesLive, fetchAdsbLol, fetchOpenSky]) {
    try {
      const { aircraft, source } = await fn();
      const body = JSON.stringify({ aircraft, timestamp: Date.now(), count: aircraft.length, source });
      cache = body; cacheTs = Date.now();
      return { statusCode: 200, headers, body };
    } catch (e) {
      errors.push(e.message);
    }
  }

  // All sources failed — return stale cache or error with diagnostics
  if (cache) return { statusCode: 200, headers, body: cache };
  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({ aircraft: [], error: errors.join(' | '), errors }),
  };
};
