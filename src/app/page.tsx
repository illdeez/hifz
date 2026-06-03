"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { PlanManager } from "@/components/plan-manager"
import { SegmentDraftForm, createInitialSegmentDraft } from "@/components/segment-draft-form"
import {
  buildPacePlanSummary,
  formatDailyPacePages,
  getDirectSurahAyahQuickCounts,
  getMemorizationMode,
  isShortSurahPlan,
  resolveMemorizationEntryGoalUnit,
} from "@/lib/pace-planner"
import { getAyahPageMetadata } from "@/lib/page-coverage"
import { buildSelectedAyahRanges } from "@/lib/plan-selection"
import { getJuzMeta, getSurahMeta } from "@/lib/quran-metadata"
import { useKunehStore } from "@/lib/store"
import { describeSegment, STATUS_COLORS, STATUS_LABEL } from "@/lib/review-engine"
import {
  createTodaySession,
  createReviewSessionFromSegments,
  withReviewResult,
  withSegmentAdded,
  withSegmentDraftStepSkipped,
  withSessionNote,
  type TodaySessionState,
} from "@/lib/session-state"
import { daysBetween, daysUntil, formatDateAr, formatDateFullAr, formatNumberAr, formatYearAr, reviewRelativeLabel, today } from "@/lib/utils"
import type { EnrichedSegment, MemorizationPlan, PlanTargetSegment, Rating, SegmentDraft } from "@/lib/types"

const RATING_OPTIONS: Array<{ value: Rating; label: string; hint: string; tone: Rating }> = [
  { value: "excellent", label: "ممتاز", hint: "يرجع بعد ٧ أيام", tone: "excellent" },
  { value: "good", label: "جيد", hint: "يرجع بعد ٣ أيام", tone: "good" },
  { value: "struggled", label: "تعثرت كثير", hint: "يرجع غدًا", tone: "struggled" },
]

// Flat dark pill ratings — used inside the dark session overlay
const DARK_RATING_OPTIONS: Array<{ value: Rating; label: string; tone: string }> = [
  { value: "struggled", label: "تعثّرت", tone: "#C08552" },
  { value: "good",      label: "جيّد",   tone: "#C7A86A" },
  { value: "excellent", label: "ممتاز",  tone: "#7FA98C" },
]

type NewSegmentGoal =
  | {
      key: string
      type: "juz"
      title: string
      subtitle: string
      juzId: number
      surahIds: number[]
      hasMappedSurahs: boolean
      ranges: PlanTargetSegment[]
    }
  | { key: string; type: "surah"; title: string; subtitle: string; surahId: number }
  | {
      key: string
      type: "segment"
      title: string
      subtitle: string
      surahId: number
      fromAyah: number
      toAyah: number
    }

type QuickRangeOption = {
  key: string
  label: string
  hint: string
  draft: SegmentDraft | null
  tone?: "manual"
}

type GoalEntryMode = "juz" | "surah" | "segment"

export default function TodayPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    store,
    todayBuckets,
    todayLog,
    planProgress,
    submitRating,
    saveDailyLog,
    addSegment,
    allSegments,
    setActivePlan,
    isSegmentInsidePlan,
    getSurahPlanReason,
  } = useKunehStore()
  const [session, setSession] = useState<TodaySessionState | null>(null)
  // uiPhase sits outside the engine: 'overview' and 'done' are presentation-only
  const [uiPhase, setUiPhase] = useState<"overview" | "engine" | "done" | null>(null)
  const [draft, setDraft] = useState<SegmentDraft>(createInitialSegmentDraft())
  const [draftError, setDraftError] = useState<string | null>(null)
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<NewSegmentGoal | null>(null)
  const [goalEntryMode, setGoalEntryMode] = useState<GoalEntryMode | null>(null)
  const [selectedJuzSurahId, setSelectedJuzSurahId] = useState<number | null>(null)
  const [outsidePlanMode, setOutsidePlanMode] = useState(false)
  const [draftPrepared, setDraftPrepared] = useState(false)
  const [selectedQuickOptionLabel, setSelectedQuickOptionLabel] = useState<string | null>(null)
  const [handledDirectLogKey, setHandledDirectLogKey] = useState<string | null>(null)

  const daysLeft = daysUntil(store.settings.targetDate)
  const hasCompletedTodaySession = Boolean(
    todayLog && (todayLog.reviewedSegmentIds.length > 0 || todayLog.addedSegmentIds.length > 0)
  )
  const planSegments = store.activePlan ? allSegments.filter((segment) => isSegmentInsidePlan(segment)) : []
  const paceSummary = buildPacePlanSummary({
    activePlan: store.activePlan,
    segments: allSegments,
    targetDate: store.settings.targetDate,
    dailyPace: store.settings.dailyPacePages,
  })
  const newSegmentGoals = buildNewSegmentGoals(store.activePlan)
  const primaryReviewSegment =
    todayBuckets.overdue[0] ?? todayBuckets.due[0] ?? todayBuckets.threatened[0] ?? null
  const nextMemorizationGoal = newSegmentGoals[0] ?? null
  const directSource = searchParams.get("source")
  const directAction = searchParams.get("action")
  const directSurahId = Number(searchParams.get("surahId") ?? "")
  const directReturnTo = searchParams.get("returnTo") ?? "/"
  const debugRuntime = searchParams.get("debugRuntime") === "1"
  const selectedAyahRanges = useMemo(
    () =>
      store.activePlan
        ? buildSelectedAyahRanges({
            targetJuz: store.activePlan.targetJuz ?? [],
            targetSurahs: store.activePlan.targetSurahs ?? [],
            targetSegments: store.activePlan.targetSegments ?? [],
          })
        : [],
    [store.activePlan]
  )
  const representedSurahIds = useMemo(
    () => [...new Set(selectedAyahRanges.map((range) => range.surahId))],
    [selectedAyahRanges]
  )
  const shortSurahMode = useMemo(
    () => isShortSurahPlan(representedSurahIds),
    [representedSurahIds]
  )
  const entryGoalUnit = useMemo(
    () =>
      resolveMemorizationEntryGoalUnit({
        planGoalUnit: paceSummary.goalUnit,
        source: directSource,
        surahId: Number.isFinite(directSurahId) && directSurahId > 0 ? directSurahId : null,
      }),
    [paceSummary.goalUnit, directSource, directSurahId]
  )
  const sessionPaceSuggestion = useMemo(() => {
    if (entryGoalUnit === "ayahs" && directSource === "surah" && directSurahId > 0) {
      const [suggestedAyahCount] = getDirectSurahAyahQuickCounts(directSource, directSurahId)
      return formatPaceSuggestion(suggestedAyahCount, "ayahs")
    }

    return formatPaceSuggestion(paceSummary.selectedDailyAmount, paceSummary.goalUnit)
  }, [directSource, directSurahId, entryGoalUnit, paceSummary.goalUnit, paceSummary.selectedDailyAmount])
  const directLogKey = useMemo(() => {
    if (directSource !== "surah" || directAction !== "log" || !Number.isFinite(directSurahId) || directSurahId <= 0) {
      return null
    }
    return `${directSource}:${directAction}:${directSurahId}:${directReturnTo}`
  }, [directAction, directReturnTo, directSource, directSurahId])

  useEffect(() => {
    if (!store.activePlan) return
    if (!directLogKey || handledDirectLogKey === directLogKey || session) return
    const surah = getSurahMeta(directSurahId)
    if (!surah) return

    const directGoal: NewSegmentGoal = {
      key: `surah:${surah.id}:direct`,
      type: "surah",
      title: `ضمن سورة ${surah.name}`,
      subtitle: `${formatNumberAr(surah.ayahCount)} آية في السورة`,
      surahId: surah.id,
    }

    setSession(createTodaySession(todayBuckets, 0, 1, "daily"))
    setUiPhase("engine")
    setSelectedGoal(directGoal)
    setGoalEntryMode("surah")
    setSelectedJuzSurahId(null)
    setOutsidePlanMode(false)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
    setDraft(createInitialSegmentDraft(surah.id))
    setDraftError(null)
    setHandledDirectLogKey(directLogKey)
  }, [directLogKey, handledDirectLogKey, session, store.activePlan, directSurahId, todayBuckets])

  function startSession() {
    setSession(createTodaySession(todayBuckets, store.settings.dailyReviewGoal, store.settings.dailyMemorizationGoal, "daily"))
    setUiPhase("overview") // show the calm overview intro first
    setDraft(createInitialSegmentDraft())
    setDraftError(null)
    setSelectedGoal(null)
    setGoalEntryMode(null)
    setSelectedJuzSurahId(null)
    setOutsidePlanMode(false)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
  }

  function startExtraReview() {
    setReviewPickerOpen(true)
  }

  function startExtraMemorization() {
    setSession(createTodaySession(todayBuckets, 0, 1, "daily"))
    setUiPhase("engine") // skip overview for extra memorization
    setDraft(createInitialSegmentDraft())
    setDraftError(null)
    setSelectedGoal(null)
    setGoalEntryMode(null)
    setSelectedJuzSurahId(null)
    setOutsidePlanMode(false)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
  }

  function startReviewForSegment(segmentId: string) {
    const segment = allSegments.find((entry) => entry.id === segmentId)
    if (!segment) return
    setSession(createReviewSessionFromSegments([segment]))
    setUiPhase("engine") // skip overview for standalone review
    setReviewPickerOpen(false)
    setDraft(createInitialSegmentDraft())
    setDraftError(null)
  }

  function handleRating(segmentId: string, rating: Rating) {
    submitRating(segmentId, rating)
    setSession((current) => (current ? withReviewResult(current, segmentId, rating) : current))
  }

  function finishSession() {
    if (!session) return
    saveDailyLog({
      date: today(),
      reviewedSegmentIds: session.doneReviewed,
      addedSegmentIds: session.addedSegmentIds,
      ratings: session.ratings,
      sessionNotes: session.note.trim() ? [session.note.trim()] : [],
    })
    if (directLogKey) {
      setSession(null)
      setUiPhase(null)
      setSelectedGoal(null)
      setSelectedJuzSurahId(null)
      setOutsidePlanMode(false)
      setDraftPrepared(false)
      setSelectedQuickOptionLabel(null)
      router.replace(directReturnTo)
      return
    }
    // Keep session alive for stats in SessionDone; null it on closeSession
    setUiPhase("done")
  }

  function closeSession() {
    if (directLogKey) {
      setSession(null)
      setUiPhase(null)
      setSelectedGoal(null)
      setSelectedJuzSurahId(null)
      setOutsidePlanMode(false)
      setDraftPrepared(false)
      setSelectedQuickOptionLabel(null)
      router.replace(directReturnTo)
      return
    }
    setSession(null)
    setUiPhase(null)
    setSelectedGoal(null)
    setSelectedJuzSurahId(null)
    setOutsidePlanMode(false)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
  }

  function handleAddSegmentFromToday() {
    const result = addSegment(draft)
    if (!result.ok) {
      setDraftError(result.error)
      return
    }

    setDraftError(null)
    if (store.activePlan) {
      const insideSurahs = Boolean(getSurahPlanReason(draft.surahId))
      const insideSegments = store.activePlan.targetSegments?.some(
        (target) =>
          target.surahId === draft.surahId &&
          target.fromAyah <= draft.fromAyah &&
          target.toAyah >= draft.toAyah
      )
      if (!insideSurahs && !insideSegments) {
        setActivePlan({
          ...store.activePlan,
          targetSegments: [
            ...(store.activePlan.targetSegments ?? []),
            {
              surahId: draft.surahId,
              fromAyah: draft.fromAyah,
              toAyah: draft.toAyah,
            },
          ],
          updatedAt: today(),
        })
      }
    }
    setSession((current) => (current ? withSegmentAdded(current, result.id) : current))
  }

  function chooseNewSegmentGoal(goal: NewSegmentGoal) {
    setSelectedGoal(goal)
    setSelectedJuzSurahId(null)
    setOutsidePlanMode(false)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)

    if (goal.type === "surah") {
      setDraft(createInitialSegmentDraft(goal.surahId))
      setDraftError(null)
      return
    }

    if (goal.type === "segment") {
      setDraft({
        surahId: goal.surahId,
        fromAyah: goal.fromAyah,
        toAyah: goal.toAyah,
        memorization: 1,
        meaning: 1,
        notes: "",
      })
      setDraftError(null)
      return
    }

    setDraft(createInitialSegmentDraft(goal.surahIds[0] ?? 1))
    setDraftError(null)
  }

  function chooseJuzSurah(surahId: number) {
    const targetRange =
      selectedGoal?.type === "juz" ? selectedGoal.ranges.find((range) => range.surahId === surahId) : null
    setSelectedJuzSurahId(surahId)
    setDraft({
      ...createInitialSegmentDraft(surahId),
      fromAyah: targetRange?.fromAyah ?? 1,
      toAyah: targetRange?.fromAyah ?? 1,
    })
    setDraftError(null)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
  }

  function startOutsidePlanMemorization() {
    setOutsidePlanMode(true)
    setSelectedGoal(null)
    setGoalEntryMode(null)
    setSelectedJuzSurahId(null)
    setDraft(createInitialSegmentDraft())
    setDraftError(null)
    setDraftPrepared(true)
    setSelectedQuickOptionLabel(null)
  }

  function returnToPlanGoals() {
    setOutsidePlanMode(false)
    setSelectedGoal(null)
    setGoalEntryMode(null)
    setSelectedJuzSurahId(null)
    setDraft(createInitialSegmentDraft())
    setDraftError(null)
    setDraftPrepared(false)
    setSelectedQuickOptionLabel(null)
  }

  function applyQuickRangeOption(nextDraft: SegmentDraft | null, selectedLabel?: string) {
    if (!nextDraft) {
      setSelectedQuickOptionLabel(selectedLabel ?? null)
      setDraftPrepared(true)
      return
    }

    setDraft(nextDraft)
    setDraftError(null)
    setDraftPrepared(true)
    setSelectedQuickOptionLabel(selectedLabel ?? null)
  }

  // Derived data for the new HomeQuiet design
  const ayatToday = useMemo(() => {
    if (!todayLog || !todayLog.addedSegmentIds.length) return 0
    return todayLog.addedSegmentIds.reduce((sum, id) => {
      const seg = allSegments.find((s) => s.id === id)
      return seg ? sum + (seg.toAyah - seg.fromAyah + 1) : sum
    }, 0)
  }, [todayLog, allSegments])

  const ringRatio = store.settings.dailyMemorizationGoal > 0
    ? Math.min(1, ayatToday / store.settings.dailyMemorizationGoal)
    : 0

  const heroTask = useMemo(() => {
    if (!nextMemorizationGoal) return null
    if (nextMemorizationGoal.type === "surah") {
      const surah = getSurahMeta(nextMemorizationGoal.surahId)
      return surah ? { surahName: surah.name, fromAyah: null as number | null, toAyah: null as number | null } : null
    }
    if (nextMemorizationGoal.type === "segment") {
      const surah = getSurahMeta(nextMemorizationGoal.surahId)
      return surah ? { surahName: surah.name, fromAyah: nextMemorizationGoal.fromAyah, toAyah: nextMemorizationGoal.toAyah } : null
    }
    if (nextMemorizationGoal.type === "juz") {
      const firstRange = nextMemorizationGoal.ranges[0]
      const firstSurahId = firstRange?.surahId ?? nextMemorizationGoal.surahIds[0]
      const surah = getSurahMeta(firstSurahId)
      return surah
        ? { surahName: surah.name, fromAyah: firstRange?.fromAyah ?? null, toAyah: firstRange?.toAyah ?? null }
        : null
    }
    return null
  }, [nextMemorizationGoal])

  if (!store.activePlan) {
    return <HomeOnboardingGateway />
  }

  if (session && uiPhase) {
    const sessionProps = {
      session,
      draft,
      draftError,
      paceSuggestion: sessionPaceSuggestion,
      goalUnit: entryGoalUnit,
      debugRuntime,
      debugRuntimeData: {
        activePlan: store.activePlan,
        selectedAyahRanges,
        representedSurahIds,
        isShortSurahPlan: shortSurahMode,
        selectedQuickOptionLabel,
      },
      entrySource: directSource,
      entrySurahId: Number.isFinite(directSurahId) && directSurahId > 0 ? directSurahId : null,
      newSegmentGoals,
      allSegments,
      selectedGoal,
      goalEntryMode,
      selectedJuzSurahId,
      outsidePlanMode,
      draftPrepared,
      onRate: handleRating,
      onDraftChange: (nextDraft: SegmentDraft) => { setDraft(nextDraft); setDraftError(null) },
      onAddSegment: handleAddSegmentFromToday,
      onApplyQuickRange: applyQuickRangeOption,
      onChooseGoal: chooseNewSegmentGoal,
      onChooseGoalEntryMode: setGoalEntryMode,
      onChooseJuzSurah: chooseJuzSurah,
      onStartOutsidePlan: startOutsidePlanMemorization,
      onBackToGoals: returnToPlanGoals,
      onSkipNewSegment: () => setSession((current) => (current ? withSegmentDraftStepSkipped(current) : current)),
      onNoteChange: (note: string) => setSession((current) => (current ? withSessionNote(current, note) : current)),
      onFinish: finishSession,
      onClose: closeSession,
    }

    return (
      <div className="overlay dark">
        {uiPhase === "overview" && (
          <SessionOverview
            reviewCount={session.reviewQueue.length}
            hasNewMemo={newSegmentGoals.length > 0}
            onClose={closeSession}
            onBegin={() => setUiPhase("engine")}
          />
        )}
        {uiPhase === "engine" && <SessionView {...sessionProps} />}
        {uiPhase === "done" && (
          <SessionDone
            reviewedCount={session.doneReviewed.length}
            addedCount={session.addedSegmentIds.length}
            onHome={closeSession}
          />
        )}
      </div>
    )
  }

  const dueCount = todayBuckets.overdue.length + todayBuckets.due.length

  return (
    <>
      <div className="page scrollbar-none" style={{ overflowY: "auto" }}>

        {/* ── Home Header: greeting + hijri + ring ─────────────── */}
        <div style={{
          padding: `calc(env(safe-area-inset-top, 0px) + 14px) 22px 0`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 7, color: "var(--gold-deep)" }}>
              {homeGreeting()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 13.5A7.5 7.5 0 0 1 10.5 5a6.5 6.5 0 1 0 8.5 8.5Z"/>
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{hijriDateLine()}</span>
            </div>
          </div>
          <Link href="/settings" aria-label="الإعدادات" style={{ display: "block" }}>
            <HomeProgressRing value={ringRatio} size={48} sw={3}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, color: "var(--gold-deep)" }}>ع</span>
              </div>
            </HomeProgressRing>
          </Link>
        </div>

        {/* ── Greeting + plan chip ─────────────────────────────── */}
        <div className="rise" style={{ padding: "22px 24px 0" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 31, fontWeight: 600, lineHeight: 1.26, color: "var(--ink)" }}>
            {hasCompletedTodaySession
              ? <>أتممت وِردَك اليوم،<br />جزاك الله خيرًا</>
              : <>أهلًا بعودتك،<br />إلى وِردك اليوم</>
            }
          </h1>
          <Link href="/mushaf" style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14,
            padding: "8px 14px", borderRadius: 12, background: "var(--gold-soft)",
            textDecoration: "none",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4h10v16l-5-3.5L7 20Z"/>
            </svg>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--gold-deep)" }}>{store.activePlan.name}</span>
          </Link>
        </div>

        {/* ── Hero card — وِرد اليوم ────────────────────────────── */}
        <div className="rise" style={{ padding: "22px 20px 0", animationDelay: ".05s" }}>
          {hasCompletedTodaySession ? (
            <HomeCompletedCard
              reviewed={todayLog?.reviewedSegmentIds.length ?? 0}
              added={todayLog?.addedSegmentIds.length ?? 0}
              onExtraReview={startExtraReview}
              onExtraMemorize={startExtraMemorization}
            />
          ) : heroTask ? (
            <WardCard task={heroTask} dueCount={dueCount} onSession={startSession} />
          ) : (
            <div className="card" style={{ padding: "28px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--verdant-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--verdant)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>أتممت حفظ خطّتك</div>
              <p style={{ fontSize: 13.5, color: "var(--ink-muted)", marginTop: 8, lineHeight: 1.6 }}>وسّع خطّتك بسورةٍ أو جزءٍ جديد لتواصل المسير.</p>
              <Link href="/settings" className="btn btn-ghost btn-block" style={{ marginTop: 16 }}>وسّع الخطة</Link>
            </div>
          )}
        </div>

        {/* ── Glance row ──────────────────────────────────────── */}
        <div className="rise" style={{ padding: "14px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, animationDelay: ".08s" }}>
          <GlanceTile
            icon="spark" tone="gold"
            big={ayatToday}
            label="حُفظ اليوم"
            sub={`من ${formatNumberAr(store.settings.dailyMemorizationGoal)} آيات`}
            onClick={startExtraMemorization}
          />
          <GlanceTile
            icon="repeat" tone="due"
            big={dueCount}
            label="مراجعة اليوم"
            sub={dueCount > 0 ? "تحتاج تثبيتًا" : "مستقرّ"}
            onClick={() => router.push("/review")}
          />
        </div>

        {/* ── Goal countdown ───────────────────────────────────── */}
        <div className="rise" style={{ padding: "18px 20px 0", animationDelay: ".12s" }}>
          <div className="eyebrow" style={{ marginBottom: 12, padding: "0 4px" }}>المسير حتى الهدف</div>
          <GoalCountdownCard
            daysLeft={store.settings.targetDate ? Math.max(1, daysLeft) : null}
            targetDate={store.settings.targetDate}
            planCreatedAt={store.activePlan.createdAt}
            onSetGoal={() => router.push("/settings")}
          />
        </div>

        <div className="rise" style={{ padding: "18px 20px 0", animationDelay: ".14s" }}>
          <PaceComparisonCard summary={paceSummary} currentDailyPacePages={store.settings.dailyPacePages} targetDate={store.settings.targetDate} />
        </div>

        {/* ── Plan progress strip ──────────────────────────────── */}
        <div className="rise" style={{ padding: "18px 24px 0", animationDelay: ".16s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
            <span style={{ fontSize: 13, color: "var(--ink-muted)", fontWeight: 500 }}>تقدّم الخطة</span>
            <span style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, color: "var(--gold-deep)" }}>
              {formatNumberAr(planProgress.planCompletionPercent)}٪
            </span>
          </div>
          <HomePlanBar value={planProgress.planCompletionPercent / 100} />
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* ── FAB: quick log memorization ─────────────────────── */}
      <button
        className="press"
        onClick={startExtraMemorization}
        style={{
          position: "fixed",
          bottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
          insetInlineStart: 20,
          zIndex: 38,
          height: 52, paddingInline: 18, borderRadius: 17,
          display: "flex", alignItems: "center", gap: 9,
          background: "linear-gradient(177deg, #BE9A5E, #A9824A)",
          color: "#231d12", fontWeight: 600, fontSize: 14,
          boxShadow: "0 2px 6px rgba(142,108,57,.3), 0 14px 28px -10px rgba(142,108,57,.55)",
          border: "none", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        سجّل حفظًا
      </button>

      {reviewPickerOpen && (
        <ReviewPicker
          segments={planSegments}
          onSelect={startReviewForSegment}
          onClose={() => setReviewPickerOpen(false)}
        />
      )}
    </>
  )
}

// Thin plan progress bar (reuses design system Bar concept inline)
function HomePlanBar({ value }: { value: number }) {
  return (
    <div style={{ height: 5, borderRadius: 5, background: "var(--paper-deep)", overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.max(0, Math.min(1, value)) * 100}%`,
        background: "var(--gold)", borderRadius: 5,
        transition: "width 1s cubic-bezier(.2,.7,.3,1)",
      }} />
    </div>
  )
}

function HomeCompletedCard({
  reviewed, added, onExtraReview, onExtraMemorize,
}: { reviewed: number; added: number; onExtraReview: () => void; onExtraMemorize: () => void }) {
  return (
    <div className="card" style={{ padding: "22px 22px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--verdant-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--verdant)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>أتممت جلستك اليوم</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
            راجعت {reviewed} · أضفت {added}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={onExtraReview}
          style={{ borderRadius: 14, border: "1px solid var(--line-2)", background: "var(--surface)", padding: "12px", fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}
        >
          مراجعة إضافية
        </button>
        <button
          onClick={onExtraMemorize}
          className="btn-gold"
          style={{ borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 600, color: "#231d12", cursor: "pointer", fontFamily: "inherit", border: "none", background: "linear-gradient(177deg,#BE9A5E,#A9824A)" }}
        >
          حفظ إضافي
        </button>
      </div>
    </div>
  )
}

// ── Home design components ───────────────────────────────────

/** Time-of-day greeting in Arabic */
function homeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return "سحرٌ مبارك"
  if (h < 12) return "صباح النور"
  if (h < 17) return "نهارٌ مبارك"
  if (h < 20) return "مساء النور"
  return "ليلةٌ مباركة"
}

/** Today's Hijri date as a one-line string */
function hijriDateLine(): string {
  try {
    const now = new Date()
    const d = now.toLocaleDateString("ar-SA-u-ca-islamic", { day: "numeric" })
    const m = now.toLocaleDateString("ar-SA-u-ca-islamic", { month: "long" })
    const y = now.toLocaleDateString("ar-SA-u-ca-islamic", { year: "numeric" })
    return `${d} ${m} · ${y}`
  } catch {
    return ""
  }
}

/** Circular progress ring — same geometry as the design's Ring component */
function HomeProgressRing({
  value, size, sw, children,
}: { value: number; size: number; sw: number; children: React.ReactNode }) {
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, value)))
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg) scaleX(-1)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-deep)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gold)" strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  )
}

/** Hero card for today's ward — surah band + HeroCell ayah range + CTA */
function WardCard({
  task, dueCount, onSession,
}: {
  task: { surahName: string; fromAyah: number | null; toAyah: number | null }
  dueCount: number
  onSession: () => void
}) {
  const ayahCount = task.fromAyah != null && task.toAyah != null
    ? task.toAyah - task.fromAyah + 1
    : null
  const cleanName = task.surahName.replace(/^ٱل/, "ال")

  return (
    <div className="card" style={{ padding: "24px 24px 22px" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <span className="eyebrow" style={{ color: "var(--gold-deep)" }}>وِرد اليوم</span>
        {dueCount > 0 && (
          <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
            + {formatNumberAr(dueCount)} للمراجعة
          </span>
        )}
      </div>

      {/* Surah band */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", padding: "6px 0" }}>
        <span style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(176,138,79,.4))" }} />
        <span style={{ width: 6, height: 6, transform: "rotate(45deg)", background: "var(--gold)", opacity: 0.7, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>
          سورة {cleanName}
        </span>
        <span style={{ width: 6, height: 6, transform: "rotate(45deg)", background: "var(--gold)", opacity: 0.7, display: "inline-block", flexShrink: 0 }} />
        <span style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(176,138,79,.4))" }} />
      </div>

      {/* HeroCells */}
      {ayahCount != null && task.fromAyah != null && task.toAyah != null && (
        <div className="well" style={{ display: "flex", marginTop: 20, overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "15px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginBottom: 6 }}>الآيات الجديدة</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>
              {formatNumberAr(task.fromAyah)} – {formatNumberAr(task.toAyah)}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--line-2)" }} />
          <div style={{ flex: 1, padding: "15px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginBottom: 6 }}>المقدار</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>
              {formatNumberAr(ayahCount)} آيات
            </div>
          </div>
        </div>
      )}

      <button className="btn btn-gold btn-lg btn-block" style={{ marginTop: 18 }} onClick={onSession}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        ابدأ جلسة اليوم
      </button>
    </div>
  )
}

/** 2-stat glance tile used in the two-column row */
function GlanceTile({
  icon, tone, big, label, sub, onClick,
}: {
  icon: "spark" | "repeat"
  tone: "gold" | "due"
  big: number
  label: string
  sub: string
  onClick?: () => void
}) {
  const col = tone === "due" ? "var(--due)" : "var(--gold-deep)"

  const iconEl = icon === "spark" ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4c.4 3.7 1.3 4.6 5 5-3.7.4-4.6 1.3-5 5-.4-3.7-1.3-4.6-5-5 3.7-.4 4.6-1.3 5-5Z"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 4l3 3-3 3"/><path d="M20 7H8a4 4 0 0 0-4 4v1"/>
      <path d="M7 20l-3-3 3-3"/><path d="M4 17h12a4 4 0 0 0 4-4v-1"/>
    </svg>
  )

  return (
    <button
      className="card press"
      onClick={onClick}
      style={{ padding: 16, textAlign: "inherit", display: "block", width: "100%", cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {iconEl}
        <span style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>
          {formatNumberAr(big)}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 10 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>{sub}</div>
    </button>
  )
}

/** Goal countdown card — big days-left number + elapsed progress bar */
const GREG_MO_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]

function GoalCountdownCard({
  daysLeft, targetDate, planCreatedAt, onSetGoal,
}: {
  daysLeft: number | null
  targetDate: string
  planCreatedAt: string
  onSetGoal: () => void
}) {
  if (!daysLeft || !targetDate) {
    return (
      <button
        className="card press"
        onClick={onSetGoal}
        style={{ width: "100%", textAlign: "inherit", padding: "20px 22px", display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--gold-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.4" fill="var(--gold-deep)" stroke="none"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>حدِّد هدف الإتمام</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>لتتابع عدّ أيامك حتى الختمة</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 6l-6 6 6 6"/>
        </svg>
      </button>
    )
  }

  const td = new Date(targetDate + "T12:00:00")
  const dateLine = `${formatNumberAr(td.getDate())} ${GREG_MO_AR[td.getMonth()]} ${formatYearAr(td.getFullYear())}`
  const months = Math.floor(daysLeft / 30)
  const remDays = daysLeft % 30

  const startMs = new Date(planCreatedAt + "T12:00:00").getTime()
  const endMs = td.getTime()
  const span = Math.max(1, endMs - startMs)
  const elapsed = Math.min(1, Math.max(0, (Date.now() - startMs) / span))

  const daysWord = daysLeft === 1 ? "يوم" : daysLeft === 2 ? "يومان" : "يومًا"
  const breakdown = months > 0
    ? `${formatNumberAr(months)} ${months === 1 ? "شهر" : months === 2 ? "شهرين" : "أشهر"}${remDays > 0 ? ` و${formatNumberAr(remDays)} ${remDays === 1 ? "يوم" : remDays === 2 ? "يومين" : "يومًا"}` : ""}`
    : "أقلّ من شهر"

  return (
    <div className="card" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
      {/* Radial glow accent */}
      <div style={{ position: "absolute", top: -30, insetInlineEnd: -24, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, var(--gold-soft), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "relative" }}>
        <span className="eyebrow" style={{ color: "var(--gold-deep)" }}>حتى هدفك</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.4" fill="var(--gold-deep)" stroke="none"/>
          </svg>
          {dateLine}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, position: "relative" }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 54, fontWeight: 600, color: "var(--ink)", lineHeight: 0.9 }}>
          {formatNumberAr(daysLeft)}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-soft)" }}>{daysWord}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 6, position: "relative" }}>
        أي ما يقارب {breakdown}
      </div>

      <div style={{ marginTop: 16, position: "relative" }}>
        <div style={{ height: 5, borderRadius: 5, background: "var(--paper-deep)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.round(elapsed * 100)}%`,
            background: "var(--gold)", borderRadius: 5,
            transition: "width 1s cubic-bezier(.2,.7,.3,1)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          <span style={{ fontSize: 13, color: "var(--ink-muted)", fontWeight: 500 }}>بدأت المسير</span>
          <span style={{ fontSize: 13, color: "var(--gold-deep)", fontWeight: 500 }}>
            {formatNumberAr(Math.round(elapsed * 100))}٪ من المدّة
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Deprecated visual components — replaced above ────────────
// PlanWorldCard, TodayActionCard, ReviewFocusCard, NextMemorizationCard
// PacePlannerCard, PlanManager, CompletedCard, PriorityCard
// are no longer rendered on home. Their logic helpers remain below.

function _PlanWorldCardDeprecated({
  planName,
  daysLeft,
  planProgress,
}: {
  planName: string
  daysLeft: number
  planProgress: number
}) {
  return (
    <section
      className="mb-4 overflow-hidden rounded-[34px] text-white"
      style={{ background: "linear-gradient(180deg, #2d6a4a 0%, #295a40 100%)", boxShadow: "0 24px 48px rgba(42,92,63,0.24)" }}
    >
      <div className="px-5 pt-5 pb-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-emerald-200/72">خطة حفظك الحالية</p>
        <h2 className="mt-3 text-[26px] font-black leading-tight">{planName}</h2>
        <p className="mt-2 max-w-[28ch] text-sm leading-7 text-emerald-100/88">
          هذا هو عالم حفظك الآن. كل ما في كُنه اليوم يتحرك انطلاقًا من هذه الخطة.
        </p>
      </div>
      <div className="grid grid-cols-2 border-t border-white/10">
        <div className="border-l border-white/10 px-5 py-4">
          <p className="text-[11px] text-emerald-200/72">حتى الهدف</p>
          <p className="mt-2 text-[44px] font-black leading-none">{formatNumberAr(daysLeft)}</p>
          <p className="mt-1 text-sm font-medium text-emerald-100/80">يوم</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] text-emerald-200/72">ثبّت من الخطة</p>
          <p className="mt-2 text-[44px] font-black leading-none">{formatNumberAr(planProgress)}</p>
          <p className="mt-1 text-sm font-medium text-emerald-100/80">٪ من خطتك الحالية</p>
        </div>
      </div>
    </section>
  )
}

function _TodayActionCard({
  hasCompletedTodaySession,
  overdue,
  due,
  threatened,
  newGoal,
  reviewed,
  added,
  notes,
  onStartSession,
  onExtraReview,
  onExtraMemorize,
}: {
  hasCompletedTodaySession: boolean
  overdue: number
  due: number
  threatened: number
  newGoal: number
  reviewed: number
  added: number
  notes: number
  onStartSession: () => void
  onExtraReview: () => void
  onExtraMemorize: () => void
}) {
  return (
    <section className="surface-card mb-4 p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--gold-deep)]">ما الذي تفعله اليوم؟</p>
      <h3 className="mt-3 text-[25px] font-black leading-tight text-[var(--ink)]">
        {hasCompletedTodaySession ? "جلستك الأساسية اكتملت" : buildTodayHeadline(overdue, due, threatened, newGoal)}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
        {hasCompletedTodaySession
          ? "تقدر تكمل بهدوء إذا عندك طاقة أكثر: مراجعة إضافية أو حفظ إضافي، بدون ما يعيدك التطبيق للبداية."
          : buildTodaySubline(overdue, due, threatened, newGoal)}
      </p>

      <div className="mt-4">
        <_PriorityCard overdue={overdue} due={due} threatened={threatened} newGoal={newGoal} />
      </div>

      {hasCompletedTodaySession ? (
        <div className="mt-4">
          <_CompletedCard
            reviewed={reviewed}
            added={added}
            notes={notes}
            onExtraReview={onExtraReview}
            onExtraMemorize={onExtraMemorize}
          />
        </div>
      ) : (
        <button
          onClick={onStartSession}
          className="mt-4 w-full rounded-[24px] px-4 py-5 text-lg font-bold text-white"
          style={{ background: "var(--verdant)", boxShadow: "0 14px 34px rgba(63,107,82,0.24)" }}
        >
          ابدأ جلسة اليوم
        </button>
      )}
    </section>
  )
}

function _ReviewFocusCard({ segment }: { segment: EnrichedSegment | null }) {
  if (!segment) {
    return (
      <section className="surface-card surface-card-muted mb-4 p-5">
        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--gold-deep)]">ما الذي يحتاج مراجعة؟</p>
        <h3 className="mt-3 text-xl font-black text-[var(--ink)]">لا توجد مراجعة ضاغطة الآن</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
          المراجعة اليوم هادئة. إذا بدأت الجلسة سيقودك كُنه مباشرة إلى ما يستحق وقتك الآن.
        </p>
      </section>
    )
  }

  return (
    <section className="surface-card surface-card-muted mb-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--gold-deep)]">ما الذي يحتاج مراجعة؟</p>
          <h3 className="mt-3 text-xl font-black text-[var(--ink)]">{describeSegment(segment)}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_COLORS[segment.status]}`}>
          {segment.bucket === "overdue" ? "متأخر" : segment.bucket === "due" ? "مستحق" : "مهدد"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">{buildReviewReason(segment)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)]">
          ثبات {formatNumberAr(segment.effectiveStability)}٪
        </span>
        {segment.nextReview && (
          <span className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)]">
            {reviewRelativeLabel(segment.nextReview)}
          </span>
        )}
      </div>
    </section>
  )
}

function _NextMemorizationCard({
  goal,
  paceSuggestion,
  dailyGoal,
  totalGoals,
}: {
  goal: NewSegmentGoal | null
  paceSuggestion: string
  dailyGoal: number
  totalGoals: number
}) {
  return (
    <section className="surface-card mb-4 p-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--gold-deep)]">ما خطوتك التالية في الحفظ؟</p>
      <h3 className="mt-3 text-xl font-black text-[var(--ink)]">{goal ? goal.title : "خطتك جاهزة لاستقبال الحفظ"}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-muted)]">
        {goal
          ? `${goal.subtitle} اقتراح اليوم: ${paceSuggestion} تقريبًا.`
          : dailyGoal > 0
            ? `عند بدء الحفظ الجديد، سيقودك كُنه من داخل خطتك الحالية.`
            : "يمكنك تشغيل الحفظ الجديد يدويًا حين تريد، حتى لو لم يكن هدفك اليومي مرتفعًا."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--gold-deep)]">
          {formatNumberAr(totalGoals)} أهداف داخل الخطة
        </span>
        {dailyGoal > 0 && (
          <span className="rounded-full bg-[var(--verdant-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--verdant)]">
            حفظ {formatNumberAr(dailyGoal)} جديد
          </span>
        )}
      </div>
    </section>
  )
}

function PaceComparisonCard({
  summary,
  currentDailyPacePages,
  targetDate,
}: {
  summary: ReturnType<typeof buildPacePlanSummary>
  currentDailyPacePages: number
  targetDate: string
}) {
  const afterTargetDays = Math.max(0, daysBetween(targetDate, summary.finishDate))

  return (
    <div className="surface-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-bold text-[var(--ink)]">وتيرة الحفظ</p>
        <span className="rounded-lg bg-[var(--paper-deep)] px-2 py-1 text-[11px] font-medium text-[var(--ink-muted)]">
          {formatNumberAr(summary.remainingPages)} صفحة متبقية
        </span>
      </div>

      <div className="grid gap-3">
        <div className="rounded-[18px] bg-[var(--paper-deep)] px-4 py-3">
          <div className="text-xs font-semibold tracking-[0.08em] text-[var(--ink-muted)]">وتيرتك الحالية</div>
          <div className="mt-2 font-bold text-[var(--ink)]">{formatDailyPacePages(currentDailyPacePages)}</div>
        </div>
        <div className="rounded-[18px] bg-[var(--paper-deep)] px-4 py-3">
          <div className="text-xs font-semibold tracking-[0.08em] text-[var(--ink-muted)]">المطلوب لإنهاء الخطة قبل الهدف</div>
          <div className="mt-2 font-bold text-[var(--ink)]">{formatPaceLabel(summary.requiredDailyAmount, "pages")}</div>
        </div>
      </div>

      <div className={`mt-3 rounded-[18px] px-4 py-3 text-sm leading-7 ${summary.onTrack ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
        {summary.remainingAmount === 0 ? (
          "الخطة المعروفة مكتملة."
        ) : summary.onTrack ? (
          <>
            <div className="font-semibold">وتيرتك الحالية تكفي لإنهاء الخطة قبل الهدف.</div>
            <div className="mt-1">ومن المتوقع أن تنتهي تقريبًا في: {formatDateAr(summary.finishDate)}</div>
          </>
        ) : (
          <>
            <div>بناءً على هذه الوتيرة، ستنتهي تقريبًا في: {formatDateAr(summary.finishDate)}</div>
            <div className="mt-1">أي بعد هدفك الحالي بـ {formatNumberAr(afterTargetDays)} يومًا.</div>
            <div className="mt-1">إذا أردت إنهاء الخطة قبل هدفك الحالي، تحتاج تقريبًا {formatPaceLabel(summary.requiredDailyAmount, "pages")}.</div>
          </>
        )}
      </div>
    </div>
  )
}

function formatPaceLabel(value: number, unit: "pages" | "ayahs"): string {
  if (value === 0) return "مكتملة"
  if (unit === "ayahs") {
    const rounded = Math.ceil(value)
    return `${formatNumberAr(rounded)} آيات يوميًا`
  }
  if (value < 0.25) return "أقل من ربع صفحة يوميًا"
  if (value <= 0.37) return "ربع صفحة يوميًا"
  if (value <= 0.75) return "نصف صفحة يوميًا"
  if (value <= 1.25) return "صفحة يوميًا"
  return `${formatPageAmount(Number(value.toFixed(2)))} يوميًا`
}

function formatSelectedPace(value: number, unit: "pages" | "ayahs"): string {
  if (unit === "ayahs") {
    return `${formatNumberAr(Number(value.toFixed(0)))} آيات يوميًا`
  }
  if (value === 0.25) return "ربع صفحة يوميًا"
  if (value === 0.5) return "نصف صفحة يوميًا"
  if (value === 1) return "صفحة يوميًا"
  if (value === 2) return "صفحتين يوميًا"
  return `${formatPageAmount(Number(value.toFixed(2)))} يوميًا`
}

function formatPaceSuggestion(value: number, unit: "pages" | "ayahs"): string {
  if (unit === "ayahs") {
    return `${formatNumberAr(Number(value.toFixed(0)))} آيات`
  }
  const rounded = Number(value.toFixed(2))
  if (rounded === 0.25) return "ربع صفحة"
  if (rounded === 0.5) return "نصف صفحة"
  if (rounded === 1) return "صفحة"
  if (rounded === 2) return "صفحتين"
  return formatPageAmount(rounded)
}

function formatPageAmount(value: number): string {
  const rounded = Number(value.toFixed(2))
  if (rounded === 0.25) return "ربع صفحة"
  if (rounded === 0.5) return "نصف صفحة"
  if (rounded === 1) return "صفحة واحدة"
  if (rounded === 2) return "صفحتين"
  return `${formatNumberAr(rounded)} صفحات`
}

function buildTodayHeadline(overdue: number, due: number, threatened: number, newGoal: number) {
  if (overdue > 0) return "ابدأ بالمراجعة المتأخرة أولًا"
  if (due > 0) return "عندك مراجعات مستحقة اليوم"
  if (threatened > 0) return "بعض الحفظ يحتاج تثبيت قبل أن يضعف"
  if (newGoal > 0) return "اليوم مناسب لإضافة حفظ جديد"
  return "اليوم هادئ وخطتك واضحة"
}

function buildTodaySubline(overdue: number, due: number, threatened: number, newGoal: number) {
  if (overdue > 0) return "كُنه سيبدأ بما تأخر عن وقته، ثم ينقلك بالتدرج إلى المستحق والمهدد قبل أي حفظ جديد."
  if (due > 0) return "لا توجد عناصر متأخرة الآن، لذلك الجلسة ستبدأ مباشرة بما استحق وقته داخل خطتك الحالية."
  if (threatened > 0) return "لا يوجد استحقاق صريح اليوم، لكن بعض المقاطع تحتاج مراجعة وقائية حتى يبقى الثبات مرتفعًا."
  if (newGoal > 0) return "المراجعة اليوم خفيفة، لذلك يمكنك التقدم في الحفظ الجديد من داخل خطتك الحالية."
  return "إذا أردت، تقدر تدخل مراجعة إضافية أو تضيف حفظًا جديدًا يدويًا من داخل جلستك."
}

function buildReviewReason(segment: EnrichedSegment) {
  if (segment.bucket === "overdue") {
    return "هذا المقطع تجاوز موعد مراجعته، لذلك يجب أن يعود إلى الواجهة قبل أن ينخفض ثباته أكثر."
  }
  if (segment.bucket === "due") {
    return "هذا المقطع مستحق اليوم بحسب آخر مراجعة وتقييمه السابق، وهو أول ما ينبغي أن تمر عليه."
  }
  return "هذا المقطع ليس متأخرًا بعد، لكنه مهدد بالضعف إذا تأجل أكثر، لذلك ظهر لك كتنبيه وقائي."
}

function buildNewSegmentGoals(plan: MemorizationPlan | null): NewSegmentGoal[] {
  if (!plan) return []

  const juzGoals = (plan.targetJuz ?? [])
    .map((juzId) => {
      const juz = getJuzMeta(juzId)
      const surahIds = juz?.surahIds ?? []
      if (!juz) return null
      return {
        key: `juz:${juz.id}`,
        type: "juz" as const,
        title: `ضمن ${juz.name}`,
        subtitle: `${formatNumberAr(surahIds.length)} سور داخل هذا الجزء`,
        juzId: juz.id,
        surahIds,
        hasMappedSurahs: surahIds.length > 0,
        ranges: juz.ranges,
      }
    })
    .filter((goal): goal is Extract<NewSegmentGoal, { type: "juz" }> => Boolean(goal))

  const surahsCoveredByJuz = new Set(juzGoals.flatMap((goal) => goal.surahIds))

  const surahGoals = (plan.targetSurahs ?? [])
    .filter((surahId) => !surahsCoveredByJuz.has(surahId))
    .map((surahId) => {
      const surah = getSurahMeta(surahId)
      if (!surah) return null
      return {
        key: `surah:${surah.id}`,
        type: "surah" as const,
        title: `ضمن سورة ${surah.name}`,
        subtitle: `${formatNumberAr(surah.ayahCount)} آية في السورة`,
        surahId: surah.id,
      }
    })
    .filter((goal): goal is Extract<NewSegmentGoal, { type: "surah" }> => Boolean(goal))

  const segmentGoals = (plan.targetSegments ?? []).map((target) => {
    const surah = getSurahMeta(target.surahId)
    return {
      key: `segment:${target.surahId}:${target.fromAyah}-${target.toAyah}`,
      type: "segment" as const,
      title: `ضمن ${surah?.name ?? `سورة ${target.surahId}`} ${formatNumberAr(target.fromAyah)}–${formatNumberAr(target.toAyah)}`,
      subtitle: "نطاق مقترح من خطتك، ويمكنك تعديله حسب ما حفظته فعليًا.",
      surahId: target.surahId,
      fromAyah: target.fromAyah,
      toAyah: target.toAyah,
    }
  })

  return [...juzGoals, ...surahGoals, ...segmentGoals]
}

function buildSurahEntryGoalsFromPlan(goals: NewSegmentGoal[]): Extract<NewSegmentGoal, { type: "surah" }>[] {
  const surahIds = new Set<number>()

  for (const goal of goals) {
    if (goal.type === "surah") {
      surahIds.add(goal.surahId)
      continue
    }

    if (goal.type === "juz") {
      goal.surahIds.forEach((surahId) => surahIds.add(surahId))
      continue
    }

    surahIds.add(goal.surahId)
  }

  return [...surahIds]
    .sort((a, b) => a - b)
    .map((surahId) => {
      const surah = getSurahMeta(surahId)
      if (!surah) return null
      return {
        key: `surah-entry:${surah.id}`,
        type: "surah" as const,
        title: `ضمن سورة ${surah.name}`,
        subtitle: `${formatNumberAr(surah.ayahCount)} آية في السورة`,
        surahId: surah.id,
      }
    })
    .filter((goal): goal is Extract<NewSegmentGoal, { type: "surah" }> => Boolean(goal))
}

function getGoalFormConfig(
  goal: NewSegmentGoal | null,
  selectedJuzSurahId: number | null,
  outsidePlanMode: boolean
): {
  surahOptions?: Array<{ id: number; name: string }>
  lockSurah: boolean
  helperText: string
  contextStartAyah?: number
  contextEndAyah?: number
} {
  if (outsidePlanMode || !goal) {
    return {
      lockSurah: false,
      helperText: "إذا كان حفظك اليوم خارج الخطة، سجّله هنا بشكل ثانوي بدون تغيير مسارك الأساسي.",
    }
  }

  if (goal.type === "juz") {
    const availableSurahIds = selectedJuzSurahId ? [selectedJuzSurahId] : goal.surahIds
    const surahOptions = availableSurahIds
      .map((surahId) => getSurahMeta(surahId))
      .filter((surah): surah is NonNullable<typeof surah> => Boolean(surah))
      .map((surah) => ({ id: surah.id, name: surah.name }))

    return {
      surahOptions: surahOptions.length > 0 ? surahOptions : undefined,
      lockSurah: Boolean(selectedJuzSurahId),
      contextStartAyah: selectedJuzSurahId ? getJuzRangeForSurah(goal, selectedJuzSurahId)?.fromAyah : undefined,
      contextEndAyah: selectedJuzSurahId ? getJuzRangeForSurah(goal, selectedJuzSurahId)?.toAyah : undefined,
      helperText: selectedJuzSurahId
        ? "عدّل من الآية إلى الآية بحسب ما حفظته فعليًا داخل هذه السورة."
        : "اختر السورة أولًا من السور الموجودة داخل هذا الجزء.",
    }
  }

  if (goal.type === "surah") {
    const surah = getSurahMeta(goal.surahId)
    return {
      surahOptions: surah ? [{ id: surah.id, name: surah.name }] : undefined,
      lockSurah: true,
      contextStartAyah: 1,
      contextEndAyah: surah?.ayahCount,
      helperText: "حدّد فقط من الآية إلى الآية، لأن السورة مأخوذة من خطتك الحالية.",
    }
  }

  const surah = getSurahMeta(goal.surahId)
  return {
    surahOptions: surah ? [{ id: surah.id, name: surah.name }] : undefined,
    lockSurah: true,
    contextStartAyah: goal.fromAyah,
    contextEndAyah: goal.toAyah,
    helperText: "هذا مقطع مقترح من خطتك. عدّل البداية أو النهاية إذا كان حفظك اليوم أقل أو أكثر.",
  }
}

function getJuzRangeForSurah(goal: Extract<NewSegmentGoal, { type: "juz" }>, surahId: number) {
  return goal.ranges.find((range) => range.surahId === surahId) ?? null
}

function getAyahEntriesForRange(surahId: number, fromAyah: number, toAyah: number) {
  return getAyahPageMetadata()
    .filter((entry) => entry.surahId === surahId && entry.ayah >= fromAyah && entry.ayah <= toAyah)
    .sort((a, b) => a.ayah - b.ayah)
}

type GoalRange = {
  surahId: number
  fromAyah: number
  toAyah: number
}

type GoalPageChunk = {
  page: number
  fromAyah: number
  toAyah: number
}

function getGoalRange(goal: NewSegmentGoal, targetSurahId: number | null): GoalRange | null {
  if (goal.type === "segment") {
    return {
      surahId: goal.surahId,
      fromAyah: goal.fromAyah,
      toAyah: goal.toAyah,
    }
  }

  if (goal.type === "juz") {
    if (!targetSurahId) return null
    const range = getJuzRangeForSurah(goal, targetSurahId)
    if (!range) return null
    return range
  }

  const surah = getSurahMeta(goal.surahId)
  if (!surah) return null
  return {
    surahId: goal.surahId,
    fromAyah: 1,
    toAyah: surah.ayahCount,
  }
}

function getUniquePagesForRange(surahId: number, fromAyah: number, toAyah: number): number[] {
  return [...new Set(getAyahEntriesForRange(surahId, fromAyah, toAyah).map((entry) => entry.page))]
}

function getGoalPageSequence(
  goal: NewSegmentGoal,
  targetSurahId: number
): number[] {
  const range = getGoalRange(goal, targetSurahId)
  if (!range) return []
  return getUniquePagesForRange(range.surahId, range.fromAyah, range.toAyah)
}

function getGoalPageChunks(goal: NewSegmentGoal, targetSurahId: number | null): GoalPageChunk[] {
  const range = getGoalRange(goal, targetSurahId)
  if (!range) return []

  const entries = getAyahEntriesForRange(range.surahId, range.fromAyah, range.toAyah)
  const chunks: GoalPageChunk[] = []

  for (const entry of entries) {
    const last = chunks[chunks.length - 1]
    if (!last || last.page !== entry.page) {
      chunks.push({ page: entry.page, fromAyah: entry.ayah, toAyah: entry.ayah })
      continue
    }

    last.toAyah = entry.ayah
  }

  return chunks
}

function getChunkIndexForAyah(chunks: GoalPageChunk[], ayah: number): number {
  return chunks.findIndex((chunk) => ayah >= chunk.fromAyah && ayah <= chunk.toAyah)
}

function isFullChunkRemaining(chunk: GoalPageChunk | undefined, remaining: { fromAyah: number; toAyah: number } | null): boolean {
  if (!chunk || !remaining) return false
  return remaining.fromAyah === chunk.fromAyah && remaining.toAyah >= chunk.toAyah
}

function isChunkCoveredByRemaining(chunk: GoalPageChunk | undefined, remaining: { fromAyah: number; toAyah: number } | null): boolean {
  if (!chunk || !remaining) return false
  return remaining.fromAyah <= chunk.fromAyah && remaining.toAyah >= chunk.toAyah
}

function isPartialChunkRemaining(chunk: GoalPageChunk | undefined, remaining: { fromAyah: number; toAyah: number } | null): boolean {
  if (!chunk || !remaining) return false
  return remaining.fromAyah > chunk.fromAyah && remaining.fromAyah <= chunk.toAyah && remaining.toAyah >= remaining.fromAyah
}

function getDraftPageOrdinals(goalPages: number[], draft: SegmentDraft | null): number[] {
  if (!draft) return []
  const draftPages = getUniquePagesForRange(draft.surahId, draft.fromAyah, draft.toAyah)
  return draftPages
    .map((page) => {
      const index = goalPages.indexOf(page)
      return index >= 0 ? index + 1 : null
    })
    .filter((value): value is number => value !== null)
}

function getGoalObjectLabel(goal: NewSegmentGoal, targetSurahId: number | null): string {
  if (goal.type === "segment") return "المقطع"
  if (goal.type === "juz") {
    if (targetSurahId) {
      const surah = getSurahMeta(targetSurahId)
      return `سورة ${surah?.name ?? formatNumberAr(targetSurahId)}`
    }
    return `الجزء ${formatNumberAr(goal.juzId)}`
  }

  const surah = getSurahMeta(targetSurahId ?? goal.surahId)
  return `سورة ${surah?.name ?? formatNumberAr(goal.surahId)}`
}

function isFullSurahContext(goal: NewSegmentGoal, targetSurahId: number | null): boolean {
  const range = getGoalRange(goal, targetSurahId)
  if (!range) return false
  const surah = getSurahMeta(range.surahId)
  if (!surah) return false
  return range.fromAyah === 1 && range.toAyah === surah.ayahCount
}

function reachesGoalEnd(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): boolean {
  const range = getGoalRange(goal, targetSurahId)
  if (!range || !draft) return false
  return draft.toAyah === range.toAyah
}

function describeSinglePageShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  if (isFullSurahContext(goal, targetSurahId) && reachesGoalEnd(goal, targetSurahId, draft)) {
    return `حفظت ${getGoalObjectLabel(goal, targetSurahId)} كاملة`
  }
  const goalPages = targetSurahId ? getGoalPageSequence(goal, targetSurahId) : []
  const ordinals = getDraftPageOrdinals(goalPages, draft)
  const label = getGoalObjectLabel(goal, targetSurahId)
  if (ordinals.length === 0) return `حفظت صفحة من ${label}`
  return `حفظت الصفحة ${formatNumberAr(ordinals[0])} من ${label}`
}

function describeTwoPageShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  if (isFullSurahContext(goal, targetSurahId) && reachesGoalEnd(goal, targetSurahId, draft)) {
    return `حفظت ${getGoalObjectLabel(goal, targetSurahId)} كاملة`
  }
  const goalPages = targetSurahId ? getGoalPageSequence(goal, targetSurahId) : []
  const ordinals = getDraftPageOrdinals(goalPages, draft)
  const label = getGoalObjectLabel(goal, targetSurahId)
  if (ordinals.length < 2) return `حفظت صفحتين من ${label}`
  return `حفظت الصفحتين ${formatNumberAr(ordinals[0])}–${formatNumberAr(ordinals[ordinals.length - 1])} من ${label}`
}

function describeHalfPageShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  const goalPages = targetSurahId ? getGoalPageSequence(goal, targetSurahId) : []
  const ordinals = getDraftPageOrdinals(goalPages, draft)
  if (ordinals.length === 0) return "حفظت نصف صفحة من الموضع التالي"
  return `حفظت نصف صفحة من الصفحة ${formatNumberAr(ordinals[0])}`
}

function describeFullRemainingShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  if (isFullSurahContext(goal, targetSurahId) && reachesGoalEnd(goal, targetSurahId, draft)) {
    return `حفظت ${getGoalObjectLabel(goal, targetSurahId)} كاملة`
  }
  const goalPages = targetSurahId ? getGoalPageSequence(goal, targetSurahId) : []
  const ordinals = getDraftPageOrdinals(goalPages, draft)
  const label = getGoalObjectLabel(goal, targetSurahId)

  if (ordinals.length === 0) {
    return goal.type === "segment" ? "حفظت المتبقي من المقطع" : `حفظت المتبقي من ${label}`
  }

  if (ordinals.length === 1) {
    return `حفظت الصفحة ${formatNumberAr(ordinals[0])} من ${label}`
  }

  if (ordinals.length === 2) {
    return `حفظت الصفحتين ${formatNumberAr(ordinals[0])}–${formatNumberAr(ordinals[1])} من ${label}`
  }

  return goal.type === "segment" ? "حفظت المتبقي من المقطع" : `حفظت المتبقي من ${label}`
}

function dedupeQuickOptions(options: QuickRangeOption[]): QuickRangeOption[] {
  const map = new Map<string, QuickRangeOption>()

  for (const option of options) {
    if (!option.draft) continue
    const key = `${option.label}:${option.draft.surahId}:${option.draft.fromAyah}-${option.draft.toAyah}:${option.tone ?? "default"}`
    if (!map.has(key)) {
      map.set(key, option)
    }
  }

  return [...map.values()]
}

function describeAyahCountShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  const label = getGoalObjectLabel(goal, targetSurahId)
  if (!draft) return `حفظت آيات من ${label}`
  const ayahCount = Math.max(0, draft.toAyah - draft.fromAyah + 1)
  if (ayahCount === 1) return `حفظت آية واحدة من ${label}`
  if (ayahCount === 2) return `حفظت آيتين من ${label}`
  return `حفظت ${formatNumberAr(ayahCount)} آيات من ${label}`
}

function describeFullAyahShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  const label = getGoalObjectLabel(goal, targetSurahId)
  const range = targetSurahId ? getGoalRange(goal, targetSurahId) : null
  if (!draft || !range) {
    return goal.type === "segment" ? "حفظت المقطع كاملًا" : `حفظت ${label} كاملة`
  }

  const isFullRange = draft.fromAyah === range.fromAyah && draft.toAyah === range.toAyah
  if (isFullRange) {
    return goal.type === "segment" ? "حفظت المقطع كاملًا" : `حفظت ${label} كاملة`
  }

  return goal.type === "segment" ? "حفظت المتبقي من المقطع" : `حفظت المتبقي من ${label}`
}

function describeHalfSegmentShortcut(goal: NewSegmentGoal, targetSurahId: number | null, draft: SegmentDraft | null): string {
  const range = targetSurahId ? getGoalRange(goal, targetSurahId) : null
  if (!draft || !range) return "حفظت نصف المقطع"

  const isFullRangeStart = draft.fromAyah === range.fromAyah
  return isFullRangeStart ? "حفظت نصف المقطع" : "حفظت نصف المقطع المتبقي"
}

function describeMediumFractionShortcut(
  goal: NewSegmentGoal,
  targetSurahId: number | null,
  draft: SegmentDraft | null,
  fraction: "quarter" | "half"
): string {
  const label = getGoalObjectLabel(goal, targetSurahId)
  const range = targetSurahId ? getGoalRange(goal, targetSurahId) : null
  const fractionLabel = fraction === "quarter" ? "ربع" : "نصف"

  if (!draft || !range) {
    return `حفظت ${fractionLabel} ${label}`
  }

  if (draft.fromAyah > range.fromAyah) {
    return `حفظت ${fractionLabel} ${label} التالي`
  }

  return `حفظت ${fractionLabel} ${label}`
}

function getPageSpanDraft(surahId: number, fromAyah: number, toAyah: number, pageCount: 1 | 2): SegmentDraft | null {
  const entries = getAyahEntriesForRange(surahId, fromAyah, toAyah)
  if (entries.length === 0) return null

  const uniquePages = [...new Set(entries.map((entry) => entry.page))]
  const targetPages = uniquePages.slice(0, pageCount)
  if (targetPages.length < pageCount) return null

  const lastPage = targetPages[targetPages.length - 1]
  const lastEntry = [...entries].reverse().find((entry) => entry.page === lastPage)
  if (!lastEntry) return null

  return {
    surahId,
    fromAyah,
    toAyah: lastEntry.ayah,
    memorization: 1,
    meaning: 1,
    notes: "",
  }
}

function getHalfPageDraft(surahId: number, fromAyah: number, toAyah: number): SegmentDraft | null {
  const entries = getAyahEntriesForRange(surahId, fromAyah, toAyah)
  if (entries.length === 0) return null

  const firstPage = entries[0].page
  const firstPageEntries = entries.filter((entry) => entry.page === firstPage)
  if (firstPageEntries.length < 2) return null

  const halfIndex = Math.max(0, Math.ceil(firstPageEntries.length / 2) - 1)
  return {
    surahId,
    fromAyah,
    toAyah: firstPageEntries[halfIndex].ayah,
    memorization: 1,
    meaning: 1,
    notes: "",
  }
}

function getHalfSegmentDraft(surahId: number, fromAyah: number, toAyah: number): SegmentDraft | null {
  if (toAyah < fromAyah) return null
  const halfLength = Math.max(1, Math.ceil((toAyah - fromAyah + 1) / 2))
  return {
    surahId,
    fromAyah,
    toAyah: Math.min(toAyah, fromAyah + halfLength - 1),
    memorization: 1,
    meaning: 1,
    notes: "",
  }
}

function getAyahCountDraft(surahId: number, fromAyah: number, toAyah: number, count: number): SegmentDraft | null {
  if (count <= 0 || toAyah < fromAyah) return null
  const actualToAyah = Math.min(toAyah, fromAyah + count - 1)
  if (actualToAyah < fromAyah) return null
  return {
    surahId,
    fromAyah,
    toAyah: actualToAyah,
    memorization: 1,
    meaning: 1,
    notes: "",
  }
}

function createSuggestedDraft(
  surahId: number,
  fromAyah: number,
  toAyah: number,
  base?: Pick<SegmentDraft, "memorization" | "meaning" | "notes">
): SegmentDraft {
  return {
    surahId,
    fromAyah,
    toAyah,
    memorization: base?.memorization ?? 1,
    meaning: base?.meaning ?? 1,
    notes: base?.notes ?? "",
  }
}

function getCoveredAyahSet(
  segments: EnrichedSegment[],
  surahId: number,
  fromAyah: number,
  toAyah: number
): Set<number> {
  const covered = new Set<number>()

  segments
    .filter((segment) => segment.memorization > 0 && segment.surahId === surahId)
    .forEach((segment) => {
      const start = Math.max(fromAyah, segment.fromAyah)
      const end = Math.min(toAyah, segment.toAyah)
      if (start > end) return

      for (let ayah = start; ayah <= end; ayah += 1) {
        covered.add(ayah)
      }
    })

  return covered
}

function getFirstUncoveredBlock(
  segments: EnrichedSegment[],
  surahId: number,
  fromAyah: number,
  toAyah: number
): { fromAyah: number; toAyah: number } | null {
  const covered = getCoveredAyahSet(segments, surahId, fromAyah, toAyah)
  let firstUncovered: number | null = null

  for (let ayah = fromAyah; ayah <= toAyah; ayah += 1) {
    if (!covered.has(ayah)) {
      firstUncovered = ayah
      break
    }
  }

  if (firstUncovered === null) return null

  let lastUncovered = firstUncovered
  for (let ayah = firstUncovered + 1; ayah <= toAyah; ayah += 1) {
    if (covered.has(ayah)) break
    lastUncovered = ayah
  }

  return { fromAyah: firstUncovered, toAyah: lastUncovered }
}

function buildQuickRangeOptions(
  goal: NewSegmentGoal | null,
  selectedJuzSurahId: number | null,
  draft: SegmentDraft,
  outsidePlanMode: boolean,
  allSegments: EnrichedSegment[],
  goalUnit: "pages" | "ayahs",
  entrySource: string | null,
  entrySurahId: number | null
): QuickRangeOption[] {
  if (outsidePlanMode) return []
  if (!goal) return []

  const targetSurahId = goal.type === "segment" ? goal.surahId : goal.type === "surah" ? goal.surahId : selectedJuzSurahId
  if (!targetSurahId) return []

  const range = getGoalRange(goal, targetSurahId)
  if (!range) return []

  const remaining = getFirstUncoveredBlock(allSegments, range.surahId, range.fromAyah, range.toAyah)
  const suggestionStartAyah = remaining?.fromAyah ?? range.fromAyah
  const memorizationMode = getMemorizationMode(targetSurahId)

  if (goal.type === "segment") {
    const fullRemainingDraft = remaining
      ? createSuggestedDraft(range.surahId, remaining.fromAyah, remaining.toAyah)
      : null
    const halfSegmentDraft =
      remaining ? getHalfSegmentDraft(range.surahId, remaining.fromAyah, remaining.toAyah) : null
    const manualDraft = createSuggestedDraft(
      range.surahId,
      suggestionStartAyah,
      suggestionStartAyah,
      { memorization: draft.memorization, meaning: draft.meaning, notes: draft.notes ?? "" }
    )

    const quickOptions: QuickRangeOption[] = [
      {
        key: "goal-half-segment",
        label: describeHalfSegmentShortcut(goal, targetSurahId, halfSegmentDraft),
        hint: halfSegmentDraft
          ? `من ${formatNumberAr(halfSegmentDraft.fromAyah)} إلى ${formatNumberAr(halfSegmentDraft.toAyah)}`
          : "إذا كان المقطع مكتملًا استخدم الخيار اليدوي",
        draft: halfSegmentDraft,
      },
      {
        key: "goal-full-segment",
        label: describeFullAyahShortcut(goal, targetSurahId, fullRemainingDraft),
        hint: remaining
          ? `من ${formatNumberAr(remaining.fromAyah)} إلى ${formatNumberAr(remaining.toAyah)}`
          : "هذا المقطع محفوظ حاليًا",
        draft: fullRemainingDraft,
      },
      {
        key: "goal-manual",
        label: "اختيار آيات يدوي",
        hint: "إذا كان حفظك اليوم يختلف عن هذه الاختصارات",
        draft: { ...manualDraft },
        tone: "manual" as const,
      },
    ]

    return dedupeQuickOptions(quickOptions.filter((option) => option.draft !== null))
  }

  if (memorizationMode === "short") {
    const fullRemainingDraft = remaining
      ? createSuggestedDraft(range.surahId, remaining.fromAyah, remaining.toAyah)
      : null
    const remainingAyahCount = remaining ? remaining.toAyah - remaining.fromAyah + 1 : 0
    const ayahCountDrafts = getDirectSurahAyahQuickCounts(entrySource, entrySurahId)
      .filter((count) => remainingAyahCount > count && remainingAyahCount - count !== 1)
      .map((count) => ({
        count,
        draft: remaining && remainingAyahCount >= count ? getAyahCountDraft(range.surahId, remaining.fromAyah, remaining.toAyah, count) : null,
      }))
      .filter((option): option is { count: number; draft: SegmentDraft } => option.draft !== null)
    const manualDraft = createSuggestedDraft(
      range.surahId,
      suggestionStartAyah,
      suggestionStartAyah,
      { memorization: draft.memorization, meaning: draft.meaning, notes: draft.notes ?? "" }
    )

    const quickOptions: QuickRangeOption[] = [
      ...ayahCountDrafts.map(({ count, draft: optionDraft }) => ({
        key: `goal-${count}-ayahs`,
        label: describeAyahCountShortcut(goal, targetSurahId, optionDraft),
        hint: remaining ? `من الآية ${formatNumberAr(optionDraft.fromAyah)} إلى ${formatNumberAr(optionDraft.toAyah)}` : "إذا كان الهدف مكتملًا استخدم الخيار اليدوي",
        draft: optionDraft,
      })),
      {
        key: "goal-full-ayahs",
        label: describeFullAyahShortcut(goal, targetSurahId, fullRemainingDraft),
        hint: remaining ? `من الآية ${formatNumberAr(remaining.fromAyah)} إلى ${formatNumberAr(remaining.toAyah)}` : "هذا الهدف محفوظ حاليًا",
        draft: fullRemainingDraft,
      },
      {
        key: "goal-manual",
        label: "اختيار آيات يدوي",
        hint: "إذا كان حفظك اليوم يختلف عن هذا الاقتراح",
        draft: { ...manualDraft },
        tone: "manual" as const,
      },
    ]

    return dedupeQuickOptions(quickOptions.filter((option) => option.draft !== null))
  }

  if (memorizationMode === "medium") {
    const fullRemainingDraft = remaining
      ? createSuggestedDraft(range.surahId, remaining.fromAyah, remaining.toAyah)
      : null
    const remainingAyahCount = remaining ? remaining.toAyah - remaining.fromAyah + 1 : 0
    const totalAyahCount = range.toAyah - range.fromAyah + 1
    const quarterCount = Math.max(1, Math.ceil(totalAyahCount / 4))
    const halfCount = Math.max(1, Math.ceil(totalAyahCount / 2))
    const quarterDraft =
      remaining && remainingAyahCount > quarterCount
        ? getAyahCountDraft(range.surahId, remaining.fromAyah, remaining.toAyah, quarterCount)
        : null
    const halfDraft =
      remaining && remainingAyahCount > halfCount
        ? getAyahCountDraft(range.surahId, remaining.fromAyah, remaining.toAyah, halfCount)
        : null
    const manualDraft = createSuggestedDraft(
      range.surahId,
      suggestionStartAyah,
      suggestionStartAyah,
      { memorization: draft.memorization, meaning: draft.meaning, notes: draft.notes ?? "" }
    )

    const quickOptions: QuickRangeOption[] = [
      {
        key: "goal-quarter-surah",
        label: describeMediumFractionShortcut(goal, targetSurahId, quarterDraft, "quarter"),
        hint: quarterDraft ? `من الآية ${formatNumberAr(quarterDraft.fromAyah)} إلى ${formatNumberAr(quarterDraft.toAyah)}` : "إذا كان المتبقي أقل من ربع السورة فاختر المتبقي أو يدوي",
        draft: quarterDraft,
      },
      {
        key: "goal-half-surah",
        label: describeMediumFractionShortcut(goal, targetSurahId, halfDraft, "half"),
        hint: halfDraft ? `من الآية ${formatNumberAr(halfDraft.fromAyah)} إلى ${formatNumberAr(halfDraft.toAyah)}` : "إذا كان المتبقي أقل من نصف السورة فاختر المتبقي أو يدوي",
        draft: halfDraft,
      },
      {
        key: "goal-full-ayahs",
        label: describeFullAyahShortcut(goal, targetSurahId, fullRemainingDraft),
        hint: remaining ? `من الآية ${formatNumberAr(remaining.fromAyah)} إلى ${formatNumberAr(remaining.toAyah)}` : "هذا الهدف محفوظ حاليًا",
        draft: fullRemainingDraft,
      },
      {
        key: "goal-manual",
        label: "اختيار آيات يدوي",
        hint: "إذا كان حفظك اليوم يختلف عن هذا الاقتراح",
        draft: { ...manualDraft },
        tone: "manual" as const,
      },
    ]

    return dedupeQuickOptions(quickOptions.filter((option) => option.draft !== null))
  }

  const pageChunks = getGoalPageChunks(goal, targetSurahId)
  const currentChunkIndex = remaining ? getChunkIndexForAyah(pageChunks, remaining.fromAyah) : -1
  const currentChunk = currentChunkIndex >= 0 ? pageChunks[currentChunkIndex] : undefined
  const nextChunk = currentChunkIndex >= 0 ? pageChunks[currentChunkIndex + 1] : undefined
  const currentChunkFullyRemaining = isFullChunkRemaining(currentChunk, remaining)
  const currentChunkPartiallyRemaining = isPartialChunkRemaining(currentChunk, remaining)
  const nextChunkFullyRemaining = isChunkCoveredByRemaining(nextChunk, remaining)
  const goalPages = targetSurahId ? getGoalPageSequence(goal, targetSurahId) : []
  const currentPageOrdinal = currentChunkIndex >= 0 ? currentChunkIndex + 1 : null
  const nextPageOrdinal = nextChunk ? currentChunkIndex + 2 : null

  const fullRemainingDraft = remaining
    ? createSuggestedDraft(range.surahId, remaining.fromAyah, remaining.toAyah)
    : null
  const currentPageRemainderDraft =
    remaining && currentChunkPartiallyRemaining && currentChunk
      ? createSuggestedDraft(range.surahId, remaining.fromAyah, Math.min(remaining.toAyah, currentChunk.toAyah))
      : null
  const onePageDraft =
    remaining && currentChunkPartiallyRemaining && nextChunk
      ? createSuggestedDraft(range.surahId, nextChunk.fromAyah, Math.min(remaining.toAyah, nextChunk.toAyah))
      : remaining && currentChunkFullyRemaining
      ? getPageSpanDraft(range.surahId, remaining.fromAyah, remaining.toAyah, 1)
      : null
  const twoPageDraft =
    remaining && currentChunkPartiallyRemaining && nextChunk && nextChunkFullyRemaining
      ? null
      : remaining && currentChunkFullyRemaining && nextChunk && nextChunkFullyRemaining
      ? getPageSpanDraft(range.surahId, remaining.fromAyah, remaining.toAyah, 2)
      : null
  const halfPageDraft =
    currentPageRemainderDraft ?? (remaining ? getHalfPageDraft(range.surahId, remaining.fromAyah, remaining.toAyah) : null)
  const manualDraft = createSuggestedDraft(
    range.surahId,
    suggestionStartAyah,
    suggestionStartAyah,
    { memorization: draft.memorization, meaning: draft.meaning, notes: draft.notes ?? "" }
  )

  const quickOptions: QuickRangeOption[] = [
    {
      key: "goal-half-page",
      label:
        currentChunkPartiallyRemaining && currentPageOrdinal
          ? `حفظت نصف الصفحة المتبقي من الصفحة ${formatNumberAr(currentPageOrdinal)}`
          : describeHalfPageShortcut(goal, targetSurahId, halfPageDraft),
      hint: remaining ? "اقتراح تقريبي من أول موضع غير محفوظ" : "إذا كان الهدف مكتملًا استخدم الخيار اليدوي",
      draft: halfPageDraft,
    },
    {
      key: "goal-first-page",
      label:
        currentChunkPartiallyRemaining && currentPageOrdinal && currentPageRemainderDraft
          ? `حفظت الصفحة ${formatNumberAr(currentPageOrdinal)} كاملة من ${getGoalObjectLabel(goal, targetSurahId)}`
          : describeSinglePageShortcut(goal, targetSurahId, onePageDraft),
      hint: remaining ? "من أول موضع غير محفوظ داخل الهدف" : "إذا كان الهدف مكتملًا استخدم الخيار اليدوي",
      draft: currentChunkPartiallyRemaining ? currentPageRemainderDraft : onePageDraft,
    },
    {
      key: "goal-first-two-pages",
      label:
        currentChunkPartiallyRemaining && nextPageOrdinal
          ? `حفظت الصفحة ${formatNumberAr(nextPageOrdinal)} من ${getGoalObjectLabel(goal, targetSurahId)}`
          : describeTwoPageShortcut(goal, targetSurahId, twoPageDraft),
      hint: remaining ? "من أول موضع غير محفوظ داخل الهدف" : "إذا كان الهدف مكتملًا استخدم الخيار اليدوي",
      draft: currentChunkPartiallyRemaining ? onePageDraft : twoPageDraft,
    },
    {
      key: "goal-full",
      label: describeFullRemainingShortcut(goal, targetSurahId, fullRemainingDraft),
      hint: remaining
        ? `من ${formatNumberAr(remaining.fromAyah)} إلى ${formatNumberAr(remaining.toAyah)}`
        : "هذا الهدف محفوظ حاليًا",
      draft: fullRemainingDraft,
    },
    {
      key: "goal-manual",
      label: "اختيار آيات يدوي",
      hint: "إذا كان حفظك اليوم يختلف عن هذه الاختصارات",
      draft: { ...manualDraft },
      tone: "manual" as const,
    },
  ]

  return dedupeQuickOptions(quickOptions.filter((option) => option.draft !== null))
}


function HomeOnboardingGateway() {
  return (
    <div className="page" style={{ paddingTop: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", padding: "40px 36px" }}>
      {/* Breathing logo mark */}
      <div className="breathe" style={{
        width: 88, height: 88, borderRadius: "50%",
        background: "var(--surface)",
        boxShadow: "var(--sh-2), inset 0 0 0 1px rgba(176,138,79,.35)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28,
      }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 36, fontWeight: 600, color: "var(--gold-deep)" }}>حفظ</span>
      </div>

      <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 30, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, textAlign: "center" }}>
        لنبنِ خطّتك<br />مع كتاب الله
      </h1>
      <p style={{ margin: "16px auto 0", fontSize: 14.5, lineHeight: 1.85, color: "var(--ink-soft)", maxWidth: 290, textAlign: "center" }}>
        خطّتك هي عالَمك الحالي للحفظ — تختار ما تحفظه، نرافقك في الحفظ والمراجعة، آيةً آية، بلا عجلة.
      </p>

      <div style={{ marginTop: 36, width: "100%" }}>
        <Link
          href="/onboarding"
          className="btn btn-gold btn-lg btn-block"
          style={{ textDecoration: "none", justifyContent: "center" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          لنبدأ
        </Link>
      </div>
    </div>
  )
}

function _PriorityCard({
  overdue,
  due,
  threatened,
  newGoal,
}: {
  overdue: number
  due: number
  threatened: number
  newGoal: number
}) {
  const isEmpty = overdue === 0 && due === 0 && threatened === 0 && newGoal === 0
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {overdue > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
            {formatNumberAr(overdue)} متأخرة
          </span>
        )}
        {due > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            {formatNumberAr(due)} مستحقة
          </span>
        )}
        {threatened > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            {formatNumberAr(threatened)} مهددة
          </span>
        )}
        {newGoal > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            حفظ {formatNumberAr(newGoal)} جديد
          </span>
        )}
        {isEmpty && (
          <span className="text-sm text-[var(--ink-muted)]">لا مهام معلقة</span>
        )}
      </div>
    </div>
  )
}

function _CompletedCard({
  reviewed,
  added,
  notes,
  onExtraReview,
  onExtraMemorize,
}: {
  reviewed: number
  added: number
  notes: number
  onExtraReview: () => void
  onExtraMemorize: () => void
}) {
  return (
    <div className="mb-5 rounded-[28px] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2a5c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-stone-900">أتممت جلستك اليوم</p>
          <p className="mt-0.5 text-sm text-stone-400">
            راجعت {formatNumberAr(reviewed)} · أضفت {formatNumberAr(added)}
            {notes > 0 && ` · ${formatNumberAr(notes)} ملاحظة`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onExtraReview}
          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-700"
        >
          مراجعة إضافية
        </button>
        <button
          onClick={onExtraMemorize}
          className="rounded-2xl px-4 py-3 text-sm font-semibold text-white"
          style={{ background: "#2a5c3f" }}
        >
          حفظ إضافي
        </button>
      </div>
    </div>
  )
}

function ReviewPicker({
  segments,
  onSelect,
  onClose,
}: {
  segments: ReturnType<typeof useKunehStore>["allSegments"]
  onSelect: (segmentId: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
      <div
        className="sheet-frame relative z-50 w-full p-5"
        onClick={(event) => event.stopPropagation()}
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)]" />
        <p className="mb-1 text-lg font-bold text-[var(--ink)]">مراجعة إضافية</p>
        <p className="mb-4 text-sm text-[var(--ink-muted)]">اختر أي مقطع موجود وراجعه الآن حتى لو لم يحن موعده.</p>
        <div className="max-h-[58vh] space-y-2 overflow-y-auto pb-6">
          {segments.map((segment) => (
            <button
              key={segment.id}
              onClick={() => onSelect(segment.id)}
              className="surface-card surface-card-muted w-full p-4 text-right"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-medium text-[var(--ink)]">{describeSegment(segment)}</p>
                    <p className="mt-1 text-xs text-[var(--ink-muted)]">
                      {reviewRelativeLabel(segment.nextReview)} · ثبات {formatNumberAr(Math.round(segment.effectiveStability))}٪
                    </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[segment.status]}`}>
                  {STATUS_LABEL[segment.status]}
                </span>
              </div>
            </button>
          ))}
          {segments.length === 0 && <p className="py-4 text-center text-sm text-[var(--ink-muted)]">لا توجد مقاطع بعد.</p>}
        </div>
      </div>
    </div>
  )
}

function SessionView({
  session,
  draft,
  draftError,
  paceSuggestion,
  goalUnit,
  debugRuntime,
  debugRuntimeData,
  entrySource,
  entrySurahId,
  newSegmentGoals,
  allSegments,
  selectedGoal,
  goalEntryMode,
  selectedJuzSurahId,
  outsidePlanMode,
  draftPrepared,
  onRate,
  onDraftChange,
  onAddSegment,
  onApplyQuickRange,
  onChooseGoal,
  onChooseGoalEntryMode,
  onChooseJuzSurah,
  onStartOutsidePlan,
  onBackToGoals,
  onSkipNewSegment,
  onNoteChange,
  onFinish,
  onClose,
}: {
  session: TodaySessionState
  draft: SegmentDraft
  draftError: string | null
  paceSuggestion: string
  goalUnit: "pages" | "ayahs"
  debugRuntime: boolean
  debugRuntimeData: {
    activePlan: MemorizationPlan | null
    selectedAyahRanges: PlanTargetSegment[]
    representedSurahIds: number[]
    isShortSurahPlan: boolean
    selectedQuickOptionLabel: string | null
  }
  entrySource: string | null
  entrySurahId: number | null
  newSegmentGoals: NewSegmentGoal[]
  allSegments: EnrichedSegment[]
  selectedGoal: NewSegmentGoal | null
  goalEntryMode: GoalEntryMode | null
  selectedJuzSurahId: number | null
  outsidePlanMode: boolean
  draftPrepared: boolean
  onRate: (segmentId: string, rating: Rating) => void
  onDraftChange: (draft: SegmentDraft) => void
  onAddSegment: () => void
  onApplyQuickRange: (draft: SegmentDraft | null, selectedLabel?: string) => void
  onChooseGoal: (goal: NewSegmentGoal) => void
  onChooseGoalEntryMode: (mode: GoalEntryMode | null) => void
  onChooseJuzSurah: (surahId: number) => void
  onStartOutsidePlan: () => void
  onBackToGoals: () => void
  onSkipNewSegment: () => void
  onNoteChange: (note: string) => void
  onFinish: () => void
  onClose: () => void
}) {
  const current = session.reviewQueue[session.reviewIndex]
  const formConfig = getGoalFormConfig(selectedGoal, selectedJuzSurahId, outsidePlanMode)
  const quickRangeOptions = buildQuickRangeOptions(
    selectedGoal,
    selectedJuzSurahId,
    draft,
    outsidePlanMode,
    allSegments,
    goalUnit,
    entrySource,
    entrySurahId
  )
  const juzEntryGoals = newSegmentGoals.filter((goal): goal is Extract<NewSegmentGoal, { type: "juz" }> => goal.type === "juz")
  const segmentEntryGoals = newSegmentGoals.filter((goal): goal is Extract<NewSegmentGoal, { type: "segment" }> => goal.type === "segment")
  const surahEntryGoals = buildSurahEntryGoalsFromPlan(newSegmentGoals)
  const selectedJuzSurahs =
    selectedGoal?.type === "juz"
      ? selectedGoal.surahIds
          .map((surahId) => {
            const surah = getSurahMeta(surahId)
            const range = getJuzRangeForSurah(selectedGoal, surahId)
            if (!surah || !range) return null
            const remaining = getFirstUncoveredBlock(allSegments, surahId, range.fromAyah, range.toAyah)
            if (!remaining) return null
            return { surah, range, remaining }
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : []
  const showGoalEntryModeChooser = !outsidePlanMode && !goalEntryMode && !selectedGoal
  const showPlanGoalChooser = !outsidePlanMode && goalEntryMode !== null && !selectedGoal
  const showJuzSurahChooser = selectedGoal?.type === "juz" && selectedGoal.hasMappedSurahs && selectedJuzSurahId === null
  const showQuickRangeChooser = !outsidePlanMode && Boolean(selectedGoal) && !showJuzSurahChooser && !draftPrepared
  const showDraftForm =
    outsidePlanMode || (!showJuzSurahChooser && (draftPrepared || (Boolean(selectedGoal) && quickRangeOptions.length === 0)))
  const totalSteps = session.reviewQueue.length > 0 ? 3 : 2
  const currentStep = session.phase === "review" ? 1 : session.phase === "new-segment" ? 2 : totalSteps
  const reviewCompletionPercent =
    session.reviewQueue.length === 0 ? 0 : Math.round((session.reviewIndex / session.reviewQueue.length) * 100)

  // ── Dark overlay layout ──────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header: close + phase label + progress counter */}
      <div style={{ padding: "56px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <SessionCloseBtn onClick={onClose} />
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)" }}>
            {session.phase === "review" ? "مراجعة" : session.phase === "new-segment" ? "حفظ جديد" : "تأمّل"}
          </div>
          {session.phase === "review" && session.reviewQueue.length > 0 && (
            <div style={{ fontSize: 11.5, color: "rgba(237,230,214,.5)", marginTop: 3 }}>
              {formatNumberAr(session.reviewIndex + 1)} من {formatNumberAr(session.reviewQueue.length)}
            </div>
          )}
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Review progress track */}
      {session.phase === "review" && session.reviewQueue.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "18px 24px 0", flexShrink: 0 }}>
          {Array.from({ length: session.reviewQueue.length }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i < session.reviewIndex
                ? "var(--gold)"
                : i === session.reviewIndex
                  ? "rgba(237,230,214,.4)"
                  : "rgba(237,230,214,.14)",
              transition: ".4s",
            }} />
          ))}
        </div>
      )}

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0 40px" }}>

        {/* ── REVIEW PHASE ──────────────────────────────────── */}
        {session.phase === "review" && current && (
          <div style={{ padding: "0 24px" }}>
            {/* Segment identity */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p className="serif" style={{ fontSize: 20, fontWeight: 600, color: "rgba(237,230,214,.9)", margin: 0 }}>
                {describeSegment(current)}
              </p>
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "rgba(237,230,214,.45)", background: "rgba(237,230,214,.07)", padding: "4px 12px", borderRadius: 9999 }}>
                  {reviewRelativeLabel(current.nextReview)}
                </span>
                <span style={{ fontSize: 12, color: "rgba(237,230,214,.45)", background: "rgba(237,230,214,.07)", padding: "4px 12px", borderRadius: 9999 }}>
                  ثبات {formatNumberAr(Math.round(current.effectiveStability))}٪
                </span>
                {current.referencePages && current.referencePages.length > 0 && (
                  <span style={{ fontSize: 12, color: "rgba(237,230,214,.45)", background: "rgba(237,230,214,.07)", padding: "4px 12px", borderRadius: 9999 }}>
                    صفحة {current.referencePages[0]}
                    {current.referencePages.length > 1 ? `–${current.referencePages[current.referencePages.length - 1]}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Recall prompt */}
            <div style={{
              minHeight: 110,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 22,
              background: "rgba(237,230,214,.05)",
              boxShadow: "inset 0 0 0 1px rgba(237,230,214,.1)",
              padding: "24px 20px",
              marginBottom: 32,
              textAlign: "center",
            }}>
              <p style={{ fontSize: 14, color: "rgba(237,230,214,.4)", lineHeight: 1.8, margin: 0 }}>
                استرجع الآيات من حفظك في ذهنك،<br />ثم قيّم مدى ثباتها
              </p>
            </div>

            {/* Flat dark pill ratings */}
            <div style={{ textAlign: "center", fontSize: 13, color: "rgba(237,230,214,.5)", marginBottom: 14 }}>
              كيف كان استرجاعك؟
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {DARK_RATING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onRate(current.id, option.value)}
                  style={{
                    flex: 1, height: 64, borderRadius: 16,
                    background: "rgba(237,230,214,.06)",
                    color: "#F1EAD9", border: "none",
                    boxShadow: `inset 0 0 0 1px ${option.tone}55`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 6,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: option.tone, display: "block" }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── NEW SEGMENT PHASE ─────────────────────────────── */}
        {session.phase === "new-segment" && (
          <div style={{ padding: "0 20px" }}>
            <h2 className="serif" style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 600, color: "#F1EAD9", lineHeight: 1.3 }}>
              ماذا حفظت اليوم؟
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(237,230,214,.55)", lineHeight: 1.7 }}>
              ابدأ من أهداف خطتك الحالية، وسجّل فقط ما حفظته فعلًا.
            </p>

            {/* Pace suggestion */}
            <div style={{
              borderRadius: 14, padding: "12px 16px", marginBottom: 20,
              background: "rgba(176,138,79,.1)",
              boxShadow: "inset 0 0 0 1px rgba(176,138,79,.2)",
              fontSize: 14, color: "#D9C9A3",
            }}>
              اقتراح اليوم: {paceSuggestion} تقريبًا
            </div>

            {showGoalEntryModeChooser && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {juzEntryGoals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChooseGoalEntryMode("juz")}
                    style={darkGoalChooserBtn}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>جزء</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>
                        اعرض فقط الأجزاء الموجودة في خطتك الحالية.
                      </p>
                    </div>
                    <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                  </button>
                )}
                {surahEntryGoals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChooseGoalEntryMode("surah")}
                    style={darkGoalChooserBtn}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>سورة</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>
                        اعرض فقط السور الموجودة في خطتك الحالية.
                      </p>
                    </div>
                    <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                  </button>
                )}
                {segmentEntryGoals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChooseGoalEntryMode("segment")}
                    style={darkGoalChooserBtn}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>مقطع</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>
                        اعرض فقط المقاطع المخصصة الموجودة في خطتك.
                      </p>
                    </div>
                    <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onStartOutsidePlan}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 16,
                    border: "1px dashed rgba(237,230,214,.2)",
                    background: "transparent", color: "rgba(237,230,214,.45)",
                    fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  حفظ شيء خارج الخطة
                </button>
                <button
                  type="button"
                  onClick={onSkipNewSegment}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 16,
                    border: "1px solid rgba(237,230,214,.12)",
                    background: "rgba(237,230,214,.06)", color: "rgba(237,230,214,.6)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  تخطّي الحفظ الجديد اليوم
                </button>
              </div>
            )}

            {showPlanGoalChooser && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button type="button" onClick={() => onChooseGoalEntryMode(null)} style={darkBackBtn}>
                  رجوع إلى أنواع الأهداف
                </button>
                {(goalEntryMode === "juz"
                  ? juzEntryGoals
                  : goalEntryMode === "segment"
                    ? segmentEntryGoals
                    : surahEntryGoals
                ).map((goal) => (
                  <button
                    key={goal.key}
                    type="button"
                    onClick={() => onChooseGoal(goal)}
                    style={darkGoalChooserBtn}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{goal.title}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>{goal.subtitle}</p>
                    </div>
                    <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                  </button>
                ))}
              </div>
            )}

            {showJuzSurahChooser && (
              <div>
                <button type="button" onClick={onBackToGoals} style={darkBackBtn}>
                  رجوع إلى أهداف الخطة
                </button>
                <div style={darkInfoBox}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#EDE6D6" }}>{selectedGoal.title}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(237,230,214,.5)", lineHeight: 1.6 }}>
                    اختر السورة التي حفظت منها اليوم داخل هذا الجزء.
                  </p>
                </div>
                {selectedJuzSurahs.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedJuzSurahs.map(({ surah, range, remaining }) => (
                      <button
                        key={surah.id}
                        type="button"
                        onClick={() => onChooseJuzSurah(surah.id)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "14px 16px", borderRadius: 16,
                          background: "rgba(237,230,214,.07)",
                          boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
                          border: "none", color: "#EDE6D6", cursor: "pointer", fontFamily: "inherit",
                          textAlign: "right",
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>ضمن سورة {surah.name}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>
                            المتبقي: {formatNumberAr(remaining.fromAyah)}–{formatNumberAr(remaining.toAyah)}
                          </p>
                        </div>
                        <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={darkInfoBox}>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(237,230,214,.72)", lineHeight: 1.8 }}>
                      تم إكمال جميع سور هذا الجزء داخل خطتك.
                    </p>
                  </div>
                )}
              </div>
            )}

            {showQuickRangeChooser && (
              <div>
                <button type="button" onClick={onBackToGoals} style={darkBackBtn}>
                  رجوع إلى أهداف الخطة
                </button>
                <div style={darkInfoBox}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#EDE6D6" }}>{selectedGoal?.title}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(237,230,214,.5)", lineHeight: 1.6 }}>
                    اختر اختصارًا سريعًا أولًا، ثم عدّل الآيات قبل الحفظ.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {quickRangeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => onApplyQuickRange(option.draft, option.label)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "14px 16px", borderRadius: 16,
                        border: option.tone === "manual"
                          ? "1px dashed rgba(237,230,214,.2)"
                          : "1px solid rgba(237,230,214,.12)",
                        background: option.tone === "manual"
                          ? "transparent"
                          : "rgba(237,230,214,.07)",
                        color: option.tone === "manual" ? "rgba(237,230,214,.45)" : "#EDE6D6",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "right",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{option.label}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(237,230,214,.5)" }}>{option.hint}</p>
                      </div>
                      <span style={{ color: "rgba(237,230,214,.35)", fontSize: 18 }}>‹</span>
                    </button>
                  ))}
                </div>
                {debugRuntime && (
                  <RuntimeDebugPanel
                    activePlan={debugRuntimeData.activePlan}
                    selectedAyahRanges={debugRuntimeData.selectedAyahRanges}
                    representedSurahIds={debugRuntimeData.representedSurahIds}
                    isShortSurahPlan={debugRuntimeData.isShortSurahPlan}
                    goalUnit={goalUnit}
                    quickRangeLabels={quickRangeOptions.map((option) => option.label)}
                    selectedQuickOptionLabel={debugRuntimeData.selectedQuickOptionLabel}
                  />
                )}
              </div>
            )}

            {showDraftForm && (
              <div>
                <button type="button" onClick={onBackToGoals} style={darkBackBtn}>
                  رجوع إلى أهداف الخطة
                </button>
                <p style={{ fontSize: 13, color: "rgba(237,230,214,.5)", lineHeight: 1.7, marginBottom: 16 }}>
                  {draftPrepared
                    ? "هذا اقتراح أولي. عدّل الآيات إذا كان حفظك اليوم أقل أو أكثر."
                    : formConfig.helperText}
                </p>
                <SegmentDraftForm
                  draft={draft}
                  error={draftError}
                  submitLabel="حفظ المقطع وإكمال الجلسة"
                  surahOptions={formConfig.surahOptions}
                  lockSurah={formConfig.lockSurah}
                  contextStartAyah={formConfig.contextStartAyah}
                  contextEndAyah={formConfig.contextEndAyah}
                  onChange={onDraftChange}
                  onSubmit={onAddSegment}
                  onCancel={onSkipNewSegment}
                />
                {debugRuntime && (
                  <RuntimeDebugPanel
                    activePlan={debugRuntimeData.activePlan}
                    selectedAyahRanges={debugRuntimeData.selectedAyahRanges}
                    representedSurahIds={debugRuntimeData.representedSurahIds}
                    isShortSurahPlan={debugRuntimeData.isShortSurahPlan}
                    goalUnit={goalUnit}
                    quickRangeLabels={quickRangeOptions.map((option) => option.label)}
                    selectedQuickOptionLabel={debugRuntimeData.selectedQuickOptionLabel}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REFLECT / SUMMARY PHASE ───────────────────────── */}
        {session.phase === "summary" && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 32px" }}>
            <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)", textAlign: "center", marginBottom: 14 }}>
              تأمّل اليوم
            </div>
            <h1 className="serif" style={{ margin: 0, fontSize: 26, fontWeight: 600, color: "#F1EAD9", textAlign: "center", lineHeight: 1.4 }}>
              خاطرةٌ تربطك<br />بما حفظت
            </h1>
            <textarea
              value={session.note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={4}
              placeholder="ماذا لمس قلبك اليوم؟ (اختياري)"
              style={{
                marginTop: 28, width: "100%",
                borderRadius: 18,
                border: "1px solid rgba(237,230,214,.16)",
                background: "rgba(237,230,214,.05)",
                color: "#F1EAD9", fontFamily: "var(--serif)",
                fontSize: 18, lineHeight: 1.8,
                padding: "16px 18px", resize: "none",
                direction: "rtl",
              }}
            />
            <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
              <button
                style={{
                  flex: 1, height: 54, borderRadius: 16,
                  background: "rgba(237,230,214,.08)", color: "#EDE6D6", border: "none",
                  boxShadow: "inset 0 0 0 1px rgba(237,230,214,.14)",
                  fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
                onClick={onFinish}
              >
                تخطّي
              </button>
              <button className="btn btn-gold" style={{ flex: 1.4, height: 54 }} onClick={onFinish}>
                أنهِ الجلسة
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function RuntimeDebugPanel({
  activePlan,
  selectedAyahRanges,
  representedSurahIds,
  isShortSurahPlan,
  goalUnit,
  quickRangeLabels,
  selectedQuickOptionLabel,
}: {
  activePlan: MemorizationPlan | null
  selectedAyahRanges: PlanTargetSegment[]
  representedSurahIds: number[]
  isShortSurahPlan: boolean
  goalUnit: "pages" | "ayahs"
  quickRangeLabels: string[]
  selectedQuickOptionLabel: string | null
}) {
  const payload = {
    activePlan,
    "activePlan.targetJuz": activePlan?.targetJuz ?? [],
    "activePlan.targetSurahs": activePlan?.targetSurahs ?? [],
    "activePlan.targetSegments": activePlan?.targetSegments ?? [],
    selectedAyahRanges,
    representedSurahIds,
    isShortSurahPlan,
    goalUnit,
    quickRangeOptions: quickRangeLabels,
    selectedQuickOption: selectedQuickOptionLabel,
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 16,
        background: "rgba(0,0,0,.22)",
        boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "rgba(237,230,214,.65)",
        }}
      >
        DEBUG RUNTIME
      </div>
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          direction: "ltr",
          textAlign: "left",
          fontSize: 11,
          lineHeight: 1.7,
          color: "#EDE6D6",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  )
}

// ── Small shared helpers for SessionView dark theme ──────────
const darkBackBtn: React.CSSProperties = {
  display: "inline-block", marginBottom: 16,
  fontSize: 13, fontWeight: 500, color: "rgba(237,230,214,.5)",
  background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit",
}
const darkGoalChooserBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  textAlign: "right",
  background: "rgba(237,230,214,.07)",
  boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
  color: "#EDE6D6",
  cursor: "pointer",
  fontFamily: "inherit",
}
const darkInfoBox: React.CSSProperties = {
  borderRadius: 14, padding: "14px 16px", marginBottom: 16,
  background: "rgba(237,230,214,.06)",
  boxShadow: "inset 0 0 0 1px rgba(237,230,214,.1)",
}

function SessionCloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 44, height: 44, borderRadius: "50%",
        background: "rgba(237,230,214,.08)",
        boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#EDE6D6", border: "none", cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

// ── SessionOverview — calm intro before the engine runs ──────
function SessionOverview({
  reviewCount,
  hasNewMemo,
  onClose,
  onBegin,
}: {
  reviewCount: number
  hasNewMemo: boolean
  onClose: () => void
  onBegin: () => void
}) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 20px 0", display: "flex", justifyContent: "space-between" }}>
        <SessionCloseBtn onClick={onClose} />
        <div style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
        <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)" }}>جلسة اليوم</div>
        <h1 className="serif rise" style={{ margin: "14px 0 0", fontSize: 30, fontWeight: 600, color: "#F1EAD9", lineHeight: 1.35 }}>
          لحظةٌ هادئة<br />مع كتاب الله
        </h1>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
          <SessionOverviewRow
            icon="repeat"
            title="مراجعة"
            detail={reviewCount > 0 ? `${reviewCount} مقاطع لتثبيتها` : "لا مراجعات اليوم"}
            dim={reviewCount === 0}
          />
          <SessionOverviewRow
            icon="spark"
            title="حفظ جديد"
            detail={hasNewMemo ? "من خطتك الحالية" : "أتممت خطّتك"}
            dim={!hasNewMemo}
          />
          <SessionOverviewRow
            icon="pen"
            title="تأمّل"
            detail="خاطرةٌ تكتبها إن شئت"
            dim={false}
          />
        </div>
      </div>

      <div style={{ padding: "0 28px 48px" }}>
        <button className="btn btn-gold btn-lg btn-block" onClick={onBegin}>
          لنبدأ
        </button>
      </div>
    </div>
  )
}

function SessionOverviewRow({
  icon,
  title,
  detail,
  dim,
}: {
  icon: string
  title: string
  detail: string
  dim: boolean
}) {
  const icons: Record<string, React.ReactNode> = {
    repeat: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9C9A3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
    spark: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9C9A3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    pen: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D9C9A3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: dim ? 0.45 : 1, textAlign: "right" }}>
      <div style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
        background: "rgba(237,230,214,.08)",
        boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icons[icon]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#F1EAD9" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "rgba(237,230,214,.5)", marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  )
}

// ── SessionDone — spiritual completion moment ────────────────
function SessionDone({
  reviewedCount,
  addedCount,
  onHome,
}: {
  reviewedCount: number
  addedCount: number
  onHome: () => void
}) {
  return (
    <div style={{
      height: "100%",
      background: "radial-gradient(120% 80% at 50% 16%, #2c2620, var(--surface-ink))",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "30px 36px",
      }}>
        {/* Gold ring with breathe animation */}
        <div className="rise" style={{ marginBottom: 28 }}>
          <div style={{
            width: 116, height: 116, borderRadius: "50%", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="116" height="116" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx="58" cy="58" r="52" fill="none" stroke="rgba(237,230,214,.1)" strokeWidth={5} />
              <circle cx="58" cy="58" r="52" fill="none" stroke="var(--gold)" strokeWidth={5}
                strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={0} strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)" }} />
            </svg>
            <div className="breathe" style={{
              width: 82, height: 82, borderRadius: "50%",
              background: "rgba(237,230,214,.06)",
              boxShadow: "inset 0 0 0 1px rgba(190,154,94,.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rise" style={{ animationDelay: ".08s" }}>
          <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)" }}>تمّت جلسة اليوم</div>
          <h1 className="serif" style={{ margin: "12px 0 0", fontSize: 27, fontWeight: 600, color: "#F1EAD9", lineHeight: 1.35 }}>
            {addedCount > 0 ? `أضفت ${addedCount} مقاطع جديدة` : "ثبّتّ ما حفظت"}
          </h1>
          <p style={{ margin: "14px auto 0", fontSize: 14, lineHeight: 1.8, color: "rgba(237,230,214,.55)", maxWidth: 280 }}>
            {reviewedCount > 0 && `راجعت ${reviewedCount} مقاطع. `}
            سنذكّرك بمراجعتها في وقتها بإذن الله.
          </p>
        </div>

        {/* Ornamental du'a */}
        <div className="rise" style={{ marginTop: 32, animationDelay: ".16s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", width: 160, margin: "0 auto 14px" }}>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(176,138,79,.4))" }} />
            <div style={{ width: 6, height: 6, transform: "rotate(45deg)", background: "var(--gold)", opacity: .7 }} />
            <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(176,138,79,.4))" }} />
          </div>
          <div className="serif" style={{ fontSize: 21, fontWeight: 600, color: "var(--gold)", lineHeight: 1.7 }}>
            ﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾
          </div>
        </div>
      </div>

      <div style={{ padding: "0 28px 48px" }}>
        <button className="btn btn-gold btn-lg btn-block" onClick={onHome}>
          عودة إلى الرئيسية
        </button>
      </div>
    </div>
  )
}
