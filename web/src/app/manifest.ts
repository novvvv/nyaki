import type { MetadataRoute } from "next";

/**
 * 홈 화면에 설치하는 앱 정보. 웹과 같은 화면 · 같은 계정을 그대로 쓴다 —
 * 앱을 따로 만들지 않고 이 사이트를 설치한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nyaki — 일본어 단어장",
    short_name: "Nyaki",
    description: "그림으로 외우고, 잊을 때쯤 다시 묻는 일본어 단어장",
    lang: "ko",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
