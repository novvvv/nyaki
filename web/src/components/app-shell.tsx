"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { Folder, WordBook } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVocab } from "@/lib/vocab-store";

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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

  function handleDragEnd(event: DragEndEvent) {
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
    <div className="mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-7xl">
      {showSidebar ? (
        <aside className="hidden w-52 shrink-0 border-r border-taupe/30 py-14 pl-6 pr-3 lg:block">
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
              onDragEnd={handleDragEnd}
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
            </DndContext>
          )}
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">{children}</div>
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
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id, data: { type: "folder" } });

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
      className={cn(isDragging && "z-10 opacity-80")}
    >
      <div
        ref={setDropRef}
        className={cn(
          "group relative flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition",
          isOver ? "bg-subtle ring-1 ring-ink/15" : "hover:bg-subtle/70",
        )}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`${folder.title} 순서 바꾸기`}
          className="absolute -left-2.5 top-1/2 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-[11px] leading-none text-ink/25 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <span aria-hidden>⠿</span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-umber/75"
        >
          <span aria-hidden className="text-[10px] text-ink/30">
            {open ? "▾" : "▸"}
          </span>
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
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id, data: { type: "book" } });

  const href = `/word-books/${book.id}`;
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-80")}
    >
      {/* 줄 전체가 링크라 손잡이를 따로 둔다. 없으면 옮기려던 손짓이 클릭이 된다. */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${book.title} 순서 바꾸기`}
        className="absolute -left-2.5 top-1/2 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-[11px] leading-none text-ink/25 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span aria-hidden>⠿</span>
      </button>

      <Link
        href={href}
        className={cn(
          "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition",
          active
            ? "bg-subtle font-medium text-ink"
            : "text-umber/65 hover:bg-subtle/70 hover:text-ink",
        )}
      >
        <span className="truncate">{book.title}</span>
        <span className="ml-2 shrink-0 text-xs text-ink/35">{meta}</span>
      </Link>
    </div>
  );
}
