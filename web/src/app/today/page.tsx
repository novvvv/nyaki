"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  TodayView,
  type TodayBook,
  type WeekDay,
} from "@/components/today-view";
import {
  checkIn,
  fetchDailyReviewed,
  fetchDueCounts,
  fetchProgress,
  type Attendance,
  type DailyReviewed,
  type DueCounts,
} from "@/lib/api-client";
import { useVocab } from "@/lib/vocab-store";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 오늘 화면에 보여 줄 단어장 수 — 2열 두 줄. */
const BOOK_LIMIT = 4;

/** 로컬 날짜 YYYY-MM-DD — 서버도 보낸 시차 기준으로 같은 꼴을 준다. */
function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 이번 주 월요일부터 일요일까지. 복습 기록은 지난 7일치만 있으면 다 덮인다. */
function buildWeek(today: Date, reviewed: DailyReviewed[]): WeekDay[] {
  const byDate = new Map(
    reviewed.map((row) => [row.date, row.reviews ?? row.count]),
  );
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const todayKey = localDate(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localDate(date);
    return {
      date: key,
      weekday: WEEKDAYS[date.getDay()],
      day: date.getDate(),
      reviews: byDate.get(key) ?? 0,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });
}

/**
 * 앱의 첫 화면(manifest start_url). 웹에서 주소로 들어와도 똑같이 보인다.
 * 숫자는 모두 서버가 센 값이다 — 복습 수, 이번 주 기록, 출석, 단어장 암기율.
 */
export default function TodayPage() {
  const { getToken } = useAuth();
  const { wordBooks, summaries, loading } = useVocab();
  const [due, setDue] = useState<DueCounts | null>(null);
  const [reviewed, setReviewed] = useState<DailyReviewed[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  // 날짜는 화면을 연 순간으로 고정한다 — 그리는 중에 자정을 넘어도 흔들리지 않게.
  const [today] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      // 하나가 실패해도 나머지는 보여 준다.
      const [dueResult, reviewedResult, progressResult] =
        await Promise.allSettled([
          fetchDueCounts(token),
          fetchDailyReviewed(token, 7),
          fetchProgress(token),
        ]);
      if (cancelled) return;
      if (dueResult.status === "fulfilled") setDue(dueResult.value);
      if (reviewedResult.status === "fulfilled")
        setReviewed(reviewedResult.value);
      if (progressResult.status === "fulfilled") {
        setAttendance(progressResult.value.attendance ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const week = useMemo(() => buildWeek(today, reviewed), [today, reviewed]);

  // 복습할 카드가 많은 단어장부터, 같으면 내가 정한 순서대로.
  const books = useMemo<TodayBook[]>(() => {
    const byBook = due?.byBook ?? {};
    return [...wordBooks]
      .map((book, order) => ({
        order,
        id: book.id,
        title: book.title,
        items: summaries[book.id]?.itemCount ?? book.words.length,
        mastery: summaries[book.id]?.masteryRate ?? 0,
        due: byBook[book.id] ?? 0,
      }))
      .sort((a, b) => b.due - a.due || a.order - b.order)
      .slice(0, BOOK_LIMIT)
      .map((book) => ({
        id: book.id,
        title: book.title,
        items: book.items,
        mastery: book.mastery,
        due: book.due,
      }));
  }, [wordBooks, summaries, due]);

  async function handleCheckIn() {
    if (checkingIn || attendance?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await checkIn(token);
      setAttendance(result.attendance);
    } catch {
      // 버튼이 그대로 남아 다시 누를 수 있다.
    } finally {
      setCheckingIn(false);
    }
  }

  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${WEEKDAYS[today.getDay()]}요일`;

  return (
    <TodayView
      dateLabel={dateLabel}
      due={due?.total ?? null}
      week={week}
      streak={attendance?.streak ?? null}
      checkedIn={attendance?.checkedInToday ?? false}
      checkingIn={checkingIn}
      onCheckIn={() => void handleCheckIn()}
      books={books}
      booksLoading={loading}
    />
  );
}
