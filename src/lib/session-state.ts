import type { EnrichedSegment, Rating, SegmentBuckets } from "./types"

export type SessionPhase = "review" | "new-segment" | "summary"
export type SessionMode = "daily" | "review-only"

export type TodaySessionState = {
  phase: SessionPhase
  mode: SessionMode
  memorizationGoal: number
  reviewQueue: EnrichedSegment[]
  reviewIndex: number
  doneReviewed: string[]
  addedSegmentIds: string[]
  ratings: Record<string, Rating>
  note: string
}

export function createTodaySession(
  buckets: SegmentBuckets,
  dailyReviewGoal: number,
  memorizationGoal: number,
  mode: SessionMode
): TodaySessionState {
  const reviewQueue = [...buckets.overdue, ...buckets.due, ...buckets.threatened].slice(0, dailyReviewGoal)
  const shouldAddNewSegment = mode === "daily" && memorizationGoal > 0

  return {
    phase: reviewQueue.length > 0 ? "review" : shouldAddNewSegment ? "new-segment" : "summary",
    mode,
    memorizationGoal,
    reviewQueue,
    reviewIndex: 0,
    doneReviewed: [],
    addedSegmentIds: [],
    ratings: {},
    note: "",
  }
}

export function createReviewSessionFromSegments(segments: EnrichedSegment[]): TodaySessionState {
  return {
    phase: segments.length > 0 ? "review" : "summary",
    mode: "review-only",
    memorizationGoal: 0,
    reviewQueue: segments,
    reviewIndex: 0,
    doneReviewed: [],
    addedSegmentIds: [],
    ratings: {},
    note: "",
  }
}

export function withReviewResult(state: TodaySessionState, segmentId: string, rating: Rating): TodaySessionState {
  const next = {
    ...state,
    reviewIndex: state.reviewIndex + 1,
    doneReviewed: [...state.doneReviewed, segmentId],
    ratings: {
      ...state.ratings,
      [segmentId]: rating,
    },
  }

  if (next.reviewIndex >= next.reviewQueue.length) {
    return {
      ...next,
      phase: next.mode === "daily" && next.memorizationGoal > 0 ? "new-segment" : "summary",
    }
  }

  return next
}

export function withSegmentAdded(state: TodaySessionState, segmentId: string): TodaySessionState {
  return {
    ...state,
    addedSegmentIds: [...state.addedSegmentIds, segmentId],
    phase: "summary",
  }
}

export function withSegmentDraftStepSkipped(state: TodaySessionState): TodaySessionState {
  return {
    ...state,
    phase: "summary",
  }
}

export function withSessionNote(state: TodaySessionState, note: string): TodaySessionState {
  return {
    ...state,
    note,
  }
}
