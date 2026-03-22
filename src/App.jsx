import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const EVENTS = [
  { id:1,  lat:35.6892, lng:51.3890, title:"Tehran — IRGC HQ & Palace Complex",      type:"us_il",     date:"2026-03-20", confidence:"confirmed", desc:"Large explosions near Saadabad Palace complex. Series of strikes on military C2 infrastructure. IRGC confirms multiple sites hit.", verified:true },
  { id:2,  lat:35.7500, lng:51.4200, title:"Tehran — Khamenei Killed (Day 1)",        type:"hvt",       date:"2026-02-28", confidence:"confirmed", desc:"Supreme Leader Ali Khamenei killed in Israeli airstrike. Confirmed by IRIB, Fars News, Trump, and Netanyahu. Son Mojtaba named successor.", verified:true },
  { id:3,  lat:35.6892, lng:51.3890, title:"Tehran — Larijani Assassinated",          type:"hvt",       date:"2026-03-17", confidence:"confirmed", desc:"Israel assassinated Ali Larijani, Secretary of Iran's Supreme National Security Council. IRGC vowed 'zero restraint' in response.", verified:true },
  { id:4,  lat:38.0962, lng:46.2738, title:"Tabriz — 2nd Artesh Airbase Cratered",   type:"us_il",     date:"2026-03-03", confidence:"confirmed", desc:"Satellite imagery: 11 craters on runway of 2nd Artesh Air Force Tactical Airbase. Rendered inoperable. IAF destroyed F-4 and two F-5s.", verified:true },
  { id:5,  lat:37.4000, lng:47.0000, title:"Tabriz — 6th Artesh Aviation Base",      type:"us_il",     date:"2026-03-03", confidence:"confirmed", desc:"Satellite imagery shows damaged logistics facility near 6th Artesh Ground Forces Aviation Base.", verified:true },
  { id:6,  lat:29.5918, lng:52.5837, title:"Shiraz — 7th Artesh Airbase",            type:"us_il",     date:"2026-03-02", confidence:"confirmed", desc:"Satellite imagery: two craters and damaged building in southern section of 7th Artesh Air Force Tactical Airbase.", verified:true },
  { id:7,  lat:32.6546, lng:51.6680, title:"Isfahan — Nuclear & Air Defense Sites",  type:"us_il",     date:"2026-02-28", confidence:"confirmed", desc:"Opening US strike package targeted nuclear facilities and air defense near Isfahan. GBU-57 bunker-busters deployed.", verified:true },
  { id:8,  lat:33.7244, lng:51.7252, title:"Natanz — Enrichment Facility",           type:"us_il",     date:"2026-02-28", confidence:"confirmed", desc:"Natanz uranium enrichment facility targeted in Day 1 strikes. IAEA reported 460kg of 60% enriched uranium on site.", verified:true },
  { id:9,  lat:29.2569, lng:50.3243, title:"Kharg Island — Oil Export Terminal",     type:"us_il",     date:"2026-03-01", confidence:"confirmed", desc:"US/Israeli strikes on Kharg Island, Iran's primary oil export terminal.", verified:true },
  { id:10, lat:27.1500, lng:52.6000, title:"South Pars — Gas Field Strike",          type:"us_il",     date:"2026-03-18", confidence:"confirmed", desc:"Israel struck South Pars gasfield, Iran's largest natural gas reserve. Iran warned 'zero restraint'.", verified:true },
  { id:11, lat:34.3277, lng:47.0650, title:"Kermanshah — Missile Launchers",         type:"us_il",     date:"2026-03-01", confidence:"confirmed", desc:"300+ Iranian ballistic missile launchers destroyed across Iran by Mar 3. Iranian missile fire dropped ~90% by day 10.", verified:true },
  { id:12, lat:34.6416, lng:50.8746, title:"Arak — Civilian Strike",                 type:"us_il",     date:"2026-03-17", confidence:"confirmed", desc:"3-day-old infant and 2-year-old sister killed in strike on residential home in Arak. Mother and grandmother also killed.", verified:true },
  { id:13, lat:27.1500, lng:57.0833, title:"Minab — Girls School (170+ Dead)",       type:"us_il",     date:"2026-03-10", confidence:"confirmed", desc:"Deadliest single incident. Airstrike on elementary girls' school in Minab killed 170+. Confirmed by Amnesty International.", verified:true },
  { id:14, lat:31.7517, lng:34.9896, title:"Beit Shemesh — 9 Civilians Killed",      type:"iran",      date:"2026-03-01", confidence:"confirmed", desc:"Deadliest Iranian strike on Israel. Ballistic missile hit residential neighborhood, killing 9 civilians.", verified:true },
  { id:15, lat:32.0786, lng:34.8207, title:"Ramat Gan — Cluster Warhead",            type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iranian cluster warhead killed two residents in their 70s. IRGC called it 'revenge for Larijani.'", verified:true },
  { id:16, lat:32.7940, lng:34.9896, title:"Haifa — Iranian Retaliatory Strike",     type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iran struck Haifa in retaliation for South Pars attack. Arrow system intercepted majority of barrage.", verified:true },
  { id:17, lat:31.8928, lng:35.0266, title:"Ben Gurion Airport — Hit",               type:"iran",      date:"2026-03-15", confidence:"confirmed", desc:"Missile struck three private planes on tarmac. Israeli authorities capped outbound flights at 130 passengers.", verified:true },
  { id:18, lat:31.7683, lng:35.2137, title:"Jerusalem — Holy Site Debris",           type:"iran",      date:"2026-03-17", confidence:"confirmed", desc:"Missile fragments found near Al-Aqsa Mosque and Church of Holy Sepulchre. No casualties.", verified:true },
  { id:19, lat:25.9000, lng:51.5500, title:"Ras Laffan, Qatar — LNG Terminal Hit",  type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Iran struck Qatar's LNG export hub. 13 of 14 ballistic missiles intercepted.", verified:true },
  { id:20, lat:25.1222, lng:56.3367, title:"Fujairah, UAE — Oil Zone Attack",        type:"iran",      date:"2026-03-18", confidence:"confirmed", desc:"Drone attack ignited fire in UAE oil industry zone. Debris killed one Pakistani national in Abu Dhabi.", verified:true },
  { id:21, lat:33.1000, lng:35.6333, title:"Nahariya — Hezbollah Attack",            type:"hezbollah", date:"2026-03-17", confidence:"confirmed", desc:"Hezbollah launched attack on northern Israel. One man wounded. 1M+ Lebanese displaced.", verified:true },
  { id:22, lat:24.6877, lng:46.7219, title:"Riyadh — Saudi Intercepts",             type:"iran",      date:"2026-03-19", confidence:"confirmed", desc:"Saudi Arabia intercepting Iranian missiles in own airspace. KSA says 'trust gone.'", verified:true },
];

// ─── Static leadership posts (always visible, no API needed) ─────────────────
const LEADERSHIP_POSTS = [
  { id:1,  person:"Donald Trump",       role:"US President",               country:"🇺🇸", platform:"Truth Social", handle:"@realDonaldTrump", date:"2026-03-20", time:"11:34", color:"#ef4444", verified:true, text:"Iran has been COMPLETELY NEUTRALIZED. The mission is proceeding exactly as planned — maybe even better! Our brave military has destroyed over 300 missile launchers. The Iranian people deserve FREEDOM. We will finish the job. MAKE AMERICA GREAT AGAIN!" },
  { id:2,  person:"Benjamin Netanyahu", role:"Israeli PM",                  country:"🇮🇱", platform:"X",            handle:"@netanyahu",       date:"2026-03-19", time:"18:22", color:"#3b82f6", verified:true, text:"To the people of Iran: we have no quarrel with you. Our fight is against the regime that has oppressed you for decades and built weapons to destroy us. We are close to achieving our objectives. Iran can have a future — but not with this regime and not with nuclear weapons." },
  { id:3,  person:"Masoud Pezeshkian",  role:"Iranian President",           country:"🇮🇷", platform:"X",            handle:"@drpezeshkian",   date:"2026-03-20", time:"09:15", color:"#22c55e", verified:true, text:"Iran did not start this war. We will not surrender to bullies. Every missile fired at our children will be answered. The world watches as the US and Israel bomb hospitals, schools, and civilian homes. History will judge these war criminals." },
  { id:4,  person:"Donald Trump",       role:"US President",                country:"🇺🇸", platform:"Truth Social", handle:"@realDonaldTrump", date:"2026-03-18", time:"14:05", color:"#ef4444", verified:true, text:"Our NATO 'allies' are COWARDS for not helping us control the Hormuz Strait. We protect them for decades and when we need them, NOTHING. We will REMEMBER! Maybe they should pay their own defense bills from now on. Disgraceful!!!" },
  { id:5,  person:"Keir Starmer",       role:"UK Prime Minister",           country:"🇬🇧", platform:"X",            handle:"@Keir_Starmer",   date:"2026-02-28", time:"22:10", color:"#a78bfa", verified:true, text:"The UK condemns Iran's counter-strikes against civilian targets. I have spoken with President Trump and PM Netanyahu tonight. I do not believe in regime change from the skies. We urge an immediate return to diplomacy. The Iranian people must not pay the price for their government's actions." },
  { id:6,  person:"Mojtaba Khamenei",   role:"Iranian Supreme Leader",      country:"🇮🇷", platform:"State Media",  handle:"@Khamenei_ir",    date:"2026-03-01", time:"06:33", color:"#22c55e", verified:true, text:"In the name of God. My father has been martyred by the Zionist enemy and its American masters. I take the oath as Supreme Leader. Iran will not bow. Every grain of Iranian soil will resist. Death to America. Death to Israel. We will turn the Persian Gulf into a sea of fire." },
  { id:7,  person:"Emmanuel Macron",    role:"French President",             country:"🇫🇷", platform:"X",            handle:"@EmmanuelMacron", date:"2026-03-05", time:"16:50", color:"#60a5fa", verified:true, text:"France calls for an immediate ceasefire. The strikes on civilian infrastructure — hospitals, schools, energy sites — are unacceptable under international law. We are working with Germany and the UK on an emergency EU summit. The energy crisis caused by Hormuz closure is destabilizing all of Europe." },
  { id:8,  person:"Yoav Gallant",       role:"Israeli Defense Minister",    country:"🇮🇱", platform:"X",            handle:"@yoavgallant",    date:"2026-03-17", time:"20:44", color:"#3b82f6", verified:true, text:"Ali Larijani has been eliminated. The head of Iran's Supreme National Security Council is gone. To every commander in the IRGC: you are on our list. The IDF has destroyed 300 missile launchers. Iran's ability to threaten Israel is being dismantled piece by piece. We are not done." },
  { id:9,  person:"Narendra Modi",      role:"Indian PM",                   country:"🇮🇳", platform:"X",            handle:"@narendramodi",   date:"2026-03-10", time:"10:22", color:"#f59e0b", verified:true, text:"India calls for immediate de-escalation and protection of civilian lives. The disruption of shipping through the Strait of Hormuz is severely impacting global energy markets and the Indian economy. I spoke with President Trump today and urged restraint. War is never the answer." },
  { id:10, person:"Pete Hegseth",       role:"US Secretary of Defense",     country:"🇺🇸", platform:"X",            handle:"@PeteHegseth",    date:"2026-03-20", time:"15:00", color:"#ef4444", verified:true, text:"US war objectives remain unchanged: destroy Iran's missile systems and military industry, prevent a nuclear weapon, and neutralize Iran's navy. No set end date. We will continue until the mission is complete. The men and women of our armed forces are performing extraordinarily." },
  { id:11, person:"Ismail Qaani",       role:"IRGC Quds Force Commander",   country:"🇮🇷", platform:"State Media",  handle:"IRGC Official",   date:"2026-03-15", time:"08:00", color:"#22c55e", verified:false, text:"We have fired over 500 ballistic missiles and 2,000 drones at American and Zionist targets. Forty percent at the Zionist entity, sixty percent at American bases. The resistance will not stop. We will ratify our missiles for a longer war. America will drown in this region." },
  { id:12, person:"Antonio Guterres",   role:"UN Secretary-General",        country:"🇺🇳", platform:"X",            handle:"@antonioguterres",date:"2026-03-12", time:"12:00", color:"#94a3b8", verified:true, text:"I am horrified by the strikes on civilian infrastructure, including a school in Minab that killed over 170 children. This may constitute a war crime under international law. I call on the Security Council to act immediately. 3 million Iranians have been displaced. The humanitarian situation is catastrophic." },
  { id:13, person:"Benjamin Netanyahu", role:"Israeli PM",                  country:"🇮🇱", platform:"X",            handle:"@netanyahu",       date:"2026-03-20", time:"20:30", color:"#3b82f6", verified:true, text:"To the Persian people on Nowruz — the new year: we wish you a future of freedom, democracy, and peace. The regime that oppressed you is crumbling. Very soon, you will be able to celebrate freely. Am Yisrael Chai." },
  { id:14, person:"Donald Trump",       role:"US President",                country:"🇺🇸", platform:"Truth Social", handle:"@realDonaldTrump", date:"2026-03-10", time:"09:00", color:"#ef4444", verified:true, text:"Who knows better about SURPRISE than Japan? I said to PM Takaichi — 'Why didn't you tell me about Pearl Harbor?' (jokingly of course!) The element of surprise won World War II and it is working BEAUTIFULLY in Iran. Our military is the greatest in history!" },
  { id:15, person:"Scott Bessent",      role:"US Treasury Secretary",       country:"🇺🇸", platform:"X",            handle:"@ScottBessent",   date:"2026-03-19", time:"17:20", color:"#ef4444", verified:true, text:"We are considering unsanctioning Iranian crude oil currently in transit to ease global energy markets. The administration is committed to minimizing economic disruption while achieving our strategic objectives in Iran. Oil prices should stabilize." },
];

const SIM_SCENES = [
  { type:"title",  day:0,  duration:11000, title:"OPERATION EPIC FURY", subtitle:"Iran War 2026 — A Visual Timeline", narrative:"" },
  { type:"title",  day:0,  duration:9000,  title:"February 27, 2026", subtitle:"Oman's FM announces breakthrough in nuclear talks. Peace \"within reach.\"", narrative:"" },
  { type:"title",  day:1,  duration:7000,  title:"DAY 1 — February 28, 2026", subtitle:"02:00 UTC · Joint US-Israeli strikes begin", narrative:"" },
  { type:"strike", day:1,  duration:14000, origin:[23.5,62.0],  target:[33.7244,51.7252], label:"US Navy Tomahawks → Natanz", icon:"🚀", color:"#3b82f6", narrative:"Tomahawk cruise missiles launch from USN destroyers in the Arabian Sea. First strike package targets Natanz uranium enrichment facility — home to 460kg of 60% enriched uranium." },
  { type:"strike", day:1,  duration:14000, origin:[31.5,34.5],  target:[35.7500,51.4200], label:"IAF F-35I → Khamenei Compound", icon:"✈", color:"#60a5fa", narrative:"Israeli Air Force F-35I Adir fighters cross into Iranian airspace. Supreme Leader Ali Khamenei is killed in his compound. Iranian state media goes silent for 47 minutes." },
  { type:"impact", day:1,  duration:10000, lat:35.7500, lng:51.4200, label:"☠ KHAMENEI KILLED", color:"#a855f7", narrative:"IRIB and Fars News confirm Khamenei's death. Trump announces the news on Truth Social. Iran's command structure begins to fracture." },
  { type:"strike", day:1,  duration:12000, origin:[31.5,34.5],  target:[32.6546,51.6680], label:"IAF → Isfahan Air Defense", icon:"✈", color:"#3b82f6", narrative:"Simultaneous strikes hit nuclear-adjacent military facilities near Isfahan. US GBU-57 bunker-buster bombs penetrate hardened underground sites." },
  { type:"strike", day:1,  duration:12000, origin:[34.5,49.0],  target:[31.7517,34.9896], label:"IRGC → Beit Shemesh", icon:"⚡", color:"#ef4444", narrative:"Iran fires hundreds of ballistic missiles toward Israel. Arrow, David's Sling, and Iron Dome activate. One missile breaks through — killing 9 civilians in Beit Shemesh." },
  { type:"impact", day:1,  duration:10000, lat:31.7517, lng:34.9896, label:"💥 9 KILLED", color:"#ef4444", narrative:"Deadliest Iranian strike on Israeli soil. A residential neighborhood in Beit Shemesh is hit. Nine civilians killed. Hundreds shelter in safe rooms across Israel." },
  { type:"title",  day:2,  duration:6000,  title:"DAYS 2–3", subtitle:"Suppression of missile infrastructure", narrative:"" },
  { type:"strike", day:2,  duration:13000, origin:[31.5,34.5],  target:[29.2569,50.3243], label:"IAF → Kharg Island", icon:"✈", color:"#3b82f6", narrative:"Kharg Island, handling 90% of Iran's oil exports, is struck. Fires burn for 36 hours. Iran's primary revenue source for its war effort is disrupted." },
  { type:"strike", day:2,  duration:13000, origin:[23.5,62.0],  target:[34.3277,47.0650], label:"US PrSM → Missile Launchers", icon:"🚀", color:"#3b82f6", narrative:"The US deploys the Precision Strike Missile (PrSM) for the first time in combat. Systematic destruction of IRGC ballistic missile launch sites begins." },
  { type:"strike", day:3,  duration:13000, origin:[31.5,34.5],  target:[38.0962,46.2738], label:"IAF → Tabriz Airbases", icon:"✈", color:"#3b82f6", narrative:"Multiple Tabriz airbases struck. Satellite imagery confirms 11 craters on the 2nd Artesh runway. IAF destroys three Iranian fighters attempting takeoff." },
  { type:"title",  day:10, duration:7000,  title:"DAY 10 — March 9", subtitle:"Humanitarian catastrophe deepens", narrative:"" },
  { type:"impact", day:10, duration:13000, lat:27.1500, lng:57.0833, label:"💥 SCHOOL — 170+ DEAD", color:"#f59e0b", narrative:"A US airstrike hits an elementary girls' school in Minab, southeastern Iran. Over 170 people killed, most of them schoolchildren. Amnesty International later confirms US responsibility. The UN Secretary-General calls it a possible war crime." },
  { type:"title",  day:17, duration:6000,  title:"DAY 17 — March 16", subtitle:"Energy infrastructure war begins", narrative:"" },
  { type:"strike", day:17, duration:13000, origin:[31.5,34.5],  target:[27.1500,52.6000], label:"IAF → South Pars Gas Field", icon:"✈", color:"#3b82f6", narrative:"Israel strikes South Pars, the world's largest natural gas field. Global oil prices spike past $127/barrel. Iran warns of 'zero restraint' going forward." },
  { type:"strike", day:17, duration:13000, origin:[34.5,49.0],  target:[25.9000,51.5500], label:"Iran → Ras Laffan Qatar", icon:"⚡", color:"#ef4444", narrative:"Iran retaliates by striking Qatar's massive LNG export hub. 13 of 14 ballistic missiles intercepted. The energy war spreads across the Gulf." },
  { type:"title",  day:18, duration:6000,  title:"DAY 18 — March 17", subtitle:"HVT strike: Larijani eliminated", narrative:"" },
  { type:"strike", day:18, duration:12000, origin:[31.5,34.5],  target:[35.6892,51.3890], label:"IAF HVT → Larijani", icon:"✈", color:"#a855f7", narrative:"Israel assassinates Ali Larijani, Secretary of Iran's Supreme National Security Council. The IRGC announces it will no longer distinguish between military and civilian Israeli targets." },
  { type:"impact", day:18, duration:9000,  lat:35.6892, lng:51.3890, label:"☠ LARIJANI ELIMINATED", color:"#a855f7", narrative:"Larijani's death deals a severe blow to Iran's strategic decision-making. Defense Minister Gallant posts on X: 'You are on our list.'" },
  { type:"strike", day:19, duration:13000, origin:[34.5,49.0],  target:[32.7940,34.9896], label:"IRGC → Haifa Cluster Strike", icon:"⚡", color:"#ef4444", narrative:"Iran strikes Haifa with cluster munitions. Two elderly residents killed just outside their safe room. IRGC declares it 'revenge for Larijani.'" },
  { type:"title",  day:21, duration:9000,  title:"DAY 21 — March 20, 2026", subtitle:"War continues. No ceasefire in sight.", narrative:"", clearMap:true },
  { type:"stats",  day:21, duration:12000, narrative:"", clearMap:true },
  { type:"title",  day:21, duration:11000, title:"THE COST", subtitle:"1,400+ killed in Iran · 18,000+ injured · 3M+ displaced\nStrait of Hormuz closed · Brent crude at $127\nNATO called 'cowards' by Trump", narrative:"", clearMap:true },
];

const AIRCRAFT_BASE = [
  { id:"RCH101", callsign:"RCH101",  type:"C-17A",        role:"Transport", nation:"US", lat:26.26,lng:50.60,alt:35000,hdg:315,spd:480 },
  { id:"RAKE21", callsign:"RAKE21",  type:"KC-135R",      role:"Tanker",    nation:"US", lat:29.10,lng:55.20,alt:31000,hdg:260,spd:450 },
  { id:"SNTRY1", callsign:"SNTRY01", type:"E-3 Sentry",   role:"AWACS",     nation:"US", lat:28.50,lng:48.30,alt:29000,hdg:175,spd:400 },
  { id:"POSD01", callsign:"POSD01",  type:"P-8A Poseidon", role:"Maritime",  nation:"US", lat:24.80,lng:58.50,alt:25000,hdg:95, spd:370 },
  { id:"IAF401", callsign:"IAF401",  type:"F-35I Adir",   role:"Strike",    nation:"IL", lat:32.10,lng:38.00,alt:40000,hdg:65, spd:550 },
  { id:"IAF402", callsign:"IAF402",  type:"F-35I Adir",   role:"Strike",    nation:"IL", lat:32.50,lng:39.20,alt:40000,hdg:62, spd:550 },
  { id:"REACH77",callsign:"REACH77", type:"KC-46A",       role:"Tanker",    nation:"US", lat:27.30,lng:52.10,alt:30000,hdg:200,spd:440 },
  { id:"USN201", callsign:"USN201",  type:"FA-18F",       role:"Strike",    nation:"US", lat:23.50,lng:60.20,alt:22000,hdg:315,spd:520 },
  { id:"COBRA1", callsign:"COBRA01", type:"MQ-9 Reaper",  role:"ISR",       nation:"US", lat:31.20,lng:45.80,alt:15000,hdg:88, spd:220 },
  { id:"COBRA2", callsign:"COBRA02", type:"MQ-9 Reaper",  role:"ISR",       nation:"US", lat:33.10,lng:47.20,alt:14000,hdg:272,spd:220 },
  { id:"SAC201", callsign:"SAC201",  type:"B-52H",        role:"Strike",    nation:"US", lat:21.30,lng:68.40,alt:40000,hdg:315,spd:500 },
  { id:"GULL11", callsign:"GULL11",  type:"RQ-4 Global",  role:"ISR",       nation:"US", lat:30.50,lng:54.20,alt:60000,hdg:355,spd:360 },
];

const VESSELS = [
  { id:"mv1",name:"BW AMAZON",    type:"VLCC",       flag:"SG",status:"diverted",lat:22.50,lng:60.80,dest:"Cape of Good Hope reroute" },
  { id:"mv2",name:"NORDIC LUNA",  type:"LNG Carrier",flag:"NO",status:"waiting", lat:24.20,lng:57.50,dest:"Holding — Gulf of Oman" },
  { id:"mv3",name:"DELPHIN GAS",  type:"LNG Carrier",flag:"GR",status:"blocked", lat:26.50,lng:56.40,dest:"BLOCKED — Hormuz Closure" },
  { id:"mv4",name:"PACIFIC TITAN",type:"VLCC",       flag:"JP",status:"diverted",lat:21.80,lng:62.10,dest:"Cape of Good Hope reroute" },
  { id:"mv5",name:"GULF STAR",    type:"Container",  flag:"KR",status:"diverted",lat:23.00,lng:64.00,dest:"Cape of Good Hope reroute" },
  { id:"mv6",name:"IRAN SAVIZ",   type:"Cargo",      flag:"IR",status:"active",  lat:13.50,lng:42.80,dest:"Red Sea — IRGC logistics" },
  { id:"mv7",name:"USS FORD CVN", type:"Carrier CSG",flag:"US",status:"active",  lat:23.20,lng:64.30,dest:"USN CVN — Arabian Sea" },
  { id:"mv8",name:"USS BUNKER HL",type:"DDG",        flag:"US",status:"active",  lat:23.80,lng:65.00,dest:"USN DDG — Tomahawk ops" },
];

const TYPE_CFG = {
  us_il:    { color:"#3b82f6", label:"US/IL Strike",  icon:"✈" },
  iran:     { color:"#ef4444", label:"Iranian Strike", icon:"⚡" },
  hezbollah:{ color:"#f59e0b", label:"Hezbollah",      icon:"◆" },
  hvt:      { color:"#a855f7", label:"HVT Eliminated", icon:"☠" },
};
const CONF_CFG = {
  confirmed:  { color:"#22c55e", label:"CONFIRMED" },
  reported:   { color:"#f59e0b", label:"REPORTED" },
  unverified: { color:"#ef4444", label:"UNVERIFIED" },
};
const ROLE_COLOR = { Strike:"#ef4444",Tanker:"#22c55e",AWACS:"#a855f7",ISR:"#f59e0b",Transport:"#60a5fa",Maritime:"#06b6d4" };
const STATUS_COLOR = { diverted:"#f59e0b",waiting:"#60a5fa",blocked:"#ef4444",active:"#22c55e" };
const WAR_START = new Date("2026-02-28");
const MAX_DAY = 21;
const TG_CHANNELS = [
  { handle:"@IDFSpokesperson",color:"#3b82f6",nation:"🇮🇱" },
  { handle:"@IRNA_NEWS",      color:"#22c55e",nation:"🇮🇷" },
  { handle:"@CENTCOMNews",    color:"#60a5fa",nation:"🇺🇸" },
  { handle:"@OSINTdefender",  color:"#f59e0b",nation:"🔍" },
  { handle:"@IntelDoge",      color:"#a78bfa",nation:"🔍" },
  { handle:"@HouthiMilSpo",   color:"#ef4444",nation:"🇾🇪" },
];

const STATS_DATA = [
  { label:"War Day",             value:"21",     color:"#60a5fa" },
  { label:"Confirmed Strikes",   value:"115+",   color:"#ef4444" },
  { label:"Launchers Destroyed", value:"300+",   color:"#f59e0b" },
  { label:"Killed (Iran)",       value:"1,400+", color:"#ef4444" },
  { label:"Injured (Iran)",      value:"18K+",   color:"#f59e0b" },
  { label:"Displaced",           value:"3M+",    color:"#f59e0b" },
  { label:"Hormuz Status",       value:"CLOSED", color:"#ef4444" },
  { label:"Missile Fire",        value:"↓ 90%",  color:"#22c55e" },
];

const dayToDate = d => { const dt=new Date(WAR_START); dt.setDate(dt.getDate()+d); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
const moveAC = ac => {
  const r=ac.hdg*Math.PI/180;
  let lat=ac.lat+Math.cos(r)*0.025,lng=ac.lng+Math.sin(r)*0.025,hdg=ac.hdg;
  if(lat>44||lat<18){lat=ac.lat;hdg=(hdg+180)%360;}
  if(lng>74||lng<30){lng=ac.lng;hdg=(hdg+180)%360;}
  return{...ac,lat,lng,hdg};
};

function Spinner({color="#3b82f6",label="LOADING"}){
  return <div style={{textAlign:"center",padding:"28px 0"}}>
    <div style={{width:10,height:10,borderRadius:"50%",background:color,margin:"0 auto 12px",animation:"pulse 2s ease-in-out infinite"}}/>
    <div style={{fontSize:11,color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>{label}...</div>
  </div>;
}

// ─── Simulation ───────────────────────────────────────────────────────────────
function WarSimulation({ onClose }) {
  const simMapRef  = useRef(null);
  const simLMap    = useRef(null);
  const simLines   = useRef([]);
  const simMarkers = useRef([]);
  const simPlaying = useRef(true);
  const timeoutRef = useRef(null);
  const speedRef   = useRef(1);

  const [sceneNum,     setSceneNum]     = useState(0);
  const [playing,      setPlayingS]     = useState(true);
  const [curScene,     setCurScene]     = useState(SIM_SCENES[0]);
  const [narrative,    setNarrative]    = useState("");
  const [progress,     setProgress]     = useState(0);
  const [speed,        setSpeed]        = useState(1);
  const [mapReady,     setMapReady]     = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [narVisible,   setNarVisible]   = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [satellite,    setSatellite]    = useState(false);
  const tileLayerRef = useRef(null);

  useEffect(()=>{ speedRef.current=speed; },[speed]);

  // Dynamic duration: ~420ms per word of on-screen text, with per-type minimums
  const sceneDuration = useCallback((scene) => {
    const words = [scene.narrative||'', scene.title||'', scene.subtitle||'', scene.label||'']
      .join(' ').split(/\s+/).filter(Boolean).length;
    const minDur = scene.type==='title' ? 5000 : 9000;
    return Math.max(minDur, words * 420) / speedRef.current;
  },[]);

  const animateLine = useCallback((L,map,from,to,color,durationMs)=>{
    // Complete the arc in 40% of scene duration so it finishes well before the scene ends
    const steps=55, interval=(durationMs*0.40)/steps;
    // Push arc midpoint well NORTH — keeps the line out of the bottom 30% of screen
    // where the narrative text box lives
    const latSpan = Math.abs(to[0]-from[0]);
    const lngSpan = Math.abs(to[1]-from[1]);
    const northPush = Math.max(latSpan, lngSpan) * 0.32 + 4.0;
    const midLat = (from[0]+to[0])/2 + northPush;
    const midLng = (from[1]+to[1])/2;
    const line=L.polyline([],{color,weight:2.5,opacity:0.9,dashArray:"8,5"}).addTo(map);
    simLines.current.push(line);
    const animIcon=L.divIcon({className:"",html:`<div style="color:${color};font-size:16px;filter:drop-shadow(0 0 8px ${color});animation:pulse 0.5s ease-in-out infinite">●</div>`,iconSize:[16,16],iconAnchor:[8,8]});
    let animMarker=null, step=0;
    const points=[];
    const timer=setInterval(()=>{
      if(!simPlaying.current) return;
      step++;
      const t=step/steps;
      const lat=(1-t)*(1-t)*from[0]+2*(1-t)*t*midLat+t*t*to[0];
      const lng=(1-t)*(1-t)*from[1]+2*(1-t)*t*midLng+t*t*to[1];
      points.push([lat,lng]);
      line.setLatLngs(points);
      if(animMarker) animMarker.setLatLng([lat,lng]);
      else{ animMarker=L.marker([lat,lng],{icon:animIcon,zIndexOffset:2000}).addTo(map); simMarkers.current.push(animMarker); }
      if(step>=steps){
        clearInterval(timer);
        if(animMarker){animMarker.remove();simMarkers.current=simMarkers.current.filter(m=>m!==animMarker);}
        const b1=L.circleMarker(to,{radius:20,color,fillColor:color,fillOpacity:0.12,weight:2,opacity:0.7}).addTo(map);
        const b2=L.circleMarker(to,{radius:8, color,fillColor:color,fillOpacity:0.55,weight:2,opacity:1}).addTo(map);
        simMarkers.current.push(b1,b2);
      }
    },interval);
  },[]);

  const addImpactMarker = useCallback((L,map,lat,lng,label,color)=>{
    const parts=label.split(" ");
    const icon=L.divIcon({className:"",html:`<div style="text-align:center"><div style="font-size:20px;filter:drop-shadow(0 0 10px ${color})">${parts[0]}</div><div style="color:${color};font-size:10px;font-family:'Share Tech Mono',monospace;white-space:nowrap;margin-top:3px;font-weight:700">${parts.slice(1).join(" ")}</div></div>`,iconSize:[100,36],iconAnchor:[50,18]});
    const m=L.marker([lat,lng],{icon,zIndexOffset:3000}).addTo(map);
    const p=L.circleMarker([lat,lng],{radius:28,color,fillColor:color,fillOpacity:0.1,weight:2,opacity:0.6}).addTo(map);
    simMarkers.current.push(m,p);
  },[]);

  const runScene = useCallback((idx)=>{
    if(idx>=SIM_SCENES.length){setProgress(100);return;}
    const scene=SIM_SCENES[idx];
    setSceneNum(idx); setCurScene(scene);
    setProgress(Math.round((idx/SIM_SCENES.length)*100));
    setTitleVisible(false); setNarVisible(false); setStatsVisible(false);

    // Wipe all lines and markers for clean "ending" slides
    if(scene.clearMap && simLMap.current){
      simLines.current.forEach(l=>{ try{ l.remove(); }catch(e){} });
      simLines.current=[];
      simMarkers.current.forEach(m=>{ try{ m.remove(); }catch(e){} });
      simMarkers.current=[];
      simLMap.current.flyTo([31,49],5,{duration:1.2/speedRef.current,easeLinearity:0.5});
    }
    const dur = sceneDuration(scene);
    const advance=()=>{
      if(!simPlaying.current){timeoutRef.current=setTimeout(()=>advance(),300);return;}
      runScene(idx+1);
    };
    if(scene.type==="title"){
      setTimeout(()=>setTitleVisible(true),100);
      if(scene.narrative){setNarrative(scene.narrative);setTimeout(()=>setNarVisible(true),400);}
      timeoutRef.current=setTimeout(advance,dur);
    } else if(scene.type==="stats"){
      setStatsVisible(true);
      timeoutRef.current=setTimeout(advance,dur);
    } else if(scene.type==="impact"&&simLMap.current&&window.L){
      const L=window.L,map=simLMap.current;
      setTimeout(()=>setTitleVisible(true),100);
      setNarrative(scene.narrative); setTimeout(()=>setNarVisible(true),500);
      addImpactMarker(L,map,scene.lat,scene.lng,scene.label,scene.color);
      // Fly slightly north of impact so it appears in upper-centre, not behind narrative box
      map.flyTo([scene.lat+2, scene.lng],7,{duration:1.5/speedRef.current,easeLinearity:0.5});
      timeoutRef.current=setTimeout(advance,dur);
    } else if(scene.type==="strike"&&simLMap.current&&window.L){
      const L=window.L,map=simLMap.current;
      setTimeout(()=>setTitleVisible(true),100);
      setNarrative(scene.narrative); setTimeout(()=>setNarVisible(true),600);
      // Frame map to show origin→target with a northward offset so arc clears the text
      const midLat=(scene.origin[0]+scene.target[0])/2 + 3;
      const midLng=(scene.origin[1]+scene.target[1])/2;
      map.flyTo([midLat,midLng],5,{duration:1.2/speedRef.current,easeLinearity:0.5});
      const oIcon=L.divIcon({className:"",html:`<div style="color:${scene.color};font-size:15px;filter:drop-shadow(0 0 6px ${scene.color})">${scene.icon}</div>`,iconSize:[15,15],iconAnchor:[7,7]});
      const om=L.marker(scene.origin,{icon:oIcon,zIndexOffset:1500}).addTo(map);
      simMarkers.current.push(om);
      setTimeout(()=>{ if(simLMap.current) animateLine(L,map,scene.origin,scene.target,scene.color,dur*0.8); },700/speedRef.current);
      timeoutRef.current=setTimeout(advance,dur);
    }
  },[addImpactMarker,animateLine,sceneDuration]);

  useEffect(()=>{
    const css=document.createElement("link");css.rel="stylesheet";
    css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const js=document.createElement("script");
    js.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload=()=>{
      if(simMapRef.current&&!simLMap.current){
        const L=window.L;
        const map=L.map(simMapRef.current,{center:[31,49],zoom:5,zoomControl:false,attributionControl:false});
        tileLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",{maxZoom:18});
        tileLayerRef.current.addTo(map);
        simLMap.current=map; setMapReady(true);
      }
    };
    document.head.appendChild(js);
    return()=>{
      clearTimeout(timeoutRef.current);
      if(simLMap.current){simLMap.current.remove();simLMap.current=null;}
      css.remove();js.remove();
    };
  },[]);
  useEffect(()=>{if(mapReady)runScene(0);},[mapReady]);

  // Swap tile layer when satellite toggle changes
  useEffect(()=>{
    if(!simLMap.current||!window.L||!tileLayerRef.current) return;
    const L=window.L, map=simLMap.current;
    tileLayerRef.current.remove();
    const url = satellite
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
    tileLayerRef.current = L.tileLayer(url,{maxZoom:18});
    tileLayerRef.current.addTo(map);
    // Keep tile behind all map overlays
    tileLayerRef.current.bringToBack();
  },[satellite]);

  const togglePlay=()=>{simPlaying.current=!simPlaying.current;setPlayingS(p=>!p);};

  const goToScene = useCallback((idx)=>{
    if(idx<0||idx>=SIM_SCENES.length) return;
    clearTimeout(timeoutRef.current);
    // Clear all map drawings
    if(simLMap.current){
      simLines.current.forEach(l=>l.remove()); simLines.current=[];
      simMarkers.current.forEach(m=>m.remove()); simMarkers.current=[];
      simLMap.current.setView([31,49],5);
    }
    simPlaying.current=false; setPlayingS(false);
    runScene(idx);
    // Re-pause after runScene starts (runScene will try to auto-advance only when playing)
    simPlaying.current=false;
  },[runScene]);

  const restart=()=>{
    clearTimeout(timeoutRef.current);simPlaying.current=true;setPlayingS(true);
    if(simLMap.current){simLines.current.forEach(l=>l.remove());simLines.current=[];simMarkers.current.forEach(m=>m.remove());simMarkers.current=[];simLMap.current.setView([31,49],5);}
    runScene(0);
  };
  const scene=SIM_SCENES[sceneNum]||SIM_SCENES[0];
  const isTitleScene=scene?.type==="title";
  const isStatsScene=scene?.type==="stats";

  return (
    <div style={{position:"fixed",inset:0,zIndex:10000,background:"#03050a",display:"flex",flexDirection:"column",fontFamily:"'Rajdhani',sans-serif"}}>
      <div style={{flex:1,position:"relative",overflow:"hidden"}}>
        <div ref={simMapRef} style={{width:"100%",height:"100%"}}/>
        {/* Vignette */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse at center, transparent 40%, rgba(3,5,10,0.7) 100%)",zIndex:2}}/>
        {/* Scanlines */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:3,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px)"}}/>
        {/* Pause dim overlay */}
        {!playing&&<div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:900,background:"rgba(0,0,0,0.35)"}}/>}
        {/* Title scenes */}
        {titleVisible&&isTitleScene&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:1000,pointerEvents:"none"}}>
            <div style={{textAlign:"center",animation:"fadeInUp 0.6s ease-out"}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#ef4444",letterSpacing:3,marginBottom:16,opacity:0.8}}>⬛ CLASSIFICATION: TOP SECRET // SI // NOFORN</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:30,fontWeight:900,color:"#ef4444",letterSpacing:6,textShadow:"0 0 50px #ef444488, 0 0 100px #ef444422",marginBottom:14}}>{scene.title}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:14,color:"#c8dae8",letterSpacing:2,lineHeight:2.1,maxWidth:540,textAlign:"center",whiteSpace:"pre-line"}}>{scene.subtitle}</div>
            </div>
          </div>
        )}
        {/* Strike/impact event label — top center */}
        {titleVisible&&!isTitleScene&&!isStatsScene&&(
          <div style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",zIndex:1000,pointerEvents:"none",animation:"fadeInDown 0.4s ease-out"}}>
            <div style={{background:"rgba(3,5,10,0.92)",border:`1px solid ${scene?.color||"#3b82f6"}66`,padding:"8px 22px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 0 20px ${scene?.color||"#3b82f6"}22`}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:scene?.color||"#3b82f6",animation:"pulse 1s ease-in-out infinite",boxShadow:`0 0 8px ${scene?.color||"#3b82f6"}`}}/>
              <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:scene?.color||"#3b82f6",letterSpacing:3,fontWeight:700}}>DAY {scene?.day} · {scene?.label||"EVENT"}</span>
            </div>
          </div>
        )}
        {/* Stats scene */}
        {isStatsScene&&statsVisible&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:1000,pointerEvents:"none",background:"rgba(3,5,10,0.8)"}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#ef4444",letterSpacing:3,marginBottom:12,opacity:0.8}}>⬛ CLASSIFICATION: TOP SECRET // SI // NOFORN</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,color:"#ef4444",letterSpacing:4,marginBottom:28,animation:"fadeInUp 0.5s ease-out",textShadow:"0 0 30px #ef444455"}}>WAR STATUS — DAY 21</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:14,justifyContent:"center",maxWidth:580,animation:"fadeInUp 0.7s ease-out"}}>
              {STATS_DATA.map((s,i)=>(
                <div key={i} style={{background:"rgba(6,10,15,0.95)",border:`1px solid ${s.color}44`,padding:"14px 22px",textAlign:"center",minWidth:115,boxShadow:`0 0 12px ${s.color}11`}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,color:s.color,textShadow:`0 0 20px ${s.color}66`}}>{s.value}</div>
                  <div style={{fontSize:10,color:"#a0b8c8",letterSpacing:1.5,textTransform:"uppercase",marginTop:5}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Narrative box */}
        {narVisible&&narrative&&(
          <div style={{position:"absolute",bottom:82,left:"50%",transform:"translateX(-50%)",width:"82%",maxWidth:740,zIndex:1000,animation:"fadeInUp 0.5s ease-out",pointerEvents:"none"}}>
            <div style={{background:"rgba(3,5,10,0.97)",border:"1px solid #2a3d50",borderLeft:"3px solid #3b82f6",padding:"10px 22px 16px",boxShadow:"0 0 40px rgba(0,0,0,0.9), 0 0 20px rgba(59,130,246,0.08)"}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3b82f688",letterSpacing:3,marginBottom:8,textTransform:"uppercase"}}>Intelligence Report · {dayToDate(scene?.day||0)}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:13,color:"#c8dae8",lineHeight:2.0,letterSpacing:0.3}}>{narrative}</div>
            </div>
          </div>
        )}
        {/* Day counter — top right */}
        <div style={{position:"absolute",top:16,right:16,zIndex:1000,background:"rgba(3,5,10,0.92)",border:"1px solid #1e2d3d",padding:"9px 16px",boxShadow:"0 0 20px rgba(0,0,0,0.5)"}}>
          <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"#3b82f6",letterSpacing:2,fontWeight:700}}>DAY {scene?.day||0}</div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:"#8ba8bc",marginTop:3}}>{dayToDate(scene?.day||0)}</div>
        </div>
        {/* EXIT + SAT buttons — grouped top left */}
        <div style={{position:"absolute",top:16,left:16,zIndex:1100,display:"flex",gap:8}}>
          <button onClick={onClose} style={{background:"rgba(3,5,10,0.92)",border:"1px solid #3a5060",color:"#a0b8c8",padding:"7px 14px",cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:11,letterSpacing:1}}>✕ EXIT</button>
          <button onClick={()=>setSatellite(s=>!s)} style={{background:satellite?"rgba(14,30,50,0.95)":"rgba(3,5,10,0.92)",border:`1px solid ${satellite?"#3b82f6":"#3a5060"}`,color:satellite?"#93c5fd":"#a0b8c8",padding:"7px 12px",cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:11,letterSpacing:1,boxShadow:satellite?"0 0 12px #3b82f633":"none"}}>🛰 SAT</button>
        </div>
      </div>
      {/* Prev/Next arrows — only visible when paused */}
      {!playing&&(
        <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px"}}>
          <button onClick={()=>goToScene(sceneNum-1)} disabled={sceneNum===0}
            style={{pointerEvents:"all",background:"rgba(3,5,10,0.9)",border:`1px solid ${sceneNum===0?"#1e2d3d":"#3b82f6"}`,color:sceneNum===0?"#1e2d3d":"#3b82f6",width:54,height:54,cursor:sceneNum===0?"not-allowed":"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:sceneNum===0?"none":"0 0 20px #3b82f644"}}>‹</button>
          <div style={{pointerEvents:"none",fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#5a7888",textAlign:"center",letterSpacing:3}}>PAUSED · USE ARROWS TO STEP</div>
          <button onClick={()=>goToScene(sceneNum+1)} disabled={sceneNum>=SIM_SCENES.length-1}
            style={{pointerEvents:"all",background:"rgba(3,5,10,0.9)",border:`1px solid ${sceneNum>=SIM_SCENES.length-1?"#1e2d3d":"#3b82f6"}`,color:sceneNum>=SIM_SCENES.length-1?"#1e2d3d":"#3b82f6",width:54,height:54,cursor:sceneNum>=SIM_SCENES.length-1?"not-allowed":"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:sceneNum>=SIM_SCENES.length-1?"none":"0 0 20px #3b82f644"}}>›</button>
        </div>
      )}

      <div style={{background:"#060910",borderTop:"1px solid #0c1824",padding:"10px 20px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        {/* Play/pause */}
        <button onClick={togglePlay} style={{background:playing?"rgba(59,130,246,0.12)":"transparent",border:`1px solid ${playing?"#3b82f6":"#1e3a5c"}`,color:"#3b82f6",width:36,height:30,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:playing?"0 0 12px #3b82f633":"none",transition:"all .15s"}}>{playing?"⏸":"▶"}</button>
        {/* Restart */}
        <button onClick={restart} style={{background:"transparent",border:"1px solid #1a2a3a",color:"#374151",width:28,height:28,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↩</button>
        {/* Step buttons */}
        <button onClick={()=>goToScene(sceneNum-1)} disabled={sceneNum===0}
          style={{background:"transparent",border:"1px solid",borderColor:sceneNum===0?"#1a2a3a":"#1e3a5c",color:sceneNum===0?"#1e2d3d":"#4a7a9b",width:28,height:28,cursor:sceneNum===0?"not-allowed":"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
        <button onClick={()=>goToScene(sceneNum+1)} disabled={sceneNum>=SIM_SCENES.length-1}
          style={{background:"transparent",border:"1px solid",borderColor:sceneNum>=SIM_SCENES.length-1?"#1a2a3a":"#1e3a5c",color:sceneNum>=SIM_SCENES.length-1?"#1e2d3d":"#4a7a9b",width:28,height:28,cursor:sceneNum>=SIM_SCENES.length-1?"not-allowed":"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
        {/* Speed */}
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          {[0.5,1,2].map(s=>(
            <button key={s} onClick={()=>setSpeed(s)} style={{background:speed===s?"#0d1929":"transparent",border:"1px solid",borderColor:speed===s?"#3b82f6":"#1a2a3a",color:speed===s?"#93c5fd":"#374151",padding:"2px 8px",cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:11,letterSpacing:1,whiteSpace:"nowrap"}}>{s}x</button>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{flex:1,position:"relative",height:6,background:"#0a1420",borderRadius:3}}>
          <div style={{position:"absolute",left:0,top:0,height:"100%",background:"linear-gradient(to right,#1e3a5c,#3b82f6)",borderRadius:3,transition:"width 0.3s",width:`${progress}%`,boxShadow:"0 0 8px #3b82f644"}}/>
          {SIM_SCENES.map((sc,i)=>(
            <div key={i} onClick={()=>goToScene(i)} title={sc.label||sc.title||sc.type}
              style={{position:"absolute",top:-4,left:`${(i/SIM_SCENES.length)*100}%`,width:2,height:14,background:i<=sceneNum?"#3b82f6":"#1e2d3d",cursor:"pointer",transform:"translateX(-50%)",transition:"background 0.2s"}}/>
          ))}
        </div>
        {/* Scene counter */}
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#7090a8",textAlign:"right",flexShrink:0,lineHeight:1.7}}>
          <div style={{color:"#3b82f6"}}>{sceneNum+1} / {SIM_SCENES.length}</div>
          <div style={{color:"#5a7888"}}>~5 min</div>
        </div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:"#ef4444",letterSpacing:3,flexShrink:0,textShadow:"0 0 15px #ef444444"}}>⚔ WARWATCH</div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function WarWatch() {
  const mapRef     = useRef(null);
  const lMap       = useRef(null);
  const strikeMk   = useRef([]);
  const aircraftMk = useRef({});
  const shipMk     = useRef([]);
  const acData     = useRef(AIRCRAFT_BASE.map(a=>({...a})));

  const [time,       setTime]       = useState(new Date());
  const [tab,        setTab]        = useState("events");
  const [rtab,       setRtab]       = useState("aircraft");
  const [filter,     setFilter]     = useState("all");
  const [confFilter, setConfFilter] = useState("all");
  const [leaderFilter, setLeaderFilter] = useState("all");
  const [visibleLeaders, setVisibleLeaders] = useState(5);
  const [selected,   setSelected]   = useState(null);
  const [layers,     setLayers]     = useState({strikes:true,aircraft:true,shipping:true});
  const [tDay,       setTDay]       = useState(MAX_DAY);
  const [playing,    setPlaying]    = useState(false);
  const [sitrep,     setSitrep]     = useState("");
  const [sitLoad,    setSitLoad]    = useState(false);
  const [feedItems,  setFeedItems]  = useState([]);
  const [feedLoad,   setFeedLoad]   = useState(false);
  const [feedMoreLoad, setFeedMoreLoad] = useState(false);
  const [feedDayOffset, setFeedDayOffset] = useState(0);
  const [tgItems,    setTgItems]    = useState([]);
  const [tgLoad,     setTgLoad]     = useState(false);
  const [tgMoreLoad, setTgMoreLoad] = useState(false);
  const [tgDayOffset, setTgDayOffset] = useState(0);
  const [mapReady,   setMapReady]   = useState(false);
  const [acList,     setAcList]     = useState(AIRCRAFT_BASE);
  const [simMode,    setSimMode]    = useState(false);
  const [newAlert,   setNewAlert]   = useState(false);
  const [satellite,  setSatellite]  = useState(false);
  const mainTileRef = useRef(null);

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);
  useEffect(()=>{
    if(!playing) return;
    if(tDay>=MAX_DAY){setPlaying(false);return;}
    const t=setTimeout(()=>setTDay(d=>d+1),700);
    return()=>clearTimeout(t);
  },[playing,tDay]);

  // Events: filtered + sorted latest→oldest when on max day
  const filteredEvents = useMemo(()=>{
    let ev=EVENTS.filter(e=>Math.floor((new Date(e.date)-WAR_START)/86400000)<=tDay);
    if(filter!=="all") ev=ev.filter(e=>e.type===filter);
    if(confFilter!=="all") ev=ev.filter(e=>e.confidence===confFilter);
    // Latest-first when on current day; oldest-first during timeline scrub
    return tDay===MAX_DAY
      ? [...ev].sort((a,b)=>new Date(b.date)-new Date(a.date))
      : [...ev].sort((a,b)=>new Date(a.date)-new Date(b.date));
  },[tDay,filter,confFilter]);

  // Leadership posts filtered
  const filteredLeaders = useMemo(()=>{
    setVisibleLeaders(5);
    const dayCutoff = new Date(WAR_START); dayCutoff.setDate(dayCutoff.getDate()+tDay);
    let posts = LEADERSHIP_POSTS.filter(p=>new Date(p.date)<=dayCutoff);
    if(leaderFilter!=="all") posts=posts.filter(p=>p.country===leaderFilter);
    return [...posts].sort((a,b)=>new Date(a.date+"T"+a.time)-new Date(b.date+"T"+b.time));
  },[tDay,leaderFilter]);

  const dayCasualties = useMemo(()=>({
    killed:Math.round(1400*(tDay/MAX_DAY)),
    injured:Math.round(18000*(tDay/MAX_DAY)),
    displaced:Math.round(3000000*(tDay/MAX_DAY)),
  }),[tDay]);

  useEffect(()=>{
    const css=document.createElement("link");css.rel="stylesheet";css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";document.head.appendChild(css);
    const js=document.createElement("script");js.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload=()=>{
      if(mapRef.current&&!lMap.current){
        const L=window.L;
        const map=L.map(mapRef.current,{center:[30,49],zoom:5,zoomControl:false});
        mainTileRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19});
        mainTileRef.current.addTo(map);
        L.control.zoom({position:"bottomright"}).addTo(map);
        lMap.current=map;setMapReady(true);
      }
    };
    document.head.appendChild(js);
    return()=>{if(lMap.current){lMap.current.remove();lMap.current=null;}css.remove();js.remove();};
  },[]);

  useEffect(()=>{
    if(!mapReady||!window.L||!lMap.current) return;
    const L=window.L,map=lMap.current;
    strikeMk.current.forEach(m=>m.remove());strikeMk.current=[];
    if(!layers.strikes) return;
    filteredEvents.forEach(ev=>{
      const c=TYPE_CFG[ev.type].color;
      const confC=CONF_CFG[ev.confidence]?.color||"#22c55e";
      const icon=L.divIcon({className:"",html:`<div style="width:11px;height:11px;border-radius:50%;background:${c};border:2px solid ${confC}88;box-shadow:0 0 10px ${c}88;cursor:pointer"></div>`,iconSize:[11,11],iconAnchor:[5,5]});
      const m=L.marker([ev.lat,ev.lng],{icon});
      m.bindPopup(`<div style="font-family:'Share Tech Mono',monospace;font-size:11px;background:#070b10;color:#e2e8f0;min-width:240px;padding:6px 4px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:${c};font-weight:700">${TYPE_CFG[ev.type].icon} ${TYPE_CFG[ev.type].label}</span>
          <span style="color:${confC};font-size:9px;letter-spacing:1px">● ${(ev.confidence||"confirmed").toUpperCase()}</span>
        </div>
        <div style="color:#f8fafc;font-size:13px;font-weight:700;margin-bottom:3px">${ev.title}</div>
        <div style="color:#6b7280;margin-bottom:6px">${ev.date}</div>
        <div style="color:#94a3b8;line-height:1.6">${ev.desc}</div>
        ${ev.verified?`<div style="color:#22c55e;margin-top:6px;font-size:10px">✓ OSINT VERIFIED</div>`:""}
      </div>`,{className:"ww-popup",maxWidth:300});
      m.addTo(map);strikeMk.current.push(m);
    });
  },[mapReady,filteredEvents,layers.strikes]);

  useEffect(()=>{
    if(!mapReady||!window.L||!lMap.current) return;
    const L=window.L,map=lMap.current;
    Object.values(aircraftMk.current).forEach(m=>m.remove());aircraftMk.current={};
    if(!layers.aircraft) return;
    acData.current.forEach(ac=>{
      const col=ROLE_COLOR[ac.role]||"#94a3b8";
      const icon=L.divIcon({className:"",html:`<div style="transform:rotate(${ac.hdg}deg);color:${col};font-size:13px;filter:drop-shadow(0 0 4px ${col})">✈</div>`,iconSize:[14,14],iconAnchor:[7,7]});
      const m=L.marker([ac.lat,ac.lng],{icon,zIndexOffset:1000});
      m.bindPopup(`<div style="font-family:'Share Tech Mono',monospace;font-size:11px;background:#070b10;color:#e2e8f0;padding:6px">
        <div style="color:${col};font-weight:700">${ac.nation==="US"?"🇺🇸":"🇮🇱"} ${ac.type} — ${ac.role}</div>
        <div style="color:#f8fafc;font-weight:700;margin-top:2px">${ac.callsign}</div>
        <div style="color:#6b7280;margin-top:3px">FL${Math.floor(ac.alt/100)} · ${ac.hdg}° · ${ac.spd}kt</div>
      </div>`,{className:"ww-popup"});
      m.addTo(map);aircraftMk.current[ac.id]=m;
    });
  },[mapReady,layers.aircraft]);

  useEffect(()=>{
    if(!mapReady) return;
    const t=setInterval(()=>{
      acData.current=acData.current.map(ac=>{const u=moveAC(ac);if(aircraftMk.current[ac.id])aircraftMk.current[ac.id].setLatLng([u.lat,u.lng]);return u;});
      setAcList([...acData.current]);
    },4000);
    return()=>clearInterval(t);
  },[mapReady]);

  useEffect(()=>{
    if(!mapReady||!window.L||!lMap.current) return;
    const L=window.L,map=lMap.current;
    shipMk.current.forEach(m=>m.remove());shipMk.current=[];
    if(!layers.shipping) return;
    VESSELS.forEach(v=>{
      const col=STATUS_COLOR[v.status];
      const icon=L.divIcon({className:"",html:`<div style="color:${col};font-size:14px;filter:drop-shadow(0 0 4px ${col})">${v.status==="active"?"⛵":"⛴"}</div>`,iconSize:[14,14],iconAnchor:[7,7]});
      const m=L.marker([v.lat,v.lng],{icon,zIndexOffset:500});
      m.bindPopup(`<div style="font-family:'Share Tech Mono',monospace;font-size:11px;background:#070b10;color:#e2e8f0;padding:6px">
        <div style="color:${col};font-weight:700">⛴ ${v.status.toUpperCase()} — ${v.type}</div>
        <div style="color:#f8fafc;font-weight:700;margin-top:2px">${v.name} [${v.flag}]</div>
        <div style="color:#94a3b8;margin-top:3px">${v.dest}</div>
      </div>`,{className:"ww-popup"});
      m.addTo(map);shipMk.current.push(m);
    });
  },[mapReady,layers.shipping]);

  const genSitrep=async()=>{
    setSitLoad(true);setTab("sitrep");
    const ev=EVENTS.filter(e=>Math.floor((new Date(e.date)-WAR_START)/86400000)<=tDay).map(e=>`[${e.date}] ${e.title}: ${e.desc}`).join("\n");
    try{
      const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:"You are a senior OSINT analyst at ISW/CTP. Write professional military situation reports. No preamble.",messages:[{role:"user",content:`Situation report: 2026 Iran War — Day ${tDay+1} (${dayToDate(tDay)}).\n\nOSINT:\n${ev}\n\nFormat:\nEXECUTIVE SUMMARY\n[2-3 sentences]\n\nKEY DEVELOPMENTS — LAST 24H\n[5-7 bullets]\n\nSTRATEGIC ASSESSMENT\n[Campaign trajectory, degradation, escalation]\n\nCRITICAL INDICATORS\n[3-4 items]\n\nMax 450 words.`}]})});
      if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
      const d=await r.json();setSitrep(d.content[0].text);
    }catch(e){setSitrep(`⚠ API error: ${e.message}`);}
    setSitLoad(false);
  };

  const loadFeed=async()=>{
    setFeedLoad(true);setTab("news");setFeedDayOffset(0);
    try{
      const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:1200,
        system:"You are a JSON generator. Respond with ONLY a raw JSON array. No markdown, no code fences, no commentary. Start with [ and end with ].",
        messages:[{role:"user",content:`Generate 12 OSINT news feed items for the 2026 Iran War, Day ${tDay+1} (${dayToDate(tDay)}).

Mix sources: CENTCOM press releases, IDF Spokesperson, IRGC wire, Reuters, Al Jazeera, ISW/CTP, Amnesty International, WHO, UN OCHA.
Mix event types: strike BDA, missile intercepts, diplomatic statements, humanitarian updates, Hormuz shipping, energy prices, Hezbollah activity.

Return a JSON array of 12 objects with these exact keys:
time (HH:MM), source (news org or military), text (1-2 sentence update), type (one of: strike, intercept, diplomatic, humanitarian, energy, analysis), side (one of: us_il, iran, intl)`}]})});
      if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
      const d=await r.json();
      const raw=d.content[0].text;
      const start=raw.indexOf("["), end=raw.lastIndexOf("]");
      if(start===-1||end===-1) throw new Error("No array");
      setFeedItems(JSON.parse(raw.slice(start,end+1)));
      setNewAlert(true);setTimeout(()=>setNewAlert(false),4000);
    }catch(e){setFeedItems([{time:"ERR",source:"System",text:`Feed unavailable: ${e.message}`,type:"analysis",side:"intl"}]);}
    setFeedLoad(false);
  };

  const loadOsint=async()=>{
    setTgLoad(true);setTab("osint");setTgDayOffset(0);
    try{
      const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:1200,
        system:"You are a JSON generator. You must respond with ONLY a raw JSON array. No explanation, no markdown, no code fences, no commentary before or after. Start your response with [ and end with ].",
        messages:[{role:"user",content:`Generate exactly 12 realistic Telegram channel posts for the 2026 Iran-Israel war, Day ${tDay+1}.

Use these channels with these styles:
- @IDFSpokesperson: professional IDF military, confirmed BDA, Hebrew military terminology
- @IRNA_NEWS: Iranian state media, defiant, martyrdom language, enemy framing
- @CENTCOMNews: US military official, formal press release language, CENTCOM attribution
- @OSINTdefender: OSINT analyst, references satellite imagery, coordinates, source crediting
- @IntelDoge: fast aggregator, short punchy updates, multiple sources, breaking news style
- @HouthiMilSpo: Houthi military spokesperson, threatening rhetoric, resistance framing

Return a JSON array of exactly 12 objects, each with these exact keys:
channel (string starting with @), time (HH:MM format), text (the post content), views (integer), type (one of: text, video, photo), verified (boolean)`}]})});
      if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
      const d=await r.json();
      const raw=d.content[0].text;
      // Robustly extract JSON array even if surrounded by text
      const start=raw.indexOf("[");
      const end=raw.lastIndexOf("]");
      if(start===-1||end===-1) throw new Error("No JSON array found");
      const parsed=JSON.parse(raw.slice(start,end+1));
      setTgItems(parsed);
    }catch(e){
      console.error("Telegram parse error:",e);
      setTgItems([
        {channel:"@IDFSpokesperson",time:"08:14",text:"IDF confirms overnight strikes on IRGC missile storage facilities in western Iran. 4 launchers destroyed. No IDF casualties.",views:142300,type:"text",verified:true},
        {channel:"@CENTCOMNews",time:"09:00",text:"U.S. Central Command: Combined force conducted precision strikes on Iranian military infrastructure overnight. Operations are ongoing and meeting objectives.",views:89200,type:"text",verified:true},
        {channel:"@IRNA_NEWS",time:"09:45",text:"The Islamic Republic condemns the latest Zionist-American aggression against our sovereign territory. The resistance will respond with force.",views:67800,type:"text",verified:false},
        {channel:"@OSINTdefender",time:"10:22",text:"NEW: Planet Labs imagery from this morning shows significant damage to IRGC facility near Kermanshah. At least 3 launcher pads destroyed. Comparing to yesterday's imagery now.",views:234100,type:"photo",verified:true},
        {channel:"@IntelDoge",time:"11:03",text:"BREAKING: Multiple explosions reported in Tehran suburbs. Not yet confirmed. Monitoring.",views:412000,type:"text",verified:false},
        {channel:"@HouthiMilSpo",time:"11:30",text:"The Yemeni armed forces fired 6 ballistic missiles toward occupied Eilat. All of occupied Palestine is within range. The resistance front stands unified.",views:55600,type:"text",verified:false},
        {channel:"@IDFSpokesperson",time:"13:15",text:"⚠️ Rocket alert in northern Israel. Residents in the following areas should remain in shelters. Arrow interception activated.",views:318000,type:"text",verified:true},
        {channel:"@OSINTdefender",time:"14:40",text:"Tracking 2 likely USAF B-52 signatures on ADS-B heading NW from Diego Garcia. This is the 4th such sortie in 72 hours. Thread incoming.",views:189700,type:"text",verified:true},
        {channel:"@IRNA_NEWS",time:"15:20",text:"President Pezeshkian: Iran does not seek war but will defend every inch of its territory. The aggressor will pay a price history will record.",views:78900,type:"text",verified:true},
        {channel:"@IntelDoge",time:"16:05",text:"Reuters confirming Hormuz now day 19 closed. Tanker diversion costs up 340%. Saudi Aramco exec quoted saying 'situation is critical'.",views:521000,type:"text",verified:true},
        {channel:"@CENTCOMNews",time:"17:00",text:"USS Gerald R. Ford Carrier Strike Group conducting flight operations in the Arabian Sea in support of Operation Epic Fury. Air wing is mission-ready.",views:94300,type:"photo",verified:true},
        {channel:"@IntelDoge",time:"18:44",text:"Multiple sources: large explosion near Natanz. No official confirmation yet. 3rd report in last hour. Monitoring closely.",views:687000,type:"text",verified:false},
      ]);
    }
    setTgLoad(false);
  };

  const loadMoreFeed=async()=>{
    setFeedMoreLoad(true);
    const nextOffset = feedDayOffset + 3;
    const periodEnd   = Math.max(0, tDay - feedDayOffset - 1);
    const periodStart = Math.max(0, tDay - nextOffset);
    const dateFrom = dayToDate(periodStart);
    const dateTo   = dayToDate(periodEnd);
    const daysLabel = periodStart===periodEnd ? `Day ${periodStart+1} (${dateFrom})` : `Days ${periodStart+1}–${periodEnd+1} (${dateFrom} – ${dateTo})`;
    try{
      const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:1200,
        system:"You are a JSON generator. Respond with ONLY a raw JSON array. No explanation, no markdown, no code fences. Start with [ and end with ].",
        messages:[{role:"user",content:`Generate 10 OSINT news feed items covering the 2026 Iran War: ${daysLabel}. These are EARLIER events — reflect what was happening at that point in the war. Use timestamps and context appropriate to that window. Sources: CENTCOM, IDF, Reuters, Al Jazeera, ISW, IRGC wire, WHO. Return JSON:\n[{"time":"HH:MM","date":"YYYY-MM-DD","source":"...","text":"...","type":"strike|intercept|diplomatic|humanitarian|energy|analysis","side":"us_il|iran|intl"}]`}]})});
      if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
      const d=await r.json();
      const raw=d.content[0].text;
      const s=raw.indexOf("["),e=raw.lastIndexOf("]");
      if(s===-1||e===-1) throw new Error("No array");
      setFeedItems(prev=>[...prev,...JSON.parse(raw.slice(s,e+1))]);
      setFeedDayOffset(nextOffset);
    }catch(e){ console.error(e); }
    setFeedMoreLoad(false);
  };

  const loadMoreOsint=async()=>{
    setTgMoreLoad(true);
    const nextOffset = tgDayOffset + 3;
    const periodEnd   = Math.max(0, tDay - tgDayOffset - 1);
    const periodStart = Math.max(0, tDay - nextOffset);
    const dateFrom = dayToDate(periodStart);
    const dateTo   = dayToDate(periodEnd);
    const daysLabel = periodStart===periodEnd ? `Day ${periodStart+1} (${dateFrom})` : `Days ${periodStart+1}–${periodEnd+1} (${dateFrom} – ${dateTo})`;
    try{
      const r=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6",max_tokens:1200,
        system:"You are a JSON generator. Respond with ONLY a raw JSON array. No explanation, no markdown, no code fences. Start with [ and end with ].",
        messages:[{role:"user",content:`Generate 10 Telegram/OSINT channel posts covering the 2026 Iran War: ${daysLabel}. These are EARLIER posts — reflect what was happening and being discussed at that point. Channels: @IDFSpokesperson (IDF updates), @IRNA_NEWS (Iranian state), @CENTCOMNews (US military), @OSINTdefender (OSINT analyst), @IntelDoge (aggregator), @HouthiMilSpo (Houthi). Use dates matching that period. JSON:\n[{"channel":"@handle","time":"HH:MM","date":"YYYY-MM-DD","text":"...","views":1234,"type":"text|video|photo","verified":true}]`}]})});
      if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
      const d=await r.json();
      const raw=d.content[0].text;
      const s=raw.indexOf("["),e=raw.lastIndexOf("]");
      if(s===-1||e===-1) throw new Error("No array");
      setTgItems(prev=>[...prev,...JSON.parse(raw.slice(s,e+1))]);
      setTgDayOffset(nextOffset);
    }catch(e){ console.error(e); }
    setTgMoreLoad(false);
  };

  const toggleLayer=k=>setLayers(p=>({...p,[k]:!p[k]}));

  // Swap main map tile when satellite toggles
  useEffect(()=>{
    if(!lMap.current||!window.L||!mainTileRef.current) return;
    const L=window.L, map=lMap.current;
    mainTileRef.current.remove();
    const url = satellite
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    mainTileRef.current = L.tileLayer(url, {maxZoom:19});
    mainTileRef.current.addTo(map);
    mainTileRef.current.bringToBack();
  },[satellite]);
  const utcTime=time.toUTCString().split(" ")[4];
  const dateStr=time.toISOString().slice(0,10);
  const sideCols={us_il:"#3b82f6",iran:"#ef4444",intl:"#94a3b8"};
  const typeCols={strike:"#ef4444",intercept:"#22c55e",diplomatic:"#a78bfa",humanitarian:"#f59e0b",energy:"#fb923c",analysis:"#60a5fa"};
  const tgColor=ch=>TG_CHANNELS.find(c=>c.handle===ch)?.color||"#94a3b8";
  const tgNation=ch=>TG_CHANNELS.find(c=>c.handle===ch)?.nation||"📡";

  const countryOptions = [...new Set(LEADERSHIP_POSTS.map(p=>p.country))];

  if(simMode) return <WarSimulation onClose={()=>setSimMode(false)}/>;

  return (
    <div style={{fontFamily:"'Rajdhani',sans-serif",background:"#060a0d",color:"#e2e8f0",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a0e14}
        ::-webkit-scrollbar-thumb{background:#1e2d3d;border-radius:2px}
        .ww-popup .leaflet-popup-content-wrapper{background:#070b10!important;border:1px solid #1e2d3d!important;border-radius:2px!important;box-shadow:0 4px 24px rgba(0,0,0,.9)!important}
        .ww-popup .leaflet-popup-tip{background:#070b10!important}
        .ww-popup .leaflet-popup-content{margin:10px 12px!important}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes scan{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes alertPulse{0%,100%{background:#0a2016}50%{background:#0d3520}}
        .blink{animation:blink 1.2s step-end infinite}
        .pulse{animation:pulse 2s ease-in-out infinite}
        .scan{animation:scan 3s linear infinite}
        .erow{cursor:pointer;transition:background .1s}
        .erow:hover{background:#0c1928!important}
        /* Tab buttons */
        .tbtn{background:transparent;border:none;border-bottom:2px solid transparent;color:#8b9eb5;padding:6px 9px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;transition:all .15s;white-space:nowrap}
        .tbtn.on{color:#f59e0b;border-bottom-color:#f59e0b}
        .tbtn:hover:not(.on){color:#c8d8e8}
        /* Filter buttons */
        .fbtn{background:transparent;border:1px solid #2a3d50;color:#7090a8;padding:3px 8px;font-family:'Share Tech Mono',monospace;font-size:10px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;transition:all .1s}
        .fbtn.on{background:#0d1929;border-color:#3b82f6;color:#93c5fd}
        .fbtn:hover:not(.on){border-color:#3a5060;color:#b0c8d8}
        .lbtn{background:transparent;border:1px solid;padding:4px 10px;font-family:'Share Tech Mono',monospace;font-size:10px;cursor:pointer;letter-spacing:1.5px;text-transform:uppercase;transition:all .15s}
        .abtn{border:1px solid;padding:6px 16px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:2px;text-transform:uppercase;background:transparent;transition:all .15s}
        .simbtn{background:linear-gradient(135deg,#1a0808,#300a0a);border:1px solid #ef4444;color:#ef4444;padding:7px 16px;font-family:'Orbitron',monospace;font-weight:700;font-size:11px;cursor:pointer;letter-spacing:2px;text-transform:uppercase;transition:all .2s;display:flex;align-items:center;gap:8px;white-space:nowrap}
        .simbtn:hover{background:linear-gradient(135deg,#300a0a,#4a0c0c);box-shadow:0 0 18px #ef444444}
        input[type=range]{-webkit-appearance:none;width:100%;height:3px;background:#1a2a3a;outline:none;border-radius:2px;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#f59e0b;cursor:pointer;box-shadow:0 0 8px #f59e0b88}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{background:"#070b12",borderBottom:"1px solid #0c1824",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:17,fontWeight:900,color:"#ef4444",letterSpacing:4}}>⚔ WARWATCH</span>
          <span style={{background:"#200808",border:"1px solid #ef444488",color:"#ef4444",padding:"2px 8px",fontSize:10,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>
            <span className="blink">●</span> LIVE
          </span>
          <span style={{background:"#120d00",border:"1px solid #f59e0b55",color:"#f59e0b",padding:"2px 8px",fontSize:10,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1.5}}>
            IRAN WAR 2026 · DAY {tDay+1} · OP EPIC FURY
          </span>
          {newAlert && (
            <span style={{background:"#0a2016",border:"1px solid #22c55e88",color:"#22c55e",padding:"2px 8px",fontSize:10,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1.5,animation:"alertPulse 1s ease-in-out infinite"}}>
              ● NEW EVENTS LOADED
            </span>
          )}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button className="simbtn" onClick={()=>setSimMode(true)}><span style={{fontSize:15}}>▶</span> WATCH WAR SIMULATION</button>
          <span style={{color:"#22c55e",fontWeight:700,fontFamily:"'Share Tech Mono',monospace",fontSize:12}}>{utcTime} UTC</span>
        </div>
      </div>

      {/* ═══ STATS BAR — fully readable ═══ */}
      <div style={{background:"#07111a",borderBottom:"1px solid #0c1824",display:"flex",flexShrink:0,overflowX:"auto"}}>
        {[
          ["DAY", String(tDay+1), "#60a5fa"],
          ["DATE", dayToDate(tDay), "#60a5fa"],
          ["EVENTS", String(filteredEvents.length), "#f8fafc"],
          ["KILLED (IRAN)", dayCasualties.killed.toLocaleString(), "#ef4444"],
          ["INJURED", dayCasualties.injured.toLocaleString(), "#f59e0b"],
          ["DISPLACED", (dayCasualties.displaced/1000000).toFixed(1)+"M", "#f59e0b"],
          ["LAUNCHERS", "300+", "#f59e0b"],
          ["HORMUZ", tDay>=3?"CLOSED":"OPEN", tDay>=3?"#ef4444":"#22c55e"],
          ["MISSILE FIRE", "↓ 90%", "#22c55e"],
          ["BRENT CRUDE", "$127", "#fb923c"],
        ].map(([l,v,c],i)=>(
          <div key={i} style={{padding:"6px 16px",borderRight:"1px solid #0c1824",textAlign:"center",flexShrink:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:c,lineHeight:1,whiteSpace:"nowrap"}}>{v}</div>
            <div style={{fontSize:9,color:"#c8dae8",letterSpacing:1,textTransform:"uppercase",marginTop:3,whiteSpace:"nowrap"}}>{l}</div>
          </div>
        ))}
        <div style={{marginLeft:"auto",padding:"6px 14px",display:"flex",alignItems:"center",gap:6}}>
          <div className="pulse" style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
          <span style={{fontSize:10,color:"#22c55e",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1.5}}>LIVE</span>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ─── LEFT PANEL ─── */}
        <div style={{width:300,background:"#070b10",borderRight:"1px solid #0a1420",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          <div style={{display:"flex",borderBottom:"1px solid #0a1420",background:"#060a0d",flexShrink:0,overflowX:"auto"}}>
            {[["events","Events"],["leaders","Leaders"],["news","Feed"],["osint","OSINT"],["sitrep","SitRep"],["sources","Sources"]].map(([k,l])=>(
              <button key={k} className={`tbtn ${tab===k?"on":""}`} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>

          {/* Event filters */}
          {tab==="events" && (
            <div style={{padding:"6px 10px",borderBottom:"1px solid #0a1420",display:"flex",gap:3,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
              {[["all","ALL"],["us_il","US/IL"],["iran","IRAN"],["hezbollah","HZBL"],["hvt","HVT"]].map(([k,l])=>(
                <button key={k} className={`fbtn ${filter===k?"on":""}`} onClick={()=>setFilter(k)}>{l}</button>
              ))}
              <div style={{width:"100%",height:1,background:"#0a1420",marginTop:3}}/>
              {[["all","ALL"],["confirmed","✓ CONF"],["reported","! REP"]].map(([k,l])=>(
                <button key={k} className={`fbtn ${confFilter===k?"on":""}`} onClick={()=>setConfFilter(k)}>{l}</button>
              ))}
              <span style={{marginLeft:"auto",fontSize:9,color:"#5a7888",fontFamily:"'Share Tech Mono',monospace"}}>
                {filteredEvents.length} · {tDay===MAX_DAY?"NEWEST FIRST":"OLDEST FIRST"}
              </span>
            </div>
          )}

          {/* Leader filters */}
          {tab==="leaders" && (
            <div style={{padding:"6px 10px",borderBottom:"1px solid #0a1420",display:"flex",gap:3,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
              <button className={`fbtn ${leaderFilter==="all"?"on":""}`} onClick={()=>setLeaderFilter("all")}>ALL</button>
              {countryOptions.map(c=>(
                <button key={c} className={`fbtn ${leaderFilter===c?"on":""}`} onClick={()=>setLeaderFilter(c)} style={{fontSize:12,padding:"2px 5px"}}>{c}</button>
              ))}
            </div>
          )}

          <div style={{flex:1,overflowY:"auto"}}>

            {/* ── EVENTS ── */}
            {tab==="events" && filteredEvents.map(ev=>{
              const cfg=TYPE_CFG[ev.type], sel=selected?.id===ev.id;
              const confC=CONF_CFG[ev.confidence]?.color||"#22c55e";
              return (
                <div key={ev.id} className="erow" onClick={()=>{setSelected(sel?null:ev);if(lMap.current)lMap.current.setView([ev.lat,ev.lng],7,{animate:true});}}
                  style={{padding:"9px 12px",borderBottom:"1px solid #090f19",background:sel?"#0b1827":"transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:10,color:cfg.color,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{cfg.icon} {cfg.label}</span>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:9,color:confC,fontFamily:"'Share Tech Mono',monospace"}}>● {ev.confidence}</span>
                      <span style={{fontSize:9,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{ev.date.slice(5)}</span>
                    </div>
                  </div>
                  <div style={{fontSize:13,color:sel?"#f1f5f9":"#b8ccd8",fontWeight:600,lineHeight:1.3}}>{ev.title}</div>
                  {sel && (
                    <div style={{marginTop:7,fontSize:12,color:"#96b0c0",lineHeight:1.7,fontFamily:"'Share Tech Mono',monospace"}}>
                      {ev.desc}
                      {ev.verified&&<div style={{color:"#22c55e",marginTop:4,fontSize:10}}>✓ OSINT VERIFIED</div>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── LEADERSHIP POSTS ── */}
            {tab==="leaders" && (
              <div>
                {filteredLeaders.length===0 && (
                  <div style={{textAlign:"center",padding:"24px",color:"#7090a8",fontSize:12,fontFamily:"'Share Tech Mono',monospace"}}>
                    No posts available for Day {tDay+1}
                  </div>
                )}
                {filteredLeaders.slice(0,visibleLeaders).map(post=>(
                  <div key={post.id} style={{padding:"10px 12px",borderBottom:"1px solid #090f19"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <div style={{width:34,height:34,borderRadius:"50%",background:`${post.color}22`,border:`2px solid ${post.color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{post.country}</div>
                        <div>
                          <div style={{fontSize:13,color:"#e8f0f8",fontWeight:700,lineHeight:1.2}}>
                            {post.person}
                            {post.verified && <span style={{color:"#3b82f6",fontSize:11,marginLeft:5}}>✓</span>}
                          </div>
                          <div style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace",marginTop:1}}>{post.role}</div>
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:9,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{post.date.slice(5)} {post.time}</div>
                        <div style={{fontSize:9,color:post.color,fontFamily:"'Share Tech Mono',monospace",marginTop:1}}>{post.platform}</div>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#6080a0",fontFamily:"'Share Tech Mono',monospace",marginBottom:6}}>{post.handle}</div>
                    <div style={{fontSize:13,color:"#b8ccd8",lineHeight:1.7}}>{post.text}</div>
                  </div>
                ))}
                {visibleLeaders < filteredLeaders.length && (
                  <div style={{padding:"10px 12px"}}>
                    <button className="abtn" onClick={()=>setVisibleLeaders(v=>v+5)}
                      style={{width:"100%",borderColor:"#2a3d50",color:"#8aa8bc"}}>
                      ↓ LOAD MORE ({filteredLeaders.length - visibleLeaders} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── LIVE FEED ── */}
            {tab==="news" && (
              <div style={{padding:"10px 12px"}}>
                {feedItems.length===0&&!feedLoad&&(
                  <div style={{textAlign:"center",padding:"24px 0"}}>
                    <div style={{fontSize:12,color:"#7090a8",marginBottom:12,lineHeight:1.7}}>AI-aggregated · CENTCOM · IDF · IRGC<br/>Reuters · Al Jazeera · ISW · Amnesty</div>
                    <button className="abtn" onClick={loadFeed} style={{borderColor:"#3b82f6",color:"#93c5fd"}}>↻ LOAD LIVE FEED</button>
                  </div>
                )}
                {feedLoad&&<Spinner color="#3b82f6" label="AGGREGATING FEEDS"/>}
                {feedItems.map((item,i)=>(
                  <div key={i} style={{borderBottom:"1px solid #090f19",padding:"8px 0"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                      {item.date && <span style={{fontSize:9,color:"#5a7888",fontFamily:"'Share Tech Mono',monospace"}}>{item.date.slice(5)}</span>}
                      <span style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{item.time}</span>
                      <span style={{fontSize:10,color:sideCols[item.side]||"#94a3b8",background:(sideCols[item.side]||"#94a3b8")+"18",padding:"1px 6px",fontFamily:"'Share Tech Mono',monospace"}}>{item.source}</span>
                      <span style={{fontSize:9,color:typeCols[item.type]||"#94a3b8",textTransform:"uppercase",letterSpacing:1}}>● {item.type}</span>
                    </div>
                    <div style={{fontSize:12,color:"#b0c8d8",lineHeight:1.6}}>{item.text}</div>
                  </div>
                ))}
                {feedItems.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:12}}>
                    <button className="abtn" onClick={loadFeed} style={{width:"100%",borderColor:"#2a3d50",color:"#7090a8"}}>↻ REFRESH</button>
                    {tDay - feedDayOffset > 0 && (
                      <button className="abtn" onClick={loadMoreFeed} disabled={feedMoreLoad}
                        style={{width:"100%",borderColor:"#2a3d50",color:feedMoreLoad?"#374151":"#8aa8bc"}}>
                        {feedMoreLoad ? "⏳ LOADING..." : `↓ EARLIER (${dayToDate(Math.max(0, tDay-feedDayOffset-3))} – ${dayToDate(Math.max(0, tDay-feedDayOffset-1))})`}
                      </button>
                    )}
                    {tDay - feedDayOffset <= 0 && <div style={{textAlign:"center",fontSize:9,color:"#374151",fontFamily:"'Share Tech Mono',monospace",padding:"4px 0"}}>⬆ WAR START — FEB 28, 2026</div>}
                  </div>
                )}
              </div>
            )}

            {tab==="osint" && (
              <div style={{padding:"10px 12px"}}>
                {tgItems.length===0&&!tgLoad&&(
                  <div style={{textAlign:"center",padding:"16px 0"}}>
                    <div style={{fontSize:12,color:"#7090a8",marginBottom:10}}>Monitor active OSINT channels</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center",marginBottom:14}}>
                      {TG_CHANNELS.map(ch=>(
                        <span key={ch.handle} style={{fontSize:9,color:ch.color,border:`1px solid ${ch.color}44`,padding:"2px 6px",fontFamily:"'Share Tech Mono',monospace"}}>{ch.nation} {ch.handle}</span>
                      ))}
                    </div>
                    <button className="abtn" onClick={loadOsint} style={{borderColor:"#2d9cdb",color:"#7dd3fc"}}>📡 CONNECT MONITOR</button>
                  </div>
                )}
                {tgLoad&&<Spinner color="#2d9cdb" label="SCANNING OSINT CHANNELS"/>}
                {tgItems.map((item,i)=>{
                  const col=tgColor(item.channel);
                  return (
                    <div key={i} style={{borderBottom:"1px solid #090f19",padding:"9px 0"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:10,color:col,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{tgNation(item.channel)} {item.channel}</span>
                          {item.verified&&<span style={{fontSize:9,color:"#22c55e"}}>✓</span>}
                          {item.type!=="text"&&<span style={{fontSize:9,color:"#f59e0b"}}>📎{item.type}</span>}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          {item.date && <span style={{fontSize:9,color:"#5a7888",fontFamily:"'Share Tech Mono',monospace"}}>{item.date.slice(5)}</span>}
                          <span style={{fontSize:9,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{item.time}</span>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#b0c8d8",lineHeight:1.6,marginBottom:4}}>{item.text}</div>
                      <div style={{fontSize:9,color:"#6080a0",fontFamily:"'Share Tech Mono',monospace"}}>👁 {typeof item.views==="number"?item.views.toLocaleString():item.views}</div>
                    </div>
                  );
                })}
                {tgItems.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:12}}>
                    <button className="abtn" onClick={loadOsint} style={{width:"100%",borderColor:"#2a3d50",color:"#7090a8"}}>↻ REFRESH CHANNELS</button>
                    {tDay - tgDayOffset > 0 && (
                      <button className="abtn" onClick={loadMoreOsint} disabled={tgMoreLoad}
                        style={{width:"100%",borderColor:"#2a3d50",color:tgMoreLoad?"#374151":"#8aa8bc"}}>
                        {tgMoreLoad ? "⏳ LOADING..." : `↓ EARLIER (${dayToDate(Math.max(0, tDay-tgDayOffset-3))} – ${dayToDate(Math.max(0, tDay-tgDayOffset-1))})`}
                      </button>
                    )}
                    {tDay - tgDayOffset <= 0 && <div style={{textAlign:"center",fontSize:9,color:"#374151",fontFamily:"'Share Tech Mono',monospace",padding:"4px 0"}}>⬆ WAR START — FEB 28, 2026</div>}
                  </div>
                )}
              </div>
            )}

            {tab==="sitrep" && (
              <div style={{padding:"12px"}}>
                {!sitrep&&!sitLoad&&(
                  <div style={{textAlign:"center",padding:"24px 0"}}>
                    <div style={{fontSize:12,color:"#7090a8",marginBottom:4}}>AI analysis · ISW/CTP methodology</div>
                    <div style={{fontSize:10,color:"#6080a0",marginBottom:16,lineHeight:1.6}}>{filteredEvents.length} verified events · Day {tDay+1}</div>
                    <button className="abtn" onClick={genSitrep} style={{borderColor:"#ef4444",color:"#fca5a5"}}>⚡ GENERATE SITREP</button>
                  </div>
                )}
                {sitLoad&&<Spinner color="#ef4444" label="ANALYZING OSINT DATA"/>}
                {sitrep&&!sitLoad&&(
                  <div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:"#a8c0d0",lineHeight:2,whiteSpace:"pre-wrap"}}>{sitrep}</div>
                    <button className="abtn" onClick={genSitrep} style={{marginTop:14,width:"100%",borderColor:"#2a3d50",color:"#7090a8"}}>↻ REGENERATE</button>
                  </div>
                )}
              </div>
            )}

            {tab==="sources" && (
              <div style={{padding:"12px"}}>
                {["ISW / CTP","ACLED","CENTCOM","IDF Spokesperson","Reuters","Al Jazeera","Amnesty International","WHO","UN OCHA","Times of Israel","Fars News","IRNA"].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #090f19"}}>
                    <div className="pulse" style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>
                    <span style={{fontSize:12,color:"#a8c0d0",fontFamily:"'Share Tech Mono',monospace"}}>{s}</span>
                    <span style={{marginLeft:"auto",fontSize:9,color:"#22c55e",fontFamily:"'Share Tech Mono',monospace"}}>LIVE</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── MAP ─── */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          <div ref={mapRef} style={{width:"100%",height:"100%"}}/>

          <div style={{position:"absolute",top:10,left:10,zIndex:999,display:"flex",flexDirection:"column",gap:5}}>
            {[["strikes","● STRIKES",layers.strikes,"#ef4444"],["aircraft","✈ AIRCRAFT",layers.aircraft,"#22c55e"],["shipping","⛴ SHIPPING",layers.shipping,"#f59e0b"]].map(([k,l,on,c])=>(
              <button key={k} className="lbtn" onClick={()=>toggleLayer(k)} style={{borderColor:on?c:"#2a3d50",color:on?c:"#7090a8",background:"rgba(6,10,13,0.92)"}}>{l}</button>
            ))}
            <button className="lbtn" onClick={()=>setSatellite(s=>!s)}
              style={{borderColor:satellite?"#3b82f6":"#2a3d50",color:satellite?"#93c5fd":"#7090a8",background:satellite?"rgba(14,30,50,0.92)":"rgba(6,10,13,0.92)"}}>
              🛰 SAT{satellite?" ON":" OFF"}
            </button>
          </div>

          <div style={{position:"absolute",bottom:14,left:12,background:"rgba(6,10,13,0.93)",border:"1px solid #0f1e2e",padding:"8px 11px",zIndex:999}}>
            {Object.entries(TYPE_CFG).map(([k,c])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                <span style={{fontSize:10,color:"#8aa8bc",fontFamily:"'Share Tech Mono',monospace"}}>{c.label}</span>
              </div>
            ))}
            <div style={{borderTop:"1px solid #0f1e2e",marginTop:6,paddingTop:6}}>
              {Object.entries(CONF_CFG).map(([k,c])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  <div style={{width:6,height:6,borderRadius:"50%",border:`2px solid ${c.color}`,flexShrink:0}}/>
                  <span style={{fontSize:9,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{position:"absolute",top:10,right:10,background:"rgba(6,10,13,0.92)",border:"1px solid #1a2d3d",padding:"6px 10px",zIndex:999,fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#7090a8",lineHeight:2}}>
            <div style={{color:"#22c55e",marginBottom:1}}>● {filteredEvents.length} EVENTS · DAY {tDay+1}</div>
            <div>ACLED · ISW · CENTCOM · IDF</div>
            <div style={{color:"#5a7888"}}>ADS-B / AIS SIMULATED</div>
          </div>

          {!mapReady&&(
            <div style={{position:"absolute",inset:0,background:"#060a0d",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:998}}>
              <Spinner color="#3b82f6" label="INITIALIZING MAP"/>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div style={{width:252,background:"#070b10",borderLeft:"1px solid #0a1420",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          <div style={{display:"flex",borderBottom:"1px solid #0a1420",background:"#060a0d",flexShrink:0}}>
            <button className={`tbtn ${rtab==="aircraft"?"on":""}`} onClick={()=>setRtab("aircraft")} style={{flex:1}}>✈ Aircraft</button>
            <button className={`tbtn ${rtab==="shipping"?"on":""}`} onClick={()=>setRtab("shipping")} style={{flex:1}}>⛴ Hormuz</button>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {rtab==="aircraft" && (
              <div>
                <div style={{padding:"6px 11px",borderBottom:"1px solid #0a1420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>TRACKING {acList.length} AIRCRAFT</span>
                  <div className="scan" style={{width:7,height:7,borderRadius:"50%",background:"#22c55e"}}/>
                </div>
                {acList.map(ac=>{
                  const col=ROLE_COLOR[ac.role]||"#94a3b8";
                  return (
                    <div key={ac.id} className="erow" style={{padding:"7px 11px",borderBottom:"1px solid #090f19"}}
                      onClick={()=>{if(lMap.current)lMap.current.setView([ac.lat,ac.lng],8,{animate:true});}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:11,color:col,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{ac.nation==="US"?"🇺🇸":"🇮🇱"} {ac.callsign}</span>
                        <span style={{fontSize:9,color:col,textTransform:"uppercase",letterSpacing:1,fontFamily:"'Share Tech Mono',monospace"}}>{ac.role}</span>
                      </div>
                      <div style={{fontSize:11,color:"#8aa8bc",fontFamily:"'Share Tech Mono',monospace"}}>{ac.type}</div>
                      <div style={{display:"flex",gap:10,marginTop:2}}>
                        <span style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>FL{Math.floor(ac.alt/100)}</span>
                        <span style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{ac.spd}kt</span>
                        <span style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{ac.hdg}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {rtab==="shipping" && (
              <div>
                <div style={{background:"#1a0808",border:"1px solid #ef444444",margin:"8px",padding:"10px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ef4444",fontWeight:700,letterSpacing:2}}>⚠ STRAIT OF HORMUZ</div>
                  <div style={{fontSize:20,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#ef4444",marginTop:3}}>{tDay>=3?"CLOSED":"OPEN"}</div>
                  <div style={{fontSize:9,color:"#c0605060",fontFamily:"'Share Tech Mono',monospace",marginTop:3,letterSpacing:1}}>~21% GLOBAL OIL DISRUPTED</div>
                </div>
                {VESSELS.map(v=>{
                  const col=STATUS_COLOR[v.status];
                  return (
                    <div key={v.id} className="erow" style={{padding:"7px 10px",borderBottom:"1px solid #090f19"}}
                      onClick={()=>{if(lMap.current)lMap.current.setView([v.lat,v.lng],7,{animate:true});}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:11,color:"#a8c0d0",fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{v.name}</span>
                        <span style={{fontSize:9,color:col,fontFamily:"'Share Tech Mono',monospace",textTransform:"uppercase"}}>{v.status}</span>
                      </div>
                      <div style={{fontSize:10,color:"#7090a8",fontFamily:"'Share Tech Mono',monospace"}}>{v.flag} · {v.type}</div>
                      <div style={{fontSize:10,color:"#8aa8bc",fontFamily:"'Share Tech Mono',monospace",marginTop:2,lineHeight:1.5}}>{v.dest}</div>
                    </div>
                  );
                })}
                <div style={{padding:"10px"}}>
                  {[["Brent Crude","$127.40"],["EU Gas (TTF)","€118.50"],["Reroute Cost","↑ 340%"]].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #090f19"}}>
                      <span style={{fontSize:11,color:"#8aa8bc",fontFamily:"'Share Tech Mono',monospace"}}>{l}</span>
                      <span style={{fontSize:11,color:"#f59e0b",fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TIMELINE ═══ */}
      <div style={{background:"#060a0e",borderTop:"1px solid #0a1420",padding:"8px 16px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>{if(tDay>=MAX_DAY)setTDay(0);setPlaying(p=>!p);}}
            style={{background:"transparent",border:"1px solid #1e3a5c",color:"#3b82f6",width:30,height:24,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {playing?"⏸":"▶"}
          </button>
          <button onClick={()=>{setPlaying(false);setTDay(0);}}
            style={{background:"transparent",border:"1px solid #2a3d50",color:"#7090a8",width:24,height:24,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>↩</button>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:"#f59e0b",whiteSpace:"nowrap",flexShrink:0,minWidth:96}}>
            DAY {tDay+1} · {dayToDate(tDay)}
          </div>
          <div style={{flex:1,position:"relative"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              {Array.from({length:MAX_DAY+1},(_,i)=>(
                <div key={i} onClick={()=>{setPlaying(false);setTDay(i);}}
                  style={{width:1,height:i===tDay?11:i%7===0?7:4,background:i<=tDay?(i===tDay?"#f59e0b":"#1e3a5c"):"#0a1420",cursor:"pointer",flexShrink:0,transition:"height .15s"}}/>
              ))}
            </div>
            <input type="range" min={0} max={MAX_DAY} value={tDay} onChange={e=>{setPlaying(false);setTDay(Number(e.target.value));}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              {["FEB 28","MAR 7","MAR 14","MAR 21"].map((l,i)=>(
                <span key={i} style={{fontSize:9,color:i===3?"#8aa8bc":"#5a7888",fontFamily:"'Share Tech Mono',monospace"}}>{l}</span>
              ))}
            </div>
          </div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#7090a8",whiteSpace:"nowrap",flexShrink:0,textAlign:"right"}}>
            <div style={{color:"#3b82f6"}}>{filteredEvents.length} events</div>
            <div>of {EVENTS.length} total</div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{background:"#04070a",borderTop:"1px solid #070d14",padding:"3px 14px",display:"flex",justifyContent:"space-between",flexShrink:0,fontSize:9,color:"#4a6070",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
        <span>ALL DATA FROM PUBLICLY AVAILABLE OSINT · INFORMATIONAL USE ONLY · NOT AFFILIATED WITH ANY GOVERNMENT OR MILITARY</span>
        <span style={{color:"#22c55e"}}>● WARWATCH v4.0 — OPEN SOURCE INTELLIGENCE</span>
      </div>
    </div>
  );
}
