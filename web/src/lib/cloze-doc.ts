/**
 * 빈칸 노트 원문 ↔ 서식 편집기(TipTap) 문서.
 *
 * 저장 형식은 그대로 원문 문자열이다(`{{c1::답}}` · `**굵게**` · `==형광==` ·
 * `++밑줄++` · 표). 서버 · 앱 · 테스트 화면은 원문만 안다. 편집기만 이 둘
 * 사이를 오간다 — 사용자가 기호를 보지 않고 쓰게 하려는 것이다.
 *
 * 원문을 읽을 때는 테스트 화면과 **같은 해석**을 쓴다(toPieces → toBlocks →
 * parseInline). 편집기에서 보이는 모양과 시험볼 때 모양이 갈리지 않게.
 *
 * 원문으로 쓸 때 지키는 것
 * - 빈칸이 가장 바깥이다. 서버는 `{{cN::}}`에서 문장을 자르므로, 굵게 같은
 *   마커가 빈칸 경계를 넘으면 잘린 조각에 `**`가 짝 없이 남아 기호가 보인다.
 *   그래서 서식은 글자 조각마다 따로 감싼다.
 * - 빈칸 번호는 앞에서부터 다시 매긴다. 번호는 자리 표시일 뿐 뜻이 없다.
 */
import type { JSONContent } from "@tiptap/core";

import {
  parseInline,
  toBlocks,
  toPieces,
  type ClozePiece,
  type InlineToken,
} from "./cloze";

type Mark = NonNullable<JSONContent["marks"]>[number];

function marksOf(token: InlineToken, blank: ClozePiece | null): Mark[] {
  const marks: Mark[] = [];
  if (blank) marks.push({ type: "blank", attrs: { hint: blank.hint ?? null } });
  if (token.bold) marks.push({ type: "bold" });
  if (token.highlight) marks.push({ type: "highlight" });
  if (token.underline) marks.push({ type: "underline" });
  return marks;
}

function textNode(text: string, marks: Mark[]): JSONContent {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

function paragraph(content: JSONContent[]): JSONContent {
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

/**
 * 조각을 줄마다의 글자 노드로. 빈칸 밖의 줄바꿈은 문단을 나누고, 빈칸 안의
 * 줄바꿈(여러 줄짜리 답)은 그 빈칸 안의 줄바꿈(hardBreak)으로 둔다.
 */
function piecesToLines(pieces: ClozePiece[]): JSONContent[][] {
  const lines: JSONContent[][] = [[]];
  for (const piece of pieces) {
    const blank = piece.blank ? piece : null;
    for (const token of parseInline(piece.text)) {
      const marks = marksOf(token, blank);
      token.text.split("\n").forEach((part, index) => {
        if (index > 0) {
          if (blank) lines.at(-1)!.push({ type: "hardBreak", marks });
          else lines.push([]);
        }
        if (part) lines.at(-1)!.push(textNode(part, marks));
      });
    }
  }
  return lines;
}

function cell(type: "tableHeader" | "tableCell", pieces: ClozePiece[]): JSONContent {
  return { type, content: [paragraph(piecesToLines(pieces).flat())] };
}

/** 원문 → 편집기 문서. */
export function markupToDoc(raw: string): JSONContent {
  const content: JSONContent[] = [];
  for (const block of toBlocks(toPieces(raw))) {
    if (block.kind === "text") {
      for (const line of piecesToLines(block.pieces)) content.push(paragraph(line));
      continue;
    }
    const rows: JSONContent[] = [];
    if (block.header) {
      rows.push({
        type: "tableRow",
        content: block.header.map((pieces) => cell("tableHeader", pieces)),
      });
    }
    for (const row of block.rows) {
      rows.push({
        type: "tableRow",
        content: row.map((pieces) => cell("tableCell", pieces)),
      });
    }
    content.push({ type: "table", content: rows });
  }
  return { type: "doc", content: content.length > 0 ? content : [paragraph([])] };
}

function hasMark(node: JSONContent, type: string): boolean {
  return node.marks?.some((mark) => mark.type === type) ?? false;
}

function blankOf(node: JSONContent): Mark | undefined {
  return node.marks?.find((mark) => mark.type === "blank");
}

/** 글자 노드 하나. 서식은 늘 같은 순서로 감싼다 — 바깥부터 굵게 · 형광 · 밑줄. */
function inlineNode(node: JSONContent): string {
  if (node.type === "hardBreak") return "\n";
  if (node.type !== "text" || !node.text) return "";
  let text = node.text;
  if (hasMark(node, "underline")) text = `++${text}++`;
  if (hasMark(node, "highlight")) text = `==${text}==`;
  if (hasMark(node, "bold")) text = `**${text}**`;
  return text;
}

/** 편집기 문서 → 원문. */
export function docToMarkup(doc: JSONContent): string {
  let blankNo = 0;

  function inline(nodes: JSONContent[] = []): string {
    let out = "";
    let i = 0;
    while (i < nodes.length) {
      const blank = blankOf(nodes[i]!);
      if (!blank) {
        out += inlineNode(nodes[i]!);
        i += 1;
        continue;
      }
      // 이어 붙은 빈칸 노드는 한 빈칸이다(안에서 굵게가 바뀌면 노드가 나뉜다).
      const hint = blank.attrs?.hint as string | null | undefined;
      let answer = "";
      while (i < nodes.length && blankOf(nodes[i]!)?.attrs?.hint === hint) {
        answer += inlineNode(nodes[i]!);
        i += 1;
      }
      blankNo += 1;
      out += `{{c${blankNo}::${answer}${hint ? `::${hint}` : ""}}}`;
    }
    return out;
  }

  /** 표 칸은 한 줄이다 — 칸 안의 줄바꿈은 공백으로 편다. */
  function cellText(node: JSONContent): string {
    return (node.content ?? [])
      .map((child) => inline(child.content))
      .join(" ")
      .replaceAll("\n", " ")
      .trim();
  }

  const lines: string[] = [];
  for (const block of doc.content ?? []) {
    if (block.type !== "table") {
      lines.push(inline(block.content));
      continue;
    }
    (block.content ?? []).forEach((row, index) => {
      const cells = row.content ?? [];
      const texts = cells.map(cellText);
      lines.push(`| ${texts.map((text) => text || " ").join(" | ")} |`);
      // 첫 행이 모두 머리 칸이면 제목 행이다.
      if (index === 0 && cells.length > 0 && cells.every((c) => c.type === "tableHeader")) {
        lines.push(`| ${texts.map(() => "---").join(" | ")} |`);
      }
    });
  }
  return lines.join("\n");
}
