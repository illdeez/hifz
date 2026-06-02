import test from "node:test"
import assert from "node:assert/strict"

import { updateDraftAyahRangeForContext, isDraftRangeValidForContext } from "./segment-draft-form"
import type { SegmentDraft } from "@/lib/types"

function makeDraft(overrides: Partial<SegmentDraft> = {}): SegmentDraft {
  return {
    surahId: 27,
    fromAyah: 1,
    toAyah: 5,
    memorization: 1,
    meaning: 1,
    notes: "",
    ...overrides,
  }
}

test("incrementing fromAyah beyond toAyah pulls toAyah up to match it", () => {
  const result = updateDraftAyahRangeForContext(makeDraft({ fromAyah: 9, toAyah: 9 }), "fromAyah", 10, 1, 93)
  assert.equal(result.fromAyah, 10)
  assert.equal(result.toAyah, 10)
  assert.equal(isDraftRangeValidForContext(result, 1, 93), true)
})

test("decrementing toAyah below fromAyah pulls fromAyah down to match it", () => {
  const result = updateDraftAyahRangeForContext(makeDraft({ fromAyah: 10, toAyah: 10 }), "toAyah", 4, 1, 93)
  assert.equal(result.fromAyah, 4)
  assert.equal(result.toAyah, 4)
  assert.equal(isDraftRangeValidForContext(result, 1, 93), true)
})

test("partial surah context clamps both bounds inside the allowed range", () => {
  const raisedStart = updateDraftAyahRangeForContext(makeDraft({ fromAyah: 31, toAyah: 40 }), "fromAyah", 20, 31, 60)
  assert.equal(raisedStart.fromAyah, 31)
  assert.equal(raisedStart.toAyah, 40)

  const loweredEnd = updateDraftAyahRangeForContext(makeDraft({ fromAyah: 31, toAyah: 40 }), "toAyah", 80, 31, 60)
  assert.equal(loweredEnd.fromAyah, 31)
  assert.equal(loweredEnd.toAyah, 60)

  assert.equal(isDraftRangeValidForContext(raisedStart, 31, 60), true)
  assert.equal(isDraftRangeValidForContext(loweredEnd, 31, 60), true)
})
