import type { ActivePlan, AppSettings, DailyLog, HifzSegment, KunehStore, SegmentDraft } from "./types"

const STORAGE_KEY = "kuneh-v3"

export function getDefaultSettings(): AppSettings {
  return {
    dailyMemorizationGoal: 1,
    dailyReviewGoal: 5,
    targetDate: "2027-02-07",
  }
}

export function createEmptyStore(): KunehStore {
  return {
    settings: getDefaultSettings(),
    activePlan: null,
    segments: {},
    logs: [],
  }
}

function normalizePlan(raw: Partial<ActivePlan> | null | undefined): ActivePlan | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null
  }

  return {
    id: raw.id,
    name: raw.name,
    targetJuz: raw.targetJuz ?? [],
    targetSurahs: raw.targetSurahs ?? [],
    targetSegments: raw.targetSegments ?? [],
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ?? new Date().toISOString().slice(0, 10),
  }
}

function normalizeSegment(raw: Partial<HifzSegment>): HifzSegment | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.surahId !== "number" ||
    typeof raw.surahName !== "string" ||
    typeof raw.fromAyah !== "number" ||
    typeof raw.toAyah !== "number"
  ) {
    return null
  }

  return {
    id: raw.id,
    surahId: raw.surahId,
    surahName: raw.surahName,
    fromAyah: raw.fromAyah,
    toAyah: raw.toAyah,
    memorization: (raw.memorization ?? 0) as HifzSegment["memorization"],
    meaning: (raw.meaning ?? 0) as HifzSegment["meaning"],
    stability: raw.stability ?? 0,
    lastReviewed: raw.lastReviewed ?? null,
    nextReview: raw.nextReview ?? null,
    reviewCount: raw.reviewCount ?? 0,
    notes: raw.notes ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ?? new Date().toISOString().slice(0, 10),
  }
}

function normalizeLog(raw: Partial<DailyLog> & { date: string }): DailyLog {
  return {
    date: raw.date,
    reviewedSegmentIds: [...new Set(raw.reviewedSegmentIds ?? [])],
    addedSegmentIds: [...new Set(raw.addedSegmentIds ?? [])],
    ratings: raw.ratings ?? {},
    sessionNotes: raw.sessionNotes ?? [],
  }
}

export function normalizeStore(raw: unknown): KunehStore {
  if (!raw || typeof raw !== "object") {
    return createEmptyStore()
  }

  const candidate = raw as Partial<KunehStore> & {
    settings?: Partial<AppSettings>
    activePlan?: Partial<ActivePlan> | null
    segments?: Record<string, Partial<HifzSegment>>
    logs?: Array<Partial<DailyLog> & { date: string }>
  }

  const segments = Object.fromEntries(
    Object.entries(candidate.segments ?? {})
      .map(([id, segment]) => [id, normalizeSegment({ ...segment, id })] as const)
      .filter((entry): entry is [string, HifzSegment] => entry[1] !== null)
  )

  return {
    settings: {
      ...getDefaultSettings(),
      ...(candidate.settings ?? {}),
    },
    activePlan: normalizePlan(candidate.activePlan),
    segments,
    logs: (candidate.logs ?? [])
      .filter((log) => typeof log?.date === "string")
      .map((log) => normalizeLog(log as Partial<DailyLog> & { date: string })),
  }
}

export function loadStore(): KunehStore {
  if (typeof window === "undefined") {
    return createEmptyStore()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeStore(JSON.parse(raw)) : createEmptyStore()
  } catch {
    return createEmptyStore()
  }
}

export function saveStore(store: KunehStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function resetStoredData() {
  localStorage.removeItem(STORAGE_KEY)
}

export function buildSegmentId(draft: Pick<SegmentDraft, "surahId" | "fromAyah" | "toAyah">): string {
  return `${draft.surahId}:${draft.fromAyah}-${draft.toAyah}`
}
