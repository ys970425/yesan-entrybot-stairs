// 오프라인 실행용: 처음 열 때 모든 파일을 저장해 두고, 이후에는 저장본으로 실행
// 파일을 고쳐서 다시 배포할 때는 VERSION 숫자를 올립니다.
const VERSION = 'v17';
const CACHE = `yesan-stairs-${VERSION}`;
const FILES = [
  './', './index.html', './manifest.json',
  './src/main.js', './src/config.js', './src/audio.js', './src/net.js', './src/colors.js',
  './fonts/Galmuri11-Bold.woff2', './fonts/Galmuri11.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
  './assets/bg_01.webp', './assets/bg_02.webp', './assets/bg_03.webp', './assets/bg_04.webp',
  './assets/bg_05.webp', './assets/bg_06.webp', './assets/bg_07.webp', './assets/bg_08.webp', './assets/bg_09.webp',
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [`./assets/letter_${i}.webp`, `./assets/letter_${i}_dim.webp`]),
  './assets/bot_idle1.webp', './assets/bot_idle2.webp', './assets/bot_climb1.webp', './assets/bot_climb2.webp',
  './assets/bot_fall1.webp', './assets/bot_fall2.webp', './assets/bot_boost1.webp', './assets/bot_boost2.webp',
  './assets/bot_happy.webp',
  './assets/fx_fire1.webp', './assets/fx_fire2.webp', './assets/fx_fire3.webp', './assets/fx_fire4.webp',
];

self.addEventListener('install', (e) => {
  // 버전 번호를 붙여 받아서, 중간 서버에 남아 있는 예전 파일 대신 항상 새 파일을 저장
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((u) =>
      fetch(`${u}${u.includes('?') ? '&' : '?'}v=${VERSION}`, { cache: 'reload' }).then((res) => {
        if (!res.ok) throw new Error(`${u} ${res.status}`);
        return c.put(u, res);
      })
    ))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yesan-stairs-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// TV 순위표·관리자 화면은 항상 최신 파일 (인터넷이 없을 때만 저장본)
function isLivePage(req) {
  const u = req.url + ' ' + (req.referrer || '');
  return u.includes('/board/') || u.includes('/admin/');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  if (isLivePage(e.request)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
