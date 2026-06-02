import { AYAH_METADATA, SURAHS, getJuzMeta, getSurahMeta } from "./quran-metadata"
import { buildSegmentId, createEmptyStore, getDefaultSettings } from "./storage"
import type {
  DailyLog,
  EnrichedSegment,
  HifzSegment,
  KunehStore,
  ActivePlan,
  PlanTargetSegment,
  ProgressMetrics,
  Rating,
  SegmentBuckets,
  SegmentDraft,
  SegmentStatus,
  SurahMeta,
  SurahSummary,
} from "./types"
import { addDays, daysBetween, formatNumberAr, today } from "./utils"

export { createEmptyStore, getDefaultSettings }

export const STATUS_COLORS: Record<SegmentStatus, string> = {
  none: "bg-stone-200 text-stone-400",
  weak: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  strong: "bg-emerald-100 text-emerald-800",
}

export const STATUS_DOT: Record<SegmentStatus, string> = {
  none: "bg-stone-300",
  weak: "bg-rose-400",
  medium: "bg-amber-400",
  strong: "bg-emerald-500",
}

export const STATUS_LABEL: Record<SegmentStatus, string> = {
  none: "غير محفوظ",
  weak: "ضعيف",
  medium: "متوسط",
  strong: "قوي",
}

export const MEMORIZATION_LABEL: Record<HifzSegment["memorization"], string> = {
  0: "لم يحفظ",
  1: "ضعيف",
  2: "متوسط",
  3: "قوي",
}

export const MEANING_LABEL: Record<HifzSegment["meaning"], string> = {
  0: "لم يفهم",
  1: "ضعيف",
  2: "متوسط",
  3: "قوي",
}

const RATING_DELTA: Record<Rating, number> = {
  struggled: 3,
  good: 8,
  excellent: 15,
}

const RATING_DAYS: Record<Rating, number> = {
  struggled: 1,
  good: 3,
  excellent: 7,
}

export function memorizationScore(level: HifzSegment["memorization"]): number {
  return level * 33
}

export function stabilityStatus(stability: number): SegmentStatus {
  if (stability <= 0) return "none"
  if (stability < 40) return "weak"
  if (stability < 70) return "medium"
  return "strong"
}

export function effectiveStability(segment: HifzSegment, todayDate = today()): number {
  if (!segment.nextReview) return segment.stability
  const overdueDays = Math.max(0, daysBetween(segment.nextReview, todayDate) - 2)
  return Math.max(0, segment.stability - overdueDays * 5)
}

export function computeSegmentNextReviewDate(baseDate: string, rating: Rating): string {
  return addDays(baseDate, RATING_DAYS[rating])
}

export function applyRating(segment: HifzSegment, rating: Rating, todayDate = today()): HifzSegment {
  const stability = Math.min(100, effectiveStability(segment, todayDate) + RATING_DELTA[rating])
  return {
    ...segment,
    stability,
    lastReviewed: todayDate,
    nextReview: computeSegmentNextReviewDate(todayDate, rating),
    reviewCount: segment.reviewCount + 1,
    updatedAt: todayDate,
  }
}

export function isDue(segment: HifzSegment, todayDate = today()): boolean {
  return Boolean(segment.nextReview && segment.nextReview <= todayDate)
}

export function isOverdue(segment: HifzSegment, todayDate = today()): boolean {
  return Boolean(segment.nextReview && segment.nextReview < todayDate)
}

export function isThreatened(segment: HifzSegment, todayDate = today()): boolean {
  if (segment.memorization === 0) return false
  if (isDue(segment, todayDate)) return false
  const effective = effectiveStability(segment, todayDate)
  return effective < 45 || segment.stability - effective >= 10
}

export function getReferencePages(surahId: number, fromAyah: number, toAyah: number): number[] | null {
  const pages = AYAH_METADATA
    .filter((ayah) => ayah.surahId === surahId && ayah.ayah >= fromAyah && ayah.ayah <= toAyah)
    .map((ayah) => ayah.page)

  if (pages.length === 0) return null
  return [...new Set(pages)].sort((a, b) => a - b)
}

export function describeReferencePages(surahId: number, fromAyah: number, toAyah: number): string | null {
  const pages = getReferencePages(surahId, fromAyah, toAyah)
  if (!pages || pages.length === 0) return null
  if (pages.length === 1) return `الصفحة ${formatNumberAr(pages[0])}`
  return `الصفحات ${formatNumberAr(pages[0])}–${formatNumberAr(pages[pages.length - 1])}`
}

export function enrichSegment(segment: HifzSegment, todayDate = today()): EnrichedSegment {
  const due = isDue(segment, todayDate)
  const overdue = isOverdue(segment, todayDate)
  const threatened = isThreatened(segment, todayDate)
  const effective = effectiveStability(segment, todayDate)

  return {
    ...segment,
    effectiveStability: effective,
    status: stabilityStatus(effective),
    isDue: due,
    isOverdue: overdue,
    isThreatened: threatened,
    bucket: overdue ? "overdue" : due ? "due" : threatened ? "threatened" : null,
    referencePages: getReferencePages(segment.surahId, segment.fromAyah, segment.toAyah),
  }
}

function sortSegments(segments: EnrichedSegment[]): EnrichedSegment[] {
  return [...segments].sort((a, b) => {
    if (a.nextReview && b.nextReview && a.nextReview !== b.nextReview) {
      return a.nextReview.localeCompare(b.nextReview)
    }
    if (a.surahId !== b.surahId) return a.surahId - b.surahId
    return a.fromAyah - b.fromAyah
  })
}

export function buildSegmentBuckets({
  store,
  todayDate = today(),
}: {
  store: KunehStore
  todayDate?: string
}): SegmentBuckets {
  const enriched = Object.values(store.segments).map((segment) => enrichSegment(segment, todayDate))

  return {
    overdue: sortSegments(enriched.filter((segment) => segment.isOverdue)),
    due: sortSegments(enriched.filter((segment) => !segment.isOverdue && segment.isDue)),
    threatened: sortSegments(
      enriched.filter((segment) => !segment.isOverdue && !segment.isDue && segment.isThreatened)
    ),
  }
}

export function validateSegmentDraft(draft: SegmentDraft, store: KunehStore, segmentId?: string): string | null {
  const surah = getSurahMeta(draft.surahId)
  if (!surah) return "السورة غير معروفة"
  if (draft.fromAyah > draft.toAyah) return "من آية يجب أن تكون أقل أو تساوي إلى آية"
  if (draft.fromAyah < 1 || draft.toAyah > surah.ayahCount) return "الآيات خارج نطاق السورة"

  const duplicateId = buildSegmentId(draft)
  const duplicate = Object.values(store.segments).find(
    (segment) =>
      segment.id !== segmentId &&
      segment.surahId === draft.surahId &&
      segment.fromAyah === draft.fromAyah &&
      segment.toAyah === draft.toAyah
  )
  if (duplicate || (store.segments[duplicateId] && duplicateId !== segmentId)) return "هذا المقطع مكرر داخل السورة"

  return null
}

export function createSegmentFromDraft(draft: SegmentDraft, todayDate = today()): HifzSegment {
  const surah = getSurahMeta(draft.surahId)
  const stability = Math.min(100, draft.memorization * 25)
  const nextReview = draft.memorization === 0 ? null : addDays(todayDate, 1)

  return {
    id: buildSegmentId(draft),
    surahId: draft.surahId,
    surahName: surah?.name ?? `سورة ${draft.surahId}`,
    fromAyah: draft.fromAyah,
    toAyah: draft.toAyah,
    memorization: draft.memorization,
    meaning: draft.meaning,
    stability,
    lastReviewed: null,
    nextReview,
    reviewCount: 0,
    notes: draft.notes ?? "",
    createdAt: todayDate,
    updatedAt: todayDate,
  }
}

function coveredAyahs(segments: HifzSegment[], ayahCount: number): number {
  const covered = new Set<number>()
  segments.forEach((segment) => {
    for (let ayah = segment.fromAyah; ayah <= Math.min(segment.toAyah, ayahCount); ayah += 1) {
      covered.add(ayah)
    }
  })
  return covered.size
}

export function computeSurahProgress(surahId: number, store: KunehStore, todayDate = today()): SurahSummary {
  const surah = getSurahMeta(surahId) as SurahMeta
  const segments = Object.values(store.segments).filter((segment) => segment.surahId === surahId)
  const enriched = segments.map((segment) => enrichSegment(segment, todayDate))
  const memorizedSegments = segments.filter((segment) => segment.memorization > 0).length
  const progressPercent = surah
    ? Math.round((coveredAyahs(segments.filter((segment) => segment.memorization > 0), surah.ayahCount) / surah.ayahCount) * 100)
    : 0
  const averageStability =
    enriched.length === 0 ? 0 : Math.round(enriched.reduce((sum, segment) => sum + segment.effectiveStability, 0) / enriched.length)
  const nearestReview =
    enriched
      .filter((segment) => segment.nextReview)
      .sort((a, b) => (a.nextReview ?? "").localeCompare(b.nextReview ?? ""))[0]?.nextReview ?? null

  return {
    surah,
    memorizedSegments,
    progressPercent,
    status: stabilityStatus(averageStability),
    averageStability,
    overdueCount: enriched.filter((segment) => segment.isOverdue).length,
    nearestReview,
  }
}

export function buildSurahSummaries(store: KunehStore, todayDate = today()): SurahSummary[] {
  return SURAHS.map((surah) => computeSurahProgress(surah.id, store, todayDate))
}

function targetContainsSegment(target: PlanTargetSegment, segment: HifzSegment): boolean {
  if (target.surahId !== segment.surahId) return false
  return !(segment.toAyah < target.fromAyah || segment.fromAyah > target.toAyah)
}

function getKnownSurahIdsFromJuz(plan: ActivePlan | null): number[] {
  if (!plan) return []

  return [...new Set((plan.targetJuz ?? []).flatMap((juzId) => getJuzMeta(juzId)?.surahIds ?? []))]
}

function getKnownJuzRanges(plan: ActivePlan | null): PlanTargetSegment[] {
  if (!plan) return []
  return (plan.targetJuz ?? []).flatMap((juzId) => getJuzMeta(juzId)?.ranges ?? [])
}

export function isSegmentInsidePlan(segment: HifzSegment, plan: ActivePlan | null): boolean {
  if (!plan) return false
  if (getKnownJuzRanges(plan).some((target) => targetContainsSegment(target, segment))) return true
  if (plan.targetSurahs?.includes(segment.surahId)) return true
  return Boolean(plan.targetSegments?.some((target) => targetContainsSegment(target, segment)))
}

export function getSurahPlanReason(
  surahId: number,
  plan: ActivePlan | null
): "surah" | "juz" | "segment" | null {
  if (!plan) return null
  if (plan.targetSurahs?.includes(surahId)) return "surah"
  if (getKnownJuzRanges(plan).some((target) => target.surahId === surahId)) return "juz"
  if (plan.targetSegments?.some((target) => target.surahId === surahId)) return "segment"
  return null
}

export function isSurahInsidePlan(surahId: number, plan: ActivePlan | null): boolean {
  return getSurahPlanReason(surahId, plan) !== null
}

function getPlanSegments(store: KunehStore): HifzSegment[] {
  if (!store.activePlan) return []
  return Object.values(store.segments).filter((segment) => isSegmentInsidePlan(segment, store.activePlan))
}

export function getPlannedSegmentBuckets(store: KunehStore, todayDate = today()): SegmentBuckets {
  if (!store.activePlan) {
    return { overdue: [], due: [], threatened: [] }
  }

  const enriched = getPlanSegments(store).map((segment) => enrichSegment(segment, todayDate))

  return {
    overdue: sortSegments(enriched.filter((segment) => segment.isOverdue)),
    due: sortSegments(enriched.filter((segment) => !segment.isOverdue && segment.isDue)),
    threatened: sortSegments(
      enriched.filter((segment) => !segment.isOverdue && !segment.isDue && segment.isThreatened)
    ),
  }
}

function buildAyahKeysForPlan(plan: ActivePlan | null): Set<string> {
  const keys = new Set<string>()
  if (!plan) return keys

  ;(plan.targetJuz ?? []).forEach((juzId) => {
    const juz = getJuzMeta(juzId)
    ;(juz?.ranges ?? []).forEach((target) => {
      for (let ayah = target.fromAyah; ayah <= target.toAyah; ayah += 1) {
        keys.add(`${target.surahId}:${ayah}`)
      }
    })
  })

  ;(plan.targetSurahs ?? []).forEach((surahId) => {
    const surah = getSurahMeta(surahId)
    if (!surah) return
    for (let ayah = 1; ayah <= surah.ayahCount; ayah += 1) {
      keys.add(`${surahId}:${ayah}`)
    }
  })

  ;(plan.targetSegments ?? []).forEach((target) => {
    for (let ayah = target.fromAyah; ayah <= target.toAyah; ayah += 1) {
      keys.add(`${target.surahId}:${ayah}`)
    }
  })

  return keys
}

export function getKnownMappedJuzCount(plan: ActivePlan | null): number {
  if (!plan) return 0
  return (plan.targetJuz ?? []).filter((juzId) => Boolean(getJuzMeta(juzId)?.ranges.length)).length
}

function buildAyahKeysForSegments(segments: HifzSegment[]): Set<string> {
  const keys = new Set<string>()
  segments
    .filter((segment) => segment.memorization > 0)
    .forEach((segment) => {
      for (let ayah = segment.fromAyah; ayah <= segment.toAyah; ayah += 1) {
        keys.add(`${segment.surahId}:${ayah}`)
      }
    })
  return keys
}

function getFullQuranAyahCount(): number {
  return SURAHS.reduce((sum, surah) => sum + surah.ayahCount, 0)
}

export function buildPlanProgress(store: KunehStore): {
  planCompletionPercent: number
  fullQuranCompletionPercent: number
} {
  const planTargets = buildAyahKeysForPlan(store.activePlan)
  const coveredPlanAyahs = buildAyahKeysForSegments(getPlanSegments(store))
  const coveredAllAyahs = buildAyahKeysForSegments(Object.values(store.segments))

  let coveredPlanCount = 0
  planTargets.forEach((key) => {
    if (coveredPlanAyahs.has(key)) coveredPlanCount += 1
  })

  return {
    planCompletionPercent:
      planTargets.size === 0 ? 0 : Math.round((coveredPlanCount / planTargets.size) * 100),
    fullQuranCompletionPercent: Math.round((coveredAllAyahs.size / getFullQuranAyahCount()) * 100),
  }
}

export function buildProgressMetrics(store: KunehStore, todayDate = today()): ProgressMetrics {
  const segments = (store.activePlan ? getPlanSegments(store) : Object.values(store.segments)).map((segment) =>
    enrichSegment(segment, todayDate)
  )
  const memorizedSegments = segments.filter((segment) => segment.memorization > 0)
  const strongSegments = memorizedSegments.filter((segment) => segment.status === "strong").length
  const weakSegments = memorizedSegments.filter((segment) => segment.status === "weak").length
  const overdueSegments = memorizedSegments.filter((segment) => segment.isOverdue).length
  const averageStability =
    memorizedSegments.length === 0
      ? 0
      : Math.round(
          memorizedSegments.reduce((sum, segment) => sum + segment.effectiveStability, 0) / memorizedSegments.length
        )

  const mostNeedySurahs = buildSurahSummaries(store, todayDate)
    .filter((surah) => surah.memorizedSegments > 0 && isSurahInsidePlan(surah.surah.id, store.activePlan))
    .sort((a, b) => {
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount
      return a.averageStability - b.averageStability
    })
    .slice(0, 3)

  const planProgress = buildPlanProgress(store)

  return {
    memorizedSegments: memorizedSegments.length,
    strongSegments,
    weakSegments,
    overdueSegments,
    averageStability,
    mostNeedySurahs,
    planCompletionPercent: planProgress.planCompletionPercent,
    fullQuranCompletionPercent: planProgress.fullQuranCompletionPercent,
  }
}

export function describeSegment(segment: Pick<HifzSegment, "surahName" | "fromAyah" | "toAyah">): string {
  return `سورة ${segment.surahName}، الآيات ${segment.fromAyah}–${segment.toAyah}`
}

export function mergeDailyLog(existing: DailyLog | undefined, incoming: DailyLog): DailyLog {
  if (!existing) return incoming

  return {
    date: incoming.date,
    reviewedSegmentIds: [...new Set([...existing.reviewedSegmentIds, ...incoming.reviewedSegmentIds])],
    addedSegmentIds: [...new Set([...existing.addedSegmentIds, ...incoming.addedSegmentIds])],
    ratings: {
      ...existing.ratings,
      ...incoming.ratings,
    },
    sessionNotes: [...existing.sessionNotes, ...incoming.sessionNotes].filter(Boolean),
  }
}
