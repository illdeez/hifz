import { buildSelectedAyahRanges } from "./plan-selection"
import { getSurahMeta } from "./quran-metadata"
import { getRemainingPlanPages } from "./page-coverage"
import type { ActivePlan, HifzSegment } from "./types"
import { addDays, daysBetween, today } from "./utils"

export type PaceOption = 0.25 | 0.5 | 1 | 2
export type MemorizationMode = "short" | "medium" | "long"

export type PacePlanSummary = {
  goalUnit: "pages" | "ayahs"
  remainingPages: number
  remainingAyahs: number
  remainingAmount: number
  remainingDays: number
  requiredDailyPace: number
  selectedDailyPace: number
  requiredDailyAmount: number
  selectedDailyAmount: number
  daysNeeded: number
  finishDate: string
  todayAmount: number
  onTrack: boolean
}

const SHORT_SURAH_IDS = new Set([93, 94, 95, 97, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114])
const MEDIUM_SURAH_MAX_AYAHS = 46

export function getMemorizationMode(surahId: number): MemorizationMode {
  if (SHORT_SURAH_IDS.has(surahId)) return "short"

  const surah = getSurahMeta(surahId)
  if (surah && surah.ayahCount <= MEDIUM_SURAH_MAX_AYAHS) return "medium"

  return "long"
}

export function isShortSurahPlan(selectedSurahIds: number[]): boolean {
  return selectedSurahIds.length > 0 && selectedSurahIds.every((surahId) => getMemorizationMode(surahId) === "short")
}

export function resolveMemorizationEntryGoalUnit({
  planGoalUnit,
  source,
  surahId,
}: {
  planGoalUnit: "pages" | "ayahs"
  source: string | null
  surahId: number | null
}): "pages" | "ayahs" {
  if (source === "surah" && surahId && Number.isFinite(surahId) && getMemorizationMode(surahId) === "short") {
    return "ayahs"
  }

  return planGoalUnit
}

export function getDirectSurahAyahQuickCounts(source: string | null, surahId: number | null): number[] {
  if (source === "surah" && surahId && Number.isFinite(surahId) && getMemorizationMode(surahId) === "short") {
    return [2, 3]
  }

  return [3, 5, 10]
}

function getPlanRepresentedSurahIds(activePlan: ActivePlan | null): number[] {
  if (!activePlan) return []
  return [...new Set(buildSelectedAyahRanges(activePlan).map((range) => range.surahId))]
}

function buildPlanAyahKeys(activePlan: ActivePlan | null): Set<string> {
  const keys = new Set<string>()
  if (!activePlan) return keys

  buildSelectedAyahRanges(activePlan).forEach((range) => {
    for (let ayah = range.fromAyah; ayah <= range.toAyah; ayah += 1) {
      keys.add(`${range.surahId}:${ayah}`)
    }
  })

  return keys
}

function buildCoveredAyahKeys(segments: HifzSegment[]): Set<string> {
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

function getRemainingPlanAyahs(activePlan: ActivePlan | null, segments: HifzSegment[]): number {
  const planKeys = buildPlanAyahKeys(activePlan)
  const coveredKeys = buildCoveredAyahKeys(segments)
  let remaining = 0
  planKeys.forEach((key) => {
    if (!coveredKeys.has(key)) remaining += 1
  })
  return remaining
}

export function buildPacePlanSummary({
  activePlan,
  segments,
  targetDate,
  dailyPace,
  todayDate = today(),
}: {
  activePlan: ActivePlan | null
  segments: HifzSegment[]
  targetDate: string
  dailyPace: number
  todayDate?: string
}): PacePlanSummary {
  const representedSurahIds = getPlanRepresentedSurahIds(activePlan)
  const goalUnit: "pages" | "ayahs" = isShortSurahPlan(representedSurahIds) ? "ayahs" : "pages"
  const remainingPages = getRemainingPlanPages(activePlan, segments).length
  const remainingAyahs = getRemainingPlanAyahs(activePlan, segments)
  const remainingDays = Math.max(0, daysBetween(todayDate, targetDate) - 1)
  const safePace = goalUnit === "ayahs" ? Math.max(1, dailyPace) : Math.max(0.25, dailyPace)
  const remainingAmount = goalUnit === "ayahs" ? remainingAyahs : remainingPages
  const divisor = Math.max(remainingDays, 1)
  const requiredDailyPace = remainingAmount === 0 ? 0 : remainingAmount / divisor
  const daysNeeded = remainingAmount === 0 ? 0 : Math.ceil(remainingAmount / safePace)
  const finishDate = addDays(todayDate, daysNeeded)
  const todayAmount = Math.min(safePace, remainingAmount)
  const onTrack = remainingAmount === 0 ? true : daysNeeded <= remainingDays

  return {
    goalUnit,
    remainingPages,
    remainingAyahs,
    remainingAmount,
    remainingDays,
    requiredDailyPace,
    selectedDailyPace: safePace,
    requiredDailyAmount: requiredDailyPace,
    selectedDailyAmount: safePace,
    daysNeeded,
    finishDate,
    todayAmount,
    onTrack,
  }
}
