import test from "node:test"
import assert from "node:assert/strict"

import { applySegmentDraftsToStore } from "./store"
import { createEmptyStore } from "./storage"

test("applySegmentDraftsToStore replaces a partial segment with a larger covering segment", () => {
  const initial = createEmptyStore()
  const first = applySegmentDraftsToStore(initial, [
    { surahId: 78, fromAyah: 1, toAyah: 20, memorization: 1, meaning: 1, notes: "" },
  ], "2026-06-03")
  assert.equal(first.ok, true)
  if (!first.ok) return

  const second = applySegmentDraftsToStore(first.store, [
    { surahId: 78, fromAyah: 1, toAyah: 40, memorization: 1, meaning: 1, notes: "" },
  ], "2026-06-03")
  assert.equal(second.ok, true)
  if (!second.ok) return

  assert.deepEqual(Object.keys(second.store.segments), ["78:1-40"])
})

test("applySegmentDraftsToStore keeps exact range updates without duplicates", () => {
  const initial = createEmptyStore()
  const first = applySegmentDraftsToStore(initial, [
    { surahId: 112, fromAyah: 1, toAyah: 4, memorization: 1, meaning: 1, notes: "" },
  ], "2026-06-03")
  assert.equal(first.ok, true)
  if (!first.ok) return

  const second = applySegmentDraftsToStore(first.store, [
    { surahId: 112, fromAyah: 1, toAyah: 4, memorization: 3, meaning: 2, notes: "مراجعة" },
  ], "2026-06-03")
  assert.equal(second.ok, true)
  if (!second.ok) return

  assert.equal(Object.keys(second.store.segments).length, 1)
  assert.equal(second.store.segments["112:1-4"]?.memorization, 3)
  assert.equal(second.store.segments["112:1-4"]?.meaning, 2)
  assert.equal(second.store.segments["112:1-4"]?.notes, "مراجعة")
})

