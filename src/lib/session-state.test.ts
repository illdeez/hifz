import test from "node:test"
import assert from "node:assert/strict"

import { createTodaySession, withReviewResult, withSegmentDraftStepSkipped } from "./session-state"
import type { EnrichedSegment, SegmentBuckets } from "./types"

function makeSegment(id: string): EnrichedSegment {
  return {
    id,
    surahId: 2,
    surahName: "البقرة",
    fromAyah: 1,
    toAyah: 5,
    memorization: 3,
    meaning: 2,
    stability: 70,
    lastReviewed: "2026-05-20",
    nextReview: "2026-05-28",
    reviewCount: 1,
    notes: "",
    createdAt: "2026-05-10",
    updatedAt: "2026-05-20",
    effectiveStability: 70,
    status: "strong",
    isDue: true,
    isOverdue: false,
    isThreatened: false,
    bucket: "due",
    referencePages: null,
  }
}

test("daily session moves from review into new segment step before summary", () => {
  const buckets: SegmentBuckets = {
    overdue: [],
    due: [makeSegment("seg-1")],
    threatened: [],
  }

  const initial = createTodaySession(buckets, 3, 1, "daily")
  const afterReview = withReviewResult(initial, "seg-1", "good")

  assert.equal(afterReview.phase, "new-segment")
})

test("review-only session ends at summary without new segment step", () => {
  const buckets: SegmentBuckets = {
    overdue: [],
    due: [makeSegment("seg-1")],
    threatened: [],
  }

  const initial = createTodaySession(buckets, 3, 1, "review-only")
  const afterReview = withReviewResult(initial, "seg-1", "good")

  assert.equal(afterReview.phase, "summary")
})

test("skipping new segment step advances the session to summary", () => {
  const buckets: SegmentBuckets = {
    overdue: [],
    due: [],
    threatened: [],
  }

  const initial = createTodaySession(buckets, 3, 1, "daily")
  const skipped = withSegmentDraftStepSkipped({
    ...initial,
    phase: "new-segment",
  })

  assert.equal(skipped.phase, "summary")
})
