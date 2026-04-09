// vessels.js — naval vessel tracker
// Tries multiple free public AIS REST endpoints in sequence.
// Falls back to curated last-known positions for strategic vessels.
// GET /api/vessels → { vessels, source, lastUpdated }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// ─── Curated strategic vessels ────────────────────────────────────────────────
// Positions represent estimated Day-40 scenario positions.
// These are used when all live AIS sources fail.
const FALLBACK_VESSELS = [
  // US Navy — Carrier Strike Groups
  { id:"cvn78",  name:"USS GERALD R. FORD",     type:"Carrier CVN",   flag:"US", status:"active",  lat:18.00, lng:62.50, dest:"Arabian Sea strike ops — CVW-8 sorties",        note:"Day 1 arrival. 3 CSGs now operating simultaneously.", source:"USN/CENTCOM" },
  { id:"cvn69",  name:"USS EISENHOWER",          type:"Carrier CVN",   flag:"US", status:"active",  lat:23.50, lng:59.00, dest:"Gulf of Oman — reserve strike package",           note:"Arrived Day 5. Operating jointly with USS Ford.",      source:"USN/CENTCOM" },
  { id:"cvn70",  name:"USS CARL VINSON",         type:"Carrier CVN",   flag:"US", status:"active",  lat:16.00, lng:62.00, dest:"Southern Arabian Sea — Day 28 arrival",           note:"3rd carrier group. Surge deployment ordered by SECDEF.",source:"USN/CENTCOM" },
  { id:"ddg107", name:"USS GRAVELY",             type:"DDG-51",        flag:"US", status:"active",  lat:24.80, lng:58.20, dest:"Forward Hormuz screen — BMD role",                note:"Ballistic missile defense. Tomahawk strike ops.",       source:"USN" },
  { id:"ddg87",  name:"USS MASON",               type:"DDG-51",        flag:"US", status:"active",  lat:26.20, lng:56.90, dest:"Hormuz patrol — anti-drone escort",               note:"Intercepted 9 IRGC drones. Repelled 2 speedboat swarms.",source:"USN" },
  { id:"ddg67",  name:"USS COLE",                type:"DDG-51",        flag:"US", status:"active",  lat:14.50, lng:43.50, dest:"Red Sea northern sector — Tomahawk",              note:"Named for USS Cole attack 2000. Conducting strike ops.", source:"USN" },
  { id:"ddg64",  name:"USS CARNEY",              type:"DDG-51",        flag:"US", status:"active",  lat:13.00, lng:42.50, dest:"Bab el-Mandeb — drone intercept ops",             note:"Downed 9-drone IRGC swarm on Day 5. Red Sea picket.",   source:"USN" },
  { id:"lhd5",   name:"USS BATAAN",              type:"LHD Amphib",    flag:"US", status:"active",  lat:23.50, lng:60.50, dest:"Amphibious ready group — 24th MEU",               note:"24th MEU embarked. Contingency landing force on standby.",source:"USN" },
  // UK Royal Navy
  { id:"d34",    name:"HMS DIAMOND",             type:"Type 45 DDG",   flag:"UK", status:"active",  lat:13.50, lng:43.20, dest:"Northern Red Sea — air defense picket",            note:"Shot down 6 Iranian drones near Bab el-Mandeb (Day 13).",source:"Royal Navy" },
  // Iranian Navy
  { id:"f74",    name:"IRIS SAHAND",             type:"Moudge Frigate",flag:"IR", status:"damaged", lat:26.80, lng:56.50, dest:"Damaged — withdrawing to Bandar Abbas",           note:"Struck by Harpoon missile Day 30. Limping to port.",     source:"IRGCN / OSINT" },
  { id:"irgc1",  name:"IRGC DIV-1 SPEEDBOATS",  type:"Fast Attack",   flag:"IR", status:"active",  lat:27.20, lng:56.80, dest:"Near Bandar Abbas — harassment ops",              note:"~40-boat swarm repelled by USS Ford CSG on Day 2.",      source:"USN / OSINT" },
  // Commercial — diverted/holding east of Hormuz
  { id:"mv1",    name:"BW AMAZON",               type:"VLCC",          flag:"SG", status:"diverted",lat:22.50, lng:60.80, dest:"Rerouting via Cape of Good Hope (+12d)",          note:"VLCC (316k DWT). Adds $2.3M to voyage cost via Africa.", source:"MarineTraffic est." },
  { id:"mv2",    name:"NORDIC LUNA",             type:"LNG Carrier",   flag:"NO", status:"waiting", lat:24.20, lng:57.50, dest:"Holding — Gulf of Oman anchorage",                note:"LNG carrier. Waiting for Hormuz corridor clearance.",    source:"MarineTraffic est." },
  { id:"mv3",    name:"DELPHIN GAS",             type:"LNG Carrier",   flag:"GR", status:"blocked", lat:26.50, lng:56.40, dest:"BLOCKED — last position near Hormuz",             note:"Stranded since Day 3. Hormuz fully closed to transit.",  source:"MarineTraffic est." },
  { id:"mv4",    name:"PACIFIC TITAN",           type:"VLCC",          flag:"JP", status:"diverted",lat:21.80, lng:62.10, dest:"Rerouting via Cape of Good Hope",                 note:"VLCC (299k DWT). Full reroute via southern Africa.",     source:"MarineTraffic est." },
  { id:"mv5",    name:"MOUNT BLANC",             type:"VLCC",          flag:"MH", status:"waiting", lat:25.00, lng:56.40, dest:"Anchored off Fujairah — awaiting corridor",        note:"Anchored in UAE waters. Awaiting US Navy escort window.",source:"MarineTraffic est." },
  { id:"mv6",    name:"KOREA GAS",               type:"LNG Carrier",   flag:"KR", status:"waiting", lat:23.80, lng:61.50, dest:"Holding — Gulf of Oman",                          note:"South Korean LNG carrier. 50+ similar vessels holding.", source:"MarineTraffic est." },
  { id:"mv7",    name:"GULF STAR",               type:"Container",     flag:"KR", status:"diverted",lat:23.00, lng:64.00, dest:"Rerouting via Cape of Good Hope",                 note:"Container ship. 18-day delay to European ports.",        source:"MarineTraffic est." },
];

// 5-minute cache
let cache = { data: null, ts: 0, source: "curated" };
const TTL = 5 * 60 * 1000;

exports.handler = async () => {
  if (cache.data && Date.now() - cache.ts < TTL) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ vessels: cache.data, source: cache.source, lastUpdated: new Date(cache.ts).toISOString() }),
    };
  }

  // Try live AIS sources in priority order
  const sources = [
    { fn: fetchAISStream,    label: "AISStream (live)" },
    { fn: fetchAISExplorer,  label: "AIS Exchange (live)" },
    { fn: fetchMarineTraffic,label: "MarineTraffic (live)" },
  ];

  let liveVessels = [];
  let dataSource = "curated";

  for (const { fn, label } of sources) {
    try {
      const result = await fn();
      if (result && result.length >= 3) {
        liveVessels = result;
        dataSource = label;
        break;
      }
    } catch { /* try next */ }
  }

  const vessels = mergeVessels(FALLBACK_VESSELS, liveVessels);
  cache = { data: vessels, ts: Date.now(), source: dataSource };

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ vessels, source: dataSource, lastUpdated: new Date().toISOString() }),
  };
};

// ─── AIS Source 1: aisstream.io ───────────────────────────────────────────────
// Free REST snapshot endpoint (no API key needed for bbox query)
async function fetchAISStream() {
  const url = "https://api.aisstream.io/v0/vesselLocations?MMSI=538006693,311000857,244780000,232004793,219021588";
  // Try bbox query instead — free public endpoint
  const bboxUrl = "https://aisstream.io/api/v1/vessels?latmin=12&latmax=30&lonmin=40&lonmax=67&limit=50";
  const r = await fetch(bboxUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error(`AISStream HTTP ${r.status}`);
  const data = await r.json();
  const arr = Array.isArray(data) ? data : (data.vessels || data.data || []);
  return normalizeAISStream(arr);
}

function normalizeAISStream(arr) {
  return arr
    .filter(v => v && v.lat != null && v.lon != null)
    .map(v => ({
      id: `ais-${v.mmsi || v.MMSI}`,
      name: (v.name || v.NAME || v.callsign || "Unknown").trim(),
      type: aisTypeLabel(v.type || v.TYPE || 0),
      flag: v.flag || v.FLAG || "?",
      status: "active",
      lat: parseFloat(v.lat || v.LAT),
      lng: parseFloat(v.lon || v.LON),
      dest: v.destination || v.DESTINATION || "Unknown",
      note: `MMSI: ${v.mmsi || v.MMSI || "?"} · ${v.speed || v.SOG || "?"}kts · ${v.course || v.COG || "?"}°`,
      source: "AISStream (live)",
      mmsi: v.mmsi || v.MMSI,
      speed: v.speed || v.SOG,
    }));
}

// ─── AIS Source 2: aisexplorer.com ───────────────────────────────────────────
async function fetchAISExplorer() {
  const url = "https://www.aisexplorer.com/AIS/?minlat=12&maxlat=30&minlon=40&maxlon=67&format=json";
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`AISExplorer HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Bad format");
  return data
    .filter(v => {
      const t = parseInt(v.TYPE, 10);
      // tankers (80-89), cargo (70-79), military (30-39), LNG/gas (84-85)
      return t >= 30 && t <= 90;
    })
    .slice(0, 40)
    .map(v => ({
      id: `ais-${v.MMSI || v.CALLSIGN}`,
      name: (v.NAME || v.CALLSIGN || "Unknown").trim(),
      type: aisTypeLabel(parseInt(v.TYPE, 10)),
      flag: v.FLAG || "?",
      status: "active",
      lat: parseFloat(v.LAT),
      lng: parseFloat(v.LON),
      dest: v.DESTINATION || "Unknown",
      note: `MMSI: ${v.MMSI || "?"} · ${v.SOG || "?"}kts · ${v.COG || "?"}°`,
      source: "AIS Exchange (live)",
      mmsi: v.MMSI,
      speed: v.SOG,
    }));
}

// ─── AIS Source 3: MarineTraffic open data ────────────────────────────────────
async function fetchMarineTraffic() {
  // Public bbox endpoint — works without auth for some regions/times
  const url = "https://www.marinetraffic.com/getData/get_data_json_3/sw_x/40/sw_y/12/ne_x/67/ne_y/30/zoom/5/station:0";
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.marinetraffic.com/",
      "Accept": "application/json, text/javascript, */*",
      "X-Requested-With": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`MarineTraffic HTTP ${r.status}`);
  const data = await r.json();
  const arr = data?.data?.rows || data?.rows || [];
  if (!arr.length) throw new Error("No rows");
  return arr.slice(0, 40).map(v => ({
    id: `mt-${v.MMSI || v[0]}`,
    name: (v.SHIPNAME || v[2] || "Unknown").trim(),
    type: aisTypeLabel(parseInt(v.SHIPTYPE || v[9] || 0, 10)),
    flag: v.FLAG || v[6] || "?",
    status: "active",
    lat: parseFloat(v.LAT || v[4]),
    lng: parseFloat(v.LON || v[5]),
    dest: v.DESTINATION || v[11] || "Unknown",
    note: `MMSI: ${v.MMSI || v[0] || "?"} · ${v.SPEED || v[7] || "?"}kts`,
    source: "MarineTraffic (live)",
    mmsi: v.MMSI || v[0],
    speed: v.SPEED || v[7],
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function aisTypeLabel(t) {
  if (t >= 30 && t <= 35) return "Naval Vessel";
  if (t === 37)            return "DDG";
  if (t >= 70 && t <= 72) return "Container";
  if (t >= 73 && t <= 79) return "Cargo";
  if (t === 80 || t === 81 || t === 82 || t === 83 || t === 89) return "VLCC";
  if (t === 84 || t === 85) return "LNG Carrier";
  if (t >= 80 && t <= 89)  return "Tanker";
  return "Cargo";
}

function mergeVessels(curated, live) {
  if (!live.length) return curated;

  // Filter live to strategic types only (tankers, LNG, military — skip small fishing)
  const strategic = live.filter(v =>
    ["VLCC","LNG Carrier","Tanker","Naval Vessel","DDG","Container","Carrier CVN"].includes(v.type)
  );
  if (!strategic.length) return curated;

  const merged = [...curated];
  for (const lv of strategic) {
    const name6 = lv.name.toLowerCase().slice(0, 6);
    const exists = curated.some(cv =>
      cv.name.toLowerCase().includes(name6) ||
      (lv.mmsi && cv.mmsi === lv.mmsi)
    );
    if (!exists) merged.push(lv);
  }
  return merged.slice(0, 40); // cap at 40 vessels
}
