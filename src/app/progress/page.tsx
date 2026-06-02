"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Ring, MushafMap, DayGrid, MapLegend } from "@/components/ds"
import { PageHeader } from "@/components/page-header"
import { useKunehStore } from "@/lib/store"
import { formatNumberAr, formatDateAr } from "@/lib/utils"
import { buildPacePlanSummary } from "@/lib/pace-planner"
import { JUZ_RANGES } from "@/lib/juz-ranges"
import type { HifzSegment } from "@/lib/types"

// Compute 30-juz status from segments
function computeJuzStatus(segments: HifzSegment[]): Array<"done" | "progress" | "none"> {
  return JUZ_RANGES.map(juz => {
    let total = 0, covered = 0
    for (const r of juz.ranges) {
      const span = r.toAyah - r.fromAyah + 1
      total += span
      for (const seg of segments) {
        if (seg.surahId !== r.surahId) continue
        const overlapStart = Math.max(seg.fromAyah, r.fromAyah)
        const overlapEnd = Math.min(seg.toAyah, r.toAyah)
        if (overlapEnd >= overlapStart) covered += overlapEnd - overlapStart + 1
      }
    }
    if (covered === 0) return "none"
    return covered / total >= 0.8 ? "done" : "progress"
  })
}

export default function ProgressPage() {
  const { progressMetrics, planProgress, store, allSegments } = useKunehStore()
  const rawSegments = allSegments as unknown as HifzSegment[]

  const paceSummary = buildPacePlanSummary({
    activePlan: store.activePlan,
    segments: Object.values(store.segments),
    targetDate: store.settings.targetDate,
    dailyPace: 0.5,
  })

  const juzStatus = useMemo(() => computeJuzStatus(rawSegments), [rawSegments])
  const juzDone = juzStatus.filter(s => s === "done").length

  // Consistency day grid for current month
  const now = new Date()
  const yr = now.getFullYear(), mo = now.getMonth()
  const activeDates = useMemo(() => {
    const set = new Set<string>()
    store.logs.forEach(l => {
      const d = l.date.slice(0, 10)
      if ((l.reviewedSegmentIds?.length ?? 0) + (l.addedSegmentIds?.length ?? 0) > 0) set.add(d)
    })
    return set
  }, [store.logs])
  const activeCount = activeDates.size

  const onTrack = paceSummary.onTrack

  if (!store.activePlan) {
    return (
      <div className="page">
        <PageHeader title="التقدّم" showBack={false} />
        <div style={{ padding: "16px 20px 0" }}>
          <div className="card" style={{ padding: "28px 22px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              لا توجد خطة نشطة بعد
            </div>
            <Link href="/onboarding" style={{ display: "inline-block", marginTop: 8, padding: "10px 20px", borderRadius: 14, background: "var(--verdant)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              ابدأ الخطة
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="التقدّم" showBack={false} />

      {/* ── Dual rings: plan + Quran-wide ── */}
      <div style={{ padding: "16px 20px 0" }}>
        <div className="card" style={{ padding: "24px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          <RingStat value={planProgress.planCompletionPercent / 100} label="الخطة" color="var(--gold)" />
          <div style={{ width: 1, height: 90, background: "var(--line)" }} />
          <RingStat value={progressMetrics.fullQuranCompletionPercent / 100} label="من القرآن" color="var(--verdant)"
            sub={`${formatNumberAr(progressMetrics.memorizedSegments)} مقطع`} />
        </div>
      </div>

      {/* ── Mushaf map ── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 14, padding: "0 2px" }}>
          خريطة المصحف · ثلاثون جزءًا
        </div>
        <div className="card" style={{ padding: "26px 22px" }}>
          <MushafMap juzStatus={juzStatus} size={30} gap={9} />
          <div style={{ display: "flex", gap: 18, marginTop: 22, justifyContent: "center", flexWrap: "wrap" }}>
            <MapLegend color="var(--verdant)" label="محفوظ" />
            <MapLegend color="var(--gold)" label="قيد الحفظ" opacity={0.6} />
            <MapLegend color="var(--paper-deep)" label="لم يبدأ" />
          </div>
          {juzDone > 0 && (
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--ink-muted)" }}>
              أتممت {formatNumberAr(juzDone)} {juzDone === 1 ? "جزءًا" : "أجزاء"} من القرآن
            </div>
          )}
        </div>
      </div>

      {/* ── Pace planner ── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 12, padding: "0 2px" }}>الوتيرة · حتى هدفك</div>
        <div className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: onTrack ? "var(--verdant-soft)" : "var(--gold-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={onTrack ? "var(--verdant)" : "var(--gold-deep)"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                {onTrack
                  ? <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>
                  : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                {onTrack ? "وتيرتك تكفي لهدفك" : "تحتاج وتيرة أعلى قليلًا"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 3 }}>
                الهدف: {formatDateAr(store.settings.targetDate)}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <PaceCell
              label="المتبقّي"
              value={`${formatNumberAr(paceSummary.remainingAmount)} ${paceSummary.goalUnit === "ayahs" ? "آية" : "صفحة"}`}
            />
            <PaceCell
              label="المطلوب يوميًا"
              value={paceSummary.remainingAmount === 0 ? "مكتمل" : `${paceLabel(paceSummary.requiredDailyAmount, paceSummary.goalUnit)}`}
              highlight={!onTrack}
            />
            <PaceCell label="ينتهي" value={paceSummary.remainingAmount === 0 ? "—" : formatDateAr(paceSummary.finishDate)} />
          </div>
        </div>
      </div>

      {/* ── Consistency grid ── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, padding: "0 2px" }}>
          <span className="eyebrow">جلوسك مع القرآن · هذا الشهر</span>
          <span style={{ fontSize: 12.5, color: "var(--verdant)", fontWeight: 600 }}>
            {formatNumberAr(activeCount)} يومًا
          </span>
        </div>
        <div className="card" style={{ padding: "20px 22px" }}>
          <DayGrid year={yr} month={mo} activeDates={activeDates} />
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
            الاستمرار أحبّ إلى الله من الكثرة المنقطعة.
          </div>
        </div>
      </div>

      {/* ── Journey link ── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>الرحلة</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                لحفظك قصّةٌ تُكتب
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 4 }}>
                {formatNumberAr(store.logs.length)} جلسة محفوظة
              </div>
            </div>
            <Link href="/progress/journey" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px", borderRadius: 12,
              background: "var(--gold)", color: "#fff",
              fontSize: 14, fontWeight: 600, textDecoration: "none", flexShrink: 0,
            }}>
              افتح الرحلة
            </Link>
          </div>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}

function RingStat({ value, label, color, sub }: { value: number; label: string; color: string; sub?: string }) {
  return (
    <Ring value={value} size={104} sw={8} color={color}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>
          {formatNumberAr(Math.round(value * 100))}<span style={{ fontSize: 13 }}>٪</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink-muted)", marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 9.5, color: "var(--ink-faint)", marginTop: 1 }}>{sub}</div>}
      </div>
    </Ring>
  )
}

function PaceCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="well" style={{ flex: 1, padding: "14px 10px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: highlight ? "var(--gold-deep)" : "var(--ink)", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function paceLabel(pace: number, unit: "pages" | "ayahs"): string {
  if (pace <= 0) return "مكتمل"
  if (unit === "ayahs") return `${formatNumberAr(Math.ceil(pace))} آيات`
  if (pace <= 0.37) return "ربع صفحة"
  if (pace <= 0.75) return "نصف صفحة"
  if (pace <= 1.25) return "صفحة"
  return `${formatNumberAr(Number(pace.toFixed(1)))} صفحات`
}
