import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Nyaki — 단어장",
  description: "Nyaki 웹 단어 편집기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${donguri.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
