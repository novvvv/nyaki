/**
 * 빈칸 노트의 마크업.
 *
 * `{{c1::답}}` 빈칸 · `**굵게**` · `==형광==` · `| 칸 | 칸 |` 표
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

/**
 * 가린 빈칸 자리에 채우는 글자 — 밑줄을 긋기 위한 전각 공백 세 칸.
 *
 * 브라우저는 줄의 맨 앞과 맨 끝에 온 공백에는 밑줄을 긋지 않는다. 표 칸에
 * 빈칸만 있으면 공백이 줄의 처음이자 끝이라 빈칸이 통째로 안 보였다. 앞뒤의
 * U+2060(폭 없는 보이지 않는 글자)이 공백을 줄 가운데로 만든다.
 */
export const BLANK_FILL = "⁠　　　⁠";

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

// ── 표 ──────────────────────────────────────────────────────────────────────
//
// 마크다운 표와 같다. `|---|` 줄 위의 행이 제목 행이다.
//
//   | 구분 | 내용 |
//   |---|---|
//   | RTO | {{c1::목표 복구 시간}} |
//
// 서버는 `{{cN::}}`만 보고 자르므로 표는 여러 조각에 걸쳐 온다(칸 안에 빈칸이
// 있으면 그 자리에서 끊긴다). 그래서 표는 원문이 아니라 **조각**에서 읽는다 —
// 출제 화면은 서버 조각을, 미리보기는 [toPieces]로 같은 모양을 만들어 넘긴다.

/** 서버가 잘라 보내는 조각과 같은 모양(api cloze_segments). */
export interface ClozePiece {
  text: string;
  blank: boolean;
  hint?: string;
}

/** 표 한 행. 칸마다 조각 목록이다 — 칸 안에도 빈칸·굵게가 들어간다. */
export type TableRow = ClozePiece[][];

export type ClozeBlock =
  | { kind: "text"; pieces: ClozePiece[] }
  | { kind: "table"; header: TableRow | null; rows: TableRow[] };

/**
 * 원문을 서버와 같은 방식으로 자른다(api `cloze_segments`). 미리보기가 출제
 * 화면과 같은 조각에서 표를 읽게 하려고 둔다.
 */
export function toPieces(raw: string): ClozePiece[] {
  const out: ClozePiece[] = [];
  let cursor = 0;
  for (const match of raw.matchAll(CLOZE_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) out.push({ text: raw.slice(cursor, start), blank: false });
    out.push({ text: match[2]!, blank: true, hint: match[3] });
    cursor = start + match[0].length;
  }
  if (cursor < raw.length) out.push({ text: raw.slice(cursor), blank: false });
  return out;
}

/** 줄 하나. 빈칸은 쪼개지 않는다 — 답 안의 줄바꿈은 답의 일부다. */
function splitLines(pieces: ClozePiece[]): ClozePiece[][] {
  const lines: ClozePiece[][] = [[]];
  for (const piece of pieces) {
    if (piece.blank) {
      lines.at(-1)!.push(piece);
      continue;
    }
    piece.text.split("\n").forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines.at(-1)!.push({ text: part, blank: false });
    });
  }
  return lines;
}

function isEmptyLine(line: ClozePiece[]): boolean {
  return line.every((piece) => !piece.blank && piece.text.trim() === "");
}

/** `|`로 시작해 `|`로 끝나는 줄. 빈칸으로 시작하거나 끝나면 표가 아니다. */
function isTableLine(line: ClozePiece[]): boolean {
  const first = line[0];
  const last = line.at(-1);
  if (!first || !last || first.blank || last.blank) return false;
  const head = first.text.trimStart();
  const tail = last.text.trimEnd();
  // `|` 한 글자뿐인 줄은 시작과 끝이 같은 글자다.
  if (line.length === 1 && head.trim().length < 2) return false;
  return head.startsWith("|") && tail.endsWith("|");
}

/** 칸 앞뒤의 공백을 걷어낸다. 빈칸 조각은 건드리지 않는다. */
function trimCell(cell: ClozePiece[]): ClozePiece[] {
  const out = cell.map((piece) => ({ ...piece }));
  const first = out[0];
  if (first && !first.blank) first.text = first.text.trimStart();
  const last = out.at(-1);
  if (last && !last.blank) last.text = last.text.trimEnd();
  return out.filter((piece) => piece.blank || piece.text !== "");
}

function splitCells(line: ClozePiece[]): TableRow {
  const cells: ClozePiece[][] = [[]];
  for (const piece of line) {
    if (piece.blank) {
      cells.at(-1)!.push(piece);
      continue;
    }
    piece.text.split("|").forEach((part, index) => {
      if (index > 0) cells.push([]);
      if (part) cells.at(-1)!.push({ text: part, blank: false });
    });
  }
  // 맨 앞 `|`의 앞, 맨 뒤 `|`의 뒤는 칸이 아니다.
  return cells.slice(1, -1).map(trimCell);
}

/** `|---|:---:|` 같은 구분 줄. 제목 행을 가르는 표시일 뿐 그리지 않는다. */
function isDelimiterRow(row: TableRow): boolean {
  return (
    row.length > 0 &&
    row.every(
      (cell) =>
        cell.length === 1 && !cell[0]!.blank && /^:?-+:?$/.test(cell[0]!.text),
    )
  );
}

function toTable(lines: ClozePiece[][]): ClozeBlock {
  const parsed = lines.map(splitCells);
  const hasHeader = parsed.length >= 2 && isDelimiterRow(parsed[1]!);
  const header = hasHeader ? parsed[0]! : null;
  const rows = (hasHeader ? parsed.slice(2) : parsed).filter(
    (row) => !isDelimiterRow(row),
  );
  // 칸 수가 모자란 행은 빈칸으로 채운다. 손으로 치다 보면 `|`를 하나 빼먹는다.
  const width = Math.max(...[header ?? [], ...rows].map((row) => row.length));
  const pad = (row: TableRow): TableRow => [
    ...row,
    ...Array.from({ length: width - row.length }, () => []),
  ];
  return { kind: "table", header: header && pad(header), rows: rows.map(pad) };
}

/** 줄들을 다시 한 덩어리로. 붙어 있는 글자 조각은 합친다 — 굵게 마커가 줄을 넘어도 풀린다. */
function joinLines(lines: ClozePiece[][]): ClozePiece[] {
  const out: ClozePiece[] = [];
  const push = (piece: ClozePiece) => {
    const last = out.at(-1);
    if (last && !last.blank && !piece.blank) {
      out[out.length - 1] = { text: last.text + piece.text, blank: false };
    } else {
      out.push(piece);
    }
  };
  lines.forEach((line, index) => {
    if (index > 0) push({ text: "\n", blank: false });
    line.forEach(push);
  });
  return out;
}

/**
 * 조각을 글 덩어리와 표로 나눈다.
 *
 * `|`로 시작해 `|`로 끝나는 줄이 **두 줄 이상** 이어지면 표다. 한 줄뿐이면
 * 글로 둔다 — `| 강조 |`처럼 쓴 글까지 표로 바꾸지 않게. 표 앞뒤의 빈 줄은
 * 버린다. 간격은 표가 스스로 갖는다.
 */
export function toBlocks(pieces: ClozePiece[]): ClozeBlock[] {
  const blocks: ClozeBlock[] = [];
  let text: ClozePiece[][] = [];
  let table: ClozePiece[][] = [];

  const flushText = (beforeTable: boolean) => {
    while (beforeTable && text.length > 0 && isEmptyLine(text.at(-1)!)) text.pop();
    const afterTable = blocks.at(-1)?.kind === "table";
    while (afterTable && text.length > 0 && isEmptyLine(text[0]!)) text.shift();
    if (text.length > 0) blocks.push({ kind: "text", pieces: joinLines(text) });
    text = [];
  };
  const flushTable = () => {
    if (table.length >= 2) {
      flushText(true);
      blocks.push(toTable(table));
    } else {
      text.push(...table);
    }
    table = [];
  };

  for (const line of splitLines(pieces)) {
    if (isTableLine(line)) {
      table.push(line);
    } else {
      flushTable();
      text.push(line);
    }
  }
  flushTable();
  flushText(false);
  return blocks;
}

/** 표는 줄 단위다. 다른 글과 같은 줄에 붙지 않게 앞뒤에 줄바꿈을 넣는다. */
function placeBlock(
  raw: string,
  start: number,
  end: number,
  block: string,
  /** 넣은 표 안에서 커서를 둘 자리. */
  cursor: number,
): Edit {
  const before = raw.slice(0, start);
  const after = raw.slice(end);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const tail = after === "" || after.startsWith("\n") ? "" : "\n";
  const at = before.length + lead.length + cursor;
  return {
    text: before + lead + block + tail + after,
    selectionStart: at,
    selectionEnd: at,
  };
}

function tableLine(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/**
 * cols×rows 빈 표를 넣는다. rows는 제목 행을 포함한 전체 행 수다.
 * 커서는 첫 칸에 둔다 — 바로 이어서 제목을 칠 수 있게.
 */
export function insertTable(
  raw: string,
  start: number,
  end: number,
  cols: number,
  rows: number,
): Edit {
  const empty = Array.from({ length: cols }, () => " ");
  const lines = [
    tableLine(empty),
    tableLine(Array.from({ length: cols }, () => "---")),
    ...Array.from({ length: Math.max(rows - 1, 0) }, () => tableLine(empty)),
  ];
  return placeBlock(raw, start, end, lines.join("\n"), 2);
}

/** 고른 구간이 엑셀·구글 시트에서 복사한 표인가 — 칸이 탭으로 나뉜다. */
export function isSheetText(text: string): boolean {
  return text.includes("\t");
}

/**
 * 엑셀·구글 시트에서 복사한 표(탭으로 나뉜 줄)를 표 문법으로 바꾼다.
 * 첫 줄이 제목 행이다. 커서는 표 끝에 둔다.
 */
export function convertSheet(raw: string, start: number, end: number): Edit {
  const lines = raw
    .slice(start, end)
    .replaceAll("\r", "")
    .split("\n")
    // 시트는 복사할 때 끝에 줄바꿈을 붙인다.
    .filter((line, index, all) => index < all.length - 1 || line !== "");
  const cells = lines.map((line) =>
    line.split("\t").map((cell) => cell.trim() || " "),
  );
  const width = Math.max(...cells.map((row) => row.length));
  const pad = (row: string[]) => [
    ...row,
    ...Array.from({ length: width - row.length }, () => " "),
  ];
  const [head = [], ...body] = cells;
  const table = [
    tableLine(pad(head)),
    tableLine(Array.from({ length: width }, () => "---")),
    ...body.map((row) => tableLine(pad(row))),
  ].join("\n");
  return placeBlock(raw, start, end, table, table.length);
}
