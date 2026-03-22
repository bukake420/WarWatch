const CACHE_TTL = 60_000; // 1 minute cache
let cache = null, cacheTs = 0;

// Bounding box for Middle East conflict zone
const BBOX = { lamin: 12, lomin: 25, lamax: 42, lomax: 75 };

// Normalize an adsb.lol aircraft object
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
    country:  ac.r ? '' : (ac.dbFlags ? flagToCountry(ac.dbFlags) : 'Unknown'),
    lat,
    lng,
    alt:   typeof ac.alt_baro === 'number' ? Math.round(ac.alt_baro) : null, // already feet
    spd:   ac.gs   != null ? Math.round(ac.gs)   : null, // already knots
    hdg:   ac.track ?? ac.true_heading ?? 0,
    vrate: ac.baro_rate != null ? Math.round(ac.baro_rate / 196.85 * 10) / 10 : 0, // ft/min → m/s
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

function flagToCountry(flags) {
  // dbFlags bit 0 = military, bit 1 = interesting
  if (flags & 1) return 'Military';
  return 'Unknown';
}

async function fetchAdsbLol() {
  // Center of Middle East ~28°N 50°E, 1800nm covers Israel→Pakistan, Turkey→Yemen
  const url = 'https://api.adsb.lol/v2/lat/28/lon/50/dist/1800';
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`adsb.lol ${resp.status}`);
  const data = await resp.json();
  const list = data.ac || data.aircraft || [];
  return list.map(fromAdsbLol).filter(Boolean);
}

async function fetchOpenSky() {
  const url = `https://opensky-network.org/api/states/all?lamin=${BBOX.lamin}&lomin=${BBOX.lomin}&lamax=${BBOX.lamax}&lomax=${BBOX.lomax}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`OpenSky ${resp.status}`);
  const data = await resp.json();
  return (data.states || []).map(fromOpenSky).filter(Boolean);
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (cache && Date.now() - cacheTs < CACHE_TTL) {
    return { statusCode: 200, headers, body: cache };
  }

  let aircraft = [];
  let source = 'none';

  try {
    aircraft = await fetchAdsbLol();
    source = 'adsb.lol';
  } catch (e1) {
    try {
      aircraft = await fetchOpenSky();
      source = 'opensky';
    } catch (e2) {
      if (cache) return { statusCode: 200, headers, body: cache };
      return { statusCode: 502, headers, body: JSON.stringify({ aircraft: [], error: `${e1.message} / ${e2.message}` }) };
    }
  }

  const body = JSON.stringify({ aircraft, timestamp: Date.now(), count: aircraft.length, source });
  cache = body;
  cacheTs = Date.now();
  return { statusCode: 200, headers, body };
};
