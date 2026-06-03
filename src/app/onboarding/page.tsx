"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode, useMemo, useState } from "react"
import { TargetDateSheet } from "@/components/target-date-sheet"
import { buildPacePlanSummary, clampDailyPacePages, formatDailyPacePages } from "@/lib/pace-planner"
import { getPlanPages } from "@/lib/page-coverage"
import { JUZ, SURAHS, getSurahMeta } from "@/lib/quran-metadata"
import { buildSelectedAyahRanges, formatSurahCoverageLabel, getSelectedAyahCount, getSelectedSurahCount, getSurahSelectionState } from "@/lib/plan-selection"
import { useKunehStore } from "@/lib/store"
import { daysBetween, formatDateFullAr, formatDateYearAr, formatNumberAr, today } from "@/lib/utils"
import type { PlanTargetSegment, SegmentDraft } from "@/lib/types"

type Tab = "juz" | "surah" | "segment"
type OnboardingStep = "content" | "target-date" | "daily-pace" | "summary"

export default function OnboardingPage() {
  const router = useRouter()
  const { store, setActivePlan, updateSettings } = useKunehStore()

  const [planName, setPlanName] = useState("خطة المرحلة الحالية")
  const [draft, setDraft] = useState<{
    targetJuz: number[]
    targetSurahs: number[]
    targetSegments: PlanTargetSegment[]
  }>({
    targetJuz: [],
    targetSurahs: [],
    targetSegments: [],
  })
  const [tab, setTab] = useState<Tab>("juz")
  const [step, setStep] = useState<OnboardingStep>("content")
  const [goalOpen, setGoalOpen] = useState(false)
  const [targetDate, setTargetDate] = useState(store.settings.targetDate)
  const [paceMode, setPaceMode] = useState<"0.5" | "1" | "2" | "custom">("0.5")
  const [customPace, setCustomPace] = useState(`${store.settings.dailyPacePages ?? 0.5}`)
  const [segDraft, setSegDraft] = useState<SegmentDraft>({
    surahId: 67, fromAyah: 1, toAyah: 10, memorization: 1, meaning: 1, notes: "",
  })

  const selectedAyahRanges = useMemo(() => buildSelectedAyahRanges(draft), [draft])
  const goalsCount = draft.targetJuz.length + draft.targetSurahs.length + draft.targetSegments.length
  const canCreate = goalsCount > 0
  const totalAyahs = useMemo(() => getSelectedAyahCount(selectedAyahRanges), [selectedAyahRanges])
  const selectedSurahCount = useMemo(() => getSelectedSurahCount(selectedAyahRanges), [selectedAyahRanges])
  const selectedDailyPacePages = useMemo(
    () => (paceMode === "custom" ? clampDailyPacePages(Number(customPace) || 0.5) : Number(paceMode)),
    [customPace, paceMode]
  )
  const draftPlan = useMemo(
    () => ({
      id: "draft-plan",
      name: planName.trim() || "خطة المرحلة الحالية",
      targetJuz: draft.targetJuz,
      targetSurahs: draft.targetSurahs,
      targetSegments: draft.targetSegments,
      createdAt: today(),
      updatedAt: today(),
    }),
    [draft, planName]
  )
  const totalPages = useMemo(() => getPlanPages(draftPlan).length, [draftPlan])
  const summary = useMemo(
    () =>
      buildPacePlanSummary({
        activePlan: draftPlan,
        segments: [],
        targetDate,
        dailyPace: selectedDailyPacePages,
      }),
    [draftPlan, selectedDailyPacePages, targetDate]
  )
  const afterTargetDays = useMemo(
    () => Math.max(0, daysBetween(targetDate, summary.finishDate)),
    [summary.finishDate, targetDate]
  )
  const summaryContentItems = useMemo(() => {
    const items: string[] = []
    draft.targetJuz.forEach((id) => items.push(`الجزء ${formatNumberAr(id)}`))
    draft.targetSurahs.forEach((id) => items.push(SURAHS.find((surah) => surah.id === id)?.name ?? `${id}`))
    draft.targetSegments.forEach((segment) => {
      const name = SURAHS.find((surah) => surah.id === segment.surahId)?.name ?? `${segment.surahId}`
      items.push(`${name} ${formatNumberAr(segment.fromAyah)}–${formatNumberAr(segment.toAyah)}`)
    })
    return items
  }, [draft])

  // ── Already has plan ─────────────────────────────────────────
  if (store.activePlan) {
    return (
      <div className="page" style={{ padding: "28px 20px" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>الإعداد</div>
        <div className="card" style={{ padding: "24px 20px" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            لديك خطة نشطة بالفعل
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-muted)", marginBottom: 20 }}>
            كُنه يعمل الآن على{" "}
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{store.activePlan.name}</span>
            . إذا أردت تعديلها، ستجد ذلك من الصفحة الرئيسية أو الإعدادات.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" style={{
              flex: 1, height: 46, borderRadius: 14,
              background: "var(--gold)", color: "white", fontWeight: 700, fontSize: 14,
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              اذهب إلى الرئيسية
            </Link>
            <Link href="/settings" style={{
              flex: 1, height: 46, borderRadius: 14,
              background: "transparent", color: "var(--ink-soft)", fontWeight: 600, fontSize: 14,
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.12)",
            }}>
              افتح الإعدادات
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Handlers ─────────────────────────────────────────────────
  function toggleJuz(id: number) {
    setDraft((previous) => ({
      ...previous,
      targetJuz: previous.targetJuz.includes(id) ? previous.targetJuz.filter((juzId) => juzId !== id) : [...previous.targetJuz, id],
    }))
  }
  function toggleSurah(id: number) {
    setDraft((previous) => ({
      ...previous,
      targetSurahs: previous.targetSurahs.includes(id) ? previous.targetSurahs.filter((surahId) => surahId !== id) : [...previous.targetSurahs, id],
    }))
  }
  function addSegment(seg: PlanTargetSegment) {
    const key = `${seg.surahId}:${seg.fromAyah}-${seg.toAyah}`
    setDraft((previous) => ({
      ...previous,
      targetSegments: previous.targetSegments.some((segment) => `${segment.surahId}:${segment.fromAyah}-${segment.toAyah}` === key)
        ? previous.targetSegments
        : [...previous.targetSegments, seg],
    }))
  }
  function removeSegment(key: string) {
    setDraft((previous) => ({
      ...previous,
      targetSegments: previous.targetSegments.filter((segment) => `${segment.surahId}:${segment.fromAyah}-${segment.toAyah}` !== key),
    }))
  }
  function handleCreate() {
    if (!canCreate) return
    updateSettings({
      ...store.settings,
      targetDate,
      dailyPacePages: selectedDailyPacePages,
    })
    setActivePlan({
      id: "active-plan",
      name: planName.trim() || "خطة المرحلة الحالية",
      targetJuz: draft.targetJuz,
      targetSurahs: draft.targetSurahs,
      targetSegments: draft.targetSegments,
      createdAt: today(), updatedAt: today(),
    })
    router.push("/")
  }

  if (step === "target-date") {
    return (
      <div className="page" style={{ padding: "0 20px" }}>
        <div style={{ padding: "22px 2px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{formatDateFullAr(today())}</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 27, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 10 }}>
            متى تبي تخلص الخطة؟
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.85, color: "var(--ink-muted)", maxWidth: "34ch" }}>
            اختر تاريخًا قادمًا لهدفك، ثم نُظهر لك أثره على الوتيرة التي تناسبك.
          </p>
        </div>

        <div className="card" style={{ padding: "22px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>هدف الإتمام</div>
          <button
            type="button"
            onClick={() => setGoalOpen(true)}
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "space-between", height: 52 }}
          >
            <span>{formatDateYearAr(targetDate)}</span>
            <span>اختر التاريخ</span>
          </button>
        </div>

        <StepActions
          backLabel="رجوع إلى محتوى الخطة"
          nextLabel="التالي: الوتيرة اليومية"
          onBack={() => setStep("content")}
          onNext={() => setStep("daily-pace")}
        />

        {goalOpen && (
          <TargetDateSheet
            value={targetDate}
            onClose={() => setGoalOpen(false)}
            onSave={(iso) => setTargetDate(iso)}
          />
        )}
      </div>
    )
  }

  if (step === "daily-pace") {
    return (
      <div className="page" style={{ padding: "0 20px" }}>
        <div style={{ padding: "22px 2px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>الخطوة الثالثة</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 27, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 10 }}>
            شكثر تقدر تحفظ يوميًا؟
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.85, color: "var(--ink-muted)", maxWidth: "34ch" }}>
            اختر الوتيرة التي تناسب طاقتك اليومية، وسنوضح لك أثرها على تاريخ الإتمام.
          </p>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { value: "0.5" as const, label: "نصف صفحة يوميًا" },
              { value: "1" as const, label: "صفحة يوميًا" },
              { value: "2" as const, label: "صفحتان يوميًا" },
              { value: "custom" as const, label: "مخصص" },
            ].map((option) => {
              const selected = paceMode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaceMode(option.value)}
                  style={{
                    minHeight: 52,
                    borderRadius: 14,
                    border: "none",
                    background: selected ? "var(--ink)" : "var(--paper-deep)",
                    color: selected ? "white" : "var(--ink-soft)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "0 12px",
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {paceMode === "custom" && (
            <div style={{ marginTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>عدد الصفحات يوميًا</div>
              <input
                type="number"
                min={0.25}
                max={10}
                step={0.25}
                value={customPace}
                onChange={(event) => setCustomPace(event.target.value)}
                style={{
                  width: "100%", height: 52, borderRadius: 16,
                  border: "1px solid var(--line)", background: "white",
                  fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600,
                  color: "var(--ink)", padding: "0 16px", textAlign: "right", outline: "none",
                }}
              />
              <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7 }}>
                بين ربع صفحة و10 صفحات يوميًا، مع دعم الكسور مثل 0.25 و0.5 و0.75 و1.5.
              </p>
            </div>
          )}
        </div>

        <StepActions
          backLabel="رجوع إلى هدف الإتمام"
          nextLabel="التالي: ملخص الخطة"
          onBack={() => setStep("target-date")}
          onNext={() => setStep("summary")}
        />
      </div>
    )
  }

  if (step === "summary") {
    return (
      <div className="page" style={{ padding: "0 20px" }}>
        <div style={{ padding: "22px 2px 20px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>الخطوة الأخيرة</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 27, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, marginBottom: 10 }}>
            خطة حفظك
          </h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.85, color: "var(--ink-muted)", maxWidth: "34ch" }}>
            هذا ملخص اختياراتك قبل إنشاء الخطة. إذا أردت تعديل شيء، ارجع إلى الخطوة السابقة.
          </p>
        </div>

        <div className="card" style={{ padding: "22px 20px" }}>
          <SummaryRow label="المحتوى">
            <div style={{ display: "grid", gap: 6 }}>
              {summaryContentItems.map((item) => (
                <div key={item} style={{ fontSize: 14, color: "var(--ink)" }}>- {item}</div>
              ))}
            </div>
          </SummaryRow>
          <SummaryRow label="هدف الإتمام" value={formatDateYearAr(targetDate)} />
          <SummaryRow label="وتيرتك" value={formatDailyPacePages(selectedDailyPacePages)} />
          <SummaryRow label="إجمالي الخطة" value={`${formatNumberAr(totalPages)} صفحة تقريبًا`} />
          <SummaryRow label="التقدير الحالي" value={`ستنتهي تقريبًا في ${formatDateYearAr(summary.finishDate)}`} />

          {summary.remainingAmount > 0 && !summary.onTrack ? (
            <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 16, background: "var(--paper-deep)" }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
                بناءً على وتيرتك الحالية، ستنتهي تقريبًا بعد هدفك الحالي بـ {formatNumberAr(afterTargetDays)} يومًا.
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
                إذا أردت إنهاء الخطة قبل هدفك الحالي، تحتاج تقريبًا {formatDailyPacePages(summary.requiredDailyAmount)}.
              </p>
            </div>
          ) : (
            <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 16, background: "var(--gold-soft)" }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: "var(--gold-deep)", fontWeight: 600 }}>
                وتيرتك الحالية تكفي لإنهاء الخطة قبل الهدف.
              </p>
            </div>
          )}
        </div>

        <StepActions
          backLabel="رجوع إلى الوتيرة"
          nextLabel="إنشاء الخطة"
          onBack={() => setStep("daily-pace")}
          onNext={handleCreate}
        />
      </div>
    )
  }

  return (
    <div className="page" style={{ padding: "0 20px" }}>

      {/* ── Page header ── */}
      <div style={{ padding: "22px 2px 20px" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{formatDateFullAr(today())}</div>
        <h1 style={{
          fontFamily: "var(--serif)", fontSize: 27, fontWeight: 700,
          color: "var(--ink)", lineHeight: 1.3, marginBottom: 10,
        }}>
          شنو تبي تحفظ في هذه المرحلة؟
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.85, color: "var(--ink-muted)", maxWidth: "34ch" }}>
          ابنِ خطتك الحالية كسلة أهداف مرنة — جزء، سورة، أو مقطع مخصص.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 22 }}>
        <StatCard label="الأجزاء" value={draft.targetJuz.length} />
        <StatCard label="السور" value={selectedSurahCount} />
        <StatCard label="المقاطع" value={draft.targetSegments.length} />
      </div>

      {/* ── Plan name input ── */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 7 }}>اسم الخطة</div>
        <input
          value={planName}
          onChange={e => setPlanName(e.target.value)}
          style={{
            width: "100%", height: 52, borderRadius: 16,
            border: "1px solid var(--line)", background: "white",
            fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600,
            color: "var(--ink)", padding: "0 16px",
            textAlign: "right", outline: "none",
          }}
        />
      </div>

      {/* ── Content type tabs ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>محتوى الخطة</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {([
            { key: "juz" as Tab, label: "جزء", icon: <LayersIcon /> },
            { key: "surah" as Tab, label: "سورة", icon: <BookIcon /> },
            { key: "segment" as Tab, label: "نطاق آيات", icon: <RangeIcon /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                height: 38, borderRadius: 14, border: "none",
                background: tab === key ? "var(--ink)" : "white",
                color: tab === key ? "white" : "var(--ink-soft)",
                boxShadow: tab === key ? "none" : "inset 0 0 0 1px rgba(33,29,24,0.11)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                transition: "background .14s, color .14s",
              }}
            >
              <span style={{ opacity: tab === key ? 0.85 : 0.38 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Juz grid ── */}
      {tab === "juz" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7, marginBottom: 20 }}>
          {JUZ.map(juz => {
            const sel = draft.targetJuz.includes(juz.id)
            return (
              <button
                key={juz.id}
                type="button"
                onClick={() => toggleJuz(juz.id)}
                style={{
                  aspectRatio: "1", borderRadius: 12, border: "none",
                  background: sel ? "var(--gold)" : "white",
                  color: sel ? "white" : "var(--ink-soft)",
                  boxShadow: sel ? "none" : "inset 0 0 0 1px rgba(33,29,24,0.08)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "background .13s, color .13s",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
                  {formatNumberAr(juz.id)}
                </span>
                <span style={{ fontSize: 9.5, marginTop: 3, opacity: sel ? 0.7 : 0.45 }}>جزء</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Surah list ── */}
      {tab === "surah" && (
        <div style={{ background: "var(--paper-deep)", borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          {SURAHS.map((surah, idx) => {
            const isDirectlySelected = draft.targetSurahs.includes(surah.id)
            const selectionState = getSurahSelectionState(surah.id, selectedAyahRanges)
            const sel = selectionState.kind !== "none"
            return (
              <button
                key={surah.id}
                type="button"
                onClick={() => toggleSurah(surah.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  padding: "15px 16px", gap: 12,
                  background: "transparent", border: "none",
                  borderTop: idx > 0 ? "1px solid rgba(33,29,24,0.055)" : "none",
                  cursor: "pointer",
                }}
              >
                {/* name+id → rightmost in RTL */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{
                      fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600,
                      color: sel ? "var(--ink)" : "var(--ink-soft)", lineHeight: 1.2,
                    }}>
                      {surah.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                      {formatNumberAr(surah.id)}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {selectionState.kind === "partial"
                      ? `تحديد جزئي · ${formatSurahCoverageLabel(selectionState)}`
                      : isDirectlySelected
                        ? "هدف مباشر"
                        : formatSurahCoverageLabel(selectionState)}
                  </span>
                </div>
                {/* radio → leftmost in RTL (last in DOM) */}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: selectionState.kind === "full" ? "var(--ink)" : selectionState.kind === "partial" ? "var(--gold-soft)" : "transparent",
                  boxShadow: `inset 0 0 0 ${
                    selectionState.kind === "none" ? 1.5 : selectionState.kind === "partial" ? 1 : 0
                  }px ${selectionState.kind === "partial" ? "var(--gold-deep)" : "rgba(33,29,24,0.22)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selectionState.kind === "full" && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                  {selectionState.kind === "partial" && <div style={{ width: 9, height: 2, borderRadius: 999, background: "var(--gold-deep)" }} />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Verse range picker ── */}
      {tab === "segment" && (
        <div style={{ marginBottom: 20 }}>
          {selectedAyahRanges.length > 0 && (
            <div style={{ background: "var(--paper-deep)", borderRadius: 18, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>النطاقات المحددة حاليًا</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                {selectedAyahRanges.map((range) => {
                  const name = SURAHS.find((surah) => surah.id === range.surahId)?.name ?? `${range.surahId}`
                  return (
                    <span
                      key={`range-${range.surahId}-${range.fromAyah}-${range.toAyah}`}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "white",
                        boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.08)",
                        fontSize: 11.5,
                        color: "var(--ink-soft)",
                      }}
                    >
                      {name} {formatNumberAr(range.fromAyah)}–{formatNumberAr(range.toAyah)}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          {/* Surah selector */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid var(--line)", marginBottom: 8, position: "relative" }}>
            <select
              value={segDraft.surahId}
              onChange={e => setSegDraft({ ...segDraft, surahId: Number(e.target.value), fromAyah: 1, toAyah: 5 })}
              style={{
                width: "100%", height: 50, background: "transparent", border: "none",
                fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600,
                color: "var(--ink)", padding: "0 16px 0 40px",
                direction: "rtl", cursor: "pointer",
                WebkitAppearance: "none", appearance: "none", outline: "none",
              }}
            >
              {SURAHS.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({formatNumberAr(s.id)})</option>
              ))}
            </select>
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-muted)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Steppers + add button — single card */}
          <div style={{ background: "var(--paper-deep)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", padding: "16px 0 4px" }}>
              <StepperCol
                label="من آية" value={segDraft.fromAyah}
                max={getSurahMeta(segDraft.surahId)?.ayahCount ?? 286}
                onChange={v => setSegDraft({ ...segDraft, fromAyah: v })}
              />
              <div style={{ background: "rgba(33,29,24,0.08)", margin: "4px 0" }} />
              <StepperCol
                label="إلى آية" value={segDraft.toAyah}
                max={getSurahMeta(segDraft.surahId)?.ayahCount ?? 286}
                onChange={v => setSegDraft({ ...segDraft, toAyah: v })}
              />
            </div>
            <div style={{ padding: "8px 16px 16px" }}>
              <button
                type="button"
                onClick={() => addSegment({
                  surahId: segDraft.surahId,
                  fromAyah: Math.min(segDraft.fromAyah, segDraft.toAyah),
                  toAyah: Math.max(segDraft.fromAyah, segDraft.toAyah),
                })}
                style={{
                  width: "100%", height: 44, borderRadius: 12,
                  background: "white", border: "none",
                  boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.11)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 14, fontWeight: 600, color: "var(--ink)", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 17, lineHeight: 1 }}>+</span>
                أضف هذا النطاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Basket chips ── */}
      {goalsCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-muted)", textAlign: "right", marginBottom: 9 }}>
            سلة الخطة · {formatNumberAr(totalAyahs)} آية
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
            {draft.targetJuz.map(id => (
              <Chip key={`j-${id}`} label={`الجزء ${formatNumberAr(id)}`} onRemove={() => toggleJuz(id)} />
            ))}
            {draft.targetSurahs.map(id => (
              <Chip key={`s-${id}`} label={SURAHS.find(s => s.id === id)?.name ?? `${id}`} onRemove={() => toggleSurah(id)} />
            ))}
            {draft.targetSegments.map(seg => {
              const name = SURAHS.find(s => s.id === seg.surahId)?.name ?? `${seg.surahId}`
              return (
                <Chip
                  key={`seg-${seg.surahId}-${seg.fromAyah}-${seg.toAyah}`}
                  label={`${name} ${formatNumberAr(seg.fromAyah)}–${formatNumberAr(seg.toAyah)}`}
                  onRemove={() => removeSegment(`${seg.surahId}:${seg.fromAyah}-${seg.toAyah}`)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p style={{ fontSize: 12, color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.75, marginBottom: 12, padding: "0 4px" }}>
        لاحقًا تقدر توسّع هذه الخطة أو تخففها من الإعدادات، بدون ما تفقد تاريخ حفظك.
      </p>

      <div style={{ height: 160 }} />

      {/* ── Floating create button ── */}
      <div style={{
        position: "fixed", bottom: 105,
        left: "50%", transform: "translateX(-50%)",
        width: "min(100vw, 430px)",
        padding: "0 20px",
        pointerEvents: "none",
        zIndex: 50,
      }}>
        <button
          type="button"
          onClick={() => canCreate && setStep("target-date")}
          disabled={!canCreate}
          style={{
            width: "100%", height: 50, borderRadius: 18,
            background: canCreate ? "var(--ink)" : "var(--paper-deep)",
            color: canCreate ? "white" : "var(--ink-faint)",
            border: "none", fontSize: 16, fontWeight: 700,
            cursor: canCreate ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: canCreate ? "0 8px 28px rgba(33,29,24,0.28)" : "none",
            pointerEvents: "all",
            transition: "background .2s, color .2s, box-shadow .2s",
          }}
        >
          {canCreate
            ? <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                التالي: هدف الإتمام
              </>
            : "أضف هدفًا لتبدأ"
          }
        </button>
      </div>
    </div>
  )
}

// ── StatCard ─────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: "var(--paper-deep)",
      borderRadius: 16, padding: "12px 8px",
      textAlign: "center",
      boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.07)",
    }}>
      <div style={{
        fontFamily: "var(--serif)", fontSize: 26, fontWeight: 700,
        color: value > 0 ? "var(--gold-deep)" : "var(--ink-faint)", lineHeight: 1,
      }}>
        {formatNumberAr(value)}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ── StepperCol ───────────────────────────────────────────────
function StepperCol({ label, value, max, onChange }: {
  label: string; value: number; max: number; onChange: (v: number) => void
}) {
  const btn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8,
    background: "white", border: "none",
    boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.10)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 8px" }}>
      <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{label}</span>
      <button type="button" style={btn} onClick={() => onChange(Math.min(max, value + 1))}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth={2.5} strokeLinecap="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <span style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--ink)", lineHeight: 1, minWidth: 36, textAlign: "center" }}>
        {formatNumberAr(value)}
      </span>
      <button type="button" style={btn} onClick={() => onChange(Math.max(1, value - 1))}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth={2.5} strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  )
}

// ── Chip ─────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      height: 28, borderRadius: 11, padding: "0 9px",
      background: "var(--paper-deep)",
      boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.09)",
      fontSize: 11.5, fontWeight: 500, color: "var(--ink-soft)",
    }}>
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", padding: 0, fontSize: 13, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

function StepActions({
  backLabel,
  nextLabel,
  onBack,
  onNext,
}: {
  backLabel: string
  nextLabel: string
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18, paddingBottom: 40 }}>
      <button
        type="button"
        onClick={onBack}
        className="btn btn-ghost"
        style={{ height: 48 }}
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="btn btn-gold"
        style={{ height: 48 }}
      >
        {nextLabel}
      </button>
    </div>
  )
}

function SummaryRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid rgba(33,29,24,0.08)" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{label}</div>
      {value ? <div style={{ fontSize: 15, color: "var(--ink)", fontWeight: 600 }}>{value}</div> : children}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────
function LayersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
function RangeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="9" y2="18" />
    </svg>
  )
}
