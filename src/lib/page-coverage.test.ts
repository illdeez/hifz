import test from "node:test"
import assert from "node:assert/strict"

import {
  PAGE_COUNT,
  getCoveredPages,
  getFractionalPageCoverage,
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

test("getFractionalPageCoverage counts a fully-memorized page as one whole page", () => {
  // Page 1 holds all 7 ayahs of Al-Fatihah and nothing else.
  assert.equal(getFractionalPageCoverage([{ surahId: 1, fromAyah: 1, toAyah: 7 }]), 1)
})

test("getFractionalPageCoverage counts a partial page as its ayah fraction", () => {
  // 3 of 7 ayahs on page 1.
  const coverage = getFractionalPageCoverage([{ surahId: 1, fromAyah: 1, toAyah: 3 }])
  assert.ok(Math.abs(coverage - 3 / 7) < 1e-9)
})

test("getFractionalPageCoverage sums fractions across multiple pages", () => {
  // Whole Fatihah (page 1 = 1) plus 3 ayahs of page 1's worth elsewhere.
  const coverage = getFractionalPageCoverage([
    { surahId: 1, fromAyah: 1, toAyah: 7 },
    { surahId: 1, fromAyah: 1, toAyah: 3 },
  ])
  // Same page repeated never exceeds 1 per page.
  assert.equal(coverage, 1)
})

test("getFractionalPageCoverage returns 0 for empty input", () => {
  assert.equal(getFractionalPageCoverage([]), 0)
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
