import test from "node:test"
import assert from "node:assert/strict"

import {
  buildSegmentBuckets,
  buildPlanProgress,
  computeSegmentNextReviewDate,
  computeSurahProgress,
  createEmptyStore,
  describeReferencePages,
  getSurahPlanReason,
  getDefaultSettings,
  getPlannedSegmentBuckets,
  isSurahInsidePlan,
  validateSegmentDraft,
} from "./review-engine"
import type { HifzSegment, KunehStore, MemorizationPlan, SegmentDraft } from "./types"

function makeSegment(overrides: Partial<HifzSegment> & Pick<HifzSegment, "id" | "surahId" | "surahName" | "fromAyah" | "toAyah">): HifzSegment {
  return {
    id: overrides.id,
    surahId: overrides.surahId,
    surahName: overrides.surahName,
    fromAyah: overrides.fromAyah,
    toAyah: overrides.toAyah,
    memorization: 3,
    meaning: 2,
    stability: 70,
    lastReviewed: "2026-05-20",
    nextReview: "2026-05-29",
    reviewCount: 2,
    notes: "",
    createdAt: "2026-05-01",
    updatedAt: "2026-05-20",
    ...overrides,
  }
}

function makeStore(): KunehStore {
  return {
    ...createEmptyStore(),
    settings: getDefaultSettings(),
    activePlan: null,
    segments: {
      s1: makeSegment({
        id: "s1",
        surahId: 2,
        surahName: "البقرة",
        fromAyah: 1,
        toAyah: 5,
        nextReview: "2026-05-24",
      }),
      s2: makeSegment({
        id: "s2",
        surahId: 2,
        surahName: "البقرة",
        fromAyah: 6,
        toAyah: 10,
        nextReview: "2026-05-28",
      }),
      s3: makeSegment({
        id: "s3",
        surahId: 3,
        surahName: "آل عمران",
        fromAyah: 1,
        toAyah: 4,
        stability: 44,
        nextReview: "2026-06-02",
      }),
    },
  }
}

function makePlan(): MemorizationPlan {
  return {
    id: "plan-1",
    name: "خطة البقرة",
    targetJuz: [],
    targetSurahs: [2],
    targetSegments: [],
    createdAt: "2026-05-28",
    updatedAt: "2026-05-28",
  }
}

test("computeSegmentNextReviewDate follows the new rating cadence", () => {
  assert.equal(computeSegmentNextReviewDate("2026-05-28", "struggled"), "2026-05-29")
  assert.equal(computeSegmentNextReviewDate("2026-05-28", "good"), "2026-05-31")
  assert.equal(computeSegmentNextReviewDate("2026-05-28", "excellent"), "2026-06-04")
})

test("buildSegmentBuckets orders overdue before due before threatened", () => {
  const result = buildSegmentBuckets({
    store: makeStore(),
    todayDate: "2026-05-28",
  })

  assert.deepEqual(result.overdue.map((segment) => segment.id), ["s1"])
  assert.deepEqual(result.due.map((segment) => segment.id), ["s2"])
  assert.deepEqual(result.threatened.map((segment) => segment.id), ["s3"])
})

test("planned buckets only include segments inside the active plan", () => {
  const store = makeStore()
  store.activePlan = makePlan()

  const result = getPlannedSegmentBuckets(store, "2026-05-28")

  assert.deepEqual(result.overdue.map((segment) => segment.id), ["s1"])
  assert.deepEqual(result.due.map((segment) => segment.id), ["s2"])
  assert.deepEqual(result.threatened.map((segment) => segment.id), [])
})

test("validateSegmentDraft rejects reversed ranges and duplicate segments", () => {
  const store = makeStore()
  const invalidDraft: SegmentDraft = {
    surahId: 2,
    fromAyah: 10,
    toAyah: 6,
    memorization: 2,
    meaning: 1,
    notes: "",
  }

  assert.match(validateSegmentDraft(invalidDraft, store), /من آية يجب أن تكون أقل/)

  const duplicateDraft: SegmentDraft = {
    surahId: 2,
    fromAyah: 1,
    toAyah: 5,
    memorization: 3,
    meaning: 2,
    notes: "",
  }

  assert.match(validateSegmentDraft(duplicateDraft, store), /مكرر/)
})

test("computeSurahProgress summarizes saved segments inside a surah", () => {
  const summary = computeSurahProgress(2, makeStore())

  assert.equal(summary.memorizedSegments, 2)
  assert.equal(summary.progressPercent, 3)
  assert.equal(summary.status, "medium")
})

test("plan progress uses the active plan as the primary denominator", () => {
  const store = makeStore()
  store.activePlan = makePlan()

  const progress = buildPlanProgress(store)

  assert.equal(progress.planCompletionPercent, 3)
  assert.equal(progress.fullQuranCompletionPercent, 0)
})

test("describeReferencePages uses page metadata when available", () => {
  assert.equal(describeReferencePages(2, 1, 5), "الصفحة ٢")
})

test("isSurahInsidePlan distinguishes in-plan and out-of-plan surahs", () => {
  const plan = makePlan()

  assert.equal(isSurahInsidePlan(2, plan), true)
  assert.equal(isSurahInsidePlan(3, plan), false)
})

test("known juz mapping can place surahs inside the active plan", () => {
  const plan: MemorizationPlan = {
    id: "plan-juz",
    name: "تبارك",
    targetJuz: [29],
    targetSurahs: [],
    targetSegments: [],
    createdAt: "2026-05-28",
    updatedAt: "2026-05-28",
  }

  assert.equal(isSurahInsidePlan(67, plan), true)
  assert.equal(getSurahPlanReason(67, plan), "juz")
  assert.equal(isSurahInsidePlan(2, plan), false)
})
