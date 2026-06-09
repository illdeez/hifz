"use client"

import { useEffect, useMemo, useState } from "react"
import {
  applyRating,
  buildPlanProgress,
  buildProgressMetrics,
  buildSegmentBuckets,
  buildSurahSummaries,
  computeSurahProgress,
  createSegmentFromDraft,
  enrichSegment,
  getSurahPlanReason,
  getPlannedSegmentBuckets,
  isSegmentInsidePlan,
  isSurahInsidePlan,
  mergeDailyLog,
  validateSegmentDraft,
} from "./review-engine"
import { buildSegmentId, createEmptyStore, loadStore, resetStoredData, saveStore } from "./storage"
import type { ActivePlan, AppSettings, DailyLog, EnrichedSegment, HifzSegment, KunehStore, Rating, SegmentDraft } from "./types"
import { today } from "./utils"

export function applySegmentDraftsToStore(
  store: KunehStore,
  drafts: SegmentDraft[],
  todayDate = today()
): { ok: true; store: KunehStore; ids: string[] } | { ok: false; error: string } {
  let nextStore = store
  const ids: string[] = []

  for (const draft of drafts) {
    const containedIds = Object.values(nextStore.segments)
      .filter(
        (segment) =>
          segment.surahId === draft.surahId &&
          segment.fromAyah >= draft.fromAyah &&
          segment.toAyah <= draft.toAyah
      )
      .map((segment) => segment.id)

    const filteredSegments = { ...nextStore.segments }
    containedIds.forEach((id) => {
      delete filteredSegments[id]
    })

    const validationStore = {
      ...nextStore,
      segments: filteredSegments,
    }

    const error = validateSegmentDraft(draft, validationStore)
    if (error) {
      return { ok: false, error }
    }

    const segment = createSegmentFromDraft(draft, todayDate)
    nextStore = {
      ...nextStore,
      segments: {
        ...filteredSegments,
        [segment.id]: segment,
      },
    }
    ids.push(segment.id)
  }

  return { ok: true, store: nextStore, ids: [...new Set(ids)] }
}

export function useKunehStore() {
  const [store, setStore] = useState<KunehStore>(createEmptyStore)

  useEffect(() => {
    setStore(loadStore())
  }, [])

  function updateStore(updater: (previous: KunehStore) => KunehStore) {
    setStore((previous) => {
      const next = updater(previous)
      saveStore(next)
      return next
    })
  }

  function getSegment(segmentId: string): EnrichedSegment | null {
    const segment = store.segments[segmentId]
    return segment ? enrichSegment(segment, today()) : null
  }

  function getSegmentsForSurah(surahId: number): EnrichedSegment[] {
    return Object.values(store.segments)
      .filter((segment) => segment.surahId === surahId)
      .map((segment) => enrichSegment(segment, today()))
      .sort((a, b) => a.fromAyah - b.fromAyah)
  }

  function addSegment(draft: SegmentDraft): { ok: true; id: string } | { ok: false; error: string } {
    const result = applySegmentDraftsToStore(store, [draft], today())
    if (!result.ok) return result

    updateStore(() => result.store)
    return { ok: true, id: result.ids[0] }
  }

  function addSegments(drafts: SegmentDraft[]): { ok: true; ids: string[] } | { ok: false; error: string } {
    const result = applySegmentDraftsToStore(store, drafts, today())
    if (!result.ok) return result

    updateStore(() => result.store)
    return { ok: true, ids: result.ids }
  }

  function setActivePlan(plan: ActivePlan) {
    updateStore((previous) => ({
      ...previous,
      activePlan: plan,
    }))
  }

  function clearActivePlan() {
    updateStore((previous) => ({
      ...previous,
      activePlan: null,
    }))
  }

  function addSurahToActivePlan(surahId: number) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      const targetSurahs = [...new Set([...(previous.activePlan.targetSurahs ?? []), surahId])]
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetSurahs,
          updatedAt: today(),
        },
      }
    })
  }

  function removeSurahFromActivePlan(surahId: number) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetSurahs: (previous.activePlan.targetSurahs ?? []).filter((id) => id !== surahId),
          updatedAt: today(),
        },
      }
    })
  }

  function addJuzToActivePlan(juzId: number) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetJuz: [...new Set([...(previous.activePlan.targetJuz ?? []), juzId])],
          updatedAt: today(),
        },
      }
    })
  }

  function removeJuzFromActivePlan(juzId: number) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetJuz: (previous.activePlan.targetJuz ?? []).filter((id) => id !== juzId),
          updatedAt: today(),
        },
      }
    })
  }

  function addSegmentTargetToActivePlan(draft: Pick<SegmentDraft, "surahId" | "fromAyah" | "toAyah">) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      const exists = (previous.activePlan.targetSegments ?? []).some(
        (target) =>
          target.surahId === draft.surahId && target.fromAyah === draft.fromAyah && target.toAyah === draft.toAyah
      )

      if (exists) return previous

      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetSegments: [...(previous.activePlan.targetSegments ?? []), draft],
          updatedAt: today(),
        },
      }
    })
  }

  function removeSegmentTargetFromActivePlan(segmentKey: string) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          targetSegments: (previous.activePlan.targetSegments ?? []).filter(
            (target) => `${target.surahId}:${target.fromAyah}-${target.toAyah}` !== segmentKey
          ),
          updatedAt: today(),
        },
      }
    })
  }

  function renameActivePlan(name: string) {
    updateStore((previous) => {
      if (!previous.activePlan) return previous
      return {
        ...previous,
        activePlan: {
          ...previous.activePlan,
          name,
          updatedAt: today(),
        },
      }
    })
  }

  function updateSegmentLevels(segmentId: string, updates: Pick<HifzSegment, "memorization" | "meaning" | "notes">) {
    updateStore((previous) => {
      const segment = previous.segments[segmentId]
      if (!segment) return previous

      const next: HifzSegment = {
        ...segment,
        memorization: updates.memorization,
        meaning: updates.meaning,
        notes: updates.notes,
        updatedAt: today(),
      }

      return {
        ...previous,
        segments: {
          ...previous.segments,
          [segmentId]: next,
        },
      }
    })
  }

  function submitRating(segmentId: string, rating: Rating) {
    updateStore((previous) => {
      const segment = previous.segments[segmentId]
      if (!segment) return previous

      return {
        ...previous,
        segments: {
          ...previous.segments,
          [segmentId]: applyRating(segment, rating, today()),
        },
      }
    })
  }

  function saveDailyLog(log: DailyLog) {
    updateStore((previous) => {
      const existing = previous.logs.find((entry) => entry.date === log.date)
      const merged = mergeDailyLog(existing, log)

      return {
        ...previous,
        logs: [...previous.logs.filter((entry) => entry.date !== log.date), merged].sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      }
    })
  }

  function updateSettings(settings: AppSettings) {
    updateStore((previous) => ({
      ...previous,
      settings,
    }))
  }

  function resetAllData() {
    resetStoredData()
    const next = createEmptyStore()
    setStore(next)
    saveStore(next)
  }

  const todayBuckets = useMemo(
    () => (store.activePlan ? getPlannedSegmentBuckets(store, today()) : buildSegmentBuckets({ store, todayDate: today() })),
    [store]
  )
  const todayLog = useMemo(() => store.logs.find((entry) => entry.date === today()), [store.logs])
  const progressMetrics = useMemo(() => buildProgressMetrics(store, today()), [store])
  const surahSummaries = useMemo(() => buildSurahSummaries(store, today()), [store])
  const planProgress = useMemo(() => buildPlanProgress(store), [store])
  const allSegments = useMemo(
    () =>
      Object.values(store.segments)
        .map((segment) => enrichSegment(segment, today()))
        .sort((a, b) => {
          if (a.surahId !== b.surahId) return a.surahId - b.surahId
          return a.fromAyah - b.fromAyah
        }),
    [store.segments]
  )

  return {
    store,
    getSegment,
    getSegmentsForSurah,
    addSegment,
    addSegments,
    updateSegmentLevels,
    submitRating,
    saveDailyLog,
    updateSettings,
    setActivePlan,
    clearActivePlan,
    addSurahToActivePlan,
    removeSurahFromActivePlan,
    addJuzToActivePlan,
    removeJuzFromActivePlan,
    addSegmentTargetToActivePlan,
    removeSegmentTargetFromActivePlan,
    renameActivePlan,
    resetAllData,
    todayBuckets,
    todayLog,
    progressMetrics,
    planProgress,
    surahSummaries,
    allSegments,
    isSurahInsidePlan: (surahId: number) => isSurahInsidePlan(surahId, store.activePlan),
    getSurahPlanReason: (surahId: number) => getSurahPlanReason(surahId, store.activePlan),
    isSegmentInsidePlan: (segment: HifzSegment) => isSegmentInsidePlan(segment, store.activePlan),
    buildSegmentId,
    computeSurahProgress: (surahId: number) => computeSurahProgress(surahId, store, today()),
  }
}
