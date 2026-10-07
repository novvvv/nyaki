"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import type { Folder, WordBook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

/**
 * 사이드바 폭. 경계선을 끌어 바꾸고, 이 브라우저에 기억한다.
 *
 * 긴 단어장 이름이 "정보처리기사 20…"처럼 잘려서 넓힐 수 있게 했다. 너무 좁으면
 * 개수 칸과 이름이 겹치고, 너무 넓으면 본문을 밀어내서 범위를 묶는다.
 */
export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 400;
export const SIDEBAR_DEFAULT = 240;
const SIDEBAR_KEY = "nyaki.sidebarWidth";

export function clampSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) return SIDEBAR_DEFAULT;
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value)));
}

function loadSidebarWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_KEY);
    return raw === null ? SIDEBAR_DEFAULT : clampSidebarWidth(Number(raw));
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

function saveSidebarWidth(value: number) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, String(value));
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

/**
 * 끌고 난 뒤의 클릭을 삼킨다.
 *
 * 줄 전체를 잡아 끌게 하면 손을 뗄 때 클릭이 한 번 더 발생해서, 옮기자마자
 * 그 단어장으로 이동해버린다. 포인터가 얼마나 움직였는지 재뒀다가 문턱을
 * 넘었으면 클릭을 막는다. (예전에는 이걸 피하려고 작은 손잡이를 따로 뒀다)
 */
const DRAG_SLOP = 6;

function useClickAfterDragGuard() {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return {
    onPointerDownCapture: (event: React.PointerEvent) => {
      start.current = { x: event.clientX, y: event.clientY };
      moved.current = false;
    },
    onPointerMoveCapture: (event: React.PointerEvent) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP) moved.current = true;
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (!moved.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/**
 * 사이드바 — 폴더와 단어장.
 *
 * 폴더는 **한 단계뿐**이고, 단어장은 폴더에 안 속해도 된다. 그래서 목록은
 * "폴더들 → 폴더 밖 단어장들" 두 덩이다.
 *
 * 끌어서 옮길 수 있는 것:
 *   - 폴더끼리 순서
 *   - 단어장끼리 순서 (같은 자리 안에서)
 *   - 단어장을 폴더 위로 떨어뜨리면 그 폴더 안으로
 *   - 단어장을 "폴더 밖" 영역으로 떨어뜨리면 밖으로
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    wordBooks,
    folders,
    summaries,
    loading,
    reorderWordBooks,
    reorderFolders,
    moveWordBook,
    renameFolder,
    deleteFolder,
  } = useVocab();

  const [collapsed, setCollapsed] = useState<string[]>([]);
  // 초기값으로 읽는다 — 이펙트에서 읽으면 기본 폭이 한 프레임 보였다 바뀐다.
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  // 끌고 있는 줄. 커서에 붙여 따로 그린다(DragOverlay).
  const [dragging, setDragging] = useState<string | null>(null);
  const showSidebar = pathname !== "/word-books/overview";

  /**
   * 끌고 있는 것에 맞는 후보만 남긴다.
   *
   * 폴더 줄은 소속 단어장을 품고 있어서 사각형이 크다. 그대로 두면 단어장 위로
   * 끌어도 **폴더 쪽이 더 가깝다**고 잡혀 순서 바꾸기가 안 됐다. 그래서
   * 단어장을 끌 때는 폴더 껍데기를 후보에서 빼고, 폴더를 끌 때는 폴더만 본다.
   */
  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const keep =
      type === "folder"
        ? (value: string | undefined) => value === "folder"
        : (value: string | undefined) => value !== "folder";

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) =>
        keep(container.data.current?.type as string | undefined),
      ),
    });
  };

  // 8px은 끌기 시작으로 본다. 이게 없으면 클릭이 드래그로 잡혀 링크가 안 열린다.
  //
  // 키보드 센서는 뺐다. 줄 전체를 잡게 하면서 손잡이를 없앴는데, 키보드로 끌려면
  // 포커스 받을 활성 요소가 따로 있어야 한다. 링크를 감싼 껍데기에 role="button"을
  // 씌우면 스크린리더에 버튼 안에 링크가 있는 꼴이 된다.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const loose = wordBooks.filter((book) => !book.folderId);
  const booksIn = (folderId: string) =>
    wordBooks.filter((book) => book.folderId === folderId);

  async function handleRename(folder: Folder) {
    const title = window.prompt("폴더 이름", folder.title);
    if (title?.trim() && title.trim() !== folder.title) {
      await renameFolder(folder.id, title.trim());
    }
  }

  async function handleDelete(folder: Folder) {
    const inside = booksIn(folder.id);
    const warning =
      inside.length > 0
        ? `"${folder.title}" 폴더를 삭제할까요?\n안의 단어장 ${inside.length}개와 그 단어가 함께 삭제됩니다.`
        : `"${folder.title}" 폴더를 삭제할까요?`;
    if (window.confirm(warning)) await deleteFolder(folder.id);
  }

  function labelOf(id: string) {
    return (
      folders.find((folder) => folder.id === id)?.title ??
      wordBooks.find((book) => book.id === id)?.title ??
      ""
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as "folder" | "book" | undefined;
    const overData = over.data.current as
      | { type?: "folder" | "folder-drop" | "book" | "root"; folderId?: string }
      | undefined;

    if (activeType === "folder") {
      if (overData?.type !== "folder") return;
      void reorderFolders(String(active.id), String(over.id));
      return;
    }

    const book = wordBooks.find((value) => value.id === active.id);
    if (!book) return;

    // 폴더 머리줄이나 "폴더 밖" 영역 위에 떨어뜨리면 자리를 옮긴다.
    if (overData?.type === "folder-drop" || overData?.type === "root") {
      const target =
        overData.type === "folder-drop" ? (overData.folderId ?? null) : null;
      if ((book.folderId ?? null) !== target) {
        void moveWordBook(book.id, target);
      }
      return;
    }

    // 단어장 위에 떨어뜨렸다. 같은 자리면 순서만, 다른 자리면 옮긴다.
    const overBook = wordBooks.find((value) => value.id === over.id);
    if (!overBook) return;

    if ((book.folderId ?? null) !== (overBook.folderId ?? null)) {
      void moveWordBook(book.id, overBook.folderId ?? null);
      return;
    }

    void reorderWordBooks(book.id, overBook.id);
  }

  return (
    // 사이드바는 화면 왼쪽 끝에 붙인다. 예전에는 사이드바와 본문을 함께 최대 폭
    // 상자 안에서 가운데 정렬해서, 넓은 화면에서 사이드바 왼쪽이 비었다.
    // 본문은 각 화면이 남은 영역 안에서 스스로 가운데 정렬한다(mx-auto max-w-*).
    <div className="flex min-h-[calc(100vh-8.5rem)] w-full">
      {showSidebar ? (
        <aside
          style={{ width: sidebarWidth }}
          className="relative hidden shrink-0 border-r border-taupe/30 py-14 pl-6 pr-3 lg:block"
        >
          {/* 오른쪽 경계선을 끌어 폭을 바꾼다. 두 번 누르면 기본 폭으로. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 폭 조절"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture?.(event.pointerId);
              resizeStart.current = { x: event.clientX, width: sidebarWidth };
              setResizing(true);
            }}
            onPointerMove={(event) => {
              const start = resizeStart.current;
              if (!start) return;
              setSidebarWidth(
                clampSidebarWidth(start.width + event.clientX - start.x),
              );
            }}
            onPointerUp={() => {
              if (!resizeStart.current) return;
              resizeStart.current = null;
              setResizing(false);
              saveSidebarWidth(sidebarWidth);
            }}
            onDoubleClick={() => {
              setSidebarWidth(SIDEBAR_DEFAULT);
              saveSidebarWidth(SIDEBAR_DEFAULT);
            }}
            className={cn(
              "absolute -right-[3px] top-0 z-10 h-full w-1.5 cursor-col-resize select-none transition-colors",
              resizing && "bg-taupe/60",
            )}
          />
          {/* 폴더 만들기는 "단어장" 화면 헤더에 있다 — 여기 구석의 `+`는
              글자 하나짜리라 눈에 안 띄었다. */}
          <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink/35">
            단어장
          </p>

          {loading ? (
            <p className="px-2.5 py-1.5 text-xs text-ink/35">불러오는 중…</p>
          ) : wordBooks.length === 0 && folders.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-ink/35">비어 있음</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={collision}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              <nav className="space-y-0.5">
                <SortableContext
                  items={folders.map((folder) => folder.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {folders.map((folder) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      books={booksIn(folder.id)}
                      summaries={summaries}
                      pathname={pathname}
                      open={!collapsed.includes(folder.id)}
                      onToggle={() =>
                        setCollapsed((prev) =>
                          prev.includes(folder.id)
                            ? prev.filter((id) => id !== folder.id)
                            : [...prev, folder.id],
                        )
                      }
                      onRename={() => void handleRename(folder)}
                      onDelete={() => void handleDelete(folder)}
                    />
                  ))}
                </SortableContext>

                <LooseBooks
                  books={loose}
                  summaries={summaries}
                  pathname={pathname}
                  hasFolders={folders.length > 0}
                />
              </nav>

              {/*
                끌리는 줄을 커서에 붙여 따로 그린다.

                이게 없으면 폴더로 옮길 때 원래 자리에 붙어 있다가 손을 뗀
                순간에만 자리가 바뀌어 툭 끊긴다. 되돌아가는 애니메이션도
                끈다 — 이미 옮겨진 자리로 다시 그릴 참이라 한 번 더 움직이면
                두 번 튀는 것처럼 보인다.
              */}
              <DragOverlay dropAnimation={null}>
                {dragging ? <DragPreview label={labelOf(dragging)} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 사이드바 이름 왼쪽의 16px 아이콘. 원본은 32px이라 선명한 화면에서도 깨끗하다.
 * 장식이라 읽어주지 않는다(이름이 이미 있다). 브라우저 기본 이미지 끌기가
 * 줄 끌기(dnd-kit)와 겹치지 않게 막는다.
 */
function SidebarIcon({ src }: { src: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      aria-hidden
      width={16}
      height={16}
      draggable={false}
      className="size-4 shrink-0"
    />
  );
}

/** 커서를 따라다니는 줄. 목록 안의 줄과 같은 모양이되 그림자만 얹는다. */
function DragPreview({ label }: { label: string }) {
  return (
    <div className="w-44 cursor-grabbing rounded-md border border-taupe/40 bg-card px-2.5 py-1.5 text-sm text-ink shadow-sm">
      <span className="truncate">{label}</span>
    </div>
  );
}

function FolderRow({
  folder,
  books,
  summaries,
  pathname,
  open,
  onToggle,
  onRename,
  onDelete,
}: {
  folder: Folder;
  books: WordBook[];
  summaries: Record<string, { itemCount: number }>;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id, data: { type: "folder" } });
  const guard = useClickAfterDragGuard();

  // 단어장을 받는 곳은 **머리줄뿐**이다. 폴더 전체(소속 단어장 포함)를 드롭
  // 영역으로 두면 안쪽 단어장 위로 끌어도 폴더가 먼저 잡힌다.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${folder.id}`,
    data: { type: "folder-drop", folderId: folder.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
    >
      <div
        ref={setDropRef}
        className={cn(
          "group relative flex cursor-grab items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition active:cursor-grabbing",
          isOver ? "bg-subtle ring-1 ring-ink/15" : "hover:bg-subtle/70",
        )}
        {...listeners}
        {...guard}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-umber/75"
        >
          <span aria-hidden className="text-[10px] text-ink/30">
            {open ? "▾" : "▸"}
          </span>
          {/* 펼친 폴더는 채운 아이콘, 접은 폴더는 빈 아이콘 */}
          <SidebarIcon
            src={
              open
                ? "/sidebar/folder_clicked.png"
                : "/sidebar/folder_unclicked.png"
            }
          />
          <span className="truncate font-medium">{folder.title}</span>
        </button>

        <button
          type="button"
          onClick={onRename}
          aria-label={`${folder.title} 이름 바꾸기`}
          className="shrink-0 text-xs text-ink/25 opacity-0 transition hover:text-ink group-hover:opacity-100"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${folder.title} 삭제`}
          className="shrink-0 text-xs text-ink/25 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>

      {open ? (
        <SortableContext
          items={books.map((book) => book.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="ml-3 space-y-0.5 border-l border-taupe/30 pl-1.5">
            {books.length === 0 ? (
              <p className="px-2.5 py-1 text-[11px] text-ink/25">비어 있음</p>
            ) : (
              books.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  meta={summaries[book.id]?.itemCount ?? 0}
                  pathname={pathname}
                />
              ))
            )}
          </div>
        </SortableContext>
      ) : null}
    </div>
  );
}

/** 폴더 밖 단어장. 여기로 떨어뜨리면 폴더에서 꺼낸다. */
function LooseBooks({
  books,
  summaries,
  pathname,
  hasFolders,
}: {
  books: WordBook[];
  summaries: Record<string, { itemCount: number }>;
  pathname: string;
  hasFolders: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "__root__",
    data: { type: "root" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition",
        hasFolders && "mt-2 pt-1",
        isOver && "bg-subtle",
      )}
    >
      <SortableContext
        items={books.map((book) => book.id)}
        strategy={verticalListSortingStrategy}
      >
        {books.length === 0 && hasFolders ? (
          <p className="px-2.5 py-1 text-[11px] text-ink/25">폴더 밖 없음</p>
        ) : (
          books.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              meta={summaries[book.id]?.itemCount ?? 0}
              pathname={pathname}
            />
          ))
        )}
      </SortableContext>
    </div>
  );
}

function BookRow({
  book,
  meta,
  pathname,
}: {
  book: WordBook;
  meta: number;
  pathname: string;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: book.id, data: { type: "book" } });
  const guard = useClickAfterDragGuard();

  const href = `/word-books/${book.id}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative cursor-grab active:cursor-grabbing",
        // 원본은 자리만 남긴다 — 실물은 커서를 따라다니는 DragOverlay다.
        isDragging && "opacity-30",
      )}
      {...listeners}
      {...guard}
    >
      <Link
        href={href}
        // 브라우저 기본 이미지 끌기가 dnd-kit과 겹친다.
        draggable={false}
        className={cn(
          "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition",
          active
            ? "bg-subtle font-medium text-ink"
            : "text-umber/65 hover:bg-subtle/70 hover:text-ink",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {/* 지금 보고 있는 단어장만 채운 아이콘 */}
          <SidebarIcon
            src={
              active ? "/sidebar/doc_clicked.png" : "/sidebar/doc_unclicked.png"
            }
          />
          <span className="truncate">{book.title}</span>
        </span>
        <span className="ml-2 shrink-0 text-xs text-ink/35">{meta}</span>
      </Link>
    </div>
  );
}
