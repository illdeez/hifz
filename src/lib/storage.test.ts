import test from "node:test"
import assert from "node:assert/strict"

import { normalizeStore } from "./storage"

test("normalizeStore upgrades older activePlan shapes to include targetJuz", () => {
  const store = normalizeStore({
    activePlan: {
      id: "plan-1",
      name: "سور مختارة",
      targetSurahs: [67, 32],
      targetSegments: [{ surahId: 2, fromAyah: 1, toAyah: 5 }],
      createdAt: "2026-05-30",
      updatedAt: "2026-05-30",
    },
    segments: {},
    logs: [],
  })

  assert.deepEqual(store.activePlan, {
    id: "plan-1",
    name: "سور مختارة",
    targetJuz: [],
    targetSurahs: [67, 32],
    targetSegments: [{ surahId: 2, fromAyah: 1, toAyah: 5 }],
    createdAt: "2026-05-30",
    updatedAt: "2026-05-30",
  })
})

test("normalizeStore fills dailyPacePages for older settings", () => {
  const store = normalizeStore({
    settings: {
      dailyMemorizationGoal: 1,
      dailyReviewGoal: 5,
      targetDate: "2027-02-07",
    },
  })

  assert.equal(store.settings.dailyPacePages, 0.5)
})
