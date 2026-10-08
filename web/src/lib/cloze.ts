/**
 * 빈칸 노트의 마크업.
 *
 * `{{c1::답}}` 빈칸 · `**굵게**` · `==형광==`
 *
 * 빈칸 문법은 서버와 같다(`api/app/vocab/services.py`의 CLOZE_PATTERN). 서버는
 * `{{cN::}}`만 보고 문장을 조각으로 자르므로, 굵게·형광 마커는 조각 안의 글자로
 * 그대로 실려 온다. 그래서 **서버는 이 문법을 몰라도 된다** — 해석은 웹이 한다.
 *
 * 편집 화면의 미리보기와 출제 화면이 같은 함수를 쓴다. 따로 구현하면 쓸 때와
 * 시험볼 때 모양이 갈린다.
 */

// 답은 '::' · '{{' · '}}'를, 힌트는 '{{' · '}}'를 넘지 못한다. 예전처럼 둘 다
// "아무 글자나"([\s\S]+?)로 두면 닫는 }}가 없을 때 끊는 자리의 조합을 전부 시도해
// 길이의 세제곱으로 느려진다(ReDoS, CWE-1333). 5,000자에서 1.8초 — 편집기는 글자를
// 칠 때마다 이걸 돌린다. 서버 CLOZE_PATTERN과 같은 모양이어야 미리보기와 출제가 같다.
const CLOZE_RE =
  /\{\{c(\d+)::((?:(?!::|\{\{|\}\})[\s\S])+)(?:::((?:(?!\{\{|\}\})[\s\S])+))?\}\}/g;
const INLINE_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

/** 빈칸 노트 최대 길이. 서버 ClozeNotePayload.text의 max_length와 같아야 한다. */
export const MAX_CLOZE_LENGTH = 5000;

export interface InlineToken {
  text: string;
  bold: boolean;
  highlight: boolean;
}

export interface ClozeToken extends InlineToken {
  /** 이 자리가 가려지는가. */
  blank: boolean;
  /** 가린 자리에 대신 보여줄 글자(`{{c1::답::힌트}}`). */
  hint?: string;
}

/** `**굵게**` · `==형광==`을 조각으로. 마커가 없으면 통째로 한 조각이다. */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      out.push({ text: text.slice(cursor, start), bold: false, highlight: false });
    }
    const bold = match[1] !== undefined;
    out.push({
      text: bold ? match[1]! : match[2]!,
      bold,
      highlight: !bold,
    });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), bold: false, highlight: false });
  }
  return out;
}

/**
 * 원문 전체를 조각으로. 미리보기가 쓴다.
 *
 * 출제 화면은 이걸 안 쓴다 — 거기서는 서버가 자른 조각이 오고, 그 조각 안의
 * 마커만 [parseInline]으로 푼다. 가리는 판단을 서버와 웹이 각자 하면 갈린다.
 */
export function parseCloze(raw: string): ClozeToken[] {
  const out: ClozeToken[] = [];
  let cursor = 0;

  for (const match of raw.matchAll(CLOZE_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      for (const token of parseInline(raw.slice(cursor, start))) {
        out.push({ ...token, blank: false });
      }
    }
    for (const token of parseInline(match[2]!)) {
      out.push({ ...token, blank: true, hint: match[3] });
    }
    cursor = start + match[0].length;
  }

  if (cursor < raw.length) {
    for (const token of parseInline(raw.slice(cursor))) {
      out.push({ ...token, blank: false });
    }
  }
  return out;
}

/** 가려질 자리의 수. 카드 수가 아니다 — 노트 하나가 카드 한 장이다. */
export function countBlanks(raw: string): number {
  return [...raw.matchAll(CLOZE_RE)].length;
}

/** 다음에 쓸 빈칸 번호. 이미 쓴 것 중 가장 큰 값 + 1. */
export function nextBlankNumber(raw: string): number {
  const numbers = [...raw.matchAll(CLOZE_RE)].map((match) => Number(match[1]));
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

export interface Edit {
  text: string;
  /** 편집 후 커서(또는 선택 영역)를 둘 자리. */
  selectionStart: number;
  selectionEnd: number;
}

/**
 * 고른 구간을 앞뒤 문자열로 감싼다.
 *
 * 고른 게 없으면 빈 마크업을 넣고 **커서를 안쪽에** 둔다. 그래야 바로 이어서
 * 칠 수 있다. 고른 게 있으면 감싼 내용을 그대로 선택 상태로 남긴다.
 */
export function wrap(
  raw: string,
  start: number,
  end: number,
  before: string,
  after: string,
): Edit {
  const selected = raw.slice(start, end);
  return {
    text: raw.slice(0, start) + before + selected + after + raw.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/** 고른 구간을 빈칸으로. 번호는 문서에 있는 것 다음 값을 쓴다. */
export function insertBlank(raw: string, start: number, end: number): Edit {
  return wrap(raw, start, end, `{{c${nextBlankNumber(raw)}::`, "}}");
}

export function insertBold(raw: string, start: number, end: number): Edit {
  return wrap(raw, start, end, "**", "**");
}

export function insertHighlight(raw: string, start: number, end: number): Edit {
  return wrap(raw, start, end, "==", "==");
}
