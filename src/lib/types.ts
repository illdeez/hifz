export type SegmentLevel = 0 | 1 | 2 | 3
export type Rating = "excellent" | "good" | "struggled"

export type PlanTargetSegment = {
  surahId: number
  fromAyah: number
  toAyah: number
}

export type ActivePlan = {
  id: string
  name: string
  targetJuz: number[]
  targetSurahs: number[]
  targetSegments: PlanTargetSegment[]
  createdAt: string
  updatedAt: string
}

export type MemorizationPlan = ActivePlan

export type HifzSegment = {
  id: string
  surahId: number
  surahName: string
  fromAyah: number
  toAyah: number
  memorization: SegmentLevel
  meaning: SegmentLevel
  stability: number
  lastReviewed: string | null
  nextReview: string | null
  reviewCount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type SegmentDraft = {
  surahId: number
  fromAyah: number
  toAyah: number
  memorization: SegmentLevel
  meaning: SegmentLevel
  notes?: string
}

export type DailyLog = {
  date: string
  reviewedSegmentIds: string[]
  addedSegmentIds: string[]
  ratings: Record<string, Rating>
  sessionNotes: string[]
}

export type AppSettings = {
  dailyMemorizationGoal: number
  dailyReviewGoal: number
  targetDate: string
}

export type SegmentStatus = "strong" | "medium" | "weak" | "none"
export type TodayBucketKind = "overdue" | "due" | "threatened"

export type EnrichedSegment = HifzSegment & {
  effectiveStability: number
  status: SegmentStatus
  isDue: boolean
  isOverdue: boolean
  isThreatened: boolean
  bucket: TodayBucketKind | null
  referencePages: number[] | null
}

export type SurahMeta = {
  id: number
  name: string
  ayahCount: number
}

export type JuzMeta = {
  id: number
  name: string
  surahIds: number[]
  ranges: PlanTargetSegment[]
}

export type AyahMeta = {
  surahId: number
  ayah: number
  page: number
}

export type SurahSummary = {
  surah: SurahMeta
  memorizedSegments: number
  progressPercent: number
  status: SegmentStatus
  averageStability: number
  overdueCount: number
  nearestReview: string | null
}

export type SegmentBuckets = {
  overdue: EnrichedSegment[]
  due: EnrichedSegment[]
  threatened: EnrichedSegment[]
}

export type ProgressMetrics = {
  memorizedSegments: number
  strongSegments: number
  weakSegments: number
  overdueSegments: number
  averageStability: number
  mostNeedySurahs: SurahSummary[]
  planCompletionPercent: number
  fullQuranCompletionPercent: number
}

export type KunehStore = {
  settings: AppSettings
  activePlan: ActivePlan | null
  segments: Record<string, HifzSegment>
  logs: DailyLog[]
}
