// 예산과 함께하는 엔트리봇 무한의 계단 — 제작: myoLab(산쌤)
import { CONFIG as C } from './config.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const FONT = '"Galmuri11", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const clock = () => performance.now() / 1000;

// ------------------------------------------------------------
// 화면 크기
// ------------------------------------------------------------
let dpr = 1, k = 1, VW = 720, VH = 1280, GW = 720, GX = 0;
let topShade = null;
const blockCache = [];

function resize() {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  k = canvas.height / C.VIEW_H;
  VW = canvas.width / k;
  VH = C.VIEW_H;
  if (VW < C.VIEW_W_MIN) { // 아주 길쭉한 화면
    k = canvas.width / C.VIEW_W_MIN;
    VW = C.VIEW_W_MIN;
    VH = canvas.height / k;
  }
  GW = Math.min(VW, C.VIEW_W_MAX);
  GX = (VW - GW) / 2;
  topShade = null;
  buildBlocks();
}

// ------------------------------------------------------------
// 에셋 불러오기 (게임 시작 전에 전부)
// ------------------------------------------------------------
const IMG = { bg: [], bot: {}, fire: [], letters: [], lettersDim: [] };
const BOT_FRAMES = ['idle1', 'idle2', 'climb1', 'climb2', 'fall1', 'fall2', 'boost1', 'boost2', 'happy'];
let loaded = 0, total = 0, ready = false;

function loadImage(src) {
  total++;
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = async () => {
      try { if (im.decode) await im.decode(); } catch (e) {}
      loaded++; resolve(im);
    };
    im.onerror = () => { loaded++; resolve(null); };
    im.src = src;
  });
}

async function loadAll() {
  const jobs = [];
  C.STAGES.forEach((s, i) => jobs.push(loadImage(s.img).then((im) => { IMG.bg[i] = im; })));
  BOT_FRAMES.forEach((f) => jobs.push(loadImage(`assets/bot_${f}.webp`).then((im) => { IMG.bot[f] = im; })));
  [1, 2, 3, 4].forEach((n, i) => jobs.push(loadImage(`assets/fx_fire${n}.webp`).then((im) => { IMG.fire[i] = im; })));
  if (C.USE_LETTER_IMAGES) C.WORD.forEach((_, i) => {
    jobs.push(loadImage(`assets/letter_${i + 1}.webp`).then((im) => { IMG.letters[i] = im; }));
    jobs.push(loadImage(`assets/letter_${i + 1}_dim.webp`).then((im) => { IMG.lettersDim[i] = im; }));
  });
  const fontJob = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load(`700 40px Galmuri11`), document.fonts.load(`400 40px Galmuri11`)]).catch(() => {})
    : Promise.resolve();
  await Promise.all([...jobs, fontJob]);
  ready = true;
}

// ------------------------------------------------------------
// 코딩블록 계단 그림 (색별로 한 번만 그려 두고 재사용)
// ------------------------------------------------------------
const ICONS = {
  play: ['X......', 'XXX....', 'XXXXX..', 'XXXXXXX', 'XXXXX..', 'XXX....', 'X......'],
  arrow: ['...X...', '...XX..', 'XXXXXX.', 'XXXXXXX', 'XXXXXX.', '...XX..', '...X...'],
  talk: ['XXXXXXX', 'X.....X', 'X.X.X.X', 'X.....X', 'XXXXXXX', '.XX....', '.X.....'],
  loop: ['..XXX..', '.X...X.', 'X.....X', 'X...XXX', 'X....X.', '.X.....', '..XXX..'],
};

function buildBlocks() {
  blockCache.length = 0;
  const pw = 32, ph = 14;
  const OUT = '#1b2246';
  for (const col of C.BLOCK_COLORS) {
    const s = document.createElement('canvas');
    s.width = pw; s.height = ph;
    const g = s.getContext('2d');
    g.fillStyle = OUT; g.fillRect(0, 0, 32, 13);
    g.fillStyle = col.top; g.fillRect(1, 1, 30, 8);
    g.fillStyle = col.side; g.fillRect(1, 9, 30, 3);
    // 위쪽 홈
    g.clearRect(7, 0, 4, 1);
    g.fillStyle = OUT; g.fillRect(7, 1, 4, 1);
    // 아래쪽 돌기
    g.fillStyle = OUT; g.fillRect(6, 12, 6, 2);
    g.fillStyle = col.side; g.fillRect(7, 12, 4, 1);
    // 하이라이트
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(1, 1, 6, 1); g.fillRect(11, 1, 20, 1);
    // 아이콘 + 글자 막대
    g.fillStyle = '#ffffff';
    ICONS[col.icon].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === 'X') g.fillRect(12 + x, 2 + y, 1, 1);
    });
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(21, 4, 8, 2);
    g.fillRect(21, 7, 5, 1);
    // 모서리 둥글게
    g.clearRect(0, 0, 1, 1); g.clearRect(31, 0, 1, 1);
    g.clearRect(0, 12, 1, 1); g.clearRect(31, 12, 1, 1);

    // 실제 화면 해상도로 한 번 확대해 둔다
    const big = document.createElement('canvas');
    big.width = Math.max(1, Math.round(C.BLOCK_W * k));
    big.height = Math.max(1, Math.round(C.BLOCK_H * k));
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(s, 0, 0, big.width, big.height);
    blockCache.push(big);
  }
}

// ------------------------------------------------------------
// 게임 상태
// ------------------------------------------------------------
let state = 'loading'; // loading | title | ready | play | paused | falling | over
let pausedFrom = 'play';
let stairs = [];
let lastDir = 1, runLen = 0, straightUntil = 0;
let collected = [], gotCount = 0, roundStart = 0, nextLetterAt = 0, letterFx = []; // 모은 글자, 이번 판 시작 계단, 다음 글자가 놓일 계단
let n = 0, facing = 1, score = 0;
let gauge = C.GAUGE_MAX;
let boostGauge = 0, boostActive = false, boostTime = 0, boostAcc = 0, boostStartAt = -10;
let lastStepAt = -10, stepCount = 0;
let rx = 0, ry = 0, camX = 0, camY = 0; // 보이는 위치 (부드럽게 따라감)
let fallT = 0, fallDir = 0, fallX = 0, fallY = 0;
let overAt = 0, newRecord = false;
let stageIdx = 0, prevStageIdx = 0, stageFade = 1, bannerAt = -10;
let shake = 0;
let trail = [];
let pressAt = { turn: -10, climb: -10, boost: -10 };
let best = 0;
try { best = parseInt(localStorage.getItem(C.BEST_KEY) || '0', 10) || 0; } catch (e) {}

function saveBest() { try { localStorage.setItem(C.BEST_KEY, String(best)); } catch (e) {} }

function genStairs(upto) {
  while (stairs.length <= upto) {
    const i = stairs.length;
    if (i === 0) { stairs.push({ x: 0, c: 0, letter: -1 }); lastDir = 1; runLen = 0; continue; }
    let dir = lastDir;
    if (i > C.START_STRAIGHT && i > straightUntil) {
      if (runLen >= C.MAX_RUN || Math.random() < C.TURN_CHANCE) dir = -dir;
    }
    if (dir === lastDir) runLen++; else runLen = 1;
    lastDir = dir;
    const prev = stairs[i - 1];
    let letter = -1;
    if (i > straightUntil && i >= nextLetterAt) {
      nextLetterAt = i + randInt(C.LETTER_GAP_MIN, C.LETTER_GAP_MAX);
      letter = pickLetter(i);
    }
    stairs.push({ x: prev.x + dir, c: (Math.random() * C.BLOCK_COLORS.length) | 0, letter });
  }
}

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

// 다음에 놓을 글자: 기본은 8글자 중 무작위(중복 가능).
// 목표 계단 수보다 늦어지면 아직 못 모은 글자가 나올 확률을 높여 대부분 100~150계단 안에 다 모이게 한다.
function pickLetter(i) {
  const missing = [];
  for (let k = 0; k < C.WORD.length; k++) if (!collected[k]) missing.push(k);
  const q = Math.min(1, Math.max(0, C.LETTER_HELP + (i - roundStart) / C.LETTER_TARGET - gotCount / C.WORD.length));
  if (missing.length && Math.random() < q) return missing[randInt(0, missing.length - 1)];
  return randInt(0, C.WORD.length - 1);
}

function newLetterRound(from) {
  collected = C.WORD.map(() => false);
  gotCount = 0;
  roundStart = from;
  nextLetterAt = from + randInt(C.LETTER_GAP_MIN, C.LETTER_GAP_MAX);
}

function resetGame() {
  stairs = []; straightUntil = 0; newLetterRound(C.LETTER_FROM - C.LETTER_GAP_MIN); genStairs(40);
  n = 0; score = 0; facing = 1;
  gauge = C.GAUGE_MAX;
  boostGauge = 0; boostActive = false; boostTime = 0; boostAcc = 0; boostStartAt = -10;
  lastStepAt = -10; stepCount = 0;
  rx = 0; ry = 0; camX = 0; camY = 0;
  fallT = 0; newRecord = false;
  stageIdx = 0; prevStageIdx = 0; stageFade = 1; bannerAt = clock();
  shake = 0; trail = []; letterFx = [];
  state = 'ready';
}

function drainRate(s) {
  let r = C.DRAIN_TABLE[0][1];
  for (const [from, v] of C.DRAIN_TABLE) if (s >= from) r = v;
  const last = C.DRAIN_TABLE[C.DRAIN_TABLE.length - 1][0];
  if (s >= last + 100) r += Math.floor((s - last) / 100) * C.DRAIN_AFTER_300_PER_100;
  return Math.min(r, C.DRAIN_MAX);
}

// ------------------------------------------------------------
// 조작
// ------------------------------------------------------------
function doAction(type) {
  if (state === 'ready') state = 'play';
  if (state !== 'play') return;
  pressAt[type] = clock();
  if (boostActive) { facing = stairs[n + 1].x - stairs[n].x; step(true); return; } // 부스터 중: 아무 버튼이나 누르면 일직선으로 오름
  if (type === 'turn') facing = -facing;
  const dir = stairs[n + 1].x - stairs[n].x;
  if (dir === facing) step(false);
  else fail(facing);
}

function step(auto) {
  const now = clock();
  n++; score = n;
  genStairs(n + 30);
  stepCount++;
  gauge = Math.min(C.GAUGE_MAX, gauge + C.GAUGE_PER_STEP);
  const st = stairs[n];
  let gotAll = false;
  if (st.letter >= 0) {
    const li = st.letter;
    st.letter = -1;
    if (!collected[li] && !boostActive) {
      // 새 글자: 위쪽 칸이 밝아짐
      collected[li] = true;
      gotCount++;
      boostGauge = 100 * gotCount / C.WORD.length;
      letterFx.push({ i: li, x: st.x, y: n, t: now });
      if (letterFx.length > 6) letterFx.shift();
      sfx.coin();
      gotAll = gotCount >= C.WORD.length;
    } else {
      sfx.step(); // 이미 모은 글자: 아무 일도 없음
    }
  } else {
    sfx.step();
  }
  lastStepAt = now;
  const si = Math.floor(n / C.STAGE_EVERY) % C.STAGES.length;
  if (si !== stageIdx) {
    prevStageIdx = stageIdx; stageIdx = si; stageFade = 0; bannerAt = now;
    sfx.stage();
  }
  if (gotAll) startBoost(); // 8글자를 다 모으면 부스터 자동 시작
}

function startBoost() {
  boostActive = true;
  boostTime = C.BOOST_DURATION;
  boostAcc = 0;
  boostStartAt = clock();
  // 앞의 계단을 지금 바라보는 방향으로 일직선으로 다시 깐다
  rebuildAhead(C.BOOST_STRAIGHT);
  sfx.boost();
}

function endBoost() {
  boostActive = false; boostGauge = 0; gauge = C.GAUGE_MAX;
  newLetterRound(n + C.AFTER_BOOST_STRAIGHT); // 글자를 처음부터 다시 모은다
  // 남은 일직선 계단을 지우고, 잠깐 같은 방향으로 이어진 뒤 다시 무작위로
  rebuildAhead(C.AFTER_BOOST_STRAIGHT);
}

function rebuildAhead(straightCount) {
  stairs.length = n + 1;
  lastDir = facing; runLen = 0;
  straightUntil = n + straightCount;
  genStairs(n + Math.max(30, straightCount + 30));
}

function fail(dir) {
  state = 'falling';
  fallT = 0; fallDir = dir; fallX = rx; fallY = ry;
  shake = 1;
  boostActive = false;
  if (score > best) { best = score; newRecord = true; saveBest(); }
  sfx.fall();
}

// ------------------------------------------------------------
// 업데이트
// ------------------------------------------------------------
function update(dt) {
  const now = clock();
  if (state === 'play') {
    if (boostActive) {
      boostTime -= dt;
      boostGauge = Math.max(0, 100 * boostTime / C.BOOST_DURATION);
      if (boostTime <= 0) endBoost();
    } else {
      gauge -= drainRate(score) * dt;
      if (gauge <= 0) { gauge = 0; fail(0); }
    }
  }

  // 보이는 위치를 실제 위치로 부드럽게
  if (state !== 'falling' && state !== 'over') {
    const a = 1 - Math.exp(-dt * C.FOLLOW_SPEED);
    rx += (stairs[n].x - rx) * a;
    ry += (n - ry) * a;
  }
  if (state === 'falling' || state === 'over') {
    fallT += dt;
    if (state === 'falling' && fallT >= 1.0) {
      state = 'over'; overAt = now;
      if (newRecord) sfx.record();
    }
  }
  const ca = 1 - Math.exp(-dt * C.CAMERA_SPEED);
  if (state !== 'falling' && state !== 'over') {
    camX += (rx - camX) * ca;
    camY += (ry - camY) * ca;
  }

  if (boostActive) {
    trail.push({ x: rx, y: ry, f: facing });
    if (trail.length > 4) trail.shift();
  } else if (trail.length) trail.shift();

  if (stageFade < 1) stageFade = Math.min(1, stageFade + dt / 0.8);
  if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
}

// ------------------------------------------------------------
// 그리기 도우미
// ------------------------------------------------------------
let buttons = [];

function font(size, bold = true) { return `${bold ? 700 : 400} ${size}px ${FONT}`; }

function text(str, x, y, size, color = '#fff', { align = 'center', outline = '#1b2246', ow = 0, bold = true, base = 'middle' } = {}) {
  ctx.font = font(size, bold);
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (outline && ow !== null) {
    ctx.lineWidth = ow || Math.max(4, size * 0.16);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panelBox(x, y, w, h, fill, border = '#1b2246', r = 18, bw = 6) {
  rrect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = bw; ctx.strokeStyle = border; ctx.stroke();
}

function button(id, x, y, w, h, label, { fill = '#ffcc33', color = '#1b2246', size = 44, sub = null } = {}) {
  buttons.push({ id, x, y, w, h });
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rrect(x, y + 8, w, h, 22); ctx.fill();
  panelBox(x, y, w, h, fill, '#1b2246', 22, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 16, y + 10, w - 32, 6);
  text(label, x + w / 2, y + h / 2 + (sub ? -10 : 2), size, color, { outline: null });
  if (sub) text(sub, x + w / 2, y + h / 2 + 30, 22, color, { outline: null, bold: false });
}

function drawBg(idx, alpha = 1) {
  const im = IMG.bg[idx];
  if (!im) { ctx.fillStyle = '#7cc6f2'; ctx.fillRect(0, 0, VW, VH); return; }
  const s = Math.max(VW / im.width, VH / im.height);
  const w = im.width * s, h = im.height * s;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, (VW - w) / 2, (VH - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

function drawTopShade() {
  if (!topShade) {
    topShade = ctx.createLinearGradient(0, 0, 0, 320);
    topShade.addColorStop(0, 'rgba(10,16,40,0.55)');
    topShade.addColorStop(1, 'rgba(10,16,40,0)');
  }
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, VW, 320);
}

// 월드 좌표 → 화면 좌표
function sx(wx) { return GX + GW / 2 + (wx - camX) * C.STEP_DX; }
function sy(wy) { return VH * C.PLAYER_SCREEN_Y - (wy - camY) * C.STEP_DY; }

function drawStairs() {
  const from = Math.max(0, Math.floor(camY) - 9);
  const to = Math.min(stairs.length - 1, Math.ceil(camY) + Math.ceil(VH * C.PLAYER_SCREEN_Y / C.STEP_DY) + 2);
  ctx.imageSmoothingEnabled = false;
  for (let i = to; i >= from; i--) {
    const st = stairs[i];
    const x = sx(st.x) - C.BLOCK_W / 2;
    const y = sy(i);
    if (x > VW || x + C.BLOCK_W < 0) continue;
    ctx.drawImage(blockCache[st.c], x, y, C.BLOCK_W, C.BLOCK_H);
  }
  // 글자 아이템 (계단 위에 둥실)
  const now = clock();
  const ls = C.LETTER_SIZE;
  for (let i = to; i >= from; i--) {
    const st = stairs[i];
    if (!(st.letter >= 0)) continue; // 글자가 없는 계단
    const cx = sx(st.x);
    if (cx < -ls || cx > VW + ls) continue;
    const bob = Math.sin(now * 4 + i) * 6;
    drawLetter(st.letter, cx, sy(i) - ls / 2 - 16 + bob, ls, true);
  }
}

// 글자 배지: 모은 글자(lit)는 밝게, 아직 못 모은 글자는 어둡게
function drawLetter(i, cx, cy, size, lit) {
  const im = lit ? IMG.letters[i] : IMG.lettersDim[i];
  if (im) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im, cx - size / 2, cy - size / 2, size, size);
    return;
  }
  const s = size * 0.86;
  const x = cx - s / 2, y = cy - s / 2;
  if (lit) {
    panelBox(x, y, s, s, '#ffc928', '#1b2246', s * 0.2, Math.max(3, s * 0.07));
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + s * 0.18, y + s * 0.12, s * 0.64, Math.max(2, s * 0.06));
    text(C.WORD[i], cx, cy + s * 0.05, s * 0.6, '#ffffff', { outline: '#1b2246', ow: Math.max(3, s * 0.13) });
  } else {
    panelBox(x, y, s, s, 'rgba(30,34,56,0.85)', 'rgba(10,14,30,0.9)', s * 0.2, Math.max(3, s * 0.07));
    text(C.WORD[i], cx, cy + s * 0.05, s * 0.6, '#5d6584', { outline: null });
  }
}

function drawLetterFx() {
  const now = clock();
  for (const f of letterFx) {
    const t = now - f.t;
    if (t > 0.7) continue;
    const x = sx(f.x), y = sy(f.y) - C.PLAYER_SIZE - 20 - t * 140;
    ctx.globalAlpha = 1 - t / 0.7;
    drawLetter(f.i, x + 60, y, 72 * (1 + Math.max(0, 0.15 - t)), true);
    ctx.globalAlpha = 1;
  }
}

function botFrame() {
  const now = clock();
  if (state === 'falling' || state === 'over') return fallT < 0.3 ? 'fall1' : 'fall2';
  if (boostActive) return (Math.floor(now / 0.08) % 2) ? 'boost2' : 'boost1';
  if (now - lastStepAt < 0.2) return (stepCount % 2) ? 'climb1' : 'climb2';
  return (Math.floor(now / 0.5) % 2) ? 'idle2' : 'idle1';
}

function drawBotAt(frame, wx, wy, dir, alpha = 1, extraY = 0) {
  const im = IMG.bot[frame];
  if (!im) return;
  const PS = C.PLAYER_SIZE;
  const cx = sx(wx);
  const top = sy(wy) + 12 - PS + PS * 8 / 384 + extraY;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  if (dir < 0) {
    ctx.save();
    ctx.translate(cx, 0); ctx.scale(-1, 1);
    ctx.drawImage(im, -PS / 2, top, PS, PS);
    ctx.restore();
  } else {
    ctx.drawImage(im, cx - PS / 2, top, PS, PS);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const now = clock();
  const frame = botFrame();
  if (state === 'falling' || state === 'over') {
    const t = Math.min(fallT, 1.2);
    const fx = fallX + fallDir * Math.min(t * 2.2, 0.7);
    const fy = fallY + 0.9 * t - 12 * t * t;
    drawBotAt(frame, fx, fy, fallDir === 0 ? facing : fallDir);
    return;
  }
  if (boostActive) {
    // 잔상
    trail.forEach((p, i) => drawBotAt('boost1', p.x, p.y, p.f, 0.12 + i * 0.06));
    // 불꽃 (캐릭터 뒤)
    const fi = Math.floor(now / 0.07) % 4;
    const fire = IMG.fire[fi];
    if (fire) {
      const PS = C.PLAYER_SIZE * 1.55;
      const cx = sx(rx);
      const cy = sy(ry) + 12 - C.PLAYER_SIZE / 2 - 10;
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(fire, cx - PS / 2, cy - PS / 2 - 14, PS, PS);
      ctx.globalAlpha = 1;
    }
  }
  drawBotAt(frame, rx, ry, facing);
}

function drawBoostFx() {
  const now = clock();
  const t = now - boostStartAt;
  // 가장자리 주황빛
  const g = ctx.createRadialGradient(VW / 2, VH * 0.55, VH * 0.25, VW / 2, VH * 0.55, VH * 0.75);
  g.addColorStop(0, 'rgba(255,120,0,0)');
  g.addColorStop(1, `rgba(255,110,0,${0.28 + 0.08 * Math.sin(now * 20)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 속도선
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 14; i++) {
    const seed = (i * 97.13 + Math.floor(now * 30) * 13.7) % 1;
    const side = i % 2 ? 1 : 0;
    const x = side ? GX + GW - 20 - ((i * 37) % 110) : GX + 20 + ((i * 53) % 110);
    const y = ((seed * 1.7 + i * 0.13) % 1) * VH;
    ctx.fillRect(x, y, 5, 90 + (i % 3) * 40);
  }
  if (t < 0.9) {
    const s = 1 + Math.max(0, 0.4 - t) * 1.5;
    ctx.globalAlpha = Math.min(1, (0.9 - t) * 3);
    text('BOOST!', GX + GW / 2, VH * 0.3, 110 * s, '#ffde3b', { outline: '#c4320a', ow: 14 });
    ctx.globalAlpha = 1;
  } else {
    const s = 1 + 0.08 * Math.sin(now * 18);
    text('아무 곳이나 마구 터치!', GX + GW / 2, VH * 0.3, 54 * s, '#ffffff', { outline: '#c4320a', ow: 12 });
    text(`${Math.ceil(Math.max(0, boostTime))}`, GX + GW / 2, VH * 0.3 + 76, 52, '#ffde3b', { outline: '#c4320a', ow: 10 });
  }
}

function drawHud() {
  const now = clock();
  drawTopShade();
  // 일시정지 버튼
  const px = GX + 22, py = 22, ps = 70;
  buttons.push({ id: 'pause', x: px - 10, y: py - 10, w: ps + 20, h: ps + 20 });
  panelBox(px, py, ps, ps, '#ffcc33', '#1b2246', 14, 5);
  ctx.fillStyle = '#1b2246';
  ctx.fillRect(px + 22, py + 18, 9, 34); ctx.fillRect(px + 39, py + 18, 9, 34);

  // 시간 게이지
  const gx = px + ps + 18, gy = 28, gw = GX + GW - 24 - gx, gh = 36;
  panelBox(gx, gy, gw, gh, '#3a2a2a', '#1b2246', 10, 5);
  const ratio = Math.max(0, gauge / C.GAUGE_MAX);
  const warn = gauge < C.GAUGE_WARN && state === 'play' && !boostActive;
  const blink = warn && Math.floor(now * 8) % 2 === 0;
  ctx.fillStyle = boostActive ? '#ffd23b' : (blink ? '#ff5a5a' : '#e8402e');
  if (ratio > 0) { rrect(gx + 5, gy + 5, (gw - 10) * ratio, gh - 10, 6); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  if (ratio > 0) ctx.fillRect(gx + 9, gy + 8, Math.max(0, (gw - 18) * ratio), 5);

  // 모은 글자 ("엔트리와 예산사랑") — 모은 글자는 밝게, 아닌 글자는 어둡게
  const tile = 56, tgap = 5;
  const by = gy + gh + 8, bh = tile;
  const pulse = boostActive && Math.floor(now * 6) % 2 === 0 ? 1.06 : 1;
  for (let i = 0; i < C.WORD.length; i++) {
    const tx = gx + i * (tile + tgap) + (i >= 4 ? 14 : 0); // "엔트리와" 뒤 띄어쓰기
    const lit = boostActive || collected[i];
    drawLetter(i, tx + tile / 2, by + tile / 2, (tile / 0.86) * pulse, lit);
  }

  // 장소 표시 (오른쪽 위)
  const name = C.STAGES[stageIdx].name;
  ctx.font = font(26, false);
  const tw = ctx.measureText(name).width;
  const lw = tw + 36, lh = 44, lx = GX + GW - 24 - lw, ly = by + bh + 14;
  rrect(lx, ly, lw, lh, 8);
  ctx.fillStyle = 'rgba(20,24,40,0.72)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
  text(name, lx + lw / 2, ly + lh / 2 + 1, 26, '#fff', { outline: null, bold: false });

  // 점수
  text(String(score), GX + GW / 2, 236, 100, '#ffffff', { outline: '#1b2246', ow: 14 });
  text(`BEST ${best}`, GX + GW / 2, 300, 30, '#ffe066', { outline: '#1b2246', ow: 7 });
}

// ------------------------------------------------------------
// 조작 버튼 위치 (학생이 끌어서 옮길 수 있음, 태블릿에 저장)
// ------------------------------------------------------------
let ctrlLayout = null; // { turn: {fx, fy}, climb: {fx, fy} } — 버튼 가운데 위치(게임 화면 폭·높이 비율)
try { ctrlLayout = JSON.parse(localStorage.getItem(C.LAYOUT_KEY) || 'null'); } catch (e) { ctrlLayout = null; }
let dragging = null;   // { id, key, ox, oy }

function saveLayout() {
  try {
    if (ctrlLayout) localStorage.setItem(C.LAYOUT_KEY, JSON.stringify(ctrlLayout));
    else localStorage.removeItem(C.LAYOUT_KEY);
  } catch (e) {}
}

function ctrlSize() { return Math.min(190, GW * 0.3); }

// 버튼 가운데 좌표
function ctrlCenter(id) {
  const size = ctrlSize();
  if (ctrlLayout && ctrlLayout[id]) return { x: GX + ctrlLayout[id].fx * GW, y: ctrlLayout[id].fy * VH };
  const y = VH - size / 2 - 60;
  return id === 'turn' ? { x: GX + 40 + size / 2, y } : { x: GX + GW - 40 - size / 2, y };
}

// 화면을 누른 곳에서 더 가까운 버튼
function nearestCtrl(p) {
  const a = ctrlCenter('turn'), b = ctrlCenter('climb');
  return Math.hypot(p.x - a.x, p.y - a.y) <= Math.hypot(p.x - b.x, p.y - b.y) ? 'turn' : 'climb';
}

function moveCtrl(id, x, y) {
  const size = ctrlSize();
  const minX = GX + size / 2 + 8, maxX = GX + GW - size / 2 - 8;
  const minY = 330 + size / 2, maxY = VH - size / 2 - 16;
  const cx = Math.min(maxX, Math.max(minX, x)), cy = Math.min(maxY, Math.max(minY, y));
  if (!ctrlLayout) {
    const t = ctrlCenter('turn'), c = ctrlCenter('climb');
    ctrlLayout = { turn: { fx: (t.x - GX) / GW, fy: t.y / VH }, climb: { fx: (c.x - GX) / GW, fy: c.y / VH } };
  }
  ctrlLayout[id] = { fx: (cx - GX) / GW, fy: cy / VH };
}

function drawControls() {
  const now = clock();
  const size = ctrlSize();
  const defs = ['turn', 'climb'].map((id) => {
    const c = ctrlCenter(id);
    return { id, x: c.x - size / 2, y: c.y - size / 2, label: id === 'turn' ? '방향 바꾸기' : '오르기' };
  });
  for (const d of defs) {
    const y = d.y;
    const pressed = now - pressAt[d.id] < 0.1 || (dragging && dragging.id === d.id);
    const oy = pressed ? 8 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rrect(d.x, y + 10, size, size, 30); ctx.fill();
    panelBox(d.x, y + oy, size, size, pressed ? '#ffb03a' : '#ff8a1e', '#1b2246', 30, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(d.x + 22, y + oy + 14, size - 44, 8);
    const cx = d.x + size / 2, cy = y + oy + size / 2 - 14;
    ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
    if (d.id === 'turn') {
      const r = size * 0.22;
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.15, Math.PI * 1.75); ctx.stroke();
      const ax = cx + r * Math.cos(Math.PI * 1.75), ay = cy + r * Math.sin(Math.PI * 1.75);
      ctx.beginPath();
      ctx.moveTo(ax + 26, ay - 4); ctx.lineTo(ax - 8, ay - 20); ctx.lineTo(ax + 2, ay + 22);
      ctx.closePath(); ctx.fill();
    } else {
      const h = size * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h); ctx.lineTo(cx + h, cy + h * 0.55); ctx.lineTo(cx - h, cy + h * 0.55);
      ctx.closePath(); ctx.fill();
    }
    text(d.label, cx, y + oy + size - 30, 24, '#fff', { outline: '#1b2246', ow: 6 });
  }

}

function drawBanner() {
  const t = clock() - bannerAt;
  if (t > 1.8) return;
  const a = t < 0.25 ? t / 0.25 : (t > 1.4 ? (1.8 - t) / 0.4 : 1);
  ctx.globalAlpha = Math.max(0, a);
  const name = C.STAGES[stageIdx].name;
  ctx.font = font(52);
  const w = ctx.measureText(name).width + 80;
  const x = GX + GW / 2 - w / 2, y = VH * 0.42;
  panelBox(x, y, w, 96, 'rgba(20,24,40,0.8)', '#ffffff', 14, 4);
  text(name, GX + GW / 2, y + 50, 52, '#ffe066', { outline: null });
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// 화면별 그리기
// ------------------------------------------------------------
let creditHold = null;

function drawLoading() {
  ctx.fillStyle = '#2b8fd6'; ctx.fillRect(0, 0, VW, VH);
  const w = Math.min(500, GW - 120), x = GX + GW / 2 - w / 2, y = VH / 2;
  text('불러오는 중...', GX + GW / 2, y - 60, 40, '#fff');
  panelBox(x, y, w, 40, '#1b2246', '#ffffff', 12, 4);
  const r = total ? loaded / total : 0;
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(x + 6, y + 6, (w - 12) * r, 28);
}

function drawTitle() {
  const now = clock();
  drawBg(0);
  ctx.fillStyle = 'rgba(10,20,50,0.35)'; ctx.fillRect(0, 0, VW, VH);
  const cx = GX + GW / 2;
  // 소리 버튼
  const mx = GX + GW - 24 - 150, my = 24;
  buttons.push({ id: 'mute', x: mx, y: my, w: 150, h: 64 });
  panelBox(mx, my, 150, 64, isMuted() ? '#9aa3b5' : '#7fd3ff', '#1b2246', 14, 5);
  text(isMuted() ? '소리 끔' : '소리 켬', mx + 75, my + 34, 28, '#1b2246', { outline: null });
  // 최고기록 초기화 버튼
  const rx0 = GX + 24, rw = 210;
  buttons.push({ id: 'resetBest', x: rx0, y: my, w: rw, h: 64 });
  panelBox(rx0, my, rw, 64, '#ffb3b3', '#1b2246', 14, 5);
  text('기록 초기화', rx0 + rw / 2, my + 34, 28, '#1b2246', { outline: null });

  text('예산과 함께하는', cx, 170, 50, '#ffe066', { ow: 10 });
  text('엔트리봇', cx, 268, 104, '#ffffff', { ow: 16 });
  text('무한의 계단', cx, 380, 104, '#5fd0ff', { ow: 16 });

  const bob = Math.sin(now * 3) * 8;
  const im = IMG.bot[(Math.floor(now / 0.5) % 2) ? 'idle2' : 'idle1'];
  if (im) { ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - 160, 470 + bob, 320, 320); }

  const bw = Math.min(460, GW - 120);
  button('start', cx - bw / 2, 830, bw, 130, '시작하기', { size: 60 });
  text(`최고 기록  ${best}계단`, cx, 1010, 38, '#ffffff', { ow: 8 });
  text('방향 바꾸기 버튼과 오르기 버튼으로 올라가요', cx, 1060, 26, '#ffffff', { ow: 6, bold: false });
  const lw2 = 300;
  button('layout', cx - lw2 / 2, 1092, lw2, 64, '버튼 위치 바꾸기', { size: 28, fill: '#7fd3ff' });

  // 제작자 (3초 길게 누르면 최고기록 초기화)
  const cy = VH - 60;
  buttons.push({ id: 'credit', x: cx - 200, y: cy - 36, w: 400, h: 72 });
  let label = C.CREDIT;
  if (creditHold) {
    const left = Math.max(0, 3 - (now - creditHold));
    label = `최고기록 초기화까지 ${left.toFixed(1)}초`;
  }
  text(label, cx, cy, 28, '#ffffff', { ow: 6, bold: false });
}

function drawGame() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
  drawBg(prevStageIdx);
  if (stageFade < 1 || prevStageIdx !== stageIdx) drawBg(stageIdx, stageFade);
  if (boostActive) drawBoostFx();
  drawStairs();
  drawPlayer();
  drawLetterFx();
  ctx.restore();
  if (stageFade >= 1) prevStageIdx = stageIdx;
  drawHud();
  drawBanner();
  drawControls();
  if (state === 'ready' && Math.floor(clock() * 2) % 2 === 0) {
    text('버튼을 눌러 출발!', GX + GW / 2, VH * 0.3, 48, '#ffffff', { ow: 10 });
  }
}

function drawPause() {
  ctx.fillStyle = 'rgba(10,16,40,0.65)'; ctx.fillRect(0, 0, VW, VH);
  const cx = GX + GW / 2;
  text('잠깐 멈춤', cx, VH * 0.28, 80, '#ffffff', { ow: 14 });
  const bw = Math.min(440, GW - 120);
  button('resume', cx - bw / 2, VH * 0.38, bw, 110, '계속하기', { size: 48 });
  button('retry', cx - bw / 2, VH * 0.38 + 140, bw, 110, '다시 하기', { size: 48, fill: '#7fd3ff' });
  button('home', cx - bw / 2, VH * 0.38 + 280, bw, 110, '처음 화면', { size: 48, fill: '#e6e9f0' });
}

function drawOver() {
  const now = clock();
  const t = now - overAt;
  const a = Math.min(1, t / 0.3);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(10,16,40,0.7)'; ctx.fillRect(0, 0, VW, VH);
  const cx = GX + GW / 2;
  const pw = Math.min(600, GW - 60), px = cx - pw / 2, py = VH * 0.14;
  panelBox(px, py, pw, 760, '#fff8e6', '#1b2246', 28, 8);
  text('게임 오버', cx, py + 80, 72, '#ff6b3d', { ow: 12 });
  const im = IMG.bot[newRecord ? 'happy' : 'fall2'];
  if (im) { ctx.imageSmoothingEnabled = true; ctx.drawImage(im, cx - 110, py + 130, 220, 220); }
  text('이번 기록', cx, py + 400, 34, '#1b2246', { outline: null });
  text(`${score}계단`, cx, py + 470, 88, '#1b2246', { outline: '#ffe066', ow: 12 });
  text(`최고 기록  ${best}계단`, cx, py + 560, 36, '#3b5bab', { outline: null });
  if (newRecord) {
    const s = 1 + 0.06 * Math.sin(now * 8);
    ctx.save(); ctx.translate(cx, py + 640); ctx.rotate(-0.05); ctx.scale(s, s);
    panelBox(-200, -40, 400, 80, '#ff4d6d', '#1b2246', 16, 6);
    text('NEW RECORD!', 0, 2, 46, '#ffffff', { outline: null });
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // 연타로 바로 다시 시작되지 않도록 잠깐 뒤에 버튼 표시
  if (t > 0.7) {
    const bw = (pw - 30) / 2;
    button('retry', px, py + 800, bw + 40, 120, '다시 하기', { size: 46 });
    button('home', px + bw + 70, py + 800, bw - 40, 120, '처음 화면', { size: 36, fill: '#e6e9f0' });
  }
}

function drawLayout() {
  drawBg(0);
  ctx.fillStyle = 'rgba(10,16,40,0.45)'; ctx.fillRect(0, 0, VW, VH);
  const cx = GX + GW / 2;
  text('버튼 위치 바꾸기', cx, 90, 56, '#ffe066', { ow: 10 });
  text('버튼을 손가락으로 끌어서 편한 곳에 놓으세요', cx, 160, 28, '#ffffff', { ow: 6, bold: false });
  text('화면을 누르면 더 가까운 버튼으로 움직여요', cx, 200, 24, '#cfe8ff', { ow: 5, bold: false });
  const bw = Math.min(260, (GW - 90) / 2);
  button('layoutDone', cx - bw - 15, 236, bw, 80, '완료', { size: 38 });
  button('layoutReset', cx + 15, 236, bw, 80, '원래대로', { size: 34, fill: '#e6e9f0' });
  // 버튼이 놓일 수 있는 범위
  ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(GX + 8, 330, GW - 16, VH - 330 - 16); ctx.setLineDash([]);
  drawControls();
}

function draw() {
  buttons = [];
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (state === 'loading' || !ready) { drawLoading(); return; }
  if (state === 'title') { drawTitle(); return; }
  if (state === 'layout') { drawLayout(); return; }
  drawGame();
  if (state === 'paused') drawPause();
  if (state === 'over') drawOver();
  // 좌우 여백 (가로 화면일 때)
  if (GX > 0) {
    ctx.fillStyle = 'rgba(10,16,40,0.35)';
    ctx.fillRect(0, 0, GX, VH); ctx.fillRect(GX + GW, 0, VW - GX - GW, VH);
  }
}

// ------------------------------------------------------------
// 입력
// ------------------------------------------------------------
function hit(p) {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b.id;
  }
  return null;
}

function onButton(id) {
  switch (id) {
    case 'start': sfx.click(); resetGame(); requestWakeLock(); break;
    case 'mute': setMuted(!isMuted()); sfx.click(); break;
    case 'resetBest':
      sfx.click();
      setTimeout(() => {
        if (window.confirm(`최고기록(${best}계단)을 0으로 초기화할까요?`)) { best = 0; saveBest(); }
      }, 50);
      break;
    case 'pause': if ((state === 'play' || state === 'ready') && !boostActive) { pausedFrom = state; state = 'paused'; } break;
    case 'resume': sfx.click(); state = pausedFrom; break;
    case 'retry': sfx.click(); resetGame(); break;
    case 'home': sfx.click(); state = 'title'; break;
    case 'layout': sfx.click(); state = 'layout'; break;
    case 'layoutDone': sfx.click(); saveLayout(); state = 'title'; break;
    case 'layoutReset': sfx.click(); ctrlLayout = null; saveLayout(); break;
  }
}

// 터치는 touchstart로 손가락 하나하나를 바로 처리 (연타가 씹히지 않도록),
// 마우스·펜은 pointerdown으로 처리
function toLogicalXY(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * dpr / k, y: (clientY - r.top) * dpr / k };
}

function handleTap(clientX, clientY, key) {
  unlockAudio();
  if (!ready) return;
  const p = toLogicalXY(clientX, clientY);
  const id = hit(p);
  if (state === 'play' || state === 'ready') {
    if (boostActive) { doAction('climb'); return; } // 부스터 중: 화면 어디든 터치하면 오름
    if (id === 'pause') { onButton('pause'); return; }
    doAction(nearestCtrl(p)); // 더 가까운 버튼으로 인식
    return;
  }
  if (state === 'layout') {
    if (id) { onButton(id); return; }
    // 버튼 위를 눌렀으면 끌기 시작
    const size = ctrlSize();
    for (const cid of ['turn', 'climb']) {
      const c = ctrlCenter(cid);
      if (Math.abs(p.x - c.x) <= size / 2 + 10 && Math.abs(p.y - c.y) <= size / 2 + 10) {
        dragging = { id: cid, key, ox: p.x - c.x, oy: p.y - c.y };
        return;
      }
    }
    return;
  }
  if (state === 'title' && id === 'credit') { creditHold = clock(); return; }
  if (id) onButton(id);
}

function handleMove(clientX, clientY, key) {
  if (!dragging || dragging.key !== key || state !== 'layout') return;
  const p = toLogicalXY(clientX, clientY);
  moveCtrl(dragging.id, p.x - dragging.ox, p.y - dragging.oy);
}

function handleUp(key) {
  creditHold = null;
  if (dragging && (key === undefined || dragging.key === key)) dragging = null;
}

canvas.addEventListener('touchstart', (e) => {
  if (e.cancelable) e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    handleTap(t.clientX, t.clientY, 't' + t.identifier);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.cancelable) e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    handleMove(t.clientX, t.clientY, 't' + t.identifier);
  }
}, { passive: false });

function touchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) handleUp('t' + e.changedTouches[i].identifier);
}
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return; // 터치는 위에서 처리
  e.preventDefault();
  handleTap(e.clientX, e.clientY, 'p' + e.pointerId);
}, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  handleMove(e.clientX, e.clientY, 'p' + e.pointerId);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => canvas.addEventListener(ev, (e) => {
  if (e.pointerType === 'touch') { creditHold = null; return; }
  handleUp('p' + e.pointerId);
}));

const KEY_TURN = ['ArrowLeft', 'a', 'A', 'f', 'F'];
const KEY_CLIMB = ['ArrowRight', 'd', 'D', 'j', 'J'];
const KEY_BOOST = [' ', 'ArrowUp', 'Enter', 'w', 'W'];

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  unlockAudio();
  if (!ready) return;
  const key = e.key;
  if (state === 'play' || state === 'ready') {
    if (boostActive && (KEY_TURN.includes(key) || KEY_CLIMB.includes(key) || KEY_BOOST.includes(key))) {
      e.preventDefault(); doAction('climb'); // 부스터 중: 스페이스바·화살표 아무거나 연타
    } else if (KEY_TURN.includes(key)) { e.preventDefault(); doAction('turn'); }
    else if (KEY_CLIMB.includes(key)) { e.preventDefault(); doAction('climb'); }
    else if (key === 'Escape' || key === 'p' || key === 'P') onButton('pause');
  } else if (key === 'Enter' || key === ' ') {
    e.preventDefault();
    if (state === 'title') onButton('start');
    else if (state === 'paused') onButton('resume');
    else if (state === 'over' && clock() - overAt > 0.7) onButton('retry');
  } else if (key === 'Escape' && state === 'paused') onButton('resume');
});

// 확대·스크롤·길게 누르기 메뉴 막기
['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu'].forEach((ev) => {
  document.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
});

// 다른 앱으로 나가면 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'play') { pausedFrom = 'play'; state = 'paused'; }
  } else {
    requestWakeLock();
  }
});

// 화면 꺼짐 방지
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) {}
}

// ------------------------------------------------------------
// 메인 루프
// ------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (ready) {
    if (state === 'loading') state = 'title';
    if (creditHold && clock() - creditHold >= 3) {
      creditHold = null;
      if (window.confirm('최고기록을 0으로 초기화할까요?')) { best = 0; saveBest(); }
    }
    if (state !== 'paused' && state !== 'title' && state !== 'layout') update(dt);
  }
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
loadAll();
requestAnimationFrame(frame);

// 오프라인 실행 (서비스 워커)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// 테스트용 (게임 진행에는 쓰이지 않음)
window.__game = {
  get state() { return state; }, get score() { return score; }, get best() { return best; },
  get gauge() { return gauge; }, get boost() { return boostGauge; }, get boostActive() { return boostActive; },
  get n() { return n; }, get facing() { return facing; },
  nextDir() { return stairs[n + 1].x - stairs[n].x; },
  act: doAction,
  get letters() { return gotCount; },
  get collected() { return collected.slice(); },
};
