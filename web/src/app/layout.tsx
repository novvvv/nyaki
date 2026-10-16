import type { Metadata } from "next";
import { Inter, Noto_Serif_KR } from "next/font/google";
import localFont from "next/font/local";

import { AppProviders } from "@/components/app-providers";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// 픽셀 폰트. 한자·한글이 없어서 본문에는 못 쓴다 — 가나 장식 문구 전용.
// 출처와 라이선스는 fonts/README.md
const donguri = localFont({
  src: "./fonts/x10y12pxDonguriDuel.ttf",
  variable: "--font-donguri",
  display: "swap",
});

// 명조 — 테스트 화면 노트 스킨의 본문 전용. 한글·한자·가나가 모두 있다.
// 한중일 글꼴은 글자 범위별로 잘게 나뉘어 있어 미리 받을 수 없고, 노트 스킨을
// 켠 사람만 쓰므로 그럴 필요도 없다.
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif-kr",
  preload: false,
});

const TITLE = "Nyaki — 단어장";

export const metadata: Metadata = {
  // 공유 이미지 같은 상대 경로를 이 주소 기준으로 바꾼다. 카톡 등은 절대 주소만 읽는다.
  metadataBase: new URL("https://nyaki.kr"),
  title: TITLE,
  // 링크를 공유하면 메인의 고양이가 보인다. cat.png는 배경이 투명해 메신저에
  // 따라 검게 나와서, 흰 배경에 얹은 1200×630(og.png)을 따로 둔다.
  openGraph: {
    title: TITLE,
    siteName: "Nyaki",
    url: "/",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Nyaki 고양이" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${donguri.variable} ${notoSerifKr.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
