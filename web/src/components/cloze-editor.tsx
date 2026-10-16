"use client";

import type { Editor } from "@tiptap/core";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { PrimaryButton, SubtleButton, TextArea, TextInput } from "@/components/ui";
import {
  BLANK_FILL,
  convertSheet,
  countBlanks,
  insertBlank,
  insertBold,
  insertHighlight,
  insertTable,
  insertUnderline,
  isSheetText,
  MAX_CLOZE_LENGTH,
  parseInline,
  toBlocks,
  toPieces,
  type ClozePiece,
  type Edit,
  type TableRow,
} from "@/lib/cloze";
import { cn } from "@/lib/utils";

// 서식 편집기(TipTap)는 무겁고 브라우저에서만 돈다 — 이 화면에 올 때만 받는다.
const ClozeRichEditor = dynamic(() => import("./cloze-rich-editor"), {
  ssr: false,
  loading: () => <div className="cloze-rich" aria-hidden />,
});

const MAX_TABLE_COLS = 6;
const MAX_TABLE_ROWS = 20;

const MODE_KEY = "nyaki.cloze.codeMode";

/** 코드(원문) 칸으로 쓰는 사람인가. 브라우저에만 남는 편의값이다. */
function loadCodeMode(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === "on";
  } catch {
    return false;
  }
}

function saveCodeMode(on: boolean) {
  try {
    window.localStorage.setItem(MODE_KEY, on ? "on" : "off");
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

/** 숫자 칸의 값을 범위 안으로. 지우는 중(빈 문자열)이면 최솟값. */
function clamp(text: string, min: number, max: number): number {
  const value = Number.parseInt(text, 10);
  return Number.isNaN(value) ? min : Math.min(Math.max(value, min), max);
}

/** 서식 편집기에서 각 툴바 버튼이 하는 일. 고른 글자에 표시를 걸고 끈다. */
const RICH_ACTIONS = {
  blank: (editor: Editor) => editor.chain().focus().toggleMark("blank").run(),
  bold: (editor: Editor) => editor.chain().focus().toggleBold().run(),
  highlight: (editor: Editor) => editor.chain().focus().toggleHighlight().run(),
  underline: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
};

/** 코드 칸에서 각 툴바 버튼이 하는 일. 고른 구간을 마크업으로 감싼다. */
const CODE_ACTIONS = {
  blank: insertBlank,
  bold: insertBold,
  highlight: insertHighlight,
  underline: insertUnderline,
};

/**
 * 빈칸 노트 편집기. 추가 화면과 수정 화면이 같이 쓴다.
 *
 * 기본은 서식 편집기다 — 보이는 그대로 쓰고, `**` · `{{c1::}}` 같은 기호는
 * 보이지 않는다. 가릴 부분을 끌어서 고르고 툴바를 누르면 표시가 걸린다.
 * [코드]를 켜면 예전처럼 원문 칸과 미리보기가 나란히 나온다. 저장하는 값은
 * 어느 쪽이든 같은 원문 문자열이다(lib/cloze-doc).
 */
export function ClozeEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 코드 칸의 예시. 기호가 섞여 있어 서식 편집기에는 쓰지 않는다. */
  placeholder?: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [codeMode, setCodeMode] = useState(loadCodeMode);
  const [editor, setEditor] = useState<Editor | null>(null);
  // 정답이 보이는 상태. 서식 편집기에서는 이때만 고칠 수 있다.
  const [revealed, setRevealed] = useState(true);
  // 표 크기 고르는 창. 숫자는 문자열로 들고 있다가 넣을 때만 범위 안으로 맞춘다 —
  // 지우는 도중에 1로 튀지 않게.
  const [tableOpen, setTableOpen] = useState(false);
  const [colsText, setColsText] = useState("2");
  const [rowsText, setRowsText] = useState("3");

  const onEditor = useCallback((next: Editor | null) => setEditor(next), []);

  /** 코드 칸 툴바의 공통 동작 — 고른 구간에 마크업을 넣고 선택을 되살린다. */
  function apply(edit: (raw: string, start: number, end: number) => Edit) {
    const area = areaRef.current;
    if (!area) return;
    const next = edit(value, area.selectionStart, area.selectionEnd);
    // maxLength는 손으로 치는 것만 막는다. 마크업을 끼워 넣어 넘치면 서버가 422로 거절한다.
    if (next.text.length > MAX_CLOZE_LENGTH) return;
    onChange(next.text);
    // 값이 반영된 뒤에 커서를 옮겨야 한다. 지금 옮기면 리렌더가 되돌린다.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  function format(kind: keyof typeof RICH_ACTIONS) {
    if (codeMode) apply(CODE_ACTIONS[kind]);
    else if (editor) RICH_ACTIONS[kind](editor);
  }

  /**
   * [표] — 코드 칸에서 엑셀·구글 시트의 표(탭으로 나뉜 줄)를 골라 두었으면 바로
   * 표로 바꾸고, 아니면 크기 고르는 창을 연다. 서식 편집기는 시트에서 복사한
   * 표를 붙여 넣으면 그대로 표가 된다.
   */
  function onTable() {
    const area = areaRef.current;
    if (codeMode && area) {
      const selected = value.slice(area.selectionStart, area.selectionEnd);
      if (isSheetText(selected)) {
        setTableOpen(false);
        apply(convertSheet);
        return;
      }
    }
    setTableOpen((prev) => !prev);
  }

  function placeTable() {
    const cols = clamp(colsText, 1, MAX_TABLE_COLS);
    // 제목 행 + 내용 한 줄은 있어야 표다.
    const rows = clamp(rowsText, 2, MAX_TABLE_ROWS);
    setColsText(String(cols));
    setRowsText(String(rows));
    setTableOpen(false);
    if (codeMode) {
      apply((raw, start, end) => insertTable(raw, start, end, cols, rows));
    } else {
      editor
        ?.chain()
        .focus()
        .insertTable({ rows, cols, withHeaderRow: true })
        .run();
    }
  }

  function onTableKey(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      placeTable();
    } else if (event.key === "Escape") {
      setTableOpen(false);
      if (codeMode) areaRef.current?.focus();
      else editor?.commands.focus();
    }
  }

  function toggleCodeMode() {
    const next = !codeMode;
    setCodeMode(next);
    saveCodeMode(next);
    setTableOpen(false);
  }

  const blanks = countBlanks(value);
  // 서식 편집기에서 가리는 동안은 고칠 수 없으니 툴바도 쉰다.
  const toolsOff = !codeMode && !revealed;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            disabled={toolsOff}
            onClick={() => format("blank")}
          >
            빈칸
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs font-semibold"
            disabled={toolsOff}
            onClick={() => format("bold")}
          >
            굵게
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            disabled={toolsOff}
            onClick={() => format("highlight")}
          >
            <span className="bg-highlight px-1">형광</span>
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            disabled={toolsOff}
            onClick={() => format("underline")}
          >
            <span className="underline decoration-1 underline-offset-[3px]">밑줄</span>
          </SubtleButton>

          <div className="relative">
            <SubtleButton
              className={cn(
                "px-3 py-1.5 text-xs",
                tableOpen && "border-ink/40 text-ink",
              )}
              disabled={toolsOff}
              aria-expanded={tableOpen}
              onClick={onTable}
            >
              표
            </SubtleButton>

            {tableOpen ? (
              <div
                onKeyDown={onTableKey}
                className="absolute left-0 top-full z-10 mt-1.5 flex items-center gap-2 whitespace-nowrap rounded-lg border border-taupe/60 bg-cream p-2.5 text-xs text-ink/55 shadow-sm"
              >
                <label className="flex items-center gap-1.5">
                  열
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_TABLE_COLS}
                    value={colsText}
                    onChange={(event) => setColsText(event.target.value)}
                    autoFocus
                    className="w-14 px-2 py-1 text-xs tabular-nums"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  행
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={MAX_TABLE_ROWS}
                    value={rowsText}
                    onChange={(event) => setRowsText(event.target.value)}
                    className="w-14 px-2 py-1 text-xs tabular-nums"
                  />
                </label>
                <PrimaryButton
                  className="px-3 py-1 text-xs"
                  onClick={placeTable}
                >
                  넣기
                </PrimaryButton>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <SubtleButton
            className={cn(
              "px-3 py-1.5 text-xs",
              codeMode && "border-ink bg-ink text-cream hover:text-cream",
            )}
            aria-pressed={codeMode}
            onClick={toggleCodeMode}
          >
            코드
          </SubtleButton>
          <SubtleButton
            className="px-3 py-1.5 text-xs"
            aria-pressed={!revealed}
            onClick={() => setRevealed((prev) => !prev)}
          >
            {revealed ? "가리기" : "정답 보기"}
          </SubtleButton>
        </div>
      </div>

      {codeMode ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <TextArea
            ref={areaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={MAX_CLOZE_LENGTH}
            placeholder={placeholder}
            rows={12}
            aria-label="빈칸 문장"
            className="w-full text-base leading-relaxed"
          />

          <div className="min-h-[13.5rem] rounded-lg border border-taupe/45 bg-cream px-4 py-3.5 text-base leading-relaxed">
            <p className="mb-2 text-xs text-umber/45">미리보기</p>
            {value.trim().length === 0 ? (
              <p className="text-sm text-ink/30">
                가릴 부분을 끌어서 고르고 빈칸을 누릅니다.
              </p>
            ) : (
              <div className="whitespace-pre-wrap">
                <ClozePreview raw={value} revealed={revealed} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-taupe/45 bg-cream transition focus-within:border-ink/25 focus-within:ring-2 focus-within:ring-taupe/35">
          <ClozeRichEditor
            value={value}
            onChange={onChange}
            editable={revealed}
            onEditor={onEditor}
          />
        </div>
      )}

      <p className="mt-2 text-right text-xs text-umber/45">
        {value.length > MAX_CLOZE_LENGTH
          ? `너무 길어요 — ${value.length.toLocaleString()} / ${MAX_CLOZE_LENGTH.toLocaleString()}자`
          : blanks === 0
            ? "빈칸을 하나 이상"
            : `빈칸 ${blanks}개`}
      </p>
    </div>
  );
}

/**
 * 미리보기. 원문을 서버와 같은 조각으로 자른 뒤([toPieces]) 출제 화면과 같은
 * 방식으로 글과 표를 나눈다([toBlocks]) — 쓸 때와 시험볼 때 모양이 같게.
 */
function ClozePreview({ raw, revealed }: { raw: string; revealed: boolean }) {
  return (
    <>
      {toBlocks(toPieces(raw)).map((block, index) =>
        block.kind === "text" ? (
          <PreviewPieces key={index} pieces={block.pieces} revealed={revealed} />
        ) : (
          <PreviewTable
            key={index}
            header={block.header}
            rows={block.rows}
            revealed={revealed}
          />
        ),
      )}
    </>
  );
}

function PreviewPieces({
  pieces,
  revealed,
}: {
  pieces: ClozePiece[];
  revealed: boolean;
}) {
  return (
    <>
      {pieces.map((piece, index) =>
        piece.blank ? (
          <span
            key={index}
            className={cn(
              "underline decoration-taupe underline-offset-[6px]",
              revealed ? "font-semibold text-ink" : "text-ink/25",
            )}
          >
            {revealed ? (
              <Inline text={piece.text} />
            ) : piece.hint ? (
              ` ${piece.hint} `
            ) : (
              BLANK_FILL
            )}
          </span>
        ) : (
          <Inline key={index} text={piece.text} />
        ),
      )}
    </>
  );
}

/** 굵게·형광을 푼다. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => (
        <span
          key={index}
          className={cn(
            token.bold && "font-semibold",
            token.highlight && "bg-highlight",
            token.underline && "underline decoration-1 underline-offset-[3px]",
          )}
        >
          {token.text}
        </span>
      ))}
    </>
  );
}

function PreviewTable({
  header,
  rows,
  revealed,
}: {
  header: TableRow | null;
  rows: TableRow[];
  revealed: boolean;
}) {
  // 빈 칸도 높이를 갖게 공백 한 칸을 넣는다 — 안 넣으면 행이 납작해진다.
  const cell = (pieces: ClozePiece[]) =>
    pieces.length > 0 ? (
      <PreviewPieces pieces={pieces} revealed={revealed} />
    ) : (
      " "
    );

  return (
    <table className="my-2 border-collapse">
      {header ? (
        <thead>
          <tr>
            {header.map((pieces, index) => (
              <th
                key={index}
                className="border border-taupe bg-subtle/60 px-3 py-1.5 text-left align-top font-semibold"
              >
                {cell(pieces)}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((pieces, index) => (
              <td
                key={index}
                className="border border-taupe px-3 py-1.5 align-top"
              >
                {cell(pieces)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
