import { describe, expect, it } from "vitest";

import {
  convertSheet,
  countBlanks,
  insertBlank,
  insertBold,
  insertHighlight,
  insertTable,
  nextBlankNumber,
  parseCloze,
  parseInline,
  stripInline,
  toBlocks,
  toPieces,
  type ClozeBlock,
} from "./cloze";

describe("parseInline — 굵게·형광·밑줄", () => {
  const plain = { bold: false, highlight: false, underline: false };

  it("마커가 없으면 통째로 한 조각", () => {
    expect(parseInline("그냥 글")).toEqual([{ ...plain, text: "그냥 글" }]);
  });

  it("굵게와 형광을 갈라낸다", () => {
    expect(parseInline("앞 **굵게** 뒤 ==형광==")).toEqual([
      { ...plain, text: "앞 " },
      { ...plain, text: "굵게", bold: true },
      { ...plain, text: " 뒤 " },
      { ...plain, text: "형광", highlight: true },
    ]);
  });

  it("짝이 안 맞는 마커는 그냥 글자로 둔다", () => {
    expect(parseInline("**닫지 않음")).toEqual([
      { ...plain, text: "**닫지 않음" },
    ]);
  });

  it("밑줄은 ++로 감싼다", () => {
    expect(parseInline("a ++밑줄++ b")).toEqual([
      { ...plain, text: "a " },
      { ...plain, text: "밑줄", underline: true },
      { ...plain, text: " b" },
    ]);
  });

  it("겹친 서식을 함께 푼다 — 굵은 밑줄, 형광 속 굵게", () => {
    expect(parseInline("**++둘 다++**")).toEqual([
      { ...plain, text: "둘 다", bold: true, underline: true },
    ]);
    expect(parseInline("==앞 **굵게** 뒤==")).toEqual([
      { ...plain, text: "앞 ", highlight: true },
      { ...plain, text: "굵게", highlight: true, bold: true },
      { ...plain, text: " 뒤", highlight: true },
    ]);
  });

  it("stripInline은 마커를 걷고 글자만 남긴다", () => {
    expect(stripInline("**굵게** ==형광== ++밑줄++")).toBe("굵게 형광 밑줄");
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

/** 칸을 글자로 — 빈칸은 [답]으로 적는다. 비교를 읽기 쉽게. */
function cellText(cell: { text: string; blank: boolean }[]): string {
  return cell.map((piece) => (piece.blank ? `[${piece.text}]` : piece.text)).join("");
}

function tableOf(blocks: ClozeBlock[]) {
  const table = blocks.find((block) => block.kind === "table");
  if (!table || table.kind !== "table") throw new Error("표가 없다");
  return {
    header: table.header?.map(cellText) ?? null,
    rows: table.rows.map((row) => row.map(cellText)),
  };
}

describe("toPieces — 서버와 같은 자르기", () => {
  it("빈칸 자리에서 끊고 힌트를 싣는다", () => {
    expect(toPieces("가 {{c1::나::힌트}} 다")).toEqual([
      { text: "가 ", blank: false },
      { text: "나", blank: true, hint: "힌트" },
      { text: " 다", blank: false },
    ]);
  });
});

describe("toBlocks — 표", () => {
  it("표가 없으면 조각이 그대로 한 덩어리다", () => {
    const pieces = toPieces("첫 줄\n**둘째\n줄** {{c1::답}}");
    const blocks = toBlocks(pieces);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: "text", pieces });
  });

  it("구분 줄 위의 행이 제목 행이다", () => {
    const raw = "| 구분 | 내용 |\n|---|---|\n| RTO | 목표 복구 시간 |";

    expect(tableOf(toBlocks(toPieces(raw)))).toEqual({
      header: ["구분", "내용"],
      rows: [["RTO", "목표 복구 시간"]],
    });
  });

  it("칸 안의 빈칸을 그 칸에 둔다 — 조각이 칸 경계에서 끊겨 와도", () => {
    const raw = "| 용어 | 뜻 |\n|---|---|\n| {{c1::RTO}} | 목표 {{c2::복구}} 시간 |";

    expect(tableOf(toBlocks(toPieces(raw))).rows).toEqual([
      ["[RTO]", "목표 [복구] 시간"],
    ]);
  });

  it("빈칸 답 안의 |로는 칸을 나누지 않는다", () => {
    const raw = "| 가 | 나 |\n| {{c1::a|b}} | 다 |";

    expect(tableOf(toBlocks(toPieces(raw))).rows).toEqual([
      ["가", "나"],
      ["[a|b]", "다"],
    ]);
  });

  it("구분 줄이 없으면 제목 행 없이 전부 내용 행이다", () => {
    const raw = "| 가 | 나 |\n| 다 | 라 |";

    expect(tableOf(toBlocks(toPieces(raw)))).toEqual({
      header: null,
      rows: [
        ["가", "나"],
        ["다", "라"],
      ],
    });
  });

  it("칸이 모자란 행은 빈 칸으로 채운다", () => {
    const raw = "| 가 | 나 | 다 |\n|---|---|---|\n| 라 |";

    expect(tableOf(toBlocks(toPieces(raw))).rows).toEqual([["라", "", ""]]);
  });

  it("| 로 감싼 줄이 하나뿐이면 표가 아니라 글이다", () => {
    const blocks = toBlocks(toPieces("앞\n| 강조 |\n뒤"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe("text");
  });

  it("표 앞뒤의 글은 따로 두고, 사이의 빈 줄은 버린다", () => {
    const raw = "앞 글\n\n| 가 | 나 |\n|---|---|\n| 다 | 라 |\n\n뒤 글";
    const blocks = toBlocks(toPieces(raw));

    expect(blocks.map((block) => block.kind)).toEqual(["text", "table", "text"]);
    expect(blocks[0]).toEqual({ kind: "text", pieces: [{ text: "앞 글", blank: false }] });
    expect(blocks[2]).toEqual({ kind: "text", pieces: [{ text: "뒤 글", blank: false }] });
  });
});

describe("표 넣기", () => {
  it("열×행 빈 틀을 넣는다 — 행은 제목 행을 포함한다", () => {
    const edit = insertTable("", 0, 0, 2, 3);

    expect(edit.text).toBe("|   |   |\n| --- | --- |\n|   |   |\n|   |   |");
    expect(tableOf(toBlocks(toPieces(edit.text)))).toEqual({
      header: ["", ""],
      rows: [
        ["", ""],
        ["", ""],
      ],
    });
  });

  it("커서를 첫 칸에 둔다", () => {
    const edit = insertTable("", 0, 0, 2, 2);
    expect(edit.selectionStart).toBe(2);
    expect(edit.selectionEnd).toBe(2);
  });

  it("글 중간에 넣으면 앞뒤로 줄을 바꾼다", () => {
    const edit = insertTable("앞뒤", 1, 1, 1, 2);

    expect(edit.text).toBe("앞\n|   |\n| --- |\n|   |\n뒤");
    expect(edit.selectionStart).toBe(4); // "앞\n| " 뒤
  });

  it("시트에서 복사한 표를 표 문법으로 바꾼다 — 첫 줄이 제목 행", () => {
    const raw = "용어\t뜻\nRTO\t목표 복구 시간\nRPO\t\n";
    const edit = convertSheet(raw, 0, raw.length);

    expect(edit.text).toBe(
      "| 용어 | 뜻 |\n| --- | --- |\n| RTO | 목표 복구 시간 |\n| RPO |   |",
    );
    expect(edit.selectionStart).toBe(edit.text.length);
  });
});
