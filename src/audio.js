// 효과음: 파일 없이 Web Audio로 합성 (불러오기 지연 없음)
import { CONFIG } from './config.js';

let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem(CONFIG.MUTE_KEY) === '1'; } catch (e) {}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(CONFIG.MUTE_KEY, v ? '1' : '0'); } catch (e) {}
  if (master) master.gain.value = v ? 0 : 0.5;
}

// 첫 터치 때 호출 (아이패드는 터치 전에는 소리를 낼 수 없음)
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}

function tone(freq, dur, { type = 'square', vol = 0.25, slideTo = null, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

let stepFlip = false;
export const sfx = {
  step() { stepFlip = !stepFlip; tone(stepFlip ? 660 : 740, 0.05, { vol: 0.12 }); },
  boost() {
    tone(220, 0.35, { type: 'sawtooth', vol: 0.18, slideTo: 880 });
    tone(330, 0.35, { type: 'square', vol: 0.08, slideTo: 1320, delay: 0.05 });
  },
  fall() { tone(520, 0.6, { type: 'triangle', vol: 0.3, slideTo: 90 }); },
  record() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.18, delay: i * 0.11 }));
  },
  stage() { tone(880, 0.08, { vol: 0.12 }); tone(1175, 0.12, { vol: 0.12, delay: 0.08 }); },
  click() { tone(500, 0.04, { vol: 0.1 }); },
};
