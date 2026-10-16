"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PrimaryButton, SubtleButton } from "@/components/ui";
import {
  fetchDueCounts,
  fetchDueWords,
  pushGrades,
  pushGradesBeacon,
  type ClozeSegment,
  type DueCard,
  type DueCounts,
  type ReviewGrade,
  type ReviewGradeItem,
} from "@/lib/api-client";
import {
  BLANK_FILL,
  parseInline,
  toBlocks,
  type ClozePiece,
  type TableRow,
} from "@/lib/cloze";
import { formatDelay, loadShowDelays, loadSkin, shuffled } from "@/lib/review";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

type Phase = "setup" | "session" | "done";

const SCREEN = "min-h-[calc(100vh-8.5rem)]";
// 서버 /v1/review/due의 상한과 같다. 실제 출제량은 하루 한도(마이페이지)와
// 오늘 due인 단어 수가 정한다 — 이 값은 그 위에 얹힌 안전장치일 뿐이다.
const MAX_COUNT = 9999;

/**
 * 단어 카드의 앞면. 무엇을 보고 떠올릴지는 종류가 정한다.
 * 빈칸 카드는 문장 자체를 그려야 해서 ClozeText가 따로 맡는다.
 */
function front(card: DueCard): string {
  const word = card.word;
  if (!word) return "";
  return card.kind === "recall" ? word.meaning : word.term;
}

/** 단어 카드의 뒷면 — 앞면이 물은 것의 답. */
function back(card: DueCard): string {
  const word = card.word;
  if (!word) return "";
  return card.kind === "recall" ? word.term : word.meaning;
}

/**
 * 빈칸 문장. 뒤집기 전에는 묻는 자리를 가리고, 뒤집으면 **그 자리에** 답을 넣는다.
 * 문장을 두 벌 늘어놓지 않는 이유는 그게 사용자가 보려는 것이기 때문이다.
 *
 * 표가 있으면 글과 표로 나눠 그린다. 표는 서버 조각에 걸쳐 오므로 조각에서 읽는다
 * (lib/cloze의 toBlocks).
 */
function ClozeText({
  segments,
  revealed,
}: {
  segments: ClozeSegment[];
  revealed: boolean;
}) {
  return (
    <>
      {toBlocks(segments).map((block, index) =>
        block.kind === "text" ? (
          <ClozePieces key={index} segments={block.pieces} revealed={revealed} />
        ) : (
          <ClozeTable
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

function ClozePieces({
  segments,
  revealed,
}: {
  segments: ClozePiece[];
  revealed: boolean;
}) {
  return (
    <span>
      {segments.map((segment, index) =>
        segment.blank ? (
          <span
            key={index}
            className={cn(
              "underline decoration-taupe underline-offset-[6px]",
              revealed ? "font-semibold text-ink" : "text-ink/25",
            )}
          >
            {revealed ? (
              <Marked text={segment.text} />
            ) : segment.hint ? (
              ` ${segment.hint} `
            ) : (
              BLANK_FILL
            )}
          </span>
        ) : (
          <Marked key={index} text={segment.text} />
        ),
      )}
    </span>
  );
}

/** 빈칸 노트 속 표. 문장은 가운데 정렬이어도 칸 안은 왼쪽부터 읽는다. */
function ClozeTable({
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
      <ClozePieces segments={pieces} revealed={revealed} />
    ) : (
      " "
    );

  return (
    <table className="mx-auto my-4 border-collapse text-left">
      {header ? (
        <thead>
          <tr>
            {header.map((pieces, index) => (
              <th
                key={index}
                className="border border-taupe bg-subtle/60 px-3 py-1.5 align-top font-semibold"
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
                className="border border-taupe px-3 py-1.5 align-top font-normal"
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

/**
 * 굵게·형광 마커를 푼다.
 *
 * 서버는 `{{cN::}}`만 보고 문장을 자르므로 `**굵게**`는 조각 안의 글자로 그대로
 * 온다. 여기서 안 풀면 시험 화면에 별표가 그대로 보인다. 편집 화면의 미리보기와
 * 같은 파서를 쓴다.
 */
function Marked({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => (
        <span
          key={index}
          className={cn(
            token.bold && "font-semibold",
            token.highlight && "bg-highlight",
          )}
        >
          {token.text}
        </span>
      ))}
    </>
  );
}

const SELECTION_KEY = "nyaki.review.books";

/** 마지막으로 고른 단어장. 브라우저에만 남는 편의값이라 실패는 무시한다. */
function loadSelection(): string[] | null {
  try {
    const raw = window.localStorage.getItem(SELECTION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function saveSelection(ids: string[]) {
  try {
    window.localStorage.setItem(SELECTION_KEY, JSON.stringify(ids));
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 저장 못 해도 동작에는 지장 없다.
  }
}

/** 빈칸 문장의 글자 수. 크기를 정하는 데 쓴다. */
function clozeLength(card: DueCard): number {
  return (card.cloze?.segments ?? []).reduce(
    (sum, segment) => sum + segment.text.length,
    0,
  );
}

/** 진행 줄에 붙는 종류 표시. 기본 카드에는 붙이지 않는다. */
function kindLabel(card: DueCard): string | null {
  if (card.sourceType === "cloze") return "빈칸";
  // recall은 더 이상 만들 수 없지만, 예전에 켜뒀던 단어장의 카드가 서버에 남아
  // 있을 수 있다. 오면 제대로 그린다.
  if (card.kind === "recall") return "뜻 → 단어";
  return null;
}

/**
 * 노트 스킨의 줄 상자. 모든 줄이 이 크기·높이로 글씨 밑선 자리를 잡는다.
 *
 * 줄 높이가 같아도 글자 크기가 다르면 밑선 자리가 달라진다(큰 글씨일수록
 * 아래로 내려간다). 그래서 줄 상자는 늘 이 크기로 두고, 보이는 글씨는 안쪽
 * NoteText가 제 크기로 이 밑선에 얹힌다. 크기가 달라도 글씨가 모두 노트 줄
 * 바로 위에 앉는다. globals.css의 .note-lines 참고.
 */
const NOTE_LINE = "text-[15px] leading-8";

/**
 * 보이는 글씨. 줄 높이를 1로 둬서 줄 상자를 키우지 않는다 — 키우면 그 아래
 * 줄이 전부 몇 px씩 밀려 노트 줄과 어긋난다.
 *
 * leading-none은 **뒤에** 둔다. cn(tailwind-merge)은 글자 크기 클래스가 뒤에
 * 오면 앞의 줄 높이 클래스를 지운다.
 */
function NoteText({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn(className, "leading-none")}>{children}</span>;
}

/**
 * 문장 속 빈칸 — 노트 줄 위에 진하게 그은 밑줄.
 *
 * 글씨가 아니라 줄 상자 위쪽에 맞춰 놓고(align-top) 높이를 정해서 밑줄이
 * 노트 줄과 정확히 겹친다. 글씨 기준으로 놓으면 글꼴·브라우저마다 몇 px씩
 * 어긋난다. 27px은 줄 상자 위에서 노트 줄(26~27px)까지의 거리다.
 */
function NoteBlank({ children }: { children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block h-[27px] min-w-20 border-b-[1.5px] border-ink/50 px-1 text-center align-top",
        NOTE_LINE,
      )}
    >
      {children}
    </span>
  );
}

/** 노트 스킨의 빈칸 문장. ClozeText와 같되 빈칸을 노트 줄 위의 밑줄로 그린다. */
function NoteCloze({
  segments,
  revealed,
  size,
}: {
  segments: ClozePiece[];
  revealed: boolean;
  /** 문장 글자 크기. 빈칸 안의 글씨도 같은 크기로 쓴다. */
  size: string;
}) {
  return (
    <>
      {segments.map((segment, index) =>
        !segment.blank ? (
          <Marked key={index} text={segment.text} />
        ) : revealed ? (
          // 답은 줄바꿈이 될 수 있어서 칸에 가두지 않고 글씨 밑줄로 긋는다.
          // 3.5px은 글씨 밑선에서 노트 줄까지의 거리다.
          <span
            key={index}
            className="font-semibold underline decoration-ink/50 decoration-[1.5px] underline-offset-[3.5px]"
          >
            <Marked text={segment.text} />
          </span>
        ) : (
          <NoteBlank key={index}>
            {segment.hint ? (
              <NoteText className={cn(size, "font-normal text-ink/30")}>
                {segment.hint}
              </NoteText>
            ) : null}
          </NoteBlank>
        ),
      )}
    </>
  );
}

/**
 * 노트 스킨의 표. 가로줄은 노트 줄을 그대로 쓰고 세로줄과 양옆 테두리만
 * 긋는다 — 한 행이 노트 한 줄이다. 칸 안 글이 길어 줄이 바뀌면 그 행이 두 줄을
 * 차지한다.
 *
 * 가로줄을 진하게 긋지 않는 이유는 빈칸이다. 빈칸은 노트 줄 위의 진한 밑줄이라
 * 가로줄까지 진하면 빈칸이 묻힌다. 제목 행은 줄 대신 옅은 바탕으로 가른다.
 *
 * 행 상자는 노트 줄보다 6px 아래에서 시작한다(.note-lines의 위 여백). 세로줄이
 * 노트 줄에서 노트 줄까지 닿게 표를 6px 올리고, 칸 안 글씨는 6px 내려 제자리에
 * 둔다. relative라 자리는 그대로여서 아래 줄이 밀리지 않는다.
 */
function NoteTable({
  header,
  rows,
  revealed,
  size,
}: {
  header: TableRow | null;
  rows: TableRow[];
  revealed: boolean;
  size: string;
}) {
  const cell = (pieces: ClozePiece[], index: number, head: boolean) => {
    const Cell = head ? "th" : "td";
    return (
      <Cell
        key={index}
        className={cn(
          NOTE_LINE,
          "px-3 text-left align-top",
          index > 0 && "border-l border-ink/30",
          head ? "bg-ink/[0.05] font-semibold" : "font-medium",
        )}
      >
        <span className="relative top-1.5">
          {/* 빈 칸도 높이를 갖게 공백 한 칸 — 안 넣으면 행이 납작해진다. */}
          {pieces.length > 0 ? (
            <NoteText className={size}>
              <NoteCloze segments={pieces} revealed={revealed} size={size} />
            </NoteText>
          ) : (
            " "
          )}
        </span>
      </Cell>
    );
  };

  return (
    // 칸 폭은 고정이다(table-fixed) — 글에 맞춰 늘면 답을 열 때 표가 출렁인다.
    <table className="relative -top-1.5 w-full table-fixed border-separate border-spacing-0 border-x border-ink/30">
      {header ? (
        <thead>
          <tr>{header.map((pieces, index) => cell(pieces, index, true))}</tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((pieces, index) => cell(pieces, index, false))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 노트 스킨의 문제 영역. 누르면 뒤집힌다 — 기본 스킨의 카드 영역과 같다.
 *
 * 줄 친 영역이 글 길이와 상관없이 남은 높이를 다 채운다. `<button>`으로 감싸면
 * Safari에서 안쪽이 글 폭만큼 줄어들어 줄이 잘려 보여서, 줄 배경을 이 상자에
 * 직접 깔고 버튼 역할만 준다. 스페이스·엔터는 화면 전체에서 따로 받는다.
 *
 * 줄 상자의 높이와 위아래 간격은 모두 줄 간격(2rem)의 배수다. 하나라도
 * 어긋나면 그 아래 글씨가 줄 사이에 뜬다.
 */
function NoteSheet({
  card,
  flipped,
  onFlip,
}: {
  card: DueCard;
  flipped: boolean;
  onFlip: () => void;
}) {
  const word = card.word;
  const recall = card.kind === "recall";
  const reading = word?.pronunciation ? (
    <NoteText className="text-ink/45">{word.pronunciation}</NoteText>
  ) : null;

  if (card.cloze) {
    const size =
      clozeLength(card) > 160
        ? "text-base"
        : clozeLength(card) > 60
          ? "text-lg"
          : "text-xl";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onFlip}
        className="note-lines my-6 flex-1 cursor-pointer font-serif text-ink"
      >
        {toBlocks(card.cloze.segments).map((block, index) =>
          block.kind === "text" ? (
            <p key={index} className={NOTE_LINE}>
              <NoteText className={cn(size, "whitespace-pre-wrap font-medium")}>
                <NoteCloze
                  segments={block.pieces}
                  revealed={flipped}
                  size={size}
                />
              </NoteText>
            </p>
          ) : (
            <NoteTable
              key={index}
              header={block.header}
              rows={block.rows}
              revealed={flipped}
              size={size}
            />
          ),
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onFlip}
      className="note-lines my-6 flex-1 cursor-pointer font-serif text-ink"
    >
      <p className={NOTE_LINE}>
        <NoteText className="whitespace-pre-wrap text-[22px] font-semibold">
          {front(card)}
        </NoteText>
      </p>

      {/* 발음은 단어 바로 아래 줄. 뒤집기 전에도 줄을 비워 둬서 뒤집을 때
          빈칸이 밀려나지 않게 한다. 거꾸로 묻는 카드는 발음이 답 쪽이라 답 아래에 둔다. */}
      {reading && !recall ? (
        <p className={cn(NOTE_LINE, "h-8")}>{flipped ? reading : null}</p>
      ) : null}

      {/* 답 칸 — 줄마다 노트 줄 위에 진한 밑줄을 긋는다. 답이 길어 여러 줄이
          되어도 줄마다 그어진다. 위치는 NoteBlank와 같다(줄 상자 위에서 25.5~27px). */}
      <p
        className={cn(
          NOTE_LINE,
          "min-h-8 w-fit min-w-36 pr-2",
          "bg-[linear-gradient(to_bottom,transparent_25.5px,var(--nyaki-blank-line)_25.5px_27px,transparent_27px)] bg-size-[100%_2rem]",
        )}
      >
        {flipped ? (
          <NoteText className="text-lg font-semibold">{back(card)}</NoteText>
        ) : null}
      </p>

      {reading && recall && flipped ? <p className={NOTE_LINE}>{reading}</p> : null}

      {flipped && word?.example ? (
        <p className={cn(NOTE_LINE, "mt-8")}>
          <NoteText className="text-ink/60">{word.example}</NoteText>
        </p>
      ) : null}
      {flipped && word?.exampleMeaning ? (
        <p className={NOTE_LINE}>
          <NoteText className="text-sm text-ink/40">
            {word.exampleMeaning}
          </NoteText>
        </p>
      ) : null}
    </div>
  );
}

export default function ReviewPage() {
  const { getToken } = useAuth();
  const { wordBooks } = useVocab();

  const [phase, setPhase] = useState<Phase>("setup");
  // 출제 개수. null은 "아직 안 건드림" = 고를 수 있는 걸 전부 낸다는 뜻이다.
  // 예전에는 "20"으로 고정해둬서 단어장을 더 켜도 20에 머물러 있었다.
  const [countText, setCountText] = useState<string | null>(null);
  const [queue, setQueue] = useState<DueCard[]>([]);
  // 진행 표시는 **카드 수** 기준이다. 학습 단계 때문에 한 카드가 세션 안에서
  // 여러 번 나오는데, 그때마다 분모가 늘면 "풀수록 늘어나는" 화면이 된다.
  const [sessionSize, setSessionSize] = useState(0);
  const [finished, setFinished] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState({ again: 0, good: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // 복습 주기가 돌아온 카드. 시작 화면의 상한이자 그대로 세션의 출제 목록이 된다.
  const [due, setDue] = useState<DueCard[]>();
  const [shuffle, setShuffle] = useState(false);
  // 채점 버튼 위의 "즉시 / 10분" 표시. 마이페이지에서 켠 사람만 본다.
  // 초기값으로 읽는다 — 이펙트에서 읽으면 한 프레임 보였다가 사라진다.
  const [showDelays] = useState(loadShowDelays);
  // 테스트 화면 스킨. 마이페이지에서 고른다. 같은 이유로 초기값으로 읽는다.
  const [skin] = useState(loadSkin);
  // 단어장별 due 개수. /review/due(최대 200개)의 길이로 세면 201개부터 틀려서
  // 개수 전용 엔드포인트를 따로 부른다.
  const [counts, setCounts] = useState<DueCounts>();
  // 선택한 단어장. undefined면 "아직 안 정함" = 전체를 뜻한다.
  // 마지막 선택을 기억한다. 매번 같은 단어장을 고르는 사람이 대부분이다.
  // 초기값으로 읽는다 — 이펙트에서 setState하면 렌더가 두 번 돈다.
  const [selectedBookIds, setSelectedBookIds] = useState<string[] | undefined>(
    () => loadSelection() ?? undefined,
  );

  // 채점 결과는 세션이 끝날 때 한 번에 보낸다. 카드마다 보내면 30장에 30요청이
  // 되고, 매번 단어 전체를 재전송하게 된다. docs/archive/WEB-REVIEW-PLAN.md 1절.
  // 화면을 다시 그리게 할 값이 아니라서 ref에 둔다.
  const pending = useRef<ReviewGradeItem[]>([]);
  const sent = useRef(false);

  const current = queue[index];

  // 단어장이 하나뿐이면 고를 이유가 없어 선택 줄을 숨긴다.
  const showBookPicker = wordBooks.length > 1;
  // 아직 아무것도 안 고른 상태면 **오늘 낼 게 있는 단어장**만 켠다.
  // 0개짜리를 켜놔도 할 수 있는 게 없어 혼란만 준다.
  const selected = (
    selectedBookIds ??
    wordBooks
      .filter((book) => (counts?.byBook[book.id] ?? 0) > 0)
      .map((book) => book.id)
  ).filter((id) => wordBooks.some((book) => book.id === id));
  const isSelected = (bookId: string) =>
    !showBookPicker || selected.includes(bookId);

  // 화면에 보여줄 개수는 서버가 센 값이다(상한 없음).
  const dueCount = counts
    ? showBookPicker
      ? selected.reduce((sum, id) => sum + (counts.byBook[id] ?? 0), 0)
      : counts.total
    : 0;

  // 슬라이더 상한. 실제로 출제할 수 있는 건 받아둔 목록 안에서 선택한
  // 단어장에 속한 것까지다. **낼 게 없으면 0이다** — 전에는 최소 1로 올려서
  // 복습할 단어가 없는데도 "1개"가 적혀 있었다.
  const picked = (due ?? []).filter((card) => isSelected(card.wordBookId));
  const limit = Math.min(picked.length, MAX_COUNT);

  const parsed = countText === null ? NaN : Number.parseInt(countText, 10);
  const size =
    countText === null
      ? limit
      : Number.isNaN(parsed)
        ? 0
        : Math.min(Math.max(parsed, 1), limit);

  // 화면에 보이는 값은 **항상** 상한 안이다.
  //
  // 예전에는 "상한이 바뀔 때만" 입력값을 내렸는데, 처음부터 상한이 1인 채로
  // 기본값 20이 나중에 채워지는 순서라 보정이 걸리지 않았다. 1개뿐인데 20이
  // 적혀 있고 새로고침해야 고쳐지는 이유가 이것이었다.
  const countValue =
    countText !== null && Number.isNaN(parsed) ? countText : String(size);

  const flush = useCallback(async () => {
    if (sent.current || pending.current.length === 0) return;
    sent.current = true;
    try {
      const token = await getToken();
      if (token) await pushGrades(token, pending.current);
    } catch {
      // 실패해도 세션 요약은 보여준다. 다음 세션에서 다시 보낼 방법은 아직 없다.
      sent.current = false;
    }
  }, [getToken]);

  const grade = useCallback(
    (value: ReviewGrade) => {
      const card = queue[index];
      if (!card) return;

      pending.current.push({
        id: crypto.randomUUID(),
        wordId: card.word?.id ?? card.cloze?.noteId ?? card.id,
        cardId: card.id,
        grade: value,
        reviewedAt: new Date().toISOString(),
      });

      setResult((prev) => ({ ...prev, [value]: prev[value] + 1 }));
      setFlipped(false);

      // 채점한 카드는 이 세션에서 빠진다. 학습 단계가 잡아둔 다음 시각(1분·10분 뒤)은
      // 서버가 계산하고, 그 카드는 **다음 테스트**에서 다시 나온다.
      // 세션 안에서 다시 보여주면 진행이 늘 제자리라 끝이 안 보인다.
      setFinished((prev) => prev + 1);

      const next = index + 1;
      if (next >= queue.length) {
        setPhase("done");
        void flush();
      } else {
        setIndex(next);
      }
    },
    [flush, index, queue],
  );

  useEffect(() => {
    if (phase !== "session") return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((prev) => !prev);
      } else if (event.key === "ArrowLeft") {
        grade("again");
      } else if (event.key === "ArrowRight") {
        grade("good");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, grade]);

  // 세션 도중 탭을 닫으면 메모리에 쌓인 채점이 통째로 날아간다.
  // keepalive로 마지막에 한 번 더 보낸다 — 중복은 서버가 id로 걸러낸다.
  useEffect(() => {
    if (phase !== "session") return;

    function onHide() {
      if (document.visibilityState !== "hidden") return;
      if (sent.current || pending.current.length === 0) return;
      void getToken().then((token) => {
        if (token) pushGradesBeacon(token, pending.current);
      });
    }

    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [phase, getToken]);

  // 시작 화면에 들어올 때마다 due 목록을 받는다. 세션을 마치고 "다시 하기"로
  // 돌아오면 방금 채점한 결과가 반영된 목록을 다시 받게 된다.
  useEffect(() => {
    if (phase !== "setup") return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const token = await getToken();
        if (!token) throw new Error("로그인이 필요합니다.");
        const [dueResult, dueCounts] = await Promise.all([
          fetchDueWords(token, MAX_COUNT),
          fetchDueCounts(token),
        ]);
        if (cancelled) return;

        const cards = dueResult.cards;
        setDue(cards);
        setCounts(dueCounts);
      } catch (reason) {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "단어를 불러오지 못했어요.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, getToken]);

  /** 버튼에 띄울 다음 간격. 카드마다 서버가 계산해 실어 보낸다. */
  function delaysFor(card: DueCard): { again: string; good: string } {
    return {
      again: formatDelay(card.preview.againSeconds),
      good: formatDelay(card.preview.goodSeconds),
    };
  }

  function toggleBook(bookId: string) {
    setSelectedBookIds((prev) => {
      const base = prev ?? selected;
      const next = base.includes(bookId)
        ? base.filter((id) => id !== bookId)
        : [...base, bookId];
      saveSelection(next);
      return next;
    });
  }

  // 위에서 받아둔 목록을 그대로 쓴다. due는 오래 밀린 순이라 앞에서 size개를
  // 자르면 앱과 같은 "오래 밀린 순 N개"가 된다.
  function start() {
    if (!due || size < 1 || loading) return;

    pending.current = [];
    sent.current = false;
    // 무엇을 낼지는 항상 오래 밀린 순으로 고른다 — 섞는 것은 그 안의 순서뿐이다.
    const chosen = picked.slice(0, size);
    setQueue(shuffle ? shuffled(chosen) : chosen);
    setSessionSize(chosen.length);
    setFinished(0);
    setIndex(0);
    setFlipped(false);
    setResult({ again: 0, good: 0 });
    setPhase(chosen.length === 0 ? "done" : "session");
  }

  function stop() {
    setPhase("done");
    void flush();
  }

  const delays = current ? delaysFor(current) : { again: "", good: "" };

  if (phase === "session" && current) {
    return (
      // 노트 스킨은 화면 전체가 종이다. 바깥을 칠해야 가운데 단만 뜨지 않는다.
      <div className={cn(skin === "note" && "bg-paper")}>
        <main
          className={cn(SCREEN, "mx-auto flex w-full max-w-xl flex-col px-6 py-10")}
        >
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={stop}
              className="whitespace-nowrap rounded-lg border border-taupe px-4 py-1.5 text-xs text-ink/50 transition hover:border-ink/40 hover:text-ink"
            >
              그만하기
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="shrink-0 text-xs tabular-nums text-ink/35">
              {finished} / {sessionSize}
            </span>
            {/* 어느 방향으로 묻는 카드인지. 기본 종류뿐이면 군더더기라 숨긴다. */}
            {kindLabel(current) ? (
              <span className="shrink-0 text-[11px] text-ink/35">
                {kindLabel(current)}
              </span>
            ) : null}
            <div className="h-px flex-1 bg-taupe/50">
              <div
                className="h-px bg-ink transition-all duration-200"
                style={{
                  width: `${sessionSize === 0 ? 0 : (finished / sessionSize) * 100}%`,
                }}
              />
            </div>
          </div>

          {skin === "note" ? (
            <NoteSheet
              card={current}
              flipped={flipped}
              onFlip={() => setFlipped((prev) => !prev)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setFlipped((prev) => !prev)}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 text-center"
            >
              {/* div다 — 빈칸 노트에 표가 들어가면 p 안에 표를 둘 수 없다. */}
              <div
                className={cn(
                  "font-semibold tracking-tight text-ink",
                  // 줄바꿈을 적은 대로 살린다. 빈칸 노트는 여러 줄로 쓰는 일이 많다.
                  "whitespace-pre-wrap",
                  // 길이에 따라 크기를 줄인다 — 문단을 단어와 같은 크기로 두면
                  // 화면을 넘긴다.
                  current.cloze
                    ? clozeLength(current) > 160
                      ? "text-base leading-loose"
                      : clozeLength(current) > 60
                        ? "text-lg leading-relaxed"
                        : "text-2xl leading-relaxed"
                    : "text-4xl",
                )}
              >
                {current.cloze ? (
                  <ClozeText segments={current.cloze.segments} revealed={flipped} />
                ) : (
                  front(current)
                )}
              </div>

              {flipped && !current.cloze ? (
                <div className="space-y-3">
                  {current.word?.pronunciation ? (
                    <p className="text-base text-ink/45">
                      {current.word.pronunciation}
                    </p>
                  ) : null}
                  <p className="text-2xl text-ink">{back(current)}</p>
                  {current.word?.example ? (
                    <p className="pt-4 text-base text-ink/55">
                      {current.word.example}
                    </p>
                  ) : null}
                  {current.word?.exampleMeaning ? (
                    <p className="text-sm text-ink/40">
                      {current.word.exampleMeaning}
                    </p>
                  ) : null}
                </div>
              ) : flipped ? null : (
                <p className="text-xs text-ink/25">
                  {current.cloze
                    ? "눌러서 답 보기"
                    : current.kind === "recall"
                      ? "눌러서 단어 보기"
                      : "눌러서 뜻 보기"}
                </p>
              )}
            </button>
          )}

          {/* 안키가 버튼 위에 <1m / <10m를 띄우는 것과 같다. 계산은 서버가 한다. */}
          {showDelays ? (
            <div className="mb-1.5 grid grid-cols-2 gap-2.5 text-center text-[11px] tabular-nums text-ink/35">
              <span>{delays.again}</span>
              <span>{delays.good}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => grade("again")}
              className="whitespace-nowrap rounded-lg border border-ink py-3.5 text-sm font-medium text-ink transition hover:bg-subtle"
            >
              모름
            </button>
            <button
              type="button"
              onClick={() => grade("good")}
              className="group relative whitespace-nowrap rounded-lg border border-ink bg-ink py-3.5 text-sm font-medium text-cream transition hover:bg-ink/85"
            >
              <svg
                viewBox="0 0 40 14"
                aria-hidden
                className="absolute -top-3 right-3 h-3.5 w-10 fill-ink transition group-hover:fill-ink/85"
              >
                <path d="M1.5 14 C2.6 8.5 4 4 6.2 0 C8.6 4.2 10.8 9 13 14 Z" />
                <path d="M27 14 C29.2 9 31.4 4.2 33.8 0 C36 4 37.4 8.5 38.5 14 Z" />
              </svg>
              <span
                aria-hidden
                className="absolute right-10 top-2 flex size-2 items-center justify-center"
              >
                <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
              </span>
              <span
                aria-hidden
                className="absolute right-[22px] top-2 flex size-2 items-center justify-center"
              >
                <span className="h-[2px] w-2 rounded-full bg-cream transition-all duration-200 group-hover:h-2 group-hover:w-[2px]" />
              </span>
              외움
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "done") {
    const total = result.again + result.good;
    return (
      <main
        className={cn(
          SCREEN,
          "mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 py-14 text-center",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {total === 0 ? "오늘 복습할 단어가 없습니다" : "테스트 완료"}
        </h1>

        {total > 0 ? (
          <div className="mt-10 grid w-full grid-cols-2 border-y border-taupe/50">
            <div className="border-r border-taupe/50 py-7">
              <p className="text-4xl font-semibold tabular-nums text-ink">
                {result.good}
              </p>
              <p className="mt-1.5 text-xs text-ink/40">외움</p>
            </div>
            <div className="py-7">
              <p className="text-4xl font-semibold tabular-nums text-ink">
                {result.again}
              </p>
              <p className="mt-1.5 text-xs text-ink/40">모름</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/40">
            다음 복습 시각이 될 때까지 기다려 주세요
          </p>
        )}

        <div className="mt-10 flex items-center gap-6">
          <button
            type="button"
            onClick={() => setPhase("setup")}
            className="whitespace-nowrap text-sm font-medium text-ink transition hover:text-ink/55"
          >
            다시 하기
          </button>
          <Link
            href="/word-books"
            className="whitespace-nowrap text-sm text-ink/40 transition hover:text-ink"
          >
            내 단어장
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        SCREEN,
        "mx-auto grid w-full max-w-3xl items-center gap-12 px-6 py-14",
        // 넓으면 왼쪽에 시작 흐름, 오른쪽에 단어장 목록. 좁으면 위아래로 쌓인다.
        showBookPicker ? "sm:grid-cols-[1fr_14rem]" : "max-w-xl",
      )}
    >
      <div className="flex flex-col items-center text-center">
        <p aria-hidden className="text-lg text-ink/75">
          /ᐠ .⑅.ᐟ\ﾉ
        </p>

        <h1 className="mt-5 flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-tight text-ink">
          {/* 픽셀 폰트는 한자·한글이 없다 — 이 가나 문구에만 쓴다 */}
          <span className="font-pixel text-xl">テスト</span>
          <span>테스트</span>
        </h1>

        <p className="mt-3 text-sm text-ink/40">
          {loading ? (
            "단어를 세는 중이냥"
          ) : dueCount === 0 ? (
            "오늘은 복습할 단어가 없다냥"
          ) : (
            <>
              복습할 때가 된 단어{" "}
              <span className="font-semibold tabular-nums text-ink">
                {dueCount}
              </span>
              개가 기다리는 중이냥
            </>
          )}
        </p>

        <div className="mt-12 flex items-end justify-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={limit === 0 ? 0 : 1}
            max={limit}
            disabled={limit === 0}
            value={countValue}
            onChange={(e) => setCountText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void start();
            }}
            aria-label="출제할 단어 개수"
            className="w-24 border-b border-taupe/60 bg-transparent pb-1.5 text-center text-4xl font-semibold tabular-nums text-ink outline-none transition focus:border-ink"
          />
          <span className="pb-2.5 text-sm text-ink/35">개</span>
        </div>

        <input
          type="range"
          min={limit === 0 ? 0 : 1}
          // max가 min보다 작으면 브라우저가 값을 제멋대로 잡는다.
          max={Math.max(limit, 1)}
          disabled={limit === 0}
          value={size}
          onChange={(e) => setCountText(e.target.value)}
          aria-label="출제할 단어 개수 조절"
          className="mt-8 h-1 w-full max-w-xs cursor-pointer accent-ink"
        />

        <SubtleButton
          onClick={() => setShuffle((prev) => !prev)}
          aria-pressed={shuffle}
          className={cn(
            "mt-8 px-3.5 py-1.5 text-xs",
            shuffle && "border-ink bg-ink text-cream hover:text-cream",
          )}
        >
          {shuffle ? "랜덤 섞기 ON" : "랜덤 섞기"}
        </SubtleButton>

        {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

        <PrimaryButton
          onClick={start}
          disabled={!due || size < 1 || loading || picked.length === 0}
          className="mt-10 gap-2 px-7 py-2.5"
        >
          {loading ? "불러오는 중…" : "시작하기"}
          {loading ? null : <span aria-hidden>→</span>}
        </PrimaryButton>
      </div>

      {/* 단어장 — 칩을 늘어놓으면 개수가 늘수록 줄이 접힌다. 세로 목록이 읽기 쉽다. */}
      {showBookPicker ? (
        <ul className="flex flex-col gap-0.5 sm:border-l sm:border-taupe/30 sm:pl-6">
          {wordBooks.map((book) => {
            const n = counts?.byBook[book.id] ?? 0;
            const on = selected.includes(book.id);
            return (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => toggleBook(book.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-xs transition",
                    // 켜진 줄은 행 전체를 Obsidian으로 채운다.
                    // 디자인 토큰의 "선택은 Obsidian 채움" 규칙 그대로다.
                    on
                      ? "bg-ink text-cream"
                      : "text-ink/35 hover:text-ink/60",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{book.title}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      on ? "text-cream/55" : "text-ink/25",
                    )}
                  >
                    {n}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
