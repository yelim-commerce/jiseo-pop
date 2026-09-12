/* ============================================================
   JISEO POP! — 〈왕벌의 비행〉 × 제품 컬렉션 게임
   ------------------------------------------------------------
   · BGM: 림스키코르사코프 〈왕벌의 비행〉(1900, 퍼블릭 도메인)을
          외부 음원 없이 WebAudio 오실레이터로 실시간 합성
   · 풍선은 곡의 박(beat)에 맞춰 위에서 빠르게 떨어진다
   · 점수보다 "어떤 제품을 모았는가"가 보상을 결정한다
   ============================================================ */

/* ---------------- 1. 설정 ---------------- */
const CONFIG = {
  brand: 'JISEO',
  duration: 30,
  couponMinutes: 10,
  leadBonusPercent: 5,
  maxPercent: 30,

  /* 제품 = 게임의 주인공.
     rarity: common(자주) / rare(가끔) / legendary(골든 풍선에서만)
     c1,c2 = 풍선 색 (제품별 고유 컬러 → 브랜드 각인)            */
  products: [
    { id:'toner',   emoji:'🌿', name:'수분 토너',    short:'토너',  rarity:'common',
      gift:'토너 30ml 트래블 사이즈',  c1:'#b6ffcf', c2:'#12c98a' },
    { id:'essence', emoji:'🧴', name:'브라이트 에센스', short:'에센스', rarity:'common',
      gift:'에센스 파우치 2매',        c1:'#ff9ad5', c2:'#ff3d78' },
    { id:'cream',   emoji:'✨', name:'글로우 크림',   short:'크림',  rarity:'common',
      gift:'크림 5ml 미니어처',        c1:'#d9b6ff', c2:'#8a3dff' },
    { id:'cleanser',emoji:'🧼', name:'딥 클렌저',    short:'클렌저', rarity:'common',
      gift:'클렌저 20ml 미니',         c1:'#a8fff0', c2:'#00c2a8' },
    { id:'lip',     emoji:'💄', name:'틴트 립밤',    short:'립밤',  rarity:'common',
      gift:'립밤 미니 1개',            c1:'#ffb3b3', c2:'#e8324a' },
    { id:'ampoule', emoji:'💧', name:'수분 앰플',    short:'앰플',  rarity:'rare',
      gift:'앰플 1회분 앰풀 3개',      c1:'#9ad7ff', c2:'#2f7cff' },
    { id:'sun',     emoji:'☀️', name:'데일리 선크림', short:'선크림', rarity:'rare',
      gift:'선크림 미니 튜브',         c1:'#ffe9a3', c2:'#ffab2e' },
    { id:'secret',  emoji:'🎁', name:'시크릿 기프트', short:'시크릿', rarity:'legendary',
      gift:'정품 풀사이즈 1종 즉시 증정', c1:'#fff3b0', c2:'#ffab00' }
  ],

  rarityWeight: { common:1, rare:0.34, legendary:0.06 },

  /* 등급 = 모은 제품 "종류 수" 로 결정 (점수 아님) */
  tiers: [
    { min:8, grade:'MASTER',  label:'마스터', percent:25, perk:'전 제품 컬렉션 완성 · 정품 풀사이즈 증정' },
    { min:6, grade:'DIAMOND', label:'다이아', percent:20, perk:'인기 제품 미니어처 키트 증정' },
    { min:4, grade:'GOLD',    label:'골드',   percent:15, perk:'미니어처 2종 증정' },
    { min:2, grade:'SILVER',  label:'실버',   percent:10, perk:'샘플 3종 증정' },
    { min:0, grade:'BRONZE',  label:'브론즈', percent:5,  perk:'샘플 1종 증정' }
  ],
  legendaryBonus: 5,          // 시크릿 기프트 획득 시 추가 할인

  /* 풍선 구성비 — 대부분의 풍선에 제품이 들어 있다 */
  mix: { product:0.66, golden:0.10 },   // 나머지는 빈 풍선 (폭탄은 아래 별도 스케줄)

  /* 💣 환불 폭탄 — 아래에서 두둥실 떠오른다. 만지면 모은 제품을 하나 뺏긴다 */
  bomb: {
    graceSec: 3.0,       // 시작 후 이 시간 동안은 안 나온다
    riseBeats: 6.0,      // 화면을 6박에 통과 (≈2.1초 — 풍선과 비슷한 속도로 쑥 올라온다)
    everyBeatsStart: 4,  // 초반: 4박마다 1개
    everyBeatsEnd: 2.5,  // 후반: 2.5박마다 1개 (점점 잦아진다)
    maxOnScreen: 4,      // 동시에 떠 있는 폭탄 수
    timePenalty: 1.5,    // 시간 -N초
    scorePenalty: 100    // 보너스 점수 -N
  },

  points: { plain:10, product:30, golden:50 },
  comboWindow: 900,
  maxMultiplier: 5,
  feverCombo: 8,
  feverTime: 4.5,
  goldenTimeBonus: 1.5,
  touchSlack: 26,

  /* 낙하 속도 — 곡의 박자 단위로 정의한다 */
  fallBeatsStart: 7.0,        // 시작: 화면을 7박에 통과
  fallBeatsEnd:   4.8,        // 종료 직전: 4.8박 (점점 빨라짐)

  /* 풍선 크기·밀도 — 화면 크기에 따라 자동 계산된다 (휴대폰=적고 크게) */
  sizeRatio: 0.135,           // 반지름 = 화면 기준치 × 이 값
  sizeMin: 44, sizeMax: 78,   // 반지름 하한 / 상한(px)
  densityMin: 4, densityMax: 10,  // 동시에 떠 있는 풍선 수의 하한 / 상한

  idleReturn: 60
};

/* ============ BGM ============
   1순위: 실제 녹음 음원 (audio/bumblebee.mp3)
     · 림스키코르사코프 〈왕벌의 비행〉 / 미 공군 군악대(U.S. Air Force Band of
       the Rockies) 연주. 미국 정부 저작물 → 퍼블릭 도메인.
       출처: Wikimedia Commons
     · 템포는 온셋 자기상관으로 측정: ♩=169.5 (16분음표 11.3개/초)
   2순위: 음원 파일이 없거나 재생이 막히면 아래 합성 시퀀서로 자동 폴백        */
const AUDIO = {
  src: 'audio/bumblebee.mp3',
  bpm: 169.5,        // 측정된 연주 템포 — 풍선 낙하가 이 값에 맞춰진다
  startAt: 1.42,     // 도입부 무음 1.45초를 건너뛴다
  volume: 0.5        // 효과음이 묻히지 않도록
};

/* 폴백용 합성 시퀀서 — 반음계 질주 모티프 */
const MUSIC = { bpm: 168, feverRate: 1.18, vol: 0.085 };
const chrom = (a, b) => { const o = [], s = a < b ? 1 : -1; for (let n = a; n !== b + s; n += s) o.push(n); return o; };
const BEE = [
  ...chrom(76, 64),                 // E5 → E4 반음계 하강
  64,65,64,63, 64,65,64,63,         // 벌이 맴도는 인접음
  ...chrom(64, 52),                 // E4 → E3 하강
  52,53,52,51, 52,53,52,51,
  ...chrom(52, 64),                 // E3 → E4 상승
  64,63,64,65, 64,63,64,65,
  ...chrom(64, 76),                 // E4 → E5 상승
  76,75,76,77, 76,75,74,75,
  ...chrom(76, 69),                 // E5 → A4
  ...chrom(69, 76)                  // A4 → E5
];
const BASS = [45,45,45,45, 45,45,45,45, 40,40,40,40, 45,45,45,45];  // A2 / E2

/* ============ 이메일 웹훅 ============
   기존 price-slasher-game 과 동일한 Make.com 웹훅을 씁니다.
   그쪽 시나리오가 이미 쓰고 있는 필드명(date/time/email/code/score/cleared/
   discount/agreedAt/source)을 그대로 보내고, 우리 게임 전용 값만 덧붙입니다.
   source 로 어느 게임에서 온 응모인지 구분하세요.

   전송은 application/x-www-form-urlencoded 입니다.
   JSON 으로 보내면 CORS preflight(OPTIONS)가 발생해 Make 웹훅이 거부합니다.

   다른 서비스로 바꾸려면 provider 를 web3forms / formspree / formsubmit 로.   */
const WEBHOOK = {
  url: 'https://hook.eu1.make.com/iv6p47wuoc7rqnh1fb8884y0n5l6buuf',
  provider: 'make',              // make | web3forms | formspree | formsubmit | json
  accessKey: '',                 // Web3Forms 전용
  subject: 'JISEO POP! 쿠폰 응모',
  source: 'jiseo-pop-game',      // 기존 게임은 'price-slasher-game'
  clearKinds: 6,                 // 몇 종부터 cleared=true 로 볼지 (6종 = 다이아 이상)
  timeoutMs: 8000,
  retrySec: 45
};

const STORE_SCORES = 'jiseo_pop_runs';
const STORE_LEADS  = 'jiseo_pop_leads';
const STORE_OUTBOX = 'jiseo_pop_outbox';

/* ---------------- 2. DOM ---------------- */
const $ = id => document.getElementById(id);
const app = $('app'), canvas = $('stage'), ctx = canvas.getContext('2d');
const el = {
  hud:$('hud'), score:$('score'), time:$('time'), timefill:$('timefill'),
  combo:$('combo'), comboX:$('comboX'), collection:$('collection'),
  colCount:$('colCount'), colTotal:$('colTotal'), fever:$('feverBanner'),
  scAttract:$('scAttract'), scCount:$('scCount'), scResult:$('scResult'),
  countNum:$('countNum'), ticker:$('ticker'), lineup:$('lineup'),
  rGrade:$('rGrade'), rColCount:$('rColCount'), rColTotal:$('rColTotal'),
  rColBar:$('rColBar'), rColGrid:$('rColGrid'), rNear:$('rNear'),
  rPercent:$('rPercent'), rPerk:$('rPerk'), rCode:$('rCode'), rExpire:$('rExpire'),
  coupon:$('coupon'), rGifts:$('rGifts'), leadBox:$('leadBox'), board:$('board'),
  toast:$('toast'), hitFlash:$('hitFlash'),
  nowPlaying:$('nowPlaying'), npPerformer:$('npPerformer')
};

/* ---------------- 3. 상태 ---------------- */
const S = { ATTRACT:'attract', COUNT:'count', PLAY:'play', RESULT:'result' };
let state = S.ATTRACT;

let W = 0, H = 0, DPR = 1;
const balloons = [], particles = [], pops = [], confetti = [];
const pointers = new Map();

const G = {
  score:0, combo:0, bestCombo:0, comboAt:0, popped:0,
  timeLeft:CONFIG.duration, fever:0,
  col:new Map(),              // productId → 개수
  lastGot:null,               // 마지막으로 획득한 제품 id (폭탄 회수 대상 판정용)
  percent:5, code:'', tier:null, couponEnd:0, idleAt:0, leadDone:false,
  beatAcc:0, beatNo:0, nextBombBeat:0
};

const PRODUCT_BY_ID = new Map(CONFIG.products.map(p => [p.id, p]));

/* ---------------- 4. 캔버스 ---------------- */
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

/* ---------------- 5. 오디오 기반 ---------------- */
let actx = null, master = null, musicGain = null, soundOn = true;
function audioOn(){
  if (!actx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain(); master.gain.value = soundOn ? 1 : 0;
    master.connect(actx.destination);
    musicGain = actx.createGain(); musicGain.gain.value = 1;
    musicGain.connect(master);
  }
  if (actx.state === 'suspended') actx.resume();
}
function toggleSound(){
  soundOn = !soundOn;
  if (master) master.gain.setTargetAtTime(soundOn ? 1 : 0, actx.currentTime, 0.02);
  if (music.el) music.el.volume = soundOn ? AUDIO.volume : 0;
  $('btnSound').textContent = soundOn ? '🔊' : '🔇';
  $('btnSound').classList.toggle('off', !soundOn);
}
const mid2f = m => 440 * Math.pow(2, (m - 69) / 12);

function tone(freq, dur, { type='triangle', vol=.18, to=null, delay=0 } = {}){
  if (!actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + .02);
}
const sfx = {
  pop(combo){ const f = 380 * Math.pow(1.055, Math.min(combo, 24)); tone(f, .09, { to:f*.55, vol:.18 }); },
  golden(){ [784,1046,1318].forEach((f,i)=>tone(f,.17,{type:'sine',vol:.15,delay:i*.05})); },
  product(){ tone(660,.12,{type:'square',vol:.1,to:1100}); },
  newItem(){ [659,880,1174,1568].forEach((f,i)=>tone(f,.26,{type:'triangle',vol:.17,delay:i*.07})); },
  fever(){ [330,440,550,660,880].forEach((f,i)=>tone(f,.2,{type:'sawtooth',vol:.09,delay:i*.045})); },
  tick(){ tone(1046,.07,{type:'sine',vol:.11}); },
  go(){ tone(1318,.24,{type:'sine',vol:.18,to:1760}); },
  win(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,.42,{type:'triangle',vol:.15,delay:i*.1})); },
  bomb(){
    tone(180,.45,{type:'sawtooth',vol:.28,to:38});     // 폭발
    tone(90,.55,{type:'square',vol:.2,to:30});          // 저역 울림
    tone(1200,.12,{type:'sawtooth',vol:.1,to:200});     // 파편
  }
};
function buzz(ms){ if (navigator.vibrate) { try { navigator.vibrate(ms); } catch(e){} } }

/* ---------------- 6. 〈왕벌의 비행〉 시퀀서 ---------------- */
const music = {
  mode:'none',                       // 'file' | 'synth' | 'none'
  el:null, fileBroken:false, lastBeat:-1, lastTime:-1, stall:0,
  on:false, idx:0, next:0, timer:0, beatQ:[], rate:1
};
const activeBpm   = () => (music.mode === 'file' ? AUDIO.bpm : MUSIC.bpm);
const beatSeconds = () => 60 / (activeBpm() * music.rate);   // 실시간 1박 (풍선 낙하 기준)
const synthBeat   = () => 60 / (MUSIC.bpm * music.rate);
const synthStep   = () => synthBeat() / 4;                   // 합성 16분음표

/* 벌의 날갯짓 같은 스타카토 음색: 톱니파 + 로우패스 + 급격한 감쇠 */
function beeNote(midi, t, dur){
  const f = mid2f(midi);
  const g = actx.createGain();
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(7000, f * 7), t);
  filter.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(MUSIC.vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const o1 = actx.createOscillator(), o2 = actx.createOscillator();
  o1.type = 'sawtooth'; o1.frequency.setValueAtTime(f, t);
  o2.type = 'sawtooth'; o2.frequency.setValueAtTime(f, t); o2.detune.value = -9;
  o1.connect(filter); o2.connect(filter);
  filter.connect(g).connect(musicGain);
  o1.start(t); o2.start(t); o1.stop(t + dur + .02); o2.stop(t + dur + .02);
}
function bassNote(t, beatIndex){
  const m = BASS[beatIndex % BASS.length];
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(mid2f(m), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(MUSIC.vol * 1.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + synthBeat() * 0.8);
  o.connect(g).connect(musicGain);
  o.start(t); o.stop(t + synthBeat());
}
/* --- 실제 음원 --- */
function prepareAudioFile(){
  if (music.el || music.fileBroken) return;
  const a = new Audio();
  a.src = AUDIO.src;
  a.preload = 'auto';
  a.loop = true;                 // 84초 트랙 · 30초 플레이라 실제로는 순환하지 않음
  a.volume = soundOn ? AUDIO.volume : 0;
  a.addEventListener('error', () => { music.fileBroken = true; music.el = null; }, { once:true });
  music.el = a;
}
prepareAudioFile();

function musicStart(){
  audioOn();
  music.rate = 1; music.lastBeat = -1; music.lastTime = -1; music.stall = 0;
  if (music.el && !music.fileBroken){
    music.mode = 'file';
    try { music.el.currentTime = AUDIO.startAt; } catch(e){}
    music.el.playbackRate = 1;
    music.el.volume = soundOn ? AUDIO.volume : 0;
    const p = music.el.play();
    if (p && p.catch) p.catch(() => { music.mode = 'none'; synthStart(); });  // 재생 거부 → 합성으로
    return;
  }
  synthStart();
}
function synthStart(){
  if (!actx) return;
  music.mode = 'synth';
  music.on = true; music.idx = 0;
  music.next = actx.currentTime + 0.1;
  music.beatQ.length = 0;
  clearInterval(music.timer);
  music.timer = setInterval(musicSchedule, 25);
  musicSchedule();
}
function musicStop(){
  music.on = false; clearInterval(music.timer); music.beatQ.length = 0;
  if (music.el && !music.el.paused){
    // 결과 화면으로 넘어갈 때 뚝 끊기지 않게 짧게 페이드아웃
    const a = music.el, v0 = a.volume;
    let k = 0;
    const fade = setInterval(() => {
      k++; a.volume = Math.max(0, v0 * (1 - k / 12));
      if (k >= 12){ clearInterval(fade); a.pause(); a.volume = soundOn ? AUDIO.volume : 0; }
    }, 40);
  }
}
function musicSchedule(){
  if (!music.on || !actx) return;
  const horizon = actx.currentTime + 0.2;
  let guard = 0;
  while (music.next < horizon && guard++ < 64){
    const sd = synthStep();
    beeNote(BEE[music.idx % BEE.length], music.next, sd * 0.9);
    if (music.idx % 4 === 0){
      bassNote(music.next, music.idx / 4 | 0);
      if (state === S.PLAY) music.beatQ.push(music.next);   // 풍선 낙하 싱크
    }
    music.next += sd;
    music.idx++;
  }
}

/* ---------------- 7. 풍선 ---------------- */
function rand(a, b){ return a + Math.random() * (b - a); }
function pickProduct(pool){
  const list = pool || CONFIG.products;
  const total = list.reduce((s, p) => s + CONFIG.rarityWeight[p.rarity], 0);
  let r = Math.random() * total;
  for (const p of list){ r -= CONFIG.rarityWeight[p.rarity]; if (r <= 0) return p; }
  return list[0];
}
const RARE_POOL = CONFIG.products.filter(p => p.rarity !== 'common');

/* 화면이 좁을수록 풍선은 (상대적으로) 크고, 동시에 뜨는 개수는 적어진다 */
function baseRadius(){
  const ref = Math.min(W, H * 0.62);
  return Math.max(CONFIG.sizeMin, Math.min(CONFIG.sizeMax, ref * CONFIG.sizeRatio));
}
function maxOnScreen(){
  const fit = Math.round(W / (baseRadius() * 2.3)) * 2;
  return Math.max(CONFIG.densityMin, Math.min(CONFIG.densityMax, fit));
}
/* 겹쳐 보이지 않도록 화면을 세로 레인으로 나눠 최근에 쓴 레인을 피한다 */
let recentLanes = [];
function spawnX(r, amp){
  const lanes = Math.max(2, Math.floor(W / (r * 2.1)));
  let lane = 0, tries = 0;
  do { lane = (Math.random() * lanes) | 0; tries++; }
  while (recentLanes.includes(lane) && tries < 8);
  recentLanes.push(lane);
  while (recentLanes.length > Math.min(2, lanes - 1)) recentLanes.shift();
  const lw = W / lanes;
  const margin = r + amp + 6;
  return Math.max(margin, Math.min(W - margin, lw * (lane + 0.5) + rand(-lw*0.16, lw*0.16)));
}

/* 폭탄은 초반 유예 시간 이후 · 피버가 아닐 때 · 화면에 몇 개까지만 */
function bombAllowed(){
  if (state !== S.PLAY) return false;
  if (CONFIG.duration - G.timeLeft < CONFIG.bomb.graceSec) return false;
  if (G.fever > 0) return false;
  let n = 0;
  for (const b of balloons) if (b.type === 'bomb' && !b.dead) n++;
  return n < CONFIG.bomb.maxOnScreen;
}

function makeBalloon(forceType){
  const prog = state === S.PLAY ? 1 - G.timeLeft / CONFIG.duration : 0;
  const r = baseRadius() * rand(0.88, 1.12) * (1 - prog * 0.08);

  let type = forceType, product = null;
  if (!type){
    const p = Math.random();
    if (p < CONFIG.mix.golden){ type = 'golden'; product = pickProduct(RARE_POOL); }
    else if (p < CONFIG.mix.golden + CONFIG.mix.product){ type = 'product'; product = pickProduct(); }
    else type = 'plain';
  } else if (type === 'golden') product = pickProduct(RARE_POOL);
  else if (type === 'product')  product = pickProduct();

  const up = type === 'bomb';                      // 폭탄만 아래 → 위
  const amp = up ? rand(14, 26) : rand(5, 16);     // 폭탄은 크게 부유

  // 이동 시간을 "박(beat)" 으로 정의 → 곡이 빨라지면 함께 빨라진다
  const beats = up
    ? CONFIG.bomb.riseBeats
    : CONFIG.fallBeatsStart + (CONFIG.fallBeatsEnd - CONFIG.fallBeatsStart) * prog;
  const speed = (H + r * 3) / (beats * beatSeconds());

  return {
    x: spawnX(r, amp),
    y: up ? H + r * 1.6 : -r * 1.6,
    r, type, product, up,
    c1: type === 'bomb' ? '#6b6478' : (product ? product.c1 : '#cfd6ff'),
    c2: type === 'bomb' ? '#241b2e' : (product ? product.c2 : '#6b76c9'),
    vy: speed * rand(0.94, 1.06) * (up ? -1 : 1) * (state === S.ATTRACT ? 0.42 : 1),
    phase: Math.random() * Math.PI * 2,
    amp,
    born: performance.now(),
    dead: false
  };
}

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBalloon(b, now){
  const t = (now - b.born) / 560 + b.phase;
  const sway = Math.sin(t) * b.amp;
  const x = b.x + sway, y = b.y;
  b._dx = x;
  const tilt = Math.cos(t) * 0.14;

  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);

  // 실 — 떨어지는 풍선은 위로 흩날리고, 떠오르는 폭탄은 아래로 늘어진다
  ctx.strokeStyle = b.type === 'bomb' ? 'rgba(255,150,120,.6)' : 'rgba(255,255,255,.32)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, b.r * 1.02);
  if (b.up) ctx.quadraticCurveTo(sway * .5, b.r * 1.9, -sway * .5, b.r * 2.7);
  else      ctx.quadraticCurveTo(sway * .5, -b.r * 0.55, -sway * .5, -b.r * 1.5);
  ctx.stroke();

  // 매듭
  ctx.fillStyle = b.c2;
  ctx.beginPath();
  ctx.moveTo(-b.r * .12, b.r * .92); ctx.lineTo(b.r * .12, b.r * .92);
  ctx.lineTo(0, b.r * 1.12); ctx.closePath(); ctx.fill();

  // 몸통
  if (b.type === 'bomb'){
    const pl = 0.5 + 0.5 * Math.sin(now / 150);
    ctx.shadowColor = `rgba(255,54,54,${0.5 + 0.4 * pl})`;
    ctx.shadowBlur = 24 + 16 * pl;
  }
  else if (b.type === 'golden'){ ctx.shadowColor = 'rgba(255,190,40,.95)'; ctx.shadowBlur = 32; }
  else if (b.product && b.product.rarity === 'rare'){ ctx.shadowColor = 'rgba(120,240,255,.7)'; ctx.shadowBlur = 20; }
  else { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6; }
  const g = ctx.createRadialGradient(-b.r*.32, -b.r*.36, b.r*.1, 0, 0, b.r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.26, b.c1); g.addColorStop(1, b.c2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r * .88, b.r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r*.88 - 1, b.r - 1, 0, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.beginPath(); ctx.ellipse(-b.r*.3, -b.r*.4, b.r*.17, b.r*.12, -0.6, 0, Math.PI*2); ctx.fill();

  // 내용물: 제품 아이콘 + 제품명 (플레이 내내 제품을 각인)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (b.type === 'bomb'){
    const pl = 0.5 + 0.5 * Math.sin(now / 150);
    // 점선 경고 링 — 멀리서도 "만지면 안 되는 것"으로 읽히게
    ctx.strokeStyle = `rgba(255,84,84,${0.55 + 0.45 * pl})`;
    ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.88 + 8, b.r + 8, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `${b.r * 0.66}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.fillText('💣', 0, -b.r * 0.24);

    const fs = Math.max(13, b.r * 0.30);
    ctx.font = `900 ${fs}px "Pretendard",system-ui,sans-serif`;
    const tw = ctx.measureText('위험').width;
    const pw = tw + fs * 1.05, ph = fs * 1.55, py = b.r * 0.44;
    ctx.fillStyle = `rgba(255,50,50,${0.88 + 0.12 * pl})`;
    roundRect(-pw/2, py - ph/2, pw, ph, ph/2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('위험', 0, py + 0.5);
  } else if (b.product){
    ctx.font = `${b.r * 0.62}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    ctx.fillText(b.product.emoji, 0, -b.r * 0.26);

    // 제품명은 흰 알약 위에 올려 어떤 풍선 색에서도 또렷하게 읽히도록
    const fs = Math.max(13, b.r * 0.30);
    ctx.font = `900 ${fs}px "Pretendard",system-ui,sans-serif`;
    const tw = ctx.measureText(b.product.short).width;
    const pw = tw + fs * 1.05, ph = fs * 1.55, py = b.r * 0.42;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    roundRect(-pw/2, py - ph/2, pw, ph, ph/2); ctx.fill();
    ctx.fillStyle = '#1a0f2e';
    ctx.fillText(b.product.short, 0, py + 0.5);

    if (b.type === 'golden'){
      ctx.font = `900 ${b.r*0.26}px system-ui,sans-serif`;
      ctx.fillStyle = '#8a4b00'; ctx.fillText('★', 0, -b.r * 0.74);
    }
  } else {
    ctx.font = `${b.r * 0.62}px system-ui,"Apple Color Emoji",sans-serif`;
    ctx.globalAlpha = .55; ctx.fillText('🫧', 0, 0); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------------- 8. 이펙트 ---------------- */
function burst(x, y, b){
  const n = b.type === 'golden' ? 28 : 16;
  for (let i = 0; i < n; i++){
    const a = (Math.PI*2 * i)/n + rand(-.2,.2), sp = rand(90, 340);
    particles.push({
      x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 40,
      r:rand(2.5, 7), life:1, decay:rand(1.1, 2.0),
      c: Math.random() < .5 ? b.c1 : b.c2, shape: Math.random() < .35 ? 'sq' : 'ci'
    });
  }
  particles.push({ ring:true, x, y, r:b.r*.6, life:1, decay:2.4, c:b.c1 });
}
function popText(x, y, text, color, size){ pops.push({ x, y, text, color, size:size||26, life:1 }); }
function shake(){ app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake'); }
function makeConfetti(n){
  for (let i = 0; i < (n || 140); i++){
    confetti.push({
      x: rand(0, W), y: rand(-H, 0), vx: rand(-40, 40), vy: rand(120, 300),
      w: rand(6, 12), h: rand(8, 16), rot: rand(0, 6.3), vr: rand(-6, 6),
      c: ['#ff3d78','#ffd76a','#4ff0d0','#8a3dff','#ffffff'][(Math.random()*5)|0]
    });
  }
}

/* ---------------- 9. 터뜨리기 ---------------- */
function popBalloon(b, chained){
  if (b.dead) return;
  b.dead = true;
  if (b.type === 'bomb'){ blowUp(b); return; }        // 💣 는 터뜨리면 안 되는 것

  const now = performance.now();
  if (now - G.comboAt < CONFIG.comboWindow) G.combo++; else G.combo = 1;
  G.comboAt = now;
  G.bestCombo = Math.max(G.bestCombo, G.combo);

  const mult = Math.min(CONFIG.maxMultiplier, 1 + Math.floor((G.combo - 1) / 3));
  const gain = CONFIG.points[b.type] * mult * (G.fever > 0 ? 2 : 1);
  G.score += gain;
  G.popped++;

  const x = b._dx != null ? b._dx : b.x, y = b.y;
  burst(x, y, b);

  if (b.product){
    const id = b.product.id;
    const had = G.col.has(id);
    G.col.set(id, (G.col.get(id) || 0) + 1);
    G.lastGot = id;
    renderCollection(id, had ? 'got' : 'new');

    if (!had){
      // 첫 획득 = 이 게임의 하이라이트
      popText(W/2, H*0.36, `${b.product.emoji} ${b.product.name}`, '#ffd76a', 38);
      popText(W/2, H*0.36 + 46, 'NEW! 컬렉션 획득', '#ffffff', 20);
      makeConfetti(40); sfx.newItem(); shake(); buzz([15, 35, 15, 35]);
    } else {
      popText(x, y - b.r*.6, `${b.product.emoji} ${b.product.short}`, '#ffffff', 22);
      sfx.product(); buzz(12);
    }
  } else {
    popText(x, y - b.r*.5, '+' + gain, '#ffffff', 22 + mult*2);
    sfx.pop(G.combo); buzz(9);
  }

  if (b.type === 'golden'){
    G.timeLeft = Math.min(CONFIG.duration, G.timeLeft + CONFIG.goldenTimeBonus);
    popText(x, y - b.r*1.3, `+${CONFIG.goldenTimeBonus}초`, '#4ff0d0', 22);
    sfx.golden();
  }

  if (mult > 1 && !chained && !b.product) popText(W/2, H*0.24, `x${mult} COMBO`, '#ff8a3d', 30);
  if (G.combo === CONFIG.feverCombo && G.fever <= 0) startFever();

  updateHUD();
}

/* 💣 환불 폭탄 — 모은 제품을 하나 뺏긴다.
   여유분(2개 이상)이 있는 제품부터 회수해서 "도감 종류"는 최대한 지켜주고,
   전부 1개씩뿐일 때만 가장 최근에 얻은 종류가 사라진다.                    */
function refundPenalty(){
  if (!G.col.size) return null;
  let target = null, best = 1;
  for (const [id, n] of G.col) if (n > best){ best = n; target = id; }
  if (!target) target = (G.lastGot && G.col.has(G.lastGot)) ? G.lastGot : [...G.col.keys()].pop();
  const left = G.col.get(target) - 1;
  const lost = left <= 0;
  if (lost) G.col.delete(target); else G.col.set(target, left);
  renderCollection(target, lost ? 'lost' : 'down');
  return { product: PRODUCT_BY_ID.get(target), lost };
}

function blowUp(b){
  const x = b._dx != null ? b._dx : b.x, y = b.y;
  burst(x, y, { r: b.r * 1.35, type:'golden', c1:'#ffb36b', c2:'#ff2d2d' });

  G.combo = 0; G.comboAt = 0; el.combo.classList.remove('on');   // 콤보 즉시 소멸
  G.score = Math.max(0, G.score - CONFIG.bomb.scorePenalty);
  G.timeLeft = Math.max(0.2, G.timeLeft - CONFIG.bomb.timePenalty);

  const taken = refundPenalty();
  flash(); shake(); sfx.bomb(); buzz([40, 60, 40, 60, 120]);

  if (taken){
    popText(W/2, H*0.33, `💣 환불! ${taken.product.emoji} ${taken.product.name}`, '#ff7b7b', 34);
    popText(W/2, H*0.33 + 44, taken.lost ? '컬렉션에서 사라졌어요!' : '1개 회수', '#ffd76a', 20);
  } else {
    popText(W/2, H*0.33, '💣 환불 폭탄!', '#ff7b7b', 34);
  }
  popText(x, y - b.r*0.6, `-${CONFIG.bomb.timePenalty}초`, '#ff9a9a', 24);
  updateHUD();
}

function startFever(){
  G.fever = CONFIG.feverTime;
  app.classList.add('fever');
  el.fever.classList.remove('on'); void el.fever.offsetWidth; el.fever.classList.add('on');
  music.rate = MUSIC.feverRate;             // 곡이 빨라지고 풍선도 함께 빨라진다
  if (music.el && !music.el.paused) music.el.playbackRate = MUSIC.feverRate;
  sfx.fever(); shake(); buzz([20,40,20,40,60]);
  // 연쇄 폭발은 폭탄을 건드리지 않는다 (자동으로 벌점을 먹으면 억울하니까)
  balloons.filter(b => !b.dead && b.type !== 'bomb')
          .forEach((b, i) => setTimeout(() => popBalloon(b, true), i * 40));
}

/* 손이 지나간 "선분"과 풍선의 거리로 판정 → 쓸면 경로 전체가 터진다 */
function segDist(px, py, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, len = dx*dx + dy*dy;
  let t = len ? ((px-ax)*dx + (py-ay)*dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx*t), py - (ay + dy*t));
}
function sweep(ax, ay, bx, by){
  for (const b of balloons){
    if (b.dead) continue;
    const bx0 = b._dx != null ? b._dx : b.x;
    if (segDist(bx0, b.y, ax, ay, bx, by) <= b.r + CONFIG.touchSlack) popBalloon(b);
  }
}

/* ---------------- 10. 입력 ---------------- */
function point(e){ const r = canvas.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
canvas.addEventListener('pointerdown', e => {
  audioOn();
  const p = point(e);
  pointers.set(e.pointerId, p);
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  if (state === S.ATTRACT){ sweep(p.x, p.y, p.x, p.y); startCountdown(); return; }
  if (state === S.PLAY) sweep(p.x, p.y, p.x, p.y);
}, { passive:true });
canvas.addEventListener('pointermove', e => {
  const prev = pointers.get(e.pointerId); if (!prev) return;
  const p = point(e);
  if (state === S.PLAY) sweep(prev.x, prev.y, p.x, p.y);
  pointers.set(e.pointerId, p);
}, { passive:true });
['pointerup','pointercancel','pointerleave'].forEach(t =>
  canvas.addEventListener(t, e => pointers.delete(e.pointerId), { passive:true }));

$('btnStart').addEventListener('click', () => { audioOn(); if (state === S.ATTRACT) startCountdown(); });
$('btnRetry').addEventListener('click', () => { audioOn(); startCountdown(); });
$('btnSound').addEventListener('click', () => { audioOn(); toggleSound(); });
$('btnFs').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});
$('btnShare').addEventListener('click', share);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------------- 11. 화면 전환 ---------------- */
function show(screen){
  [el.scAttract, el.scCount, el.scResult].forEach(s => s.classList.remove('show'));
  if (screen) screen.classList.add('show');
}
function startCountdown(){
  state = S.COUNT;
  show(el.scCount);
  el.hud.classList.remove('on');
  balloons.length = 0; confetti.length = 0;
  let n = 3;
  const step = () => {
    if (n > 0){
      el.countNum.textContent = n;
      el.countNum.classList.remove('tick'); void el.countNum.offsetWidth; el.countNum.classList.add('tick');
      sfx.tick(); n--; setTimeout(step, 640);
    } else {
      el.countNum.textContent = 'GO!';
      el.countNum.classList.remove('tick'); void el.countNum.offsetWidth; el.countNum.classList.add('tick');
      sfx.go(); setTimeout(startPlay, 480);
    }
  };
  step();
}
function startPlay(){
  Object.assign(G, {
    score:0, combo:0, bestCombo:0, comboAt:0, popped:0,
    timeLeft:CONFIG.duration, fever:0, col:new Map(), lastGot:null,
    leadDone:false, beatAcc:0, beatNo:0, nextBombBeat:0
  });
  app.classList.remove('fever');
  state = S.PLAY;
  show(null);
  el.hud.classList.add('on');
  renderCollection();
  updateHUD();
  musicStart();
  showNowPlaying();
  for (let i = 0; i < 3; i++){ const b = makeBalloon(); b.y = -b.r * (2 + i * 2.4); balloons.push(b); }
}
function endGame(){
  state = S.RESULT;
  app.classList.remove('fever');
  el.hud.classList.remove('on');
  el.combo.classList.remove('on');
  musicStop();
  pointers.clear();
  buildResult();
  show(el.scResult);
  makeConfetti();
  sfx.win(); buzz([30,60,30,60,120]);
  G.idleAt = performance.now();
}

/* 박자에 맞춰 풍선 투하 */
function onBeat(){
  if (state !== S.PLAY) return;
  G.beatNo++;
  const cap = maxOnScreen() + (G.fever > 0 ? 3 : 0);
  let n;
  if (G.fever > 0) n = 2;                                    // 벌떼 러시
  else if (G.timeLeft < CONFIG.duration * 0.5) n = 1;        // 후반: 매 박 1개
  else n = (G.beatNo % 2 === 0) ? 1 : 0;                     // 전반: 2박에 1개
  // 상한은 "떨어지는 풍선"에만 적용 — 폭탄이 제품 노출량을 깎지 않도록
  let onScreen = 0;
  for (const b of balloons) if (!b.dead && b.type !== 'bomb') onScreen++;
  for (let i = 0; i < n && onScreen < cap; i++){ balloons.push(makeBalloon()); onScreen++; }

  // 💣 는 풍선과 별개로 자기 박자에 맞춰 아래에서 쏘아올린다
  if (G.beatNo >= G.nextBombBeat && bombAllowed()){
    balloons.push(makeBalloon('bomb'));
    const prog = 1 - G.timeLeft / CONFIG.duration;
    const every = CONFIG.bomb.everyBeatsStart
                + (CONFIG.bomb.everyBeatsEnd - CONFIG.bomb.everyBeatsStart) * prog;
    G.nextBombBeat = G.beatNo + Math.max(1, Math.round(every + rand(-0.6, 0.6)));
  }
}

/* 재생 중인 곡을 잠깐 띄운다 (합성 폴백이면 그렇게 표기) */
function showNowPlaying(){
  setTimeout(() => {
    el.npPerformer.textContent = music.mode === 'file'
      ? '림스키코르사코프 · 1900 · 美 공군 군악대 연주'
      : '림스키코르사코프 · 1900 · 실시간 합성 연주';
    el.nowPlaying.classList.remove('on');
    void el.nowPlaying.offsetWidth;
    el.nowPlaying.classList.add('on');
  }, 350);
}

/* 박 공급기 — 음원 재생 위치를 1순위로, 멈추면 타이머로 이어받는다 */
function beatPump(dt){
  const a = music.el;
  if (music.mode === 'file' && a && !a.paused){
    const t = a.currentTime;
    if (t > music.lastTime + 1e-4){          // 음원 시계 정상 진행
      music.lastTime = t; music.stall = 0;
      const ab = 60 / AUDIO.bpm;
      const b = Math.floor((t - AUDIO.startAt) / ab);
      if (music.lastBeat < 0) music.lastBeat = b;
      let guard = 0;
      while (music.lastBeat < b && guard++ < 4){ music.lastBeat++; onBeat(); }
      return;
    }
    music.stall += dt;
    if (music.stall < 0.4) return;           // 짧은 끊김은 무시
    // 0.4초 넘게 멈춰 있으면(버퍼링·스톨) 아래 타이머로 폴백해 풍선이 끊기지 않게 한다
  } else if (music.mode === 'synth' && actx){
    while (music.beatQ.length && actx.currentTime >= music.beatQ[0]){ music.beatQ.shift(); onBeat(); }
    if (music.beatQ.length > 16) music.beatQ.length = 0;
    return;
  }
  G.beatAcc += dt;                           // 음원 로딩 전 / 오디오 불가 / 스톨
  while (G.beatAcc >= beatSeconds()){ G.beatAcc -= beatSeconds(); onBeat(); }
}

/* ---------------- 12. HUD ---------------- */
function bump(node){ node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
function updateHUD(){
  el.score.textContent = G.score;
  el.colCount.textContent = G.col.size;
  const mult = Math.min(CONFIG.maxMultiplier, 1 + Math.floor((G.combo - 1) / 3));
  if (mult > 1){ el.comboX.textContent = 'x' + mult; el.combo.classList.add('on'); }
  else el.combo.classList.remove('on');
}
function flash(){
  const f = el.hitFlash;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}
function renderCollection(highlightId, mode){
  el.colTotal.textContent = '/' + CONFIG.products.length;
  el.collection.innerHTML = CONFIG.products.map(p => {
    const n = G.col.get(p.id) || 0;
    return `<div class="slot ${n ? 'got' : ''}" data-id="${p.id}" style="--c:${p.c2}" title="${p.name}">
      ${p.emoji}${n > 1 ? `<b class="n">${n}</b>` : ''}</div>`;
  }).join('');
  if (highlightId){
    const node = el.collection.querySelector(`[data-id="${highlightId}"]`);
    if (node) node.classList.add(mode === 'lost' || mode === 'down' ? 'lost' : 'pop');
  }
  if (mode === 'new' || mode === 'lost') bump(el.colCount.parentElement);
}

/* ---------------- 13. 결과 ---------------- */
function tierOf(kinds){ return CONFIG.tiers.find(t => kinds >= t.min) || CONFIG.tiers[CONFIG.tiers.length-1]; }
function makeCode(){
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 4; i++) s += cs[(Math.random()*cs.length)|0];
  return `${CONFIG.brand}-${s}`;
}
function todayKey(){ return new Date().toISOString().slice(0,10); }
function loadRuns(){
  try { const all = JSON.parse(localStorage.getItem(STORE_SCORES) || '{}'); return all[todayKey()] || []; }
  catch(e){ return []; }
}
function saveRun(kinds, score){
  const entry = { k:kinds, s:score, t:Date.now() };
  try {
    const all = JSON.parse(localStorage.getItem(STORE_SCORES) || '{}');
    const day = all[todayKey()] || [];
    day.push(entry);
    day.sort((a,b) => (b.k - a.k) || (b.s - a.s));
    all[todayKey()] = day.slice(0, 50);
    localStorage.setItem(STORE_SCORES, JSON.stringify(all));
  } catch(e){}
  return entry;
}

function buildResult(){
  const kinds = G.col.size;
  const hasLegendary = CONFIG.products.some(p => p.rarity === 'legendary' && G.col.has(p.id));
  const tier = tierOf(kinds);
  G.tier = tier;
  G.percent = Math.min(CONFIG.maxPercent, tier.percent + (hasLegendary ? CONFIG.legendaryBonus : 0));
  G.code = makeCode();
  G.couponEnd = Date.now() + CONFIG.couponMinutes * 60000;

  el.rGrade.textContent = `${tier.grade} · ${tier.label}`;
  el.rColCount.textContent = kinds;
  el.rColTotal.textContent = `/ ${CONFIG.products.length} 종 수집`;
  el.rColBar.style.width = Math.round(kinds / CONFIG.products.length * 100) + '%';

  // 컬렉션 그리드 — 결과 화면의 주인공
  el.rColGrid.innerHTML = CONFIG.products.map((p, i) => {
    const n = G.col.get(p.id) || 0;
    return `<div class="cell ${n ? 'got' : ''}" style="--c:${p.c2};animation-delay:${i*55}ms">
      <div class="e">${p.emoji}</div>
      <span class="n ${n ? '' : 'miss'}">${p.short}</span>
      ${n > 1 ? `<b class="x">${n}</b>` : ''}</div>`;
  }).join('');

  // 못 모은 제품을 이름으로 호명 → 제품 각인 + 재도전 유도
  const missing = CONFIG.products.filter(p => !G.col.has(p.id));
  const next = CONFIG.tiers.filter(t => t.min > kinds).sort((a,b) => a.min - b.min)[0];
  if (kinds === 0){
    const need = CONFIG.tiers.filter(t => t.min > 0).sort((a,b)=>a.min-b.min)[0];
    el.rNear.innerHTML = `딱 <b>${need.min}종</b>만 모으면 ${need.label} ${need.percent}%! 한 번 더 도전해보세요 🐝`;
  } else if (next){
    const need = next.min - kinds;
    if (missing.length <= need){
      const names = missing.map(p => `${p.emoji} ${p.name}`).join(', ');
      el.rNear.innerHTML = `아깝다! <b>${names}</b>만 더 모았다면<br>${next.label} ${next.percent}% 였어요 😭`;
    } else {
      const names = missing.slice(0, 2).map(p => `${p.emoji} ${p.name}`).join(', ');
      el.rNear.innerHTML = `아깝다! <b>${names}</b> 같은 제품 ${need}종만 더 모았다면<br>${next.label} ${next.percent}% 였어요 😭`;
    }
  } else {
    el.rNear.innerHTML = `전 제품 컬렉션 완성! 오늘의 전설 🏆 <b>최고 콤보 x${G.bestCombo}</b>`;
  }

  el.rPercent.textContent = G.percent;
  el.rPerk.innerHTML = tier.perk + (hasLegendary
    ? `<br><b>🎁 시크릿 기프트 보너스 +${CONFIG.legendaryBonus}%</b>` : '');
  el.rCode.textContent = G.code;
  el.coupon.classList.remove('dead');

  // 획득 제품별 증정 목록 — "무엇을 모았는지"가 곧 보상
  const got = CONFIG.products.filter(p => G.col.has(p.id));
  el.rGifts.innerHTML = `<h3>내가 획득한 제품 혜택</h3>` + (got.length
    ? `<ul>${got.map(p => `<li><span class="e">${p.emoji}</span><span class="t">
        <b>${p.name} ×${G.col.get(p.id)}</b><span>${p.gift}</span></span></li>`).join('')}</ul>`
    : `<p class="none">이번엔 제품을 하나도 못 건졌어요. 한 번 더 도전!</p>`);

  // 랭킹 (제품 종류 수 우선, 점수는 동점자 처리용)
  const me = saveRun(kinds, G.score);
  const day = loadRuns();
  const myRank = day.findIndex(e => e.t === me.t) + 1;
  const rows = day.slice(0, 5).map((e, i) => {
    const isMe = e.t === me.t;
    return `<li class="${isMe ? 'me' : ''}"><span class="rk">${i+1}위</span>
      <span>${isMe ? '🙋 나' : '익명의 도전자'}</span>
      <span class="sc">${e.k}종 · ${e.s}점</span></li>`;
  }).join('');
  const topK = day.length ? day[0].k : 0;
  el.board.innerHTML = `<h3>오늘의 컬렉션 랭킹 · 내 순위 ${myRank || '-'}위 / ${day.length}명</h3><ol>${rows}</ol>` +
    (topK > kinds ? `<p style="text-align:center;font-size:12.5px;color:var(--muted);margin:8px 0 0">
      1위는 <b style="color:var(--gold)">${topK}종</b> — ${topK - kinds}종 차이예요!</p>` : '');

  el.leadBox.innerHTML = leadMarkup();
  bindLead();
}

function leadMarkup(){
  return `<p class="lead-title">이메일을 남기면 <b>추가 ${CONFIG.leadBonusPercent}% 할인</b> 🎁</p>
    <form id="leadForm" autocomplete="off" novalidate>
      <input id="leadName" type="text" placeholder="이름 (선택)" maxlength="20">
      <input id="leadEmail" type="email" inputmode="email" placeholder="이메일 주소"
             maxlength="80" autocapitalize="off" autocorrect="off" spellcheck="false">
      <label class="agree">
        <input type="checkbox" id="leadAgree">
        <span>개인정보 수집·이용에 동의합니다
          <em>쿠폰 발송·이벤트 안내 목적 / 이름·이메일 / 6개월 보관</em></span>
      </label>
      <button type="submit" class="btn small">추가 할인 받기</button>
    </form>
    <small>${WEBHOOK.url ? '* 입력하신 이메일로 쿠폰이 발송됩니다.' : '* 입력 정보는 이 기기에만 저장됩니다.'}</small>`;
}
function bindLead(){
  const form = $('leadForm'); if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name  = $('leadName').value.trim();
    const email = $('leadEmail').value.trim();
    const agree = $('leadAgree').checked;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ toast('이메일 주소를 확인해 주세요'); return; }
    if (!agree){ toast('개인정보 수집·이용 동의가 필요해요'); return; }
    if (G.leadDone) return;
    G.leadDone = true;

    G.percent = Math.min(CONFIG.maxPercent, G.percent + CONFIG.leadBonusPercent);
    el.rPercent.textContent = G.percent;

    const now = new Date();
    // 기존 게임과 동일하게 KST 기준 날짜/시각을 따로 보낸다
    const kst = new Intl.DateTimeFormat('sv-SE', {
      timeZone:'Asia/Seoul', dateStyle:'short', timeStyle:'medium'
    }).format(now).split(' ');

    const payload = {
      name, email,
      coupon: G.code,
      percent: G.percent,
      kinds: G.col.size,
      cleared: G.col.size >= WEBHOOK.clearKinds,
      collected: CONFIG.products.filter(p => G.col.has(p.id))
                                .map(p => `${p.name} x${G.col.get(p.id)}`).join(', '),
      score: G.score,
      bestCombo: G.bestCombo,
      date: kst[0], time: kst[1],
      agreedAt: now.toISOString(),
      consent: true,
      tries: 0
    };
    try {
      const leads = JSON.parse(localStorage.getItem(STORE_LEADS) || '[]');
      leads.push(payload); localStorage.setItem(STORE_LEADS, JSON.stringify(leads));
    } catch(err){}

    // 화면은 즉시 보상 처리 — 전송 결과 때문에 손님을 기다리게 하지 않는다
    el.leadBox.innerHTML =
      `<p class="lead-title">✅ ${name ? name + '님, ' : ''}<b>${G.percent}% 할인</b>으로 업그레이드!</p>
       <small>쿠폰 코드 ${G.code} · 스태프에게 이 화면을 보여주세요.</small>
       <p class="send-status" id="sendStatus">📨 전송 중…</p>`;
    makeConfetti(60); sfx.golden(); shake();

    if (!WEBHOOK.url){
      setSendStatus('✅ 이 기기에 저장되었습니다', 'ok');
      return;
    }
    postLead(payload).then(r => {
      if (r.ok){ setSendStatus(r.via === 'beacon' ? '✅ 응모 접수 완료' : '✅ 이메일 전송 완료', 'ok'); }
      else {
        outboxAdd(payload);
        setSendStatus('📨 저장됨 — 연결되면 자동으로 전송돼요', 'warn');
      }
    });
  });
}
function setSendStatus(text, kind){
  const n = $('sendStatus'); if (!n) return;
  n.textContent = text; n.className = 'send-status ' + (kind || '');
}

/* ---------------- 이메일 웹훅 ---------------- */
function isFormTransport(){
  // Make / Zapier / n8n 등 범용 웹훅은 CORS preflight 를 못 받으므로 form 인코딩으로 보낸다
  return WEBHOOK.provider === 'make' || WEBHOOK.provider === 'json';
}
function buildBody(p){
  const base = {
    date: p.date, time: p.time,
    email: p.email,
    code: p.coupon,
    score: String(p.score),
    cleared: String(p.cleared),
    discount: String(p.percent),
    agreedAt: p.agreedAt,
    source: WEBHOOK.source,
    // ↓ 이 게임에만 있는 값 (Make 에서 매핑하면 바로 쓸 수 있습니다)
    name: p.name,
    kinds: String(p.kinds),
    collected: p.collected,
    bestCombo: String(p.bestCombo)
  };
  switch (WEBHOOK.provider){
    case 'web3forms':  return { ...base, access_key:WEBHOOK.accessKey, subject:WEBHOOK.subject,
                                from_name:`${CONFIG.brand} POP!`, replyto:p.email };
    case 'formspree':  return { ...base, _subject:WEBHOOK.subject, _replyto:p.email };
    case 'formsubmit': return { ...base, _subject:WEBHOOK.subject, _template:'table', _captcha:'false' };
    default:           return base;
  }
}
function postLead(p){
  if (!WEBHOOK.url) return Promise.resolve({ ok:false, reason:'no-url' });
  const data = buildBody(p);

  if (!isFormTransport()){
    // CORS 헤더를 제대로 주는 폼 서비스들은 JSON 그대로
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), WEBHOOK.timeoutMs) : 0;
    return fetch(WEBHOOK.url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify(data),
        signal: ctrl ? ctrl.signal : undefined
      })
      .then(res => ({ ok:res.ok, status:res.status }))
      .catch(e => ({ ok:false, reason: e && e.name === 'AbortError' ? 'timeout' : 'network' }))
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  // preflight 가 생기지 않는 단순 요청(form-urlencoded)
  const body = new URLSearchParams(data).toString();
  const TYPE = 'application/x-www-form-urlencoded;charset=UTF-8';
  return fetch(WEBHOOK.url, {
      method:'POST', headers:{ 'Content-Type':TYPE }, body, keepalive:true
    })
    .then(res => ({ ok:res.ok, status:res.status }))
    .catch(() => {
      // CORS 로 응답을 못 읽었을 뿐 요청은 갔을 수 있다 → sendBeacon 으로 한 번 더.
      // 성공하면 'sent' 로 보고 재전송 큐에 넣지 않는다 (중복 발송 방지)
      try {
        const sent = navigator.sendBeacon &&
                     navigator.sendBeacon(WEBHOOK.url, new Blob([body], { type:TYPE }));
        return sent ? { ok:true, via:'beacon' } : { ok:false, reason:'network' };
      } catch(e){ return { ok:false, reason:'network' }; }
    });
}

/* 전송 실패분은 기기에 쌓아두고 연결되면 자동 재시도 (부스 와이파이는 자주 끊긴다) */
function outboxLoad(){ try { return JSON.parse(localStorage.getItem(STORE_OUTBOX) || '[]'); } catch(e){ return []; } }
function outboxSave(a){ try { localStorage.setItem(STORE_OUTBOX, JSON.stringify(a.slice(-100))); } catch(e){} }
function outboxAdd(p){ const a = outboxLoad(); a.push(p); outboxSave(a); }
let outboxBusy = false;
function outboxFlush(){
  if (outboxBusy || !WEBHOOK.url) return;
  if (navigator.onLine === false) return;
  const queue = outboxLoad();
  if (!queue.length) return;
  outboxBusy = true;
  const rest = [];
  const step = i => {
    if (i >= queue.length){ outboxSave(rest); outboxBusy = false; return; }
    const item = queue[i];
    postLead(item).then(r => {
      if (!r.ok){
        item.tries = (item.tries || 0) + 1;
        if (item.tries < 5) rest.push(item);   // 5회까지만 재시도 (설정 오류로 무한 반복 방지)
      }
      step(i + 1);
    });
  };
  step(0);
}
setInterval(outboxFlush, WEBHOOK.retrySec * 1000);
window.addEventListener('online', outboxFlush);
outboxFlush();

function share(){
  const names = CONFIG.products.filter(p => G.col.has(p.id)).map(p => p.emoji).join('');
  const text = `${CONFIG.brand} POP! 에서 ${G.col.size}종 수집 ${names} · ${G.percent}% 할인 당첨! 🐝`;
  if (navigator.share) navigator.share({ title:`${CONFIG.brand} POP!`, text }).catch(()=>{});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('결과가 복사되었어요!'), () => toast(text));
  else toast(text);
}

let toastT = 0;
function toast(msg){
  el.toast.textContent = msg; el.toast.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('on'), 1900);
}

/* ---------------- 14. 대기 화면 ---------------- */
function renderLineup(){
  el.lineup.innerHTML = CONFIG.products.map((p, i) => {
    const tag = p.rarity === 'legendary' ? '<span class="r legendary">희귀</span>'
              : p.rarity === 'rare' ? '<span class="r rare">레어</span>' : '';
    return `<div class="item" style="animation-delay:${i*140}ms">
      <div class="e">${p.emoji}</div><span class="n">${p.name}</span>${tag}</div>`;
  }).join('');
}
renderLineup();

let tickIdx = 0;
function updateTicker(){
  const day = loadRuns();
  if (!day.length){ el.ticker.hidden = true; return; }
  const e = day[tickIdx++ % Math.min(day.length, 10)];
  el.ticker.hidden = false;
  el.ticker.textContent = `🐝 방금 한 분이 ${e.k}종 수집 · ${tierOf(e.k).percent}% 당첨! (오늘 ${day.length}명 참여)`;
  el.ticker.style.animation = 'none'; void el.ticker.offsetWidth; el.ticker.style.animation = '';
}
setInterval(() => { if (state === S.ATTRACT) updateTicker(); }, 3200);
updateTicker();

function seedAttract(){
  const n = Math.max(3, maxOnScreen() - 2);
  for (let i = 0; i < n; i++){ const b = makeBalloon(); b.y = rand(-40, H + 40); balloons.push(b); }
}
seedAttract();

/* ---------------- 15. 메인 루프 ---------------- */
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.clearRect(0, 0, W, H);

  /* --- 박자 → 풍선 투하 (오디오 시계 기준, 없으면 타이머 폴백) --- */
  if (state === S.PLAY){
    beatPump(dt);
  } else if (state === S.ATTRACT){
    G.beatAcc += dt;
    while (G.beatAcc >= 1.1){ G.beatAcc -= 1.1; if (balloons.length < Math.max(3, maxOnScreen() - 2)) balloons.push(makeBalloon()); }
  }

  /* --- 타이머 --- */
  if (state === S.PLAY){
    G.timeLeft -= dt;
    if (G.fever > 0){
      G.fever -= dt;
      if (G.fever <= 0){
        app.classList.remove('fever'); music.rate = 1;
        if (music.el) music.el.playbackRate = 1;
      }
    }
    if (performance.now() - G.comboAt > CONFIG.comboWindow && G.combo){
      G.combo = 0; el.combo.classList.remove('on');
    }
    const shown = Math.max(0, Math.ceil(G.timeLeft));
    if (el.time.textContent !== String(shown)){
      el.time.textContent = shown;
      if (shown <= 5 && shown > 0){ sfx.tick(); bump(el.time); }
    }
    el.timefill.style.width = Math.max(0, G.timeLeft / CONFIG.duration) * 100 + '%';
    el.timefill.classList.toggle('low', G.timeLeft <= 6);
    if (G.timeLeft <= 0) endGame();
  }

  /* --- 풍선 (위 → 아래) --- */
  for (let i = balloons.length - 1; i >= 0; i--){
    const b = balloons[i];
    if (b.dead){ balloons.splice(i, 1); continue; }
    b.y += b.vy * dt * (G.fever > 0 ? 1.2 : 1);
    if (b.up ? (b.y + b.r * 1.8 < 0) : (b.y - b.r * 1.8 > H)){ balloons.splice(i, 1); continue; }
    drawBalloon(b, now);
  }

  /* --- 파티클 --- */
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0){ particles.splice(i, 1); continue; }
    if (p.ring){
      ctx.globalAlpha = p.life * .6;
      ctx.strokeStyle = p.c; ctx.lineWidth = 3 + (1 - p.life) * 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (1 - p.life) * 90, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1; continue;
    }
    p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c;
    if (p.shape === 'sq') ctx.fillRect(p.x - p.r, p.y - p.r, p.r*2, p.r*2);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  /* --- 떠오르는 텍스트 --- */
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = pops.length - 1; i >= 0; i--){
    const t = pops[i];
    t.life -= dt * 1.1;
    if (t.life <= 0){ pops.splice(i, 1); continue; }
    const up = (1 - t.life) * 58;
    ctx.globalAlpha = Math.min(1, t.life * 1.6);
    ctx.font = `900 ${t.size * (0.72 + t.life * 0.36)}px "Pretendard",system-ui,"Apple Color Emoji",sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeText(t.text, t.x, t.y - up);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y - up);
    ctx.globalAlpha = 1;
  }

  /* --- 색종이 --- */
  for (let i = confetti.length - 1; i >= 0; i--){
    const c = confetti[i];
    c.vy += 90 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
    if (c.y > H + 40){ confetti.splice(i, 1); continue; }
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.c; ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h); ctx.restore();
  }

  /* --- 쿠폰 만료 + 키오스크 자동 복귀 --- */
  if (state === S.RESULT){
    const ms = G.couponEnd - Date.now();
    if (ms > 0){
      const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
      el.rExpire.textContent = `${m}:${String(s).padStart(2,'0')}`;
    } else { el.rExpire.textContent = '만료'; el.coupon.classList.add('dead'); }
    if (performance.now() - G.idleAt > CONFIG.idleReturn * 1000){
      state = S.ATTRACT; show(el.scAttract); balloons.length = 0; seedAttract(); updateTicker();
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

['pointerdown','keydown'].forEach(t =>
  el.scResult.addEventListener(t, () => { G.idleAt = performance.now(); }, { passive:true }));
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden){
    if (music.mode === 'synth') { music.on = false; clearInterval(music.timer); music.beatQ.length = 0; }
    if (music.el && !music.el.paused) music.el.pause();
  } else if (state === S.PLAY){
    if (music.mode === 'file' && music.el) music.el.play().catch(()=>{});
    else if (music.mode === 'synth') synthStart();
  }
});
