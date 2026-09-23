import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// 웹 테스트 설정.
//
// 기능별로 src/lib 의 순수 로직을 먼저 덮고, 화면은 렌더 스모크만 둔다 —
// 계산(암기율·SM-2 표시·안전한 리디렉션)이 틀리면 조용히 잘못된 숫자가 보이고,
// 레이아웃이 틀리면 눈에 바로 보이기 때문이다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
