import test from "node:test"
import assert from "node:assert/strict"

import {
  PAGE_COUNT,
  getCoveredPages,
  getPagesForJuz,
  getPagesForSegment,
  getPagesForSurah,
  getPlanPages,
  getRemainingPlanPages,
} from "./page-coverage"
import type { ActivePlan, HifzSegment } from "./types"

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

test("page metadata covers the full Madani Mushaf page range", () => {
  assert.equal(PAGE_COUNT, 604)
  assert.deepEqual(getPagesForSurah(1), [1])
})

test("getPagesForSurah and getPagesForSegment return exact page unions", () => {
  assert.deepEqual(getPagesForSurah(18), [293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304])
  assert.deepEqual(getPagesForSegment(2, 1, 20), [2, 3, 4])
})

test("getPagesForJuz returns exact pages for a mapped juz", () => {
  const pages = getPagesForJuz(29)
  assert.equal(pages[0], 562)
  assert.equal(pages[pages.length - 1], 581)
  assert.equal(pages.length, 20)
})

test("getPlanPages uses a unique union across juz, surahs, and segments", () => {
  const plan: ActivePlan = {
    id: "plan-1",
    name: "خطة متداخلة",
    targetJuz: [29],
    targetSurahs: [67],
    targetSegments: [{ surahId: 67, fromAyah: 1, toAyah: 30 }],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  assert.deepEqual(getPlanPages(plan), getPagesForJuz(29))
})

test("getCoveredPages returns unique pages touched by memorized segments", () => {
  const covered = getCoveredPages([
    makeSegment({ id: "a", surahId: 2, surahName: "البقرة", fromAyah: 1, toAyah: 20 }),
    makeSegment({ id: "b", surahId: 2, surahName: "البقرة", fromAyah: 15, toAyah: 25 }),
  ])

  assert.deepEqual(covered, [2, 3, 4, 5])
})

test("getRemainingPlanPages removes fully covered plan ayahs and keeps only remaining pages", () => {
  const plan: ActivePlan = {
    id: "plan-67",
    name: "الملك",
    targetJuz: [],
    targetSurahs: [67],
    targetSegments: [],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  const completeCover = [
    makeSegment({ id: "full", surahId: 67, surahName: "الملك", fromAyah: 1, toAyah: 30 }),
  ]
  assert.deepEqual(getRemainingPlanPages(plan, completeCover), [])

  const partialCover = [
    makeSegment({ id: "partial", surahId: 67, surahName: "الملك", fromAyah: 1, toAyah: 5 }),
  ]
  assert.deepEqual(getRemainingPlanPages(plan, partialCover), [562, 563, 564])
})
