import { getJuzMeta, getSurahMeta } from "./quran-metadata"
import type { PlanTargetSegment } from "./types"

export type PlanSelectionDraft = {
  targetJuz: number[]
  targetSurahs: number[]
  targetSegments: PlanTargetSegment[]
}

export type SurahSelectionState = {
  kind: "none" | "partial" | "full"
  coveredAyahs: number
  totalAyahs: number
  ranges: PlanTargetSegment[]
}

export function buildSelectedAyahRanges(draft: PlanSelectionDraft): PlanTargetSegment[] {
  const grouped = new Map<number, Array<{ fromAyah: number; toAyah: number }>>()

  function pushRange(range: PlanTargetSegment) {
    const existing = grouped.get(range.surahId) ?? []
    existing.push({ fromAyah: range.fromAyah, toAyah: range.toAyah })
    grouped.set(range.surahId, existing)
  }

  for (const juzId of draft.targetJuz) {
    const juz = getJuzMeta(juzId)
    juz?.ranges.forEach(pushRange)
  }

  for (const surahId of draft.targetSurahs) {
    const surah = getSurahMeta(surahId)
    if (!surah) continue
    pushRange({ surahId, fromAyah: 1, toAyah: surah.ayahCount })
  }

  draft.targetSegments.forEach(pushRange)

  const merged: PlanTargetSegment[] = []
  for (const [surahId, ranges] of grouped.entries()) {
    const sorted = [...ranges].sort((a, b) => a.fromAyah - b.fromAyah)
    const compact: Array<{ fromAyah: number; toAyah: number }> = []

    for (const range of sorted) {
      const previous = compact[compact.length - 1]
      if (!previous || range.fromAyah > previous.toAyah + 1) {
        compact.push({ ...range })
      } else {
        previous.toAyah = Math.max(previous.toAyah, range.toAyah)
      }
    }

    compact.forEach((range) => merged.push({ surahId, fromAyah: range.fromAyah, toAyah: range.toAyah }))
  }

  return merged.sort((a, b) => (a.surahId === b.surahId ? a.fromAyah - b.fromAyah : a.surahId - b.surahId))
}

export function getSelectedAyahCount(ranges: PlanTargetSegment[]): number {
  return ranges.reduce((sum, range) => sum + (range.toAyah - range.fromAyah + 1), 0)
}

export function getSelectedSurahCount(ranges: PlanTargetSegment[]): number {
  return new Set(ranges.map((range) => range.surahId)).size
}

export function getSurahSelectionState(surahId: number, ranges: PlanTargetSegment[]): SurahSelectionState {
  const surah = getSurahMeta(surahId)
  const totalAyahs = surah?.ayahCount ?? 0
  const surahRanges = ranges.filter((range) => range.surahId === surahId)
  const coveredAyahs = getSelectedAyahCount(surahRanges)

  if (coveredAyahs <= 0 || totalAyahs <= 0) {
    return { kind: "none", coveredAyahs: 0, totalAyahs, ranges: [] }
  }

  if (coveredAyahs >= totalAyahs) {
    return { kind: "full", coveredAyahs: totalAyahs, totalAyahs, ranges: surahRanges }
  }

  return { kind: "partial", coveredAyahs, totalAyahs, ranges: surahRanges }
}

export function formatSurahCoverageLabel(state: SurahSelectionState): string {
  if (state.kind === "full") return "مكتملة"
  if (state.kind === "partial") {
    return `${state.coveredAyahs}/${state.totalAyahs} آية`
  }
  return `${state.totalAyahs} آية`
}
