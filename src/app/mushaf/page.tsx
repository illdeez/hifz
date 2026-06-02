"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { SurahAvatar, Bar } from "@/components/ds"
import { PageHeader } from "@/components/page-header"
import { useKunehStore } from "@/lib/store"
import { formatNumberAr } from "@/lib/utils"
import type { SurahSummary } from "@/lib/types"

export default function MushafPage() {
  const { surahSummaries, store, isSurahInsidePlan, getSurahPlanReason, addSurahToActivePlan } = useKunehStore()
  const [viewMode, setViewMode] = useState<"plan" | "full">(store.activePlan ? "plan" : "full")

  useEffect(() => {
    if (store.activePlan) setViewMode("plan")
  }, [store.activePlan])

  const planSurahs = useMemo(
    () => store.activePlan ? surahSummaries.filter(s => isSurahInsidePlan(s.surah.id)) : surahSummaries,
    [store.activePlan, surahSummaries, isSurahInsidePlan]
  )
  const visibleSurahs = viewMode === "plan" && store.activePlan ? planSurahs : surahSummaries

  return (
    <div className="page">
      <PageHeader title="المصحف" showBack={false} />

      {/* Segmented toggle */}
      {store.activePlan && (
        <div style={{ padding: "16px 20px 16px" }}>
          <div style={{ display: "flex", gap: 6, background: "var(--paper-deep)", borderRadius: 15, padding: 5 }}>
            {([["plan", "الخطة"], ["full", "كامل المصحف"]] as const).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                style={{
                  flex: 1, height: 42, borderRadius: 11, fontSize: 14, fontWeight: 600,
                  background: viewMode === id ? "var(--surface-2)" : "transparent",
                  color: viewMode === id ? "var(--ink)" : "var(--ink-muted)",
                  boxShadow: viewMode === id ? "var(--sh-1)" : "none",
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  transition: ".2s",
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "plan" && store.activePlan && planSurahs.length === 0 && (
        <div style={{ padding: "0 20px" }}>
          <div className="card" style={{ padding: "28px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.7 }}>
              أضف جزءًا أو سورة أو مقطعًا إلى الخطة، وسيبدأ المصحف بعرض ما يخصك فقط.
            </div>
          </div>
        </div>
      )}

      {/* Surah list */}
      <div style={{ padding: "0 20px" }}>
        <div className="card" style={{ padding: "4px 18px" }}>
          {visibleSurahs.map((summary, i) => {
            const inPlan = store.activePlan ? isSurahInsidePlan(summary.surah.id) : false
            const isLast = i === visibleSurahs.length - 1
            return (
              <SurahRow
                key={summary.surah.id}
                summary={summary}
                inPlan={inPlan}
                onAddToPlan={store.activePlan && !inPlan && viewMode === "full"
                  ? () => addSurahToActivePlan(summary.surah.id)
                  : undefined}
                last={isLast}
              />
            )
          })}
        </div>
        {viewMode === "plan" && store.activePlan && (
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
            خطّتك تضمّ {formatNumberAr(planSurahs.length)} سورًا
          </div>
        )}
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}

function SurahRow({
  summary, inPlan, onAddToPlan, last,
}: {
  summary: SurahSummary
  inPlan: boolean
  onAddToPlan?: () => void
  last: boolean
}) {
  const hasMemorized = summary.memorizedSegments > 0
  const tone = summary.progressPercent >= 95 ? "verdant" : summary.progressPercent > 0 ? "gold" : "ink"
  const barColor = tone === "verdant" ? "var(--verdant)" : "var(--gold)"

  return (
    <div>
      <Link
        href={`/mushaf/${summary.surah.id}`}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 2px", textDecoration: "none" }}
      >
        <SurahAvatar name={summary.surah.name} tone={tone} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
              {summary.surah.name.replace(/^ٱل/, "ال")}
            </span>
            {inPlan && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--gold-deep)", background: "var(--gold-soft)", padding: "2px 7px", borderRadius: 6 }}>
                في الخطة
              </span>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar value={summary.progressPercent / 100} h={4} color={barColor} />
          </div>
        </div>

        <div style={{ textAlign: "end", minWidth: 52, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {formatNumberAr(summary.progressPercent)}
            <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>٪</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-muted)", marginTop: 2 }}>
            {formatNumberAr(summary.surah.ayahCount)} آية
          </div>
        </div>

        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: "scaleX(-1)" }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
      {!last && <div className="hr" />}
    </div>
  )
}
