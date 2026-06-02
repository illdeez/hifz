import { AYAH_PAGE_METADATA, JUZ_PAGE_MAP, PAGE_COUNT } from "./page-coverage-metadata"
import type { ActivePlan, AyahMeta, HifzSegment } from "./types"
import { getJuzMeta } from "./quran-metadata"

const ayahPageMap = new Map<string, number>()
const surahPagesMap = new Map<number, number[]>()

for (const entry of AYAH_PAGE_METADATA) {
  ayahPageMap.set(`${entry.surahId}:${entry.ayah}`, entry.page)

  if (!surahPagesMap.has(entry.surahId)) {
    surahPagesMap.set(entry.surahId, [])
  }

  const pages = surahPagesMap.get(entry.surahId)!
  if (pages[pages.length - 1] !== entry.page) {
    pages.push(entry.page)
  }
}

function uniqueSorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

function getAyahKeysForPlan(plan: ActivePlan | null): Set<string> {
  const keys = new Set<string>()
  if (!plan) return keys

  for (const juzId of plan.targetJuz ?? []) {
    const juz = getJuzMeta(juzId)
    for (const range of juz?.ranges ?? []) {
      for (let ayah = range.fromAyah; ayah <= range.toAyah; ayah += 1) {
        keys.add(`${range.surahId}:${ayah}`)
      }
    }
  }

  for (const surahId of plan.targetSurahs ?? []) {
    for (const entry of AYAH_PAGE_METADATA) {
      if (entry.surahId === surahId) {
        keys.add(`${entry.surahId}:${entry.ayah}`)
      }
    }
  }

  for (const target of plan.targetSegments ?? []) {
    for (let ayah = target.fromAyah; ayah <= target.toAyah; ayah += 1) {
      keys.add(`${target.surahId}:${ayah}`)
    }
  }

  return keys
}

function getCoveredAyahKeys(segments: HifzSegment[]): Set<string> {
  const keys = new Set<string>()

  for (const segment of segments) {
    if (segment.memorization === 0) continue
    for (let ayah = segment.fromAyah; ayah <= segment.toAyah; ayah += 1) {
      keys.add(`${segment.surahId}:${ayah}`)
    }
  }

  return keys
}

export function getAyahPage(surahId: number, ayah: number): number | null {
  return ayahPageMap.get(`${surahId}:${ayah}`) ?? null
}

export function getPagesForSurah(surahId: number): number[] {
  return surahPagesMap.get(surahId) ?? []
}

export function getPagesForSegment(surahId: number, fromAyah: number, toAyah: number): number[] {
  const pages: number[] = []

  for (let ayah = fromAyah; ayah <= toAyah; ayah += 1) {
    const page = getAyahPage(surahId, ayah)
    if (page !== null) {
      pages.push(page)
    }
  }

  return uniqueSorted(pages)
}

export function getPagesForJuz(juzId: number): number[] {
  const juz = getJuzMeta(juzId)
  if (!juz) return JUZ_PAGE_MAP[juzId] ?? []
  return uniqueSorted(juz.ranges.flatMap((range) => getPagesForSegment(range.surahId, range.fromAyah, range.toAyah)))
}

export function getPlanPages(activePlan: ActivePlan | null): number[] {
  if (!activePlan) return []

  return uniqueSorted([
    ...(activePlan.targetJuz ?? []).flatMap((juzId) => getPagesForJuz(juzId)),
    ...(activePlan.targetSurahs ?? []).flatMap((surahId) => getPagesForSurah(surahId)),
    ...(activePlan.targetSegments ?? []).flatMap((target) =>
      getPagesForSegment(target.surahId, target.fromAyah, target.toAyah)
    ),
  ])
}

export function getCoveredPages(segments: HifzSegment[]): number[] {
  return uniqueSorted(
    segments
      .filter((segment) => segment.memorization > 0)
      .flatMap((segment) => getPagesForSegment(segment.surahId, segment.fromAyah, segment.toAyah))
  )
}

export function getRemainingPlanPages(activePlan: ActivePlan | null, segments: HifzSegment[]): number[] {
  const remainingPages = new Set<number>()
  const planAyahKeys = getAyahKeysForPlan(activePlan)
  const coveredAyahKeys = getCoveredAyahKeys(segments)

  for (const key of planAyahKeys) {
    if (coveredAyahKeys.has(key)) continue
    const [surahId, ayah] = key.split(":").map(Number)
    const page = getAyahPage(surahId, ayah)
    if (page !== null) {
      remainingPages.add(page)
    }
  }

  return uniqueSorted(remainingPages)
}

export function getAyahPageMetadata(): AyahMeta[] {
  return AYAH_PAGE_METADATA
}

export { PAGE_COUNT }
