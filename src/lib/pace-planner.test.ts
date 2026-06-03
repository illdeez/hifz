import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPacePlanSummary,
  clampDailyPacePages,
  formatDailyPacePages,
  getDirectSurahAyahQuickCounts,
  getMemorizationMode,
  isShortSurahPlan,
  resolveMemorizationEntryGoalUnit,
} from "./pace-planner"
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
    lastReviewed: null,
    nextReview: null,
    reviewCount: 0,
    notes: "",
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
    ...overrides,
  }
}

test("pace planner calculates remaining pages, days needed, and finish date", () => {
  const plan: ActivePlan = {
    id: "plan-1",
    name: "خطة الملك",
    targetJuz: [],
    targetSurahs: [67],
    targetSegments: [],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  const summary = buildPacePlanSummary({
    activePlan: plan,
    segments: [makeSegment({ id: "s1", surahId: 67, surahName: "الملك", fromAyah: 1, toAyah: 10 })],
    targetDate: "2026-06-10",
    dailyPace: 0.5,
    todayDate: "2026-05-30",
  })

  assert.equal(summary.remainingPages, 3)
  assert.equal(summary.remainingDays, 10)
  assert.equal(summary.daysNeeded, 6)
  assert.equal(summary.finishDate, "2026-06-05")
  assert.equal(summary.todayAmount, 0.5)
  assert.equal(summary.onTrack, true)
  assert.equal(summary.goalUnit, "pages")
})

test("pace planner marks pace as behind when selected pace exceeds deadline", () => {
  const plan: ActivePlan = {
    id: "plan-2",
    name: "خطة كبيرة",
    targetJuz: [29],
    targetSurahs: [],
    targetSegments: [],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  const summary = buildPacePlanSummary({
    activePlan: plan,
    segments: [],
    targetDate: "2026-06-05",
    dailyPace: 1,
    todayDate: "2026-05-30",
  })

  assert.equal(summary.remainingPages, 20)
  assert.equal(summary.remainingDays, 5)
  assert.equal(summary.daysNeeded, 20)
  assert.equal(summary.onTrack, false)
})

test("pace planner uses only the remaining amount on the last day", () => {
  const plan: ActivePlan = {
    id: "plan-3",
    name: "مقطع قصير",
    targetJuz: [],
    targetSurahs: [],
    targetSegments: [{ surahId: 2, fromAyah: 1, toAyah: 10 }],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  const summary = buildPacePlanSummary({
    activePlan: plan,
    segments: [makeSegment({ id: "s1", surahId: 2, surahName: "البقرة", fromAyah: 1, toAyah: 9 })],
    targetDate: "2026-06-10",
    dailyPace: 2,
    todayDate: "2026-05-30",
  })

  assert.equal(summary.remainingPages, 1)
  assert.equal(summary.todayAmount, 1)
  assert.equal(summary.daysNeeded, 1)
})

test("page pace is clamped to a reasonable quarter-step range", () => {
  assert.equal(clampDailyPacePages(0.1), 0.25)
  assert.equal(clampDailyPacePages(20), 10)
  assert.equal(clampDailyPacePages(0.74), 0.75)
})

test("daily page pace formatting uses calm human labels", () => {
  assert.equal(formatDailyPacePages(0.25), "ربع صفحة يوميًا")
  assert.equal(formatDailyPacePages(0.5), "نصف صفحة يوميًا")
  assert.equal(formatDailyPacePages(1), "صفحة يوميًا")
  assert.equal(formatDailyPacePages(1.5), "١٫٥ صفحة يوميًا")
})

test("short surah plans use ayah-based goals only when all represented surahs are short", () => {
  assert.equal(isShortSurahPlan([112, 113, 114]), true)
  assert.equal(isShortSurahPlan([93, 112]), true)
  assert.equal(isShortSurahPlan([96]), false)
  assert.equal(isShortSurahPlan([67]), false)
  assert.equal(isShortSurahPlan([67, 112]), false)
})

test("memorization mode classifies short, medium, and long surahs correctly", () => {
  assert.equal(getMemorizationMode(112), "short")
  assert.equal(getMemorizationMode(93), "short")
  assert.equal(getMemorizationMode(96), "medium")
  assert.equal(getMemorizationMode(78), "medium")
  assert.equal(getMemorizationMode(56), "long")
  assert.equal(getMemorizationMode(18), "long")
})

test("pace planner stays page-based even for exclusively short-surah plans", () => {
  const plan: ActivePlan = {
    id: "plan-4",
    name: "قصار السور",
    targetJuz: [],
    targetSurahs: [112, 113, 114],
    targetSegments: [],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  }

  const summary = buildPacePlanSummary({
    activePlan: plan,
    segments: [],
    targetDate: "2026-06-10",
    dailyPace: 5,
    todayDate: "2026-05-30",
  })

  assert.equal(summary.goalUnit, "pages")
  assert.equal(summary.remainingAyahs, 15)
  assert.equal(summary.remainingAmount, summary.remainingPages)
})

test("direct short-surah logging uses ayah entry context even when plan stays page-based", () => {
  assert.equal(
    resolveMemorizationEntryGoalUnit({
      planGoalUnit: "pages",
      source: "surah",
      surahId: 112,
    }),
    "ayahs"
  )

  assert.equal(
    resolveMemorizationEntryGoalUnit({
      planGoalUnit: "pages",
      source: "surah",
      surahId: 67,
    }),
    "pages"
  )
})

test("direct short-surah logging uses lightweight ayah quick counts", () => {
  assert.deepEqual(getDirectSurahAyahQuickCounts("surah", 112), [2, 3])
  assert.deepEqual(getDirectSurahAyahQuickCounts("surah", 67), [3, 5, 10])
  assert.deepEqual(getDirectSurahAyahQuickCounts(null, 112), [3, 5, 10])
})
