import type { ActivePlan, AppSettings, DailyLog, HifzSegment, KunehStore, SegmentDraft } from "./types"
import { getSurahMeta } from "./quran-metadata"

const BACKUP_APP = "hufz"
const BACKUP_SCHEMA = "hufz-v3"

export type HufzBackup = {
  app: typeof BACKUP_APP
  schemaVersion: typeof BACKUP_SCHEMA
  exportedAt: string
  store: KunehStore
}

export type BackupPreview = {
  planName: string | null
  segmentCount: number
  logCount: number
  targetDate: string
  exportedAt: string
  schemaVersion: string
}

const STORAGE_KEY = "kuneh-v3"

export function getDefaultSettings(): AppSettings {
  return {
    dailyMemorizationGoal: 1,
    dailyReviewGoal: 5,
    targetDate: "2027-02-07",
    dailyPacePages: 0.5,
  }
}

export function createEmptyStore(): KunehStore {
  return {
    settings: getDefaultSettings(),
    activePlan: null,
    segments: {},
    logs: [],
  }
}

function normalizePlan(raw: Partial<ActivePlan> | null | undefined): ActivePlan | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null
  }

  return {
    id: raw.id,
    name: raw.name,
    targetJuz: raw.targetJuz ?? [],
    targetSurahs: raw.targetSurahs ?? [],
    targetSegments: raw.targetSegments ?? [],
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ?? new Date().toISOString().slice(0, 10),
  }
}

function normalizeSegment(raw: Partial<HifzSegment>): HifzSegment | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.surahId !== "number" ||
    typeof raw.surahName !== "string" ||
    typeof raw.fromAyah !== "number" ||
    typeof raw.toAyah !== "number"
  ) {
    return null
  }

  return {
    id: raw.id,
    surahId: raw.surahId,
    surahName: raw.surahName,
    fromAyah: raw.fromAyah,
    toAyah: raw.toAyah,
    memorization: (raw.memorization ?? 0) as HifzSegment["memorization"],
    meaning: (raw.meaning ?? 0) as HifzSegment["meaning"],
    stability: raw.stability ?? 0,
    lastReviewed: raw.lastReviewed ?? null,
    nextReview: raw.nextReview ?? null,
    reviewCount: raw.reviewCount ?? 0,
    notes: raw.notes ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ?? new Date().toISOString().slice(0, 10),
  }
}

function normalizeLog(raw: Partial<DailyLog> & { date: string }): DailyLog {
  return {
    date: raw.date,
    reviewedSegmentIds: [...new Set(raw.reviewedSegmentIds ?? [])],
    addedSegmentIds: [...new Set(raw.addedSegmentIds ?? [])],
    ratings: raw.ratings ?? {},
    sessionNotes: raw.sessionNotes ?? [],
  }
}

export function normalizeStore(raw: unknown): KunehStore {
  if (!raw || typeof raw !== "object") {
    return createEmptyStore()
  }

  const candidate = raw as Partial<KunehStore> & {
    settings?: Partial<AppSettings>
    activePlan?: Partial<ActivePlan> | null
    segments?: Record<string, Partial<HifzSegment>>
    logs?: Array<Partial<DailyLog> & { date: string }>
  }

  const segments = Object.fromEntries(
    Object.entries(candidate.segments ?? {})
      .map(([id, segment]) => [id, normalizeSegment({ ...segment, id })] as const)
      .filter((entry): entry is [string, HifzSegment] => entry[1] !== null)
  )

  return {
    settings: {
      ...getDefaultSettings(),
      ...(candidate.settings ?? {}),
    },
    activePlan: normalizePlan(candidate.activePlan),
    segments,
    logs: (candidate.logs ?? [])
      .filter((log) => typeof log?.date === "string")
      .map((log) => normalizeLog(log as Partial<DailyLog> & { date: string })),
  }
}

export function loadStore(): KunehStore {
  if (typeof window === "undefined") {
    return createEmptyStore()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeStore(JSON.parse(raw)) : createEmptyStore()
  } catch {
    return createEmptyStore()
  }
}

export function saveStore(store: KunehStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function resetStoredData() {
  localStorage.removeItem(STORAGE_KEY)
}

export function buildSegmentId(draft: Pick<SegmentDraft, "surahId" | "fromAyah" | "toAyah">): string {
  return `${draft.surahId}:${draft.fromAyah}-${draft.toAyah}`
}

// ── Versioned backup export ──────────────────────────────────

export function exportBackup(): HufzBackup {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    store: loadStore(),
  }
}

export function exportBackupAsJSON(): string {
  return JSON.stringify(exportBackup(), null, 2)
}

// ── Strict backup validation ─────────────────────────────────

function isValidDateString(value: unknown): boolean {
  if (typeof value !== "string" || value.length < 10) return false
  return !Number.isNaN(Date.parse(value))
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0
}

function isSegmentLevel(value: unknown): boolean {
  return value === 0 || value === 1 || value === 2 || value === 3
}

function validateTargetRangeStrict(
  prefix: string,
  target: unknown
): string | null {
  if (!target || typeof target !== "object") return `${prefix} غير صالح`
  const t = target as Record<string, unknown>

  if (!isInteger(t.surahId) || t.surahId < 1 || t.surahId > 114) {
    return `${prefix} يحتوي على رقم سورة غير صالح`
  }
  const surah = getSurahMeta(t.surahId)
  if (!surah) return `${prefix} يشير إلى سورة غير موجودة`

  if (!isInteger(t.fromAyah) || !isInteger(t.toAyah)) {
    return `${prefix} يحتوي على نطاق آيات غير صالح`
  }
  if (t.fromAyah < 1 || t.toAyah > surah.ayahCount || t.fromAyah > t.toAyah) {
    return `${prefix} يحتوي على نطاق آيات غير صالح`
  }

  return null
}

function validateSegmentStrict(id: string, segment: unknown): string | null {
  if (!segment || typeof segment !== "object") return `المقطع ${id} غير صالح`
  const s = segment as Record<string, unknown>

  if (!isInteger(s.surahId) || s.surahId < 1 || s.surahId > 114) {
    return `المقطع ${id} يحتوي على رقم سورة غير صالح`
  }
  const surah = getSurahMeta(s.surahId)
  if (!surah) return `المقطع ${id} يشير إلى سورة غير موجودة`

  if (!isInteger(s.fromAyah) || !isInteger(s.toAyah)) {
    return `المقطع ${id} يحتوي على نطاق آيات غير صالح`
  }
  if (s.fromAyah < 1 || s.toAyah < 1 || s.fromAyah > surah.ayahCount || s.toAyah > surah.ayahCount) {
    return `النسخة الاحتياطية تحتوي على نطاق آيات غير صالح في المقطع ${id}`
  }
  if (s.fromAyah > s.toAyah) {
    return `المقطع ${id} يحتوي على نطاق آيات مقلوب`
  }

  if (!isSegmentLevel(s.memorization)) return `المقطع ${id} يحتوي على مستوى حفظ غير صالح`
  if (!isSegmentLevel(s.meaning)) return `المقطع ${id} يحتوي على مستوى معاني غير صالح`

  if (!isFiniteNumber(s.stability) || s.stability < 0 || s.stability > 100) {
    return `المقطع ${id} يحتوي على قيمة ثبات غير صالحة`
  }
  if (!isNonNegativeInteger(s.reviewCount)) {
    return `المقطع ${id} يحتوي على عدد مراجعات غير صالح`
  }
  if (typeof s.notes !== "string") {
    return `المقطع ${id} يحتوي على ملاحظة غير صالحة`
  }
  if (typeof s.surahName !== "string") {
    return `المقطع ${id} يحتوي على اسم سورة غير صالح`
  }
  if (!isValidDateString(s.createdAt)) {
    return `المقطع ${id} يحتوي على تاريخ إنشاء غير صالح`
  }
  if (!isValidDateString(s.updatedAt)) {
    return `المقطع ${id} يحتوي على تاريخ تحديث غير صالح`
  }

  if (s.lastReviewed !== null && s.lastReviewed !== undefined && !isValidDateString(s.lastReviewed)) {
    return `المقطع ${id} يحتوي على تاريخ مراجعة غير صالح`
  }
  if (s.nextReview !== null && s.nextReview !== undefined && !isValidDateString(s.nextReview)) {
    return `المقطع ${id} يحتوي على تاريخ مراجعة قادمة غير صالح`
  }

  // Validate ID matches surah/from/to format
  const expectedId = `${s.surahId}:${s.fromAyah}-${s.toAyah}`
  if (id !== expectedId) return `مفتاح المقطع ${id} لا يطابق نطاق الآيات ${expectedId}`
  if (s.id !== expectedId) return `معرّف المقطع ${String(s.id)} لا يطابق نطاق الآيات ${expectedId}`

  return null
}

function validateSettingsStrict(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return "النسخة الاحتياطية لا تحتوي على إعدادات صالحة"
  }

  const s = settings as Record<string, unknown>
  if (!isNonNegativeInteger(s.dailyMemorizationGoal)) {
    return "النسخة الاحتياطية تحتوي على هدف حفظ يومي غير صالح"
  }
  if (!isNonNegativeInteger(s.dailyReviewGoal)) {
    return "النسخة الاحتياطية تحتوي على هدف مراجعة يومي غير صالح"
  }
  if (!isValidDateString(s.targetDate)) {
    return "النسخة الاحتياطية تحتوي على هدف إتمام غير صالح"
  }
  if (!isFiniteNumber(s.dailyPacePages) || s.dailyPacePages < 0.25 || s.dailyPacePages > 10) {
    return "النسخة الاحتياطية تحتوي على وتيرة حفظ يومية غير صالحة"
  }
  return null
}

function validateActivePlanStrict(activePlan: unknown): string | null {
  if (activePlan === null) return null
  if (!activePlan || typeof activePlan !== "object" || Array.isArray(activePlan)) {
    return "النسخة الاحتياطية تحتوي على خطة نشطة غير صالحة"
  }

  const plan = activePlan as Record<string, unknown>
  if (typeof plan.id !== "string") return "الخطة النشطة تحتوي على معرّف غير صالح"
  if (typeof plan.name !== "string") return "الخطة النشطة تحتوي على اسم غير صالح"
  if (!Array.isArray(plan.targetJuz) || plan.targetJuz.some((value) => !isInteger(value) || value < 1 || value > 30)) {
    return "الخطة النشطة تحتوي على أجزاء غير صالحة"
  }
  if (!Array.isArray(plan.targetSurahs) || plan.targetSurahs.some((value) => !isInteger(value) || value < 1 || value > 114)) {
    return "الخطة النشطة تحتوي على سور غير صالحة"
  }
  if (!Array.isArray(plan.targetSegments)) {
    return "الخطة النشطة تحتوي على مقاطع غير صالحة"
  }
  for (const target of plan.targetSegments) {
    const error = validateTargetRangeStrict("الخطة النشطة تحتوي على مقطع", target)
    if (error) return error
  }
  if (!isValidDateString(plan.createdAt)) return "الخطة النشطة تحتوي على تاريخ إنشاء غير صالح"
  if (!isValidDateString(plan.updatedAt)) return "الخطة النشطة تحتوي على تاريخ تحديث غير صالح"
  return null
}

function validateDailyLogStrict(log: unknown): string | null {
  if (!log || typeof log !== "object" || Array.isArray(log)) {
    return "النسخة الاحتياطية تحتوي على سجل يومي غير صالح"
  }

  const entry = log as Record<string, unknown>
  if (!isValidDateString(entry.date)) return "النسخة الاحتياطية تحتوي على تاريخ سجل غير صالح"
  if (!Array.isArray(entry.reviewedSegmentIds) || entry.reviewedSegmentIds.some((id) => typeof id !== "string")) {
    return "النسخة الاحتياطية تحتوي على reviewedSegmentIds غير صالحة"
  }
  if (!Array.isArray(entry.addedSegmentIds) || entry.addedSegmentIds.some((id) => typeof id !== "string")) {
    return "النسخة الاحتياطية تحتوي على addedSegmentIds غير صالحة"
  }
  if (!entry.ratings || typeof entry.ratings !== "object" || Array.isArray(entry.ratings)) {
    return "النسخة الاحتياطية تحتوي على ratings غير صالحة"
  }
  for (const [id, rating] of Object.entries(entry.ratings as Record<string, unknown>)) {
    if (typeof id !== "string" || (rating !== "struggled" && rating !== "good" && rating !== "excellent")) {
      return "النسخة الاحتياطية تحتوي على تقييمات غير صالحة"
    }
  }
  if (!Array.isArray(entry.sessionNotes) || entry.sessionNotes.some((note) => typeof note !== "string")) {
    return "النسخة الاحتياطية تحتوي على sessionNotes غير صالحة"
  }
  return null
}

export function validateImportedBackup(input: unknown): { ok: true; backup: HufzBackup } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "الملف غير صالح أو تالف" }
  }

  const candidate = input as Record<string, unknown>

  // Check backup wrapper
  if (candidate.app !== BACKUP_APP) {
    return { ok: false, error: "تعذر استيراد النسخة الاحتياطية لأن الملف غير متوافق مع حفظ" }
  }
  if (candidate.schemaVersion !== BACKUP_SCHEMA) {
    return { ok: false, error: `تعذر استيراد النسخة الاحتياطية: إصدار غير مدعوم (${String(candidate.schemaVersion)})` }
  }
  if (!isValidDateString(candidate.exportedAt)) {
    return { ok: false, error: "النسخة الاحتياطية تحتوي على تاريخ تصدير غير صالح" }
  }

  const rawStore = candidate.store
  if (!rawStore || typeof rawStore !== "object") {
    return { ok: false, error: "النسخة الاحتياطية لا تحتوي على بيانات صالحة" }
  }

  const storeCandidate = rawStore as Record<string, unknown>

  const settingsError = validateSettingsStrict(storeCandidate.settings)
  if (settingsError) return { ok: false, error: settingsError }

  const activePlanError = validateActivePlanStrict(storeCandidate.activePlan ?? null)
  if (activePlanError) return { ok: false, error: activePlanError }

  // Validate segments
  if (storeCandidate.segments !== null && storeCandidate.segments !== undefined) {
    if (typeof storeCandidate.segments !== "object" || Array.isArray(storeCandidate.segments)) {
      return { ok: false, error: "النسخة الاحتياطية تحتوي على مقاطع بتنسيق غير صالح" }
    }
    const segments = storeCandidate.segments as Record<string, unknown>
    for (const [id, segment] of Object.entries(segments)) {
      const error = validateSegmentStrict(id, segment)
      if (error) return { ok: false, error }
    }
  }

  // Validate logs
  if (storeCandidate.logs !== null && storeCandidate.logs !== undefined) {
    if (!Array.isArray(storeCandidate.logs)) {
      return { ok: false, error: "النسخة الاحتياطية تحتوي على سجل بتنسيق غير صالح" }
    }
    for (const log of storeCandidate.logs) {
      const error = validateDailyLogStrict(log)
      if (error) return { ok: false, error }
    }
  }

  // All valid — normalize the store for safe use
  const store = normalizeStore(rawStore)
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA,
      exportedAt: candidate.exportedAt as string,
      store,
    },
  }
}

export function getBackupPreview(backup: HufzBackup): BackupPreview {
  return {
    planName: backup.store.activePlan?.name ?? null,
    segmentCount: Object.keys(backup.store.segments).length,
    logCount: backup.store.logs.length,
    targetDate: backup.store.settings.targetDate,
    exportedAt: backup.exportedAt,
    schemaVersion: backup.schemaVersion,
  }
}

export function applyImportedBackup(backup: HufzBackup) {
  saveStore(backup.store)
}
