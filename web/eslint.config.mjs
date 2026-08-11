import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // shadcn 레지스트리(@bklit)에서 그대로 가져온 벤더 코드 — 직접 수정하지 않으므로
  // react-hooks 규칙 적용에서 제외 (업스트림 업데이트 시 덮어쓰기 가능하도록)
  {
    files: ["src/components/charts/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
