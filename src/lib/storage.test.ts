import test from "node:test"
import assert from "node:assert/strict"

import {
  createEmptyStore,
  exportBackup,
  getBackupPreview,
  getDefaultSettings,
  normalizeStore,
  validateImportedBackup,
} from "./storage"
import type { KunehStore } from "./types"

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

// ── Helpers ────────────────────────────────────────────────────

function makeValidStore(): KunehStore {
  return {
    settings: getDefaultSettings(),
    activePlan: {
      id: "plan-1",
      name: "خطة الجزء ٣٠",
      targetJuz: [30],
      targetSurahs: [],
      targetSegments: [],
      createdAt: "2026-05-01",
      updatedAt: "2026-05-01",
    },
    segments: {
      "112:1-4": {
        id: "112:1-4",
        surahId: 112,
        surahName: "الإخلاص",
        fromAyah: 1,
        toAyah: 4,
        memorization: 3,
        meaning: 2,
        stability: 80,
        lastReviewed: "2026-06-01",
        nextReview: "2026-06-08",
        reviewCount: 5,
        notes: "",
        createdAt: "2026-05-01",
        updatedAt: "2026-06-01",
      },
    },
    logs: [
      {
        date: "2026-06-01",
        reviewedSegmentIds: ["112:1-4"],
        addedSegmentIds: [],
        ratings: { "112:1-4": "excellent" },
        sessionNotes: [],
      },
    ],
  }
}

function makeValidBackup() {
  return {
    app: "hufz" as const,
    schemaVersion: "hufz-v3" as const,
    exportedAt: "2026-06-07T12:00:00.000Z",
    store: makeValidStore(),
  }
}

// ── Export wrapper ─────────────────────────────────────────────

test("exportBackup produces a valid versioned backup wrapper", () => {
  const backup = exportBackup()
  assert.equal(backup.app, "hufz")
  assert.equal(backup.schemaVersion, "hufz-v3")
  assert.ok(backup.exportedAt.length > 0)
  assert.ok(backup.store)
  assert.ok(backup.store.settings)
})

// ── Valid backup import ────────────────────────────────────────

test("validateImportedBackup accepts a valid backup", () => {
  const result = validateImportedBackup(makeValidBackup())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.backup.app, "hufz")
    assert.equal(result.backup.schemaVersion, "hufz-v3")
    assert.equal(Object.keys(result.backup.store.segments).length, 1)
    assert.equal(result.backup.store.logs.length, 1)
  }
})

test("validateImportedBackup accepts backup with no segments and no logs", () => {
  const backup = makeValidBackup()
  backup.store.segments = {}
  backup.store.logs = []
  backup.store.activePlan = null
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, true)
})

// ── Bad JSON / non-object ──────────────────────────────────────

test("validateImportedBackup rejects null input", () => {
  const result = validateImportedBackup(null)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects a plain string", () => {
  const result = validateImportedBackup("not a backup")
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects an empty object", () => {
  const result = validateImportedBackup({})
  assert.equal(result.ok, false)
})

// ── Wrong app identifier ───────────────────────────────────────

test("validateImportedBackup rejects wrong app identifier", () => {
  const backup = makeValidBackup()
  const result = validateImportedBackup({ ...backup, app: "other-app" })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("غير متوافق"))
  }
})

// ── Wrong schema version ───────────────────────────────────────

test("validateImportedBackup rejects unsupported schema version", () => {
  const backup = makeValidBackup()
  const result = validateImportedBackup({ ...backup, schemaVersion: "hufz-v99" })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("إصدار غير مدعوم"))
  }
})

// ── Invalid exportedAt ─────────────────────────────────────────

test("validateImportedBackup rejects invalid exportedAt date", () => {
  const backup = makeValidBackup()
  const result = validateImportedBackup({ ...backup, exportedAt: "not-a-date" })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("تاريخ تصدير"))
  }
})

// ── Missing store ──────────────────────────────────────────────

test("validateImportedBackup rejects missing store", () => {
  const backup = makeValidBackup()
  const result = validateImportedBackup({ ...backup, store: null })
  assert.equal(result.ok, false)
})

// ── Invalid surahId ────────────────────────────────────────────

test("validateImportedBackup rejects surahId above 114", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "999:1-5": {
      ...backup.store.segments["112:1-4"],
      id: "999:1-5",
      surahId: 999,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("رقم سورة غير صالح") || result.error.includes("سورة غير موجودة"))
  }
})

test("validateImportedBackup rejects surahId 0", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "0:1-5": {
      ...backup.store.segments["112:1-4"],
      id: "0:1-5",
      surahId: 0,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

// ── Invalid ayah ranges ────────────────────────────────────────

test("validateImportedBackup rejects reversed ayah range", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:4-1": {
      ...backup.store.segments["112:1-4"],
      id: "112:4-1",
      fromAyah: 4,
      toAyah: 1,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("مقلوب"))
  }
})

test("validateImportedBackup rejects ayah exceeding surah length", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-99": {
      ...backup.store.segments["112:1-4"],
      id: "112:1-99",
      toAyah: 99,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("نطاق آيات غير صالح"))
  }
})

// ── Invalid memorization/meaning levels ────────────────────────

test("validateImportedBackup rejects memorization level out of range", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      memorization: 5 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("مستوى حفظ"))
  }
})

test("validateImportedBackup rejects meaning level out of range", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      meaning: -1 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("مستوى معاني"))
  }
})

// ── Invalid stability ──────────────────────────────────────────

test("validateImportedBackup rejects stability out of range", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      stability: 150,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("ثبات"))
  }
})

test("validateImportedBackup rejects stability when missing", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      stability: undefined as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects stability when NaN", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      stability: Number.NaN,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects stability when Infinity", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      stability: Number.POSITIVE_INFINITY,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects mismatched segment record key", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-3": {
      ...backup.store.segments["112:1-4"],
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("مفتاح المقطع"))
  }
})

test("validateImportedBackup rejects mismatched segment id", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      id: "112:1-3",
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("معرّف المقطع"))
  }
})

test("validateImportedBackup rejects non-integer surahId", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112.5:1-4": {
      ...backup.store.segments["112:1-4"],
      id: "112.5:1-4",
      surahId: 112.5 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects non-integer fromAyah", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1.5-4": {
      ...backup.store.segments["112:1-4"],
      id: "112:1.5-4",
      fromAyah: 1.5 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects non-integer toAyah", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4.5": {
      ...backup.store.segments["112:1-4"],
      id: "112:1-4.5",
      toAyah: 4.5 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects negative reviewCount", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      reviewCount: -1,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects non-integer reviewCount", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      reviewCount: 1.5 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects missing notes", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      notes: undefined as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects non-string notes", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      notes: 123 as any,
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

// ── Invalid logs ───────────────────────────────────────────────

test("validateImportedBackup rejects non-array logs", () => {
  const backup = makeValidBackup()
  ;(backup.store as any).logs = "not-an-array"
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("سجل"))
  }
})

test("validateImportedBackup rejects log entry without date", () => {
  const backup = makeValidBackup()
  backup.store.logs = [{ reviewedSegmentIds: [], addedSegmentIds: [], ratings: {}, sessionNotes: [] } as any]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

// ── Invalid settings ───────────────────────────────────────────

test("validateImportedBackup rejects missing settings", () => {
  const backup = makeValidBackup()
  ;(backup.store as any).settings = null
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("إعدادات"))
  }
})

test("validateImportedBackup rejects invalid daily pace pages", () => {
  const backup = makeValidBackup()
  ;(backup.store.settings as any).dailyPacePages = 0.1
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects invalid active plan target juz", () => {
  const backup = makeValidBackup()
  ;(backup.store.activePlan as any).targetJuz = [31]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects invalid active plan target surah", () => {
  const backup = makeValidBackup()
  ;(backup.store.activePlan as any).targetSurahs = [115]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects invalid active plan segment target", () => {
  const backup = makeValidBackup()
  ;(backup.store.activePlan as any).targetSegments = [{ surahId: 112, fromAyah: 4, toAyah: 1 }]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

// ── Invalid segment date strings ───────────────────────────────

test("validateImportedBackup rejects invalid lastReviewed date", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      lastReviewed: "bad-date",
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.ok(result.error.includes("تاريخ مراجعة"))
  }
})

test("validateImportedBackup rejects invalid createdAt date", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      createdAt: "bad-date",
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects invalid updatedAt date", () => {
  const backup = makeValidBackup()
  backup.store.segments = {
    "112:1-4": {
      ...backup.store.segments["112:1-4"],
      updatedAt: "bad-date",
    },
  }
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects log with invalid ratings", () => {
  const backup = makeValidBackup()
  backup.store.logs = [{
    date: "2026-06-01",
    reviewedSegmentIds: ["112:1-4"],
    addedSegmentIds: [],
    ratings: { "112:1-4": "amazing" as any },
    sessionNotes: [],
  }]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

test("validateImportedBackup rejects log with invalid notes", () => {
  const backup = makeValidBackup()
  backup.store.logs = [{
    date: "2026-06-01",
    reviewedSegmentIds: ["112:1-4"],
    addedSegmentIds: [],
    ratings: { "112:1-4": "excellent" },
    sessionNotes: [5 as any],
  }]
  const result = validateImportedBackup(backup)
  assert.equal(result.ok, false)
})

// ── Backup preview ─────────────────────────────────────────────

test("getBackupPreview returns correct summary", () => {
  const backup = makeValidBackup()
  const preview = getBackupPreview(backup)

  assert.equal(preview.planName, "خطة الجزء ٣٠")
  assert.equal(preview.segmentCount, 1)
  assert.equal(preview.logCount, 1)
  assert.equal(preview.schemaVersion, "hufz-v3")
  assert.ok(preview.exportedAt.length > 0)
})

test("getBackupPreview handles null plan", () => {
  const backup = makeValidBackup()
  backup.store.activePlan = null
  const preview = getBackupPreview(backup)
  assert.equal(preview.planName, null)
})

// ── normalizeStore additional tests ────────────────────────────

test("normalizeStore returns empty store for non-object input", () => {
  const store = normalizeStore(null)
  assert.deepEqual(store.segments, {})
  assert.deepEqual(store.logs, [])
  assert.equal(store.activePlan, null)
})

test("normalizeStore drops invalid segments", () => {
  const store = normalizeStore({
    settings: {},
    segments: {
      good: {
        id: "good",
        surahId: 1,
        surahName: "الفاتحة",
        fromAyah: 1,
        toAyah: 7,
      },
      bad: { id: "bad" },
    },
    logs: [],
  })
  assert.equal(Object.keys(store.segments).length, 1)
  assert.ok(store.segments["good"])
})
