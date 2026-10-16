import { describe, expect, it } from "vitest";

import { toBlocks, toPieces } from "./cloze";
import { docToMarkup, markupToDoc } from "./cloze-doc";

/**
 * 원문 ↔ 서식 편집기 문서.
 *
 * 지키는 것은 **왕복해도 글이 바뀌지 않는다**와 **편집기에서 만든 원문을
 * 테스트 화면이 같은 모양으로 읽는다**이다. 편집기는 원문을 직접 보여주지
 * 않으므로, 여기서 어긋나면 사용자는 저장한 글이 바뀐 줄도 모른다.
 */

function roundTrip(raw: string): string {
  return docToMarkup(markupToDoc(raw));
}

describe("왕복 — 원문 → 문서 → 원문", () => {
  it.each([
    ["그냥 글", "그냥 글"],
    ["앞 **굵게** ==형광== ++밑줄++ 뒤", "서식"],
    ["**++굵은 밑줄++**", "겹친 서식"],
    ["{{c1::답}}과 {{c2::다른 답::힌트}}", "빈칸 · 힌트"],
    ["{{c1::**굵은 답**}} 뒤", "빈칸 안 서식"],
    ["첫 줄\n\n셋째 줄", "빈 줄"],
    ["{{c1::여러\n줄 답}}", "여러 줄 답"],
    [
      "앞 글\n| 가 | 나 |\n| --- | --- |\n| {{c1::다}} | **라** |\n뒤 글",
      "표",
    ],
    ["| 가 |   |\n| --- | --- |\n|   | 라 |", "빈 칸이 있는 표"],
  ])("%s (%s)", (raw) => {
    expect(roundTrip(raw)).toBe(raw);
  });

  it("빈칸 번호는 앞에서부터 다시 매긴다 — 번호는 자리 표시일 뿐이다", () => {
    expect(roundTrip("{{c3::가}} {{c1::나}}")).toBe("{{c1::가}} {{c2::나}}");
  });

  it("표 구분 줄은 한 모양으로 맞춘다", () => {
    expect(roundTrip("|가|나|\n|---|:---:|\n|다|라|")).toBe(
      "| 가 | 나 |\n| --- | --- |\n| 다 | 라 |",
    );
  });

  it("빈 원문은 빈 문단 하나다", () => {
    expect(markupToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(roundTrip("")).toBe("");
  });
});

describe("문서 → 원문 — 편집기에서 만든 글", () => {
  it("굵게가 빈칸을 가로지르면 빈칸 밖에서 끊어 감싼다 — 테스트 화면에 ** 가 남지 않게", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "앞 ", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: "답",
              marks: [{ type: "blank", attrs: { hint: null } }, { type: "bold" }],
            },
            { type: "text", text: " 뒤", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const raw = docToMarkup(doc);
    expect(raw).toBe("**앞 **{{c1::**답**}}** 뒤**");

    // 서버가 빈칸에서 자른 조각마다 마커가 짝이 맞는다.
    for (const piece of toPieces(raw)) {
      expect(piece.text.split("**").length % 2).toBe(1);
    }
  });

  it("한 빈칸 안에서 서식이 바뀌어도 빈칸 하나로 묶는다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "연결 ", marks: [{ type: "blank", attrs: { hint: null } }] },
            {
              type: "text",
              text: "지향",
              marks: [{ type: "blank", attrs: { hint: null } }, { type: "underline" }],
            },
          ],
        },
      ],
    };
    expect(docToMarkup(doc)).toBe("{{c1::연결 ++지향++}}");
  });

  it("편집기 표는 테스트 화면이 같은 표로 읽는다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "용어" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "뜻" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "RTO", marks: [{ type: "blank", attrs: { hint: null } }] },
                      ],
                    },
                  ],
                },
                { type: "tableCell", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
      ],
    };
    const [table] = toBlocks(toPieces(docToMarkup(doc)));
    expect(table).toMatchObject({
      kind: "table",
      header: [[{ text: "용어" }], [{ text: "뜻" }]],
      rows: [[[{ text: "RTO", blank: true }], []]],
    });
  });
});
