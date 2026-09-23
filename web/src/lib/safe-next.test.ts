import { describe, expect, it } from "vitest";

import { DEFAULT_NEXT, safeNext } from "./safe-next";

describe("safeNext — 로그인 후 돌아갈 곳", () => {
  it("우리 사이트 경로는 그대로 쓴다", () => {
    expect(safeNext("/review")).toBe("/review");
    expect(safeNext("/word-books/abc/words/1")).toBe("/word-books/abc/words/1");
  });

  it("값이 없으면 기본 목적지", () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it("바깥 주소는 버린다 — 열린 리디렉션 차단", () => {
    expect(safeNext("https://evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("http://evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });

  it("슬래시 두 개도 바깥 주소다 — 브라우저가 프로토콜을 붙여 읽는다", () => {
    expect(safeNext("//evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("//evil.com/path")).toBe(DEFAULT_NEXT);
  });
});
