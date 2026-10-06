import type { MasteryRow } from "./stats";

/**
 * 전체 통계의 "그룹" — 여러 단어장을 묶어 하나의 암기율로 본다.
 *
 * 폴더와는 별개다. 한 단어장이 여러 그룹에 들어가도 된다. 화면 설정이라 이
 * 브라우저에만 저장한다(다른 기기에서는 안 보인다).
 */
export interface MasteryGroup {
  /** "group:"으로 시작한다 — 단어장 id와 같은 목록에 섞여 저장되기 때문이다. */
  id: string;
  name: string;
  bookIds: string[];
}

export const GROUP_PREFIX = "group:";

const STORAGE_KEY = "nyaki.stats.masteryGroups";

export function isGroupId(id: string): boolean {
  return id.startsWith(GROUP_PREFIX);
}

export function newGroupId(): string {
  return `${GROUP_PREFIX}${crypto.randomUUID()}`;
}

export function loadGroups(): MasteryGroup[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): MasteryGroup[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.id !== "string" ||
        !isGroupId(item.id) ||
        typeof item.name !== "string" ||
        !Array.isArray(item.bookIds)
      ) {
        return [];
      }
      return [
        {
          id: item.id,
          name: item.name,
          bookIds: item.bookIds.filter(
            (id: unknown): id is string => typeof id === "string",
          ),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function saveGroups(groups: MasteryGroup[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 기억 못 해도 동작에는 지장 없다.
  }
}

/** 단계 6칸 중 앞 둘(새 카드 · 학습 중)이 X, 나머지가 OK다. 서버 암기율과 같은 경계. */
const OK_FROM_STAGE = 2;

export interface GroupRow extends MasteryRow {
  /** 아직 남아 있는 단어장 수. 0이면 비어 있는 그룹이다. */
  memberCount: number;
}

/**
 * 그룹 하나를 막대 · 곡선 한 줄로 합친다.
 *
 * **암기율을 평균 내지 않는다.** 카드 100장짜리 50%와 10장짜리 100%를 평균하면
 * 75%지만, 실제로는 OK 60장 ÷ 110장 = 55%다. 단계별 카드 수를 더해 다시 센다.
 *
 * 지워졌거나 비어 있는 단어장은 rows에 없으니 자연히 빠진다. 서버가 아직 단계를
 * 안 보내는 단어장이 섞이면 단어 수로 가중한 근사치를 쓰고, 곡선은 그리지 않는다.
 */
export function computeGroupRow(
  group: MasteryGroup,
  rows: MasteryRow[],
): GroupRow {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const members = [...new Set(group.bookIds)]
    .map((id) => byId.get(id))
    .filter((row): row is MasteryRow => row !== undefined);

  const allHaveStages =
    members.length > 0 && members.every((row) => row.stages.length > 0);
  const itemCount = members.reduce((sum, row) => sum + row.itemCount, 0);

  if (allHaveStages) {
    const stages = members[0]!.stages.map((_, i) =>
      members.reduce((sum, row) => sum + (row.stages[i] ?? 0), 0),
    );
    const cards = stages.reduce((sum, n) => sum + n, 0);
    const ok = stages.slice(OK_FROM_STAGE).reduce((sum, n) => sum + n, 0);
    return {
      id: group.id,
      title: group.name,
      rate: cards > 0 ? Math.round((ok * 100) / cards) : 0,
      itemCount,
      stages,
      memberCount: members.length,
    };
  }

  const weighted = members.reduce(
    (sum, row) => sum + row.rate * row.itemCount,
    0,
  );
  return {
    id: group.id,
    title: group.name,
    rate: itemCount > 0 ? Math.round(weighted / itemCount) : 0,
    itemCount,
    stages: [],
    memberCount: members.length,
  };
}
