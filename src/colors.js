// 엔트리봇 색 바꾸기: 그림의 파란 부분(후드·몸·신발)만 골라 다른 색으로 바꿈
// h: 색상(0~360), s: 채도(0~1), l: 기준 밝기(0~1), k: 명암 세기
export const BOT_COLORS = [
  { id: 'red', name: '빨강', h: 2, s: 0.82, l: 0.52, k: 1, swatch: '#e8402e' },
  { id: 'orange', name: '주황', h: 26, s: 0.95, l: 0.55, k: 1, swatch: '#ff8a1e' },
  { id: 'yellow', name: '노랑', h: 48, s: 0.95, l: 0.56, k: 0.9, swatch: '#ffd23b' },
  { id: 'green', name: '초록', h: 140, s: 0.62, l: 0.45, k: 1, swatch: '#2fb36b' },
  { id: 'blue', name: '파랑', h: null, swatch: '#1e90ff' },
  { id: 'navy', name: '남색', h: 228, s: 0.62, l: 0.36, k: 0.9, swatch: '#2d3e9e' },
  { id: 'purple', name: '보라', h: 270, s: 0.62, l: 0.55, k: 1, swatch: '#8a4fd6' },
  { id: 'gold', name: '황금', h: 44, s: 0.92, l: 0.5, k: 1.25, swatch: '#e7b416', metal: true },
  { id: 'silver', name: '은색', h: 215, s: 0.1, l: 0.72, k: 1.3, swatch: '#b9c2d0', metal: true },
  { id: 'black', name: '블랙', h: 230, s: 0.12, l: 0.24, k: 0.7, swatch: '#2b2f3a' },
  { id: 'white', name: '화이트', h: 215, s: 0.12, l: 0.9, k: 0.45, swatch: '#eef1f6' },
];
export const COLOR_IDS = BOT_COLORS.map((c) => c.id);
export function colorInfo(id) { return BOT_COLORS.find((c) => c.id === id) || BOT_COLORS[4]; }

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

const BASE_L = 0.53; // 원래 파란색의 기준 밝기
const cache = new Map();

// img(Image 또는 canvas)를 color 색으로 바꾼 canvas를 돌려줌 (파랑이면 원본 그대로)
export function recolor(img, colorId, key) {
  const c = colorInfo(colorId);
  if (!img || c.h === null) return img;
  const ck = key ? `${key}|${c.id}` : null;
  if (ck && cache.has(ck)) return cache.get(ck);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  let data;
  try { data = g.getImageData(0, 0, w, h); } catch (e) { return img; }
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [hh, ss, ll] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    if (hh < 188 || hh > 238 || ss < 0.42 || ll < 0.21 || ll > 0.93) continue; // 파란 부분만
    let nl = c.l + (ll - BASE_L) * c.k;
    if (c.metal) nl += 0.06 * Math.sin((i / 4 % w) * 0.05 + Math.floor(i / 4 / w) * 0.04); // 금속 반짝임
    nl = Math.min(0.97, Math.max(0.06, nl));
    const ns = Math.min(1, c.s * Math.min(1, ss / 0.85));
    const [r, gg, b] = hsl2rgb(c.h, ns, nl);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  g.putImageData(data, 0, 0);
  if (ck) cache.set(ck, cv);
  return cv;
}
