/* Nyaki 서비스 워커 — 앱으로 설치할 수 있게, 끊겨도 마지막 화면은 열리게.
 *
 * - 페이지: 네트워크 먼저(다시 배포하면 바로 보이게). 끊기면 저장해 둔 것을 보인다.
 * - /_next/static: 파일 이름에 버전이 붙어 바뀌지 않으므로 저장된 것을 먼저 쓴다.
 * - 서버(api.nyangki.com)와 로그인(Firebase) 요청은 건드리지 않는다 — 단어장은
 *   늘 서버에서 새로 받는다. */
const VER = "nyaki-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("nyaki-") && key !== VER).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function remember(request, response) {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(VER).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => remember(request, res))),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => remember(request, res))
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match("/today"))
            .then((hit) => hit || Response.error()),
        ),
    );
  }
});
