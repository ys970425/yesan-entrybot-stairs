// 순위표 서버(Supabase) 연결 — 게임·TV 순위표·관리자 화면이 같이 씀
import { CONFIG as C } from './config.js';

export async function rpc(name, body = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: C.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = (data && data.message) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// 닉네임 검사 (금지어)
// ------------------------------------------------------------
const BANNED = [
  '씨발', '시발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', 'ㅂㅅ', '개새', '새끼', 'ㅅㄲ', '좆', '존나', 'ㅈㄴ',
  '지랄', 'ㅈㄹ', '미친', 'ㅁㅊ', '닥쳐', '꺼져', '죽어', '등신', '애미', '애비', '느금', '니미', '엠창', '섹스', '야동',
  '보지', '자지', '변태', '찐따', '틀딱', '급식충', '凸',
  'fuck', 'shit', 'sex', 'bitch', 'dick', 'porn',
];

export function cleanNickname(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, C.NICK_MAX);
}

// 문제 없으면 null, 있으면 안내 문구
export function checkNickname(nick) {
  if (!nick) return '닉네임을 입력해 주세요.';
  if (nick.length > C.NICK_MAX) return `닉네임은 ${C.NICK_MAX}글자까지예요.`;
  const flat = nick.toLowerCase().replace(/[\s\d_\-.~!@#$%^&*()+=|\\/,;:'"`?<>[\]{}]/g, '');
  if (BANNED.some((w) => flat.includes(w))) return '바른 말로 된 닉네임을 써 주세요.';
  return null;
}

// ------------------------------------------------------------
// 기록 보내기 (인터넷이 끊기면 태블릿에 모아 두었다가 다시 보냄)
// ------------------------------------------------------------
function loadQueue() {
  try { return JSON.parse(localStorage.getItem(C.QUEUE_KEY) || '[]'); } catch (e) { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(C.QUEUE_KEY, JSON.stringify(q.slice(-200))); } catch (e) {}
}

// 성공하면 { ok: true, rank }, 실패하면 { ok: false } (대기열에 저장됨)
export async function submitScore(nickname, score) {
  if (!nickname || !(score >= 1)) return { ok: false, skipped: true };
  try {
    const rank = await rpc('stairs_submit', { p_nick: nickname, p_score: score });
    flushQueue();
    return { ok: true, rank };
  } catch (e) {
    if (e.status && e.status >= 400 && e.status < 500) return { ok: false, rejected: true };
    const q = loadQueue();
    q.push({ n: nickname, s: score, t: Date.now() });
    saveQueue(q);
    return { ok: false, queued: true };
  }
}

let flushing = false;
export async function flushQueue() {
  if (flushing) return;
  const q = loadQueue();
  if (!q.length) return;
  flushing = true;
  try {
    while (q.length) {
      const item = q[0];
      try {
        await rpc('stairs_submit', { p_nick: item.n, p_score: item.s });
      } catch (e) {
        if (!(e.status && e.status >= 400 && e.status < 500)) break; // 아직 인터넷 없음 → 다음에
      }
      q.shift();
      saveQueue(q);
    }
  } finally {
    flushing = false;
  }
}

export function pendingCount() { return loadQueue().length; }
