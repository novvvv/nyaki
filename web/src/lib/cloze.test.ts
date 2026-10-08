import { describe, expect, it } from "vitest";

import {
  countBlanks,
  insertBlank,
  insertBold,
  insertHighlight,
  nextBlankNumber,
  parseCloze,
  parseInline,
} from "./cloze";

describe("parseInline — 굵게·형광", () => {
  it("마커가 없으면 통째로 한 조각", () => {
    expect(parseInline("그냥 글")).toEqual([
      { text: "그냥 글", bold: false, highlight: false },
    ]);
  });

  it("굵게와 형광을 갈라낸다", () => {
    expect(parseInline("앞 **굵게** 뒤 ==형광==")).toEqual([
      { text: "앞 ", bold: false, highlight: false },
      { text: "굵게", bold: true, highlight: false },
      { text: " 뒤 ", bold: false, highlight: false },
      { text: "형광", bold: false, highlight: true },
    ]);
  });

  it("짝이 안 맞는 마커는 그냥 글자로 둔다", () => {
    expect(parseInline("**닫지 않음")).toEqual([
      { text: "**닫지 않음", bold: false, highlight: false },
    ]);
  });
});

describe("parseCloze — 빈칸", () => {
  it("빈칸 자리를 표시한다", () => {
    const tokens = parseCloze("TCP는 {{c1::연결 지향}} 프로토콜");

    expect(tokens.map((t) => [t.text, t.blank])).toEqual([
      ["TCP는 ", false],
      ["연결 지향", true],
      [" 프로토콜", false],
    ]);
  });

  it("빈칸이 여럿이어도 전부 가린다 — 노트 하나가 카드 한 장이다", () => {
    const tokens = parseCloze("{{c1::가}}와 {{c2::나}}");
    expect(tokens.filter((t) => t.blank).map((t) => t.text)).toEqual(["가", "나"]);
  });

  it("힌트를 함께 싣는다", () => {
    const [token] = parseCloze("답은 {{c1::42::숫자}}").filter((t) => t.blank);
    expect(token).toMatchObject({ text: "42", hint: "숫자" });
  });

  it("빈칸 안의 굵게도 푼다", () => {
    const [token] = parseCloze("{{c1::**결합도**}}").filter((t) => t.blank);
    expect(token).toMatchObject({ text: "결합도", bold: true, blank: true });
  });

  it("줄바꿈이 있어도 하나의 빈칸으로 본다", () => {
    expect(countBlanks("첫 줄\n{{c1::답}}")).toBe(1);
  });
});

// ReDoS (CWE-1333) — security_review.md 2-2. 서버 tests/vocab/cards/test_cloze_notes.py와 같은 입력.
describe("parseCloze — 닫히지 않은 빈칸", () => {
  it.each([
    ["닫지 않은 빈칸만 반복", "{{c1::".repeat(834)],
    ["답 · 힌트 구분자까지 반복", "{{c1::a::".repeat(555)],
    ["닫는 괄호를 하나만 섞기", "{{c1::a}b".repeat(555)],
  ])("%s — 5,000자여도 바로 끝난다", (_name, raw) => {
    const started = performance.now();
    parseCloze(raw);
    countBlanks(raw);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it.each([
    ["{{c1::std::vector}}", "std"], // '::' 뒤는 힌트다
    ["{{c1::a}b}}", "a}b"], // 닫는 괄호 하나는 답에 들어간다
    ["{{c1::a::b::c}}", "a"], // 힌트는 'b::c'
  ])("헷갈리기 쉬운 문장의 답은 서버와 같다 — %s", (raw, answer) => {
    const blanks = parseCloze(raw).filter((t) => t.blank);
    expect(blanks.map((t) => t.text).join("")).toBe(answer);
  });

  it("닫지 않은 빈칸이 뒤 빈칸까지 삼키지 않는다 — 뒤 빈칸만 빈칸이다", () => {
    const blanks = parseCloze("{{c1::A {{c2::B}}").filter((t) => t.blank);
    expect(blanks.map((t) => t.text)).toEqual(["B"]);
  });
});

describe("nextBlankNumber — 번호 자동 증가", () => {
  it("처음이면 1", () => {
    expect(nextBlankNumber("빈칸 없음")).toBe(1);
  });

  it("이미 쓴 것 중 가장 큰 값 다음", () => {
    expect(nextBlankNumber("{{c1::가}} {{c3::나}}")).toBe(4);
  });
});

describe("툴바 편집", () => {
  it("고른 구간을 빈칸으로 감싸고, 감싼 내용을 선택 상태로 남긴다", () => {
    const raw = "정답은 LOD 이다";
    const edit = insertBlank(raw, 4, 7); // "LOD"

    expect(edit.text).toBe("정답은 {{c1::LOD}} 이다");
    expect(edit.text.slice(edit.selectionStart, edit.selectionEnd)).toBe("LOD");
  });

  it("고른 게 없으면 빈 마크업을 넣고 커서를 안쪽에 둔다", () => {
    const edit = insertBlank("앞뒤", 1, 1); // 앞 | 뒤

    expect(edit.text).toBe("앞{{c1::}}뒤");
    expect(edit.selectionStart).toBe(edit.selectionEnd);
    expect(edit.text.slice(0, edit.selectionStart)).toBe("앞{{c1::");
  });

  it("이미 빈칸이 있으면 다음 번호를 쓴다", () => {
    const raw = "{{c1::가}}나"; // "{{c1::가}}"가 9자, "나"는 9..10
    expect(insertBlank(raw, 9, 10).text).toBe("{{c1::가}}{{c2::나}}");
  });

  it("굵게와 형광도 같은 방식으로 감싼다", () => {
    expect(insertBold("가나다", 1, 2).text).toBe("가**나**다");
    expect(insertHighlight("가나다", 1, 2).text).toBe("가==나==다");
  });
});
