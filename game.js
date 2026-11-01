(() => {
'use strict';

/* =====================================================================
   CONFIG  (sound files go in the SAME folder as index.html)
   horn1.mp3, funnyhorn1.mp3 ... funnyhorn30.mp3  (mp3 / wav / ogg / m4a)
   ===================================================================== */
const CONFIG = {
  AUDIO_EXTS: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
  HORN_NAMES: ['horn1', 'horn', 'horn 1', 'horn_1', 'Horn1', 'Horn', 'Horn 1'],
  FUNNY_PATTERNS: [
    n => 'funnyhorn' + n,
    n => 'funny horn ' + n,
    n => 'funny_horn_' + n,
    n => 'funnyhorn_' + n,
    n => 'funny-horn-' + n,
    n => 'Funny Horn ' + n,
    n => 'FunnyHorn' + n,
    n => 'Funny horn ' + n
  ],
  FUNNY_MAX: 60,        // scans funnyhorn1 ... funnyhorn60
  LOOP_FUNNY: false,    // true = funny music keeps looping until you press again
  VOL_HORN: 1.0,
  VOL_FUNNY: 0.9,
  // music that plays after a crash while the crowd comes (put crashmusic.mp3 in the same folder)
  CRASH_NAMES: ['crashmusic', 'crash', 'gameover', 'game over', 'crash music', 'crash_music', 'game_over', 'Crash', 'GameOver', 'Game Over'],
  VOL_CRASH: 0.9,
  LOOP_CRASH: true
};

/* ===================== basics ===================== */
const W = 480;
let H = 800, K = 1, PLAYER_SY = 550;
const ROAD_L = 112, ROAD_R = 368, SIDE_W = 16;
const LANE_X = [144, 208, 272, 336];
const SEG_LEN = 4500, PAIR = 360, LOT = 180;

const $ = s => document.querySelector(s);
const game = $('#game'), cv = $('#cv'), ctx = cv.getContext('2d');
const el = {
  road: $('#roadName'), gps: $('#gps'), score: $('#score'), best: $('#best'), speed: $('#speed'),
  hint: $('#hint'), toast: $('#toast'), start: $('#screenStart'), over: $('#screenOver'), pause: $('#screenPause'),
  goScore: $('#goScore'), goBest: $('#goBest'), goRoad: $('#goRoad'), goBadge: $('#goBadge'),
  startBest: $('#startBest'), mute: $('#btnMute'), pauseBtn: $('#btnPause'), dbg: $('#dbg')
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
const pad = n => String(n).padStart(5, '0');
function rnd(a, b = 0, c = 0) { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 1.234) * 43758.5453; return x - Math.floor(x); }
function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
const LS_KEY = 'crushErGoli.best';
function loadBest() { try { return parseInt(localStorage.getItem(LS_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest(v) { try { localStorage.setItem(LS_KEY, String(v)); } catch (e) {} }

/* ===================== areas (shown in GPS bar) ===================== */
const AREAS = [
  { name: 'Post Office Road',      ground: '#b9b19f', small: ['shop', 'shop', 'shop', 'grocery', 'tea', 'house'],            big: ['mall'],          bigP: .20 },
  { name: 'Huttala ', ground: '#a9b48c', small: ['house', 'shop', 'postoffice', 'tree', 'house', 'shop'],        big: ['school'],        bigP: .22 },
  { name: '60 Feet Road',     ground: '#b3ae9a', small: ['shop', 'grocery', 'house', 'shop', 'tree', 'grocery'],         big: ['mall', 'school'], bigP: .30 },
  { name: 'Nag Para',          ground: '#9fb386', small: ['banyan', 'tree', 'tea', 'shop', 'house', 'temple'],            big: ['school'],        bigP: .10 },
  { name: 'Jirat Bazar',          ground: '#97b27c', small: ['house', 'house', 'pond', 'tree', 'grocery', 'house'],          big: ['school'],        bigP: .12 },
  { name: 'Das Para',         ground: '#a2b183', small: ['house', 'temple', 'house', 'tree', 'shop', 'house'],           big: ['school'],        bigP: .14 },
  { name: 'Neplar Math',      ground: '#8fb56e', small: ['tree', 'house', 'pond', 'field', 'tree', 'field'],             big: ['field', 'field', 'school'], bigP: .35 }

];
const areaAt = z => AREAS[mod(Math.floor(z / SEG_LEN), AREAS.length)];

/* ===================== sound ===================== */
const SFX = {
  ctx: null, muted: false, hornUrl: null, crashUrl: null, crashAudio: null, funny: [], funnyAudio: null, lastFunny: -1,
  exts: CONFIG.AUDIO_EXTS.slice(),
  ac() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) { try { this.ctx = new C(); } catch (e) {} } }
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    return this.ctx;
  },
  probe(url) {
    return new Promise(res => {
      const a = new Audio(); let done = false;
      const fin = ok => {
        if (done) return; done = true; clearTimeout(t);
        a.onloadedmetadata = a.oncanplay = a.onerror = null;
        try { a.removeAttribute('src'); a.load(); } catch (e) {}
        res(ok);
      };
      const t = setTimeout(() => fin(false), 3000);
      a.preload = 'metadata';
      a.onloadedmetadata = () => fin(true);
      a.oncanplay = () => fin(true);
      a.onerror = () => fin(false);
      a.src = encodeURI(url);
    });
  },
  async findAny(base) {
    for (const ext of this.exts) {
      const url = base + '.' + ext;
      if (await this.probe(url)) { this.exts.splice(this.exts.indexOf(ext), 1); this.exts.unshift(ext); return url; }
    }
    return null;
  },
  async listRepo() {
    // On GitHub Pages (user.github.io/repo) read the repo's file list, so ANY horn / funny horn file name works.
    const host = location.hostname || '';
    if (!/\.github\.io$/i.test(host)) return false;
    const user = host.split('.')[0], repo = (location.pathname.split('/')[1] || '');
    const api = repo ? 'https://api.github.com/repos/' + user + '/' + repo + '/contents/'
                     : 'https://api.github.com/repos/' + user + '/' + host + '/contents/';
    const r = await fetch(api); if (!r.ok) return false;
    const files = (await r.json()).filter(f => f.type === 'file' && /\.(mp3|wav|ogg|m4a|aac)$/i.test(f.name));
    const num = nm => { const m = nm.match(/(\d+)/); return m ? parseInt(m[1], 10) : 9999; };
    const funny = files.filter(f => /^funny/i.test(f.name)).sort((a, b) => num(a.name) - num(b.name));
    const horns = files.filter(f => /^horn/i.test(f.name)).sort((a, b) => num(a.name) - num(b.name));
    funny.forEach((f, i) => this.funny.push({ n: num(f.name) === 9999 ? i + 1 : num(f.name), url: f.name }));
    if (horns.length) this.hornUrl = horns[0].name;
    const cr = files.filter(f => /^(crash|game[ _-]?over)/i.test(f.name));
    if (cr.length) this.crashUrl = cr[0].name;
    return funny.length > 0 || horns.length > 0;
  },
  async discover() {
    try {
      try { if (await this.listRepo()) { this.finishDiscover(); return; } } catch (e) {}
      for (const b of CONFIG.HORN_NAMES) { const u = await this.findAny(b); if (u) { this.hornUrl = u; break; } }
      for (const b of CONFIG.CRASH_NAMES) { const u = await this.findAny(b); if (u) { this.crashUrl = u; break; } }
      let pat = null;
      for (const p of CONFIG.FUNNY_PATTERNS) {
        for (const n of [1, 2]) { if (await this.findAny(p(n))) { pat = p; break; } }
        if (pat) break;
      }
      if (pat) {
        let miss = 0;
        for (let n = 1; n <= CONFIG.FUNNY_MAX && miss < 8; n++) {
          const u = await this.findAny(pat(n));
          if (u) { this.funny.push({ n, url: u }); miss = 0; } else miss++;
        }
      }
    } catch (e) {}
    this.finishDiscover();
  },
  finishDiscover() {
    if (el.dbg && /debug/.test(location.search)) {
      el.dbg.classList.remove('hidden');
      el.dbg.textContent = 'Horn: ' + (this.hornUrl || 'not found (using built-in beep)') + ' | Funny horns found: ' + this.funny.length + ' | Crash music: ' + (this.crashUrl || 'built-in jingle');
    }
  },
  play(url, vol, loop, onFail) {
    const a = new Audio(encodeURI(url));
    a.volume = vol; a.loop = !!loop;
    if (onFail) a.addEventListener('error', onFail);
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => {});
    return a;
  },
  horn() {
    if (this.muted) return;
    if (this.hornUrl) this.play(this.hornUrl, CONFIG.VOL_HORN, false, () => this.synthHorn());
    else this.synthHorn();
  },
  funnyHorn() {
    if (this.muted) return null;
    this.stopFunny();
    if (this.funny.length) {
      let pick;
      do { pick = this.funny[(Math.random() * this.funny.length) | 0]; } while (this.funny.length > 1 && pick.n === this.lastFunny);
      this.lastFunny = pick.n;
      this.funnyAudio = this.play(pick.url, CONFIG.VOL_FUNNY, CONFIG.LOOP_FUNNY);
      return 'Funny horn ' + pick.n;
    }
    this.synthFunny();
    return 'Funny horn';
  },
  stopFunny() { if (this.funnyAudio) { try { this.funnyAudio.pause(); } catch (e) {} this.funnyAudio = null; } },
  funnyPlaying() { const a = this.funnyAudio; return !!(a && !a.paused && !a.ended); },
  crashMusic() {
    if (this.muted) return;
    if (this.crashUrl) this.crashAudio = this.play(this.crashUrl, CONFIG.VOL_CRASH, CONFIG.LOOP_CRASH, () => this.synthCrash());
    else this.synthCrash();
  },
  stopCrash() { if (this.crashAudio) { try { this.crashAudio.pause(); } catch (e) {} this.crashAudio = null; } },
  synthCrash() {
    const mel = [392, 392, 440, 392, 523, 494, 392, 392, 440, 392, 587, 523];
    for (let r = 0; r < 2; r++) mel.forEach((f, i) => { this.tone('square', f, f, .4 + (r * 12 + i) * .2, .16, .08); if (i % 2 === 0) this.tone('triangle', 98, 98, .4 + (r * 12 + i) * .2, .15, .2); });
  },
  setMuted(m) { this.muted = m; if (m) { this.stopFunny(); this.stopCrash(); } },
  tone(type, f0, f1, t0, dur, vol) {
    const c = this.ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  synthHorn() { this.tone('square', 420, 420, 0, .32, .16); this.tone('square', 530, 530, 0, .32, .12); },
  synthFunny() {
    const k = (Math.random() * 4) | 0;
    if (k === 0) { this.tone('sine', 300, 1600, 0, .5, .3); this.tone('sine', 1600, 500, .5, .4, .3); }
    else if (k === 1) { this.tone('triangle', 180, 700, 0, .18, .35); this.tone('triangle', 700, 150, .18, .45, .35); }
    else if (k === 2) { for (let i = 0; i < 3; i++) this.tone('sawtooth', 360, 300, i * .22, .16, .18); }
    else { [[300, 0], [280, .3], [260, .6]].forEach(([f, t]) => this.tone('sawtooth', f, f * .98, t, .28, .16)); this.tone('sawtooth', 200, 140, .9, .7, .16); }
  },
  crash() {
    if (this.muted) return;
    const c = this.ac(); if (!c) return;
    const len = Math.floor(c.sampleRate * 0.5), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.value = .9;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    this.tone('sine', 140, 40, 0, .35, .5);
  }
};

/* ===================== scenery ===================== */
const roofCols = ['#b5533c', '#a24632', '#7f8b96', '#c46a45', '#8d6e5b', '#5f8190', '#b8895a'];
const awn = [['#e63946', '#ffffff'], ['#2a9d8f', '#ffffff'], ['#f4a261', '#ffffff'], ['#3a86ff', '#ffffff'], ['#8338ec', '#ffffff'], ['#f1c40f', '#ffffff']];
const GREENS = ['#2f6b3a', '#3f8a46', '#58a955'];

function sh(x, y, w, h, r = 3) { ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(x + 6, y + 6, w, h, r); ctx.fill(); }
function canopy(cx, cy, r, s, pal = GREENS) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(cx + 5, cy + 7, r, 0, 7); ctx.fill();
  ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = rnd(s, i) * 6.283, d = rnd(s, i + 9) * r * .5, rad = r * (.32 + rnd(s, i + 3) * .25);
    ctx.fillStyle = pal[1 + (i % 2)]; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d - 3, cy + Math.sin(a) * d - 3, rad, 0, 7); ctx.fill();
  }
}
function cow(x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(r);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(2, 3, 6, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(-2, 2, 3, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.ellipse(0, -13, 4, 4.5, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function block(x, y, w, h, roof, trim) {
  sh(x, y, w, h, 3);
  ctx.fillStyle = roof; rr(x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 3; rr(x + 1.5, y + 1.5, w - 3, h - 3, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + w * .5, y + 3, w * .5 - 3, h - 6);
}

const BUILD = {
  house(y0, h, s) {
    const w = 50 + rnd(s, 1) * 28, hh = h - 44 - rnd(s, 2) * 24, x = 14 + rnd(s, 3) * 8, y = y0 + 20 + rnd(s, 4) * (h - hh - 40);
    ctx.fillStyle = '#d6cdb8'; rr(4, y0 + 6, 88, h - 12, 4); ctx.fill();
    ctx.fillStyle = '#ebe4d5'; ctx.fillRect(2, y0 + 6, 3, h - 12);
    ctx.fillStyle = '#8a7f6c'; ctx.fillRect(1, y0 + h / 2 - 6, 5, 12);
    sh(x, y, w, hh, 3);
    ctx.fillStyle = roofCols[(rnd(s, 5) * roofCols.length) | 0]; rr(x, y, w, hh, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + w / 2, y, w / 2, hh);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + w / 2 - 1, y + 2, 2, hh - 4);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
    for (let yy = y + 8; yy < y + hh - 4; yy += 8) { ctx.beginPath(); ctx.moveTo(x + 2, yy); ctx.lineTo(x + w - 2, yy); ctx.stroke(); }
    if (rnd(s, 6) > .4) {
      ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(x + w * .3, y + hh * .3, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b525c'; ctx.beginPath(); ctx.arc(x + w * .3 - 1.5, y + hh * .3 - 1.5, 3, 0, 7); ctx.fill();
    }
    if (rnd(s, 7) > .55) canopy(80, y0 + h - 18, 11, s + 3);
  },
  shop(y0, h, s, pal = awn) {
    const x = 6, w = 84, y = y0 + 6, hh = h - 12;
    ctx.fillStyle = '#d9d3c6'; ctx.fillRect(0, y0 + 2, 96, h - 4);
    sh(x, y, w, hh, 2);
    ctx.fillStyle = '#cfc9bd'; rr(x, y, w, hh, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.fillRect(x + w * .5, y, w * .5, hh);
    ctx.strokeStyle = '#8f8a7f'; ctx.lineWidth = 2; rr(x + 1, y + 1, w - 2, hh - 2, 2); ctx.stroke();
    const units = 2 + ((rnd(s, 1) * 2) | 0), uh = hh / units;
    for (let i = 0; i < units; i++) {
      const yy = y + i * uh, c = pal[(rnd(s, 10 + i) * pal.length) | 0];
      for (let k = 0; k < uh - 4; k += 8) { ctx.fillStyle = ((k / 8) | 0) % 2 ? c[1] : c[0]; ctx.fillRect(-9, yy + 2 + k, 13, Math.min(8, uh - 4 - k)); }
      if (i > 0) { ctx.fillStyle = '#8f8a7f'; ctx.fillRect(x, yy - 1, w, 2); }
    }
    ctx.fillStyle = '#8c939c'; ctx.fillRect(x + w - 26, y + 8, 12, 9);
    ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(x + w - 20, y + hh - 18, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#4b525c'; ctx.beginPath(); ctx.arc(x + w - 22, y + hh - 20, 3, 0, 7); ctx.fill();
  },
  grocery(y0, h, s) {
    BUILD.shop(y0, h, s + 99, [['#2e9e4f', '#ffffff'], ['#f2b134', '#ffffff']]);
    const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5'], step = (h - 34) / 5;
    for (let i = 0; i < 6; i++) {
      const yy = y0 + 14 + i * step;
      ctx.fillStyle = cols[(rnd(s, 40 + i) * cols.length) | 0]; rr(-15, yy, 6, 10, 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-15, yy + 8, 6, 2);
    }
  },
  mall(y0, h, s) {
    ctx.fillStyle = '#e4e0d8'; ctx.fillRect(0, y0 + 4, 26, h - 8);
    for (let i = 0; i < 4; i++) canopy(10, y0 + 46 + i * 88, 9, s + i, ['#2f6b3a', '#4a9a4c', '#6bbd5e']);
    const x = 26, w = 66, y = y0 + 10, hh = h - 20;
    sh(x, y, w, hh, 6);
    ctx.fillStyle = '#cfd5dd'; rr(x, y, w, hh, 6); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#4f9fe0');
    ctx.fillStyle = g; rr(x + 8, y + 16, w - 24, hh - 32, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5;
    for (let yy = y + 16; yy < y + hh - 16; yy += 22) { ctx.beginPath(); ctx.moveTo(x + 8, yy); ctx.lineTo(x + w - 16, yy); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x + 8 + (w - 24) / 2, y + 16); ctx.lineTo(x + 8 + (w - 24) / 2, y + hh - 16); ctx.stroke();
    ctx.fillStyle = '#8c939c'; for (let i = 0; i < 4; i++) ctx.fillRect(x + w - 12, y + 24 + i * 70, 8, 12);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(x - 4, y0 + h / 2 - 28, 8, 56);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 3, y0 + h / 2 - 26, 2, 52);
  },
  school(y0, h, s) {
    ctx.fillStyle = '#d9d2bf'; rr(3, y0 + 8, 89, h - 16, 4); ctx.fill();
    ctx.fillStyle = '#78b45a'; rr(8, y0 + 48, 46, h - 96, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; rr(13, y0 + 56, 36, h - 112, 14); ctx.stroke();
    ctx.fillStyle = '#e8e1cf'; ctx.fillRect(0, y0 + 8, 4, h / 2 - 30); ctx.fillRect(0, y0 + h / 2 + 30, 4, h / 2 - 38);
    ctx.fillStyle = '#b5533c'; ctx.fillRect(-1, y0 + h / 2 - 32, 6, 6); ctx.fillRect(-1, y0 + h / 2 + 26, 6, 6);
    const roof = '#efdfae', trim = '#c1503c';
    block(54, y0 + 14, 36, h - 28, roof, trim);
    block(20, y0 + 14, 38, 28, roof, trim);
    block(20, y0 + h - 42, 38, 28, roof, trim);
    const fy = y0 + h / 2 - 14;
    ctx.fillStyle = '#6b6b6b'; ctx.fillRect(30, fy, 2, 20);
    ctx.fillStyle = '#ff9933'; ctx.fillRect(32, fy, 11, 2.4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(32, fy + 2.4, 11, 2.4);
    ctx.fillStyle = '#138808'; ctx.fillRect(32, fy + 4.8, 11, 2.4);
    const kc = ['#e63946', '#3a86ff', '#ffd166', '#06d6a0', '#ffffff', '#ff7a18'];
    for (let i = 0; i < 12; i++) { ctx.fillStyle = kc[(rnd(s, 20 + i) * kc.length) | 0]; ctx.beginPath(); ctx.arc(14 + rnd(s, 30 + i) * 34, y0 + 62 + rnd(s, 50 + i) * (h - 124), 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffc928'; rr(8, y0 + 52, 12, 26, 2); ctx.fill();
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(10, y0 + 56, 8, 3); ctx.fillRect(10, y0 + 63, 8, 3); ctx.fillRect(10, y0 + 70, 8, 3);
  },
  postoffice(y0, h, s) {
    ctx.fillStyle = '#d9d2bf'; rr(4, y0 + 6, 88, h - 12, 4); ctx.fill();
    sh(22, y0 + 24, 62, h - 56, 3);
    ctx.fillStyle = '#d6392f'; rr(22, y0 + 24, 62, h - 56, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(53, y0 + 24, 31, h - 56);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(52, y0 + 26, 2, h - 60);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(22, y0 + 24, 62, 4);
    ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(10, y0 + h - 22, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#7d0a1d'; ctx.beginPath(); ctx.arc(10, y0 + h - 22, 3.2, 0, 7); ctx.fill();
  },
  tea(y0, h, s) {
    ctx.fillStyle = '#c9b79a'; rr(4, y0 + 6, 88, h - 12, 6); ctx.fill();
    sh(36, y0 + 36, 44, h - 82, 3);
    ctx.fillStyle = '#7e8b97'; rr(36, y0 + 36, 44, h - 82, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let xx = 42; xx < 78; xx += 6) { ctx.beginPath(); ctx.moveTo(xx, y0 + 38); ctx.lineTo(xx, y0 + h - 48); ctx.stroke(); }
    ctx.fillStyle = '#8a5a2b'; rr(10, y0 + 46, 10, 34, 2); ctx.fill(); rr(10, y0 + 100, 10, 30, 2); ctx.fill();
    ctx.fillStyle = '#e76f51'; ctx.beginPath(); ctx.arc(15, y0 + 56, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#264653'; ctx.beginPath(); ctx.arc(15, y0 + 70, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#e9c46a'; ctx.beginPath(); ctx.arc(15, y0 + 112, 4, 0, 7); ctx.fill();
    canopy(76, y0 + h - 16, 11, s + 5);
  },
  tree(y0, h, s) {
    const n = 1 + ((rnd(s, 1) * 2) | 0);
    for (let i = 0; i < n; i++) canopy(20 + rnd(s, 2 + i) * 50, y0 + h * (n === 1 ? .5 : .28 + .44 * i), 19 + rnd(s, 5 + i) * 10, s + i);
  },
  banyan(y0, h, s) {
    ctx.fillStyle = '#cfc7b6'; ctx.beginPath(); ctx.arc(30, y0 + h / 2, 12, 0, 7); ctx.fill();
    canopy(26, y0 + h / 2, 38, s, ['#265d33', '#37803f', '#4d9e4c']);
    canopy(66, y0 + h * .28, 16, s + 4, ['#265d33', '#37803f', '#4d9e4c']);
  },
  temple(y0, h, s) {
    ctx.fillStyle = '#e9dfc9'; rr(4, y0 + 8, 88, h - 16, 6); ctx.fill();
    const cx = 52, cy = y0 + h / 2, cols = ['#e8590c', '#f08c00', '#f2b134', '#ffd166', '#ffe9a8'];
    sh(cx - 24, cy - 24, 48, 48, 2);
    for (let i = 0; i < 5; i++) { const sz = 48 - i * 9; ctx.fillStyle = cols[i]; ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz); }
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - 24, cy - 24); ctx.lineTo(cx + 24, cy + 24); ctx.moveTo(cx + 24, cy - 24); ctx.lineTo(cx - 24, cy + 24); ctx.stroke();
    ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#e63946';
    [[14, 16], [84, 16], [14, h - 16], [84, h - 16]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], y0 + p[1], 3, 0, 7); ctx.fill(); });
  },
  pond(y0, h, s) {
    const cy = y0 + h / 2;
    ctx.fillStyle = '#8a6d4b'; ctx.beginPath(); ctx.ellipse(48, cy, 42, h * .39, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3c91c6'; ctx.beginPath(); ctx.ellipse(48, cy, 36, h * .33, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(40, cy - 10, 20, h * .12, -.3, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#4c9a4a'; ctx.beginPath(); ctx.ellipse(28 + rnd(s, i) * 40, cy - h * .2 + rnd(s, i + 7) * h * .4, 5, 3.5, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.arc(52, cy + 6, 2.6, 0, 7); ctx.fill();
    canopy(82, y0 + 18, 12, s + 2);
  },
  field(y0, h, s) {
    if (h > LOT) {
      ctx.fillStyle = '#5aa347'; ctx.fillRect(0, y0, 98, h);
      for (let i = 0; i < h; i += 60) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(0, y0 + i, 98, 30); }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.strokeRect(6, y0 + 12, 84, h - 24);
      ctx.beginPath(); ctx.moveTo(6, y0 + h / 2); ctx.lineTo(90, y0 + h / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(48, y0 + h / 2, 16, 0, 7); ctx.stroke();
      ctx.strokeRect(24, y0 + 12, 48, 26); ctx.strokeRect(24, y0 + h - 38, 48, 26);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(38, y0 + 8, 20, 3); ctx.fillRect(38, y0 + h - 11, 20, 3);
      const pc = ['#e63946', '#3a86ff'];
      for (let i = 0; i < 10; i++) { ctx.fillStyle = pc[i % 2]; ctx.beginPath(); ctx.arc(14 + rnd(s, i) * 70, y0 + 50 + rnd(s, i + 11) * (h - 100), 3, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = '#79b45c'; ctx.fillRect(0, y0, 98, h);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < h; i += 40) ctx.fillRect(0, y0 + i, 98, 20);
      cow(30 + rnd(s, 1) * 20, y0 + 44, rnd(s, 2) * 6.28);
      cow(62 + rnd(s, 3) * 16, y0 + 112, rnd(s, 4) * 6.28);
      canopy(80, y0 + 24, 11, s + 6);
    }
  }
};

function drawPair(pi, side, area) {
  ctx.fillStyle = area.ground; ctx.fillRect(0, 0, 100, PAIR + 1);
  if (rnd(pi, side, 1) < area.bigP) {
    BUILD[area.big[(rnd(pi, side, 2) * area.big.length) | 0]](0, PAIR, pi * 7 + side);
    return;
  }
  for (let i = 0; i < 2; i++) BUILD[area.small[(rnd(pi, side, 3 + i) * area.small.length) | 0]](i * LOT, LOT, (pi * 2 + i) * 5 + side);
}

/* ===================== game state ===================== */
let mode = 'menu';             // menu | play | crash | over | paused
let best = loadBest(), newBest = false, finalScore = 0, crashedRoad = '';
let p, vehicles = [], particles = [], floaters = [], crowd = [], smokeT = 0;
let camZ = 0, maxZ = 0, shake = 0, flash = 0, crashT = 0, spawnT = 1.4, partyT = 0, tAcc = 0, lastSeg = null;
let shownScore = -1, shownSpeed = -1, vig = null, last = 0;
const input = { left: false, right: false, fwd: false, back: false };

const scr = z => PLAYER_SY - (z - camZ);
const difficulty = () => clamp(maxZ / 25000, 0, 1);

function reset() {
  p = { x: LANE_X[1], z: 0, speed: 0, vx: 0, w: 36, h: 66, tilt: 0, braking: false };
  vehicles = []; particles = []; floaters = []; crowd = []; smokeT = 0;
  camZ = 0; maxZ = 0; shake = 0; flash = 0; crashT = 0; spawnT = 1.4; partyT = 0; lastSeg = null;
  shownScore = -1; shownSpeed = -1;
  for (let z = 380; z <= PLAYER_SY + 120; z += 170) {
    const lanes = [0, 1, 2, 3].sort(() => Math.random() - .5), n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) spawnVehicle(lanes[i], z + (Math.random() - .5) * 60);
  }
  updateGPS(true); updateHUD();
}

const TYPE_SPEED = { car: [145, 215], taxi: [140, 205], bike: [170, 250], auto: [95, 140] };
const CAR_COLS = ['#2a9d8f', '#3a86ff', '#8338ec', '#e9ecef', '#adb5bd', '#ff7f11', '#2b4a6b', '#06b57f', '#c0392b', '#7a8b99'];
const SHIRTS = ['#e63946', '#3a86ff', '#ffd166', '#06d6a0', '#f1f1f1', '#ff7a18', '#8338ec'];

function spawnVehicle(lane, z) {
  const dir = lane < 2 ? 1 : -1, d = difficulty();
  for (const o of vehicles) if (o.lane === lane && Math.abs(o.z - z) < 240) return false;
  const inBand = new Set();
  for (const o of vehicles) if (Math.abs(o.z - z) < 170) inBand.add(o.lane);
  if (!inBand.has(lane) && inBand.size >= (d < .3 ? 2 : 3)) return false;
  const r = Math.random(), type = r < .40 ? 'car' : r < .62 ? 'taxi' : r < .90 ? 'bike' : 'auto';
  let w, h;
  if (type === 'bike') { w = 16; h = 42; }
  else if (type === 'auto') { w = 32; h = 52; }
  else { w = 36 + ((Math.random() * 5) | 0); h = 62 + ((Math.random() * 9) | 0); }
  const sp = TYPE_SPEED[type];
  let desired = lerp(sp[0], sp[1], Math.random()) * (1 + .22 * d);
  if (dir === -1) desired *= .78;
  const v = {
    type, lane, dir, w, h, z, x: LANE_X[lane] + (type === 'bike' ? (Math.random() - .5) * 28 : 0),
    desired, speed: desired, braking: false,
    color: type === 'taxi' ? '#f6c31a' : CAR_COLS[(Math.random() * CAR_COLS.length) | 0],
    c2: SHIRTS[(Math.random() * SHIRTS.length) | 0], c3: SHIRTS[(Math.random() * SHIRTS.length) | 0],
    helm: Math.random() < .5 ? '#1f1f24' : '#ffd166', pillion: Math.random() < .4
  };
  vehicles.push(v);
  return true;
}
function spawnWave() {
  const d = difficulty(), r = Math.random();
  const n = d < .3 ? (r < .7 ? 1 : 2) : (r < .35 ? 1 : r < .85 ? 2 : 3);
  const lanes = [0, 1, 2, 3].sort(() => Math.random() - .5);
  const z = p.z + PLAYER_SY + 130 + Math.random() * 50;
  let made = 0;
  for (const l of lanes) { if (made >= n) break; if (spawnVehicle(l, z + Math.random() * 30)) made++; }
}

function burst(x, z, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, sp = 60 + Math.random() * 220, spark = Math.random() < .55;
    particles.push({ x, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, life: .5 + Math.random() * .7, max: 1.2, size: spark ? 1.5 + Math.random() * 2.5 : 5 + Math.random() * 7, kind: spark ? 'spark' : 'smoke', color: ['#ffd166', '#ff7b00', '#ffffff'][(Math.random() * 3) | 0] });
  }
}
function stepParticles(dt) {
  for (const t of particles) { t.x += t.vx * dt; t.z += t.vz * dt; t.vx *= 1 - 1.6 * dt; t.vz *= 1 - 1.6 * dt; t.life -= dt; }
  particles = particles.filter(t => t.life > 0);
  for (const f of floaters) { if (f.type === 'wave') f.t += dt; else { f.y += f.vy * dt; f.life -= dt; } }
  floaters = floaters.filter(f => f.type === 'wave' ? f.t < .7 : f.life > 0);
}

function update(dt, demo) {
  if (mode === 'crash') {
    crashT += dt; shake = Math.max(0, shake - dt * 22); flash = Math.max(0, flash - dt * 2.5);
    stepParticles(dt);
    p.z += p.speed * dt; p.speed *= Math.max(0, 1 - 3 * dt);
    for (const v of vehicles) { v.z += v.dir * v.speed * dt; v.speed *= Math.max(0, 1 - 2.2 * dt); }
    stepCrowd(dt); smokeCar(dt);
    if (crashT > .7 && !crowd.length) spawnCrowd();
    if (crashT > 4.4) gameOver();
    return;
  }
  const d = difficulty(), maxV = 280 + 70 * d;
  if (demo) { p.speed = 80; p.vx = 0; p.tilt = 0; }
  else {
    const fwd = input.fwd, back = input.back;
    if (fwd && !back) { const acc = p.speed < 0 ? 340 : 190 * (1 - .55 * clamp(p.speed / maxV, 0, 1)); p.speed = Math.min(maxV, p.speed + acc * dt); }
    else if (back) { if (p.speed > 0) p.speed = Math.max(0, p.speed - 380 * dt); else p.speed = Math.max(-90, p.speed - 130 * dt); }
    else { if (p.speed > 0) p.speed = Math.max(0, p.speed - 55 * dt); else if (p.speed < 0) p.speed = Math.min(0, p.speed + 130 * dt); }
    p.braking = back && p.speed > 1;
    const dirIn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const eff = .45 + .55 * clamp(Math.abs(p.speed) / 150, 0, 1);
    p.vx += (dirIn * 230 * eff - p.vx) * Math.min(1, 11 * dt);
    p.x += p.vx * dt;
    const minX = ROAD_L + p.w / 2 + 2, maxX = ROAD_R - p.w / 2 - 2;
    if (p.x < minX || p.x > maxX) {
      const left = p.x < minX; p.x = left ? minX : maxX;
      if ((left && p.vx < 0) || (!left && p.vx > 0)) p.vx = 0;
      if (p.speed > 60) {
        p.speed = Math.max(0, p.speed - 40 * dt);
        if (Math.random() < .5) particles.push({ x: p.x + (left ? -p.w / 2 : p.w / 2), z: p.z + (Math.random() - .5) * 40, vx: (left ? 1 : -1) * 40, vz: -30 + Math.random() * 60, life: .3, max: .3, size: 2, kind: 'spark', color: '#ffd166' });
      }
    }
    p.tilt = clamp(p.vx / 230, -1, 1) * .16;
  }
  p.z += p.speed * dt;
  if (p.z > maxZ) maxZ = p.z;

  // traffic AI: stay in lane, keep a safe gap, never rear-end the player
  for (const v of vehicles) {
    let target = v.desired, gapMin = Infinity, leadSpeed = 0;
    for (const o of vehicles) {
      if (o === v || o.lane !== v.lane) continue;
      const g = v.dir === 1 ? o.z - v.z : v.z - o.z;
      if (g <= 0) continue;
      const gap = g - (o.h + v.h) / 2;
      if (gap < gapMin) { gapMin = gap; leadSpeed = o.speed; }
    }
    if (v.dir === 1 && p.z > v.z && Math.abs(p.x - v.x) < (p.w + v.w) / 2 + 6) {
      const gap = (p.z - v.z) - (p.h + v.h) / 2;
      if (gap < gapMin) { gapMin = gap; leadSpeed = Math.max(0, p.speed); }
    }
    if (gapMin < 34 + v.speed * .55) target = Math.min(target, leadSpeed * (gapMin < 14 ? .8 : 1));
    if (v.speed < target) v.speed = Math.min(target, v.speed + 110 * dt); else v.speed = Math.max(target, v.speed - 260 * dt);
    v.braking = v.speed > target + 8;
    v.z += v.dir * v.speed * dt;
  }

  // collisions
  if (!demo) {
    for (const v of vehicles) {
      if (Math.abs(v.x - p.x) < (p.w + v.w) * .5 * .86 && Math.abs(v.z - p.z) < (p.h + v.h) * .5 * .88) { crash(v); return; }
    }
  }

  // spawning (always beyond the top edge of the screen) and clean-up (always beyond the bottom/top edge)
  spawnT -= dt;
  if (spawnT <= 0) { spawnWave(); spawnT = lerp(1.7, .85, d) * (.8 + Math.random() * .4); }
  vehicles = vehicles.filter(v => v.z > p.z - 380 && v.z < p.z + PLAYER_SY + 900);

  partyT = Math.max(0, partyT - dt);
  stepParticles(dt);
  updateGPS(false); updateHUD();
}

const SKINS = ['#e0ac84', '#c68642', '#8d5524', '#f1c27d'];
function spawnCrowd() {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0, t = (Math.floor(i / 2) + .5) / (n / 2);
    const a = left ? Math.PI / 2 + t * Math.PI : -Math.PI / 2 + t * Math.PI;
    crowd.push({
      x: left ? -20 - Math.random() * 50 : W + 20 + Math.random() * 50, z: p.z + (Math.random() - .5) * 280,
      tx: p.x + Math.cos(a) * (p.w / 2 + 13), tz: p.z + Math.sin(a) * (p.h / 2 + 12),
      speed: 150 + Math.random() * 70, phase: Math.random() * 6, state: 'run', face: 0, hitT: Math.random() * .3,
      shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0], skin: SKINS[(Math.random() * SKINS.length) | 0]
    });
  }
}
function hitFx(c) {
  if (mode === 'crash') shake = Math.max(shake, 3);
  const words = ['POW!', 'BAM!', 'WHAM!', 'BONK!', 'THWACK!', 'OOF!'], cols = ['#ffd166', '#ff5d8f', '#7be0ff', '#ff9f1c'];
  floaters.push({ type: 'text', text: words[(Math.random() * words.length) | 0], x: (c.x - p.x) * .8, y: (p.z - c.z) * .8 - 10, vy: -34, life: .6, max: .6, size: 14 + Math.random() * 5, color: cols[(Math.random() * cols.length) | 0] });
  if (Math.random() < .2) floaters.push({ type: 'text', text: '\uD83D\uDE21', x: c.x - p.x, y: (p.z - c.z) - 22, vy: -30, life: .9, max: .9, size: 20 });
  for (let i = 0; i < 3; i++) particles.push({ x: (p.x + c.x) / 2, z: (p.z + c.z) / 2, vx: (Math.random() - .5) * 140, vz: (Math.random() - .5) * 140, life: .4, max: .4, size: 3, kind: 'spark', color: '#ffd166' });
}
function stepCrowd(dt) {
  for (const c of crowd) {
    c.phase += dt * (c.state === 'run' ? 16 : 22);
    if (c.state === 'run') {
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      c.face = Math.atan2(dx, dz);
      if (d < 4) c.state = 'hit';
      else { const m = Math.min(d, c.speed * dt); c.x += dx / d * m; c.z += dz / d * m; }
    } else {
      c.face = Math.atan2(p.x - c.x, p.z - c.z);
      c.hitT -= dt;
      if (c.hitT <= 0) { c.hitT = .28 + Math.random() * .3; hitFx(c); }
    }
  }
}
function smokeCar(dt) {
  smokeT -= dt;
  if (smokeT <= 0) { smokeT = .07; particles.push({ x: p.x + (Math.random() - .5) * 14, z: p.z + p.h / 2 - 2, vx: (Math.random() - .5) * 14, vz: 22 + Math.random() * 20, life: 1.1, max: 1.1, size: 5, kind: 'smoke', color: '#555' }); }
}
function crash(v) {
  mode = 'crash'; crashT = 0; shake = 12; flash = .55;
  burst((p.x + v.x) / 2, (p.z + v.z) / 2, 46);
  SFX.crash(); SFX.stopFunny(); SFX.crashMusic(); partyT = 0;
  p.speed *= .25; p.vx = 0; p.braking = false;
  for (const k in input) input[k] = false;
  document.querySelectorAll('.cb.on').forEach(b => b.classList.remove('on'));
  el.hint.classList.remove('show');
  finalScore = Math.floor(maxZ / 10);
  newBest = finalScore > best;
  if (newBest) { best = finalScore; saveBest(best); }
  crashedRoad = areaAt(p.z).name;
}
function gameOver() {
  mode = 'over';
  el.goScore.textContent = finalScore;
  el.goBest.textContent = best;
  el.goRoad.textContent = crashedRoad;
  el.goBadge.classList.toggle('hidden', !newBest);
  el.best.textContent = pad(best);
  el.over.classList.remove('hidden');
}

function updateGPS(force) {
  const idx = Math.floor(p.z / SEG_LEN);
  if (force || idx !== lastSeg) {
    lastSeg = idx;
    el.road.textContent = areaAt(idx * SEG_LEN + 1).name;
    el.gps.classList.remove('swap'); void el.gps.offsetWidth; el.gps.classList.add('swap');
  }
}
function updateHUD() {
  const sc = Math.floor(maxZ / 10);
  if (sc !== shownScore) { shownScore = sc; el.score.textContent = pad(sc); el.best.textContent = pad(Math.max(best, sc)); }
  const sp = Math.round(Math.abs(p.speed) * .28);
  if (sp !== shownSpeed) { shownSpeed = sp; el.speed.textContent = (p.speed < -1 ? 'R ' : '') + sp; }
  if (mode === 'play' && p.speed > 30) el.hint.classList.remove('show');
}

/* ===================== drawing: road & scenery ===================== */
function drawRoad() {
  const zTop = camZ + PLAYER_SY + 120, zBot = camZ - (H - PLAYER_SY) - 120;
  ctx.fillStyle = '#2f333a'; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
  ctx.fillStyle = 'rgba(0,0,0,.10)';
  for (const lx of LANE_X) { ctx.fillRect(lx - 18, 0, 9, H); ctx.fillRect(lx + 9, 0, 9, H); }
  for (let k = Math.floor(zBot / 220); k <= Math.floor(zTop / 220); k++) {
    if (rnd(k, 3) > .7) {
      const px = ROAD_L + 10 + rnd(k, 4) * (ROAD_R - ROAD_L - 90), pw = 30 + rnd(k, 5) * 40, ph = 40 + rnd(k, 6) * 50;
      ctx.fillStyle = 'rgba(15,17,21,.32)'; ctx.fillRect(px, scr(k * 220 + 110) - ph / 2, pw, ph);
    }
  }
  ctx.fillStyle = '#bdb7aa'; ctx.fillRect(ROAD_L - SIDE_W, 0, SIDE_W, H); ctx.fillRect(ROAD_R, 0, SIDE_W, H);
  ctx.fillStyle = 'rgba(0,0,0,.09)';
  for (let z = Math.floor(zBot / 24) * 24; z < zTop; z += 24) { const y = scr(z); ctx.fillRect(ROAD_L - SIDE_W, y, SIDE_W - 4, 1); ctx.fillRect(ROAD_R + 4, y, SIDE_W - 4, 1); }
  for (let k = Math.floor(zBot / 30); k <= Math.floor(zTop / 30); k++) {
    ctx.fillStyle = k % 2 ? '#f2c230' : '#2a2a2a';
    const y = scr(k * 30 + 30);
    ctx.fillRect(ROAD_L - 4, y, 4, 30); ctx.fillRect(ROAD_R, y, 4, 30);
  }
  ctx.fillStyle = '#eceae4'; ctx.fillRect(ROAD_L + 4, 0, 3, H); ctx.fillRect(ROAD_R - 7, 0, 3, H);
  ctx.fillStyle = '#f4c430'; ctx.fillRect(237, 0, 2.5, H); ctx.fillRect(241, 0, 2.5, H);
  ctx.fillStyle = 'rgba(236,234,228,.9)';
  for (let k = Math.floor(zBot / 68) - 1; k <= Math.floor(zTop / 68); k++) {
    const y = scr(k * 68 + 34);
    ctx.fillRect(174.5, y, 3, 34); ctx.fillRect(302.5, y, 3, 34);
  }
  for (let k = Math.floor((zBot - 800) / 1500); k <= Math.floor((zTop - 800) / 1500); k++) {
    const zc = k * 1500 + 800;
    ctx.fillStyle = 'rgba(236,234,228,.82)';
    for (let x = ROAD_L + 12; x < ROAD_R - 20; x += 20) ctx.fillRect(x, scr(zc + 22), 11, 44);
  }
}
function drawSides() {
  const zTop = camZ + PLAYER_SY + 120, zBot = camZ - (H - PLAYER_SY) - 120;
  for (let pi = Math.floor(zBot / PAIR); pi <= Math.floor(zTop / PAIR); pi++) {
    const top = Math.round(scr(pi * PAIR + PAIR)), area = areaAt(pi * PAIR + PAIR / 2);
    for (let side = 0; side < 2; side++) {
      ctx.save();
      if (side === 0) { ctx.translate(ROAD_L - SIDE_W, top); ctx.scale(-1, 1); } else ctx.translate(ROAD_R + SIDE_W, top);
      drawPair(pi, side, area);
      ctx.restore();
    }
  }
}
function drawPoleBases() {
  const zTop = camZ + PLAYER_SY + 120, zBot = camZ - (H - PLAYER_SY) - 120;
  for (let k = Math.floor(zBot / 240); k <= Math.floor(zTop / 240); k++) {
    [[104, k * 240 + 60], [376, k * 240 + 180]].forEach(q => {
      const y = scr(q[1]);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(q[0] + 2, y + 2, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#4a4f58'; ctx.beginPath(); ctx.arc(q[0], y, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(q[0] - 5, y - 1, 10, 2);
    });
  }
}
function drawStreetLights() {
  const zTop = camZ + PLAYER_SY + 120, zBot = camZ - (H - PLAYER_SY) - 120;
  for (let k = Math.floor(zBot / 480); k <= Math.floor(zTop / 480); k++) {
    [[104, 136, k * 480 + 100], [376, 344, k * 480 + 340]].forEach(q => {
      const y = scr(q[2]);
      ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q[0], y); ctx.lineTo(q[1], y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,200,.16)'; ctx.beginPath(); ctx.arc(q[1], y, 17, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff4c4'; ctx.beginPath(); ctx.arc(q[1], y, 4, 0, 7); ctx.fill();
    });
  }
}

/* ===================== drawing: vehicles ===================== */
function drawCar(v) {
  const w = v.w, h = v.h, hw = w / 2, hh = h / 2, c = v.color;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(-hw + 3, -hh + 5, w, h, 10); ctx.fill();
  ctx.fillStyle = '#111'; [[-hw - 1.5, -hh + 11], [hw - 1.5, -hh + 11], [-hw - 1.5, hh - 21], [hw - 1.5, hh - 21]].forEach(q => ctx.fillRect(q[0], q[1], 3, 10));
  const g = ctx.createLinearGradient(-hw, 0, hw, 0);
  g.addColorStop(0, shade(c, -32)); g.addColorStop(.5, shade(c, 14)); g.addColorStop(1, shade(c, -38));
  ctx.fillStyle = g; rr(-hw, -hh, w, h, 10); ctx.fill();
  if (v.type === 'player') { ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(-5.5, -hh + 3, 3.4, h - 6); ctx.fillRect(2.1, -hh + 3, 3.4, h - 6); }
  ctx.fillStyle = '#1b2733';
  ctx.beginPath(); ctx.moveTo(-hw * .78, -h * .17); ctx.lineTo(hw * .78, -h * .17); ctx.lineTo(hw * .66, -h * .02); ctx.lineTo(-hw * .66, -h * .02); ctx.closePath(); ctx.fill();
  ctx.fillStyle = v.type === 'player' ? '#ff5d8f' : shade(c, 22); rr(-hw * .66, -h * .02, hw * 1.32, h * .30, 5); ctx.fill();
  ctx.fillStyle = '#1b2733';
  ctx.beginPath(); ctx.moveTo(-hw * .66, h * .28); ctx.lineTo(hw * .66, h * .28); ctx.lineTo(hw * .78, h * .38); ctx.lineTo(-hw * .78, h * .38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath(); ctx.moveTo(-hw * .55, -h * .16); ctx.lineTo(-hw * .08, -h * .16); ctx.lineTo(-hw * .22, -h * .03); ctx.lineTo(-hw * .58, -h * .03); ctx.closePath(); ctx.fill();
  if (v.type === 'player') {
    ctx.fillStyle = '#fff'; const s = 5.2, cx = 0, cy = h * .12;
    ctx.beginPath(); ctx.moveTo(cx, cy + s * .9);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * .2, cx - s * .9, cy - s * 1.2, cx, cy - s * .4);
    ctx.bezierCurveTo(cx + s * .9, cy - s * 1.2, cx + s * 1.6, cy - s * .2, cx, cy + s * .9); ctx.fill();
  }
  if (v.type === 'taxi') {
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-hw * .62, h * .26 - 1, hw * 1.24, 2);
    ctx.fillStyle = '#fff'; rr(-7, h * .06, 14, 7, 2); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-7, h * .06 + 3, 14, 1.2);
  }
  ctx.fillStyle = shade(c, -20); ctx.fillRect(-hw - 3, -h * .14, 3, 6); ctx.fillRect(hw, -h * .14, 3, 6);
  ctx.fillStyle = '#fff6c8'; rr(-hw + 3, -hh + 1.5, 8, 4, 2); ctx.fill(); rr(hw - 11, -hh + 1.5, 8, 4, 2); ctx.fill();
  if (v.braking) { ctx.fillStyle = 'rgba(255,40,40,.28)'; ctx.fillRect(-hw, hh, w, 9); }
  ctx.fillStyle = v.braking ? '#ff2a2a' : '#a3151c'; rr(-hw + 2, hh - 5, 9, 3.5, 1.5); ctx.fill(); rr(hw - 11, hh - 5, 9, 3.5, 1.5); ctx.fill();
}
function drawBike(v) {
  const h = v.h;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(-4, -h / 2 + 5, 10, h, 4); ctx.fill();
  ctx.fillStyle = '#15171b'; rr(-2.2, -h / 2, 4.4, 12, 2); ctx.fill(); rr(-2.8, h / 2 - 14, 5.6, 14, 2); ctx.fill();
  ctx.fillStyle = v.c3; rr(-4, -h / 2 + 10, 8, h - 22, 4); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(-8, -h / 2 + 11, 16, 2.2);
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(-1.5, -h / 2 + 1, 3, 2);
  ctx.fillStyle = v.braking ? '#ff2a2a' : '#a3151c'; ctx.fillRect(-1.5, h / 2 - 2, 3, 2);
  if (v.pillion) { ctx.fillStyle = v.c3; ctx.beginPath(); ctx.ellipse(0, 11, 6.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(0, 10, 3.3, 0, 7); ctx.fill(); }
  ctx.strokeStyle = v.c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(-7, -h / 2 + 12); ctx.moveTo(5, -4); ctx.lineTo(7, -h / 2 + 12); ctx.stroke();
  ctx.fillStyle = v.c2; ctx.beginPath(); ctx.ellipse(0, -2, 7, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = v.helm; ctx.beginPath(); ctx.arc(0, -3, 3.8, 0, 7); ctx.fill();
}
function drawAuto(v) {
  const w = v.w, h = v.h, hw = w / 2, hh = h / 2;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(-hw + 3, -hh + 5, w, h, 8); ctx.fill();
  ctx.fillStyle = '#111'; rr(-2, -hh, 4, 10, 2); ctx.fill(); rr(-hw - 1, hh - 16, 3, 11, 1); ctx.fill(); rr(hw - 2, hh - 16, 3, 11, 1); ctx.fill();
  ctx.fillStyle = '#2e7d32'; rr(-hw + 1, -hh + 6, w - 2, h - 6, 8); ctx.fill();
  ctx.fillStyle = '#ffd23f'; rr(-hw + 2, -hh + 15, w - 4, h - 25, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-hw + 2, -hh + 15 + (h - 25) / 2, w - 4, 1.5);
  ctx.fillStyle = '#1b2733'; rr(-hw + 5, -hh + 9, w - 10, 6, 2); ctx.fill();
  ctx.fillStyle = '#fff6c8'; rr(-3, -hh + 1, 6, 4, 2); ctx.fill();
  if (v.braking) { ctx.fillStyle = 'rgba(255,40,40,.28)'; ctx.fillRect(-hw, hh, w, 8); }
  ctx.fillStyle = v.braking ? '#ff2a2a' : '#a3151c'; ctx.fillRect(-hw + 3, hh - 4, 6, 3); ctx.fillRect(hw - 9, hh - 4, 6, 3);
}
function drawVehicle(v) {
  const y = scr(v.z);
  if (y < -100 || y > H + 100) return;
  ctx.save(); ctx.translate(v.x, y);
  ctx.rotate((v.dir === -1 ? Math.PI : 0) + (v.tilt || 0));
  if (v.type === 'bike') drawBike(v); else if (v.type === 'auto') drawAuto(v); else drawCar(v);
  ctx.restore();
}

function drawPerson(c) {
  const y = scr(c.z);
  if (y < -40 || y > H + 40) return;
  ctx.save(); ctx.translate(c.x, y); ctx.rotate(c.face);
  const s = Math.sin(c.phase), hit = c.state === 'hit';
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 3, 8, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2f3a';
  if (!hit) { ctx.beginPath(); ctx.ellipse(-2.5, s * 4, 2, 3.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(2.5, -s * 4, 2, 3.5, 0, 0, 7); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(-3, 3, 2.2, 3.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(3, 3, 2.2, 3.5, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = c.skin; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  if (hit) {
    ctx.moveTo(-6, -1); ctx.lineTo(-3 + s * 2, -11 + Math.sin(c.phase * 1.3) * 4);
    ctx.moveTo(6, -1); ctx.lineTo(3 - s * 2, -11 - Math.sin(c.phase * 1.3) * 4);
  } else {
    ctx.moveTo(-6, 0); ctx.lineTo(-7, -s * 5); ctx.moveTo(6, 0); ctx.lineTo(7, s * 5);
  }
  ctx.stroke();
  ctx.fillStyle = c.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(0, 1, 3.9, 0, 7); ctx.fill();
  ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(0, -.6, 3.4, 0, 7); ctx.fill();
  ctx.restore();
}
function drawEffects() {
  if (crowd.length) {
    const py0 = scr(p.z);
    ctx.fillStyle = '#ffd166'; ctx.font = '700 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) { const a = tAcc * 4 + i * 2.09; ctx.fillText('\u2605', p.x + Math.cos(a) * 20, py0 + Math.sin(a) * 9); }
  }
  for (const t of particles) {
    const a = clamp(t.life / t.max, 0, 1), y = scr(t.z);
    if (t.kind === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = t.color; ctx.fillRect(t.x - t.size / 2, y - t.size / 2, t.size, t.size); }
    else { ctx.globalAlpha = a * .5; ctx.fillStyle = '#55585e'; ctx.beginPath(); ctx.arc(t.x, y, t.size * (1 + (1 - a) * 1.6), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  const py = scr(p.z);
  for (const f of floaters) {
    if (f.type === 'wave') {
      const t = f.t / .7;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - t) * .9 + ')'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(p.x, py - 30, 14 + t * 60 + i * 14, -2.2, -.94); ctx.stroke(); }
    } else {
      ctx.globalAlpha = clamp(f.life / f.max * 1.6, 0, 1);
      ctx.font = '800 ' + f.size + 'px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (f.color) { ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(f.text, p.x + (f.x || 0), py + f.y); ctx.fillStyle = f.color; }
      ctx.fillText(f.text, p.x + (f.x || 0), py + f.y);
      ctx.globalAlpha = 1;
    }
  }
}

function draw() {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.fillStyle = '#4a5040'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (shake > .1) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  camZ = p.z;
  drawRoad(); drawSides(); drawPoleBases();
  for (const v of vehicles) drawVehicle(v);
  drawVehicle({ type: 'player', x: p.x, z: p.z, w: p.w, h: p.h, dir: 1, color: '#ff2e63', braking: p.braking, tilt: p.tilt });
  for (const c of crowd) drawPerson(c);
  drawEffects();
  drawStreetLights();
  ctx.restore();
  if (vig) { ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H); }
  if (partyT > 0 || SFX.funnyPlaying()) { ctx.fillStyle = 'hsla(' + ((tAcc * 140) % 360) + ',95%,60%,.10)'; ctx.fillRect(0, 0, W, H); }
  if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ===================== flow ===================== */
function startGame() {
  if (mode === 'play' || mode === 'crash') return;
  SFX.ac(); SFX.stopFunny(); SFX.stopCrash();
  reset(); mode = 'play';
  el.start.classList.add('hidden'); el.over.classList.add('hidden'); el.pause.classList.add('hidden');
  el.hint.classList.add('show');
}
function togglePause() {
  if (mode === 'play') {
    mode = 'paused'; el.pause.classList.remove('hidden');
    for (const k in input) input[k] = false;
    document.querySelectorAll('.cb.on').forEach(b => b.classList.remove('on'));
    if (SFX.funnyAudio) { try { SFX.funnyAudio.pause(); } catch (e) {} }
  } else if (mode === 'paused') {
    mode = 'play'; el.pause.classList.add('hidden'); last = performance.now();
    if (SFX.funnyAudio && !SFX.funnyAudio.ended && !SFX.muted) { try { SFX.funnyAudio.play(); } catch (e) {} }
  }
}
function showToast(msg) {
  el.toast.textContent = msg; el.toast.classList.add('show');
  clearTimeout(showToast.t); showToast.t = setTimeout(() => el.toast.classList.remove('show'), 1700);
}
function doHorn() {
  if (mode !== 'play') return;
  SFX.horn();
  floaters.push({ type: 'wave', t: 0 });
  floaters.push({ type: 'text', text: 'BEEP!', x: 0, y: -66, vy: -26, life: .8, max: .8, color: '#ffd166', size: 17 });
}
function doFunny() {
  if (mode !== 'play') return;
  const label = SFX.funnyHorn();
  if (label === null) return;
  partyT = 3; showToast('\u266A ' + label);
  const em = ['\uD83D\uDE02', '\uD83E\uDD23', '\uD83E\uDD2A', '\uD83D\uDE1C', '\uD83E\uDD73', '\uD83D\uDE0E', '\uD83C\uDF89', '\uD83D\uDC83', '\uD83D\uDD7A', '\uD83E\uDD21'];
  for (let i = 0; i < 6; i++) floaters.push({ type: 'text', text: em[(Math.random() * em.length) | 0], x: (Math.random() - .5) * 80, y: -40 - Math.random() * 20, vy: -(40 + Math.random() * 50), life: 1.4, max: 1.4, size: 22 + Math.random() * 10 });
}
function toggleMute() { SFX.setMuted(!SFX.muted); el.mute.classList.toggle('muted', SFX.muted); }

/* ===================== input ===================== */
function bindHold(id, key) {
  const b = $(id);
  const on = e => { e.preventDefault(); input[key] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { input[key] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
function bindTap(id, fn) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); fn(); });
  const off = () => b.classList.remove('on');
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
bindHold('#bL', 'left'); bindHold('#bR', 'right'); bindHold('#bF', 'fwd'); bindHold('#bB', 'back');
bindTap('#bH', doHorn); bindTap('#bFH', doFunny);
cv.addEventListener('pointerdown', () => { if (mode === 'crash' && crashT > 1.5) gameOver(); });
$('#btnStart').addEventListener('click', startGame);
$('#btnAgain').addEventListener('click', startGame);
$('#btnResume').addEventListener('click', togglePause);
el.pauseBtn.addEventListener('click', togglePause);
el.mute.addEventListener('click', toggleMute);

const KEYMAP = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'left', KeyD: 'right' };
const KEYBTN = { fwd: '#bF', back: '#bB', left: '#bL', right: '#bR' };
function setBtn(k, on) { const b = $(KEYBTN[k]); if (b) b.classList.toggle('on', on); }
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k) { input[k] = true; setBtn(k, true); e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'Enter') { e.preventDefault(); if (mode === 'menu' || mode === 'over') startGame(); else if (mode === 'paused') togglePause(); }
  else if (e.code === 'KeyH' || e.code === 'Space') { e.preventDefault(); if (mode === 'menu' || mode === 'over') startGame(); else doHorn(); }
  else if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); doFunny(); }
  else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); }
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { input[k] = false; setBtn(k, false); } });
window.addEventListener('blur', () => { for (const k in input) input[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });
document.addEventListener('contextmenu', e => e.preventDefault());

/* ===================== resize + loop ===================== */
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  let s = vw / W, h = vh / s;
  if (h > 1000) h = 1000; else if (h < 720) { h = 720; s = Math.min(vw / W, vh / h); }
  H = Math.round(h); PLAYER_SY = H - 250;
  game.style.width = (W * s) + 'px'; game.style.height = (H * s) + 'px';
  game.style.setProperty('--u', s + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  K = s * dpr;
  vig = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .8);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.38)');
}
window.addEventListener('resize', resize);

function frame(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; tAcc += dt;
  if (mode === 'play' || mode === 'crash') update(dt, false);
  else if (mode === 'menu') update(dt, true);
  else if (mode === 'over') { stepParticles(dt); stepCrowd(dt); smokeCar(dt); shake = 0; flash = 0; }
  draw();
  requestAnimationFrame(frame);
}

resize();
reset();
el.startBest.textContent = pad(best);
el.best.textContent = pad(best);
SFX.discover();
requestAnimationFrame(frame);
})();
