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
