"use client"

import React from "react"
import { useKunehStore } from "@/lib/store"
import { formatNumberAr } from "@/lib/utils"
import type { DailyLog, HifzSegment, Rating } from "@/lib/types"

const RATING_LABEL: Record<Rating, string> = {
  excellent: "ممتاز",
  good:      "جيد",
  struggled: "تعثرت",
}

function relDay(dateStr: string): string {
  const today = new Date()
  const d = new Date(dateStr)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff <= 0) return "اليوم"
  if (diff === 1) return "أمس"
  if (diff < 7) return `منذ ${formatNumberAr(diff)} أيام`
  if (diff < 30) return `منذ ${formatNumberAr(Math.round(diff / 7))} أسابيع`
  return `منذ ${formatNumberAr(Math.round(diff / 30))} أشهر`
}

function fmtShort(dateStr: string): string {
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
  const d = new Date(dateStr)
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export function JourneyView({ header }: { header?: React.ReactNode }) {
  const { store } = useKunehStore()
  const logs = [...store.logs].sort((a, b) => b.date.localeCompare(a.date))
  const totalAyat = Object.values(store.segments).reduce((n, s) => n + (s.toAyah - s.fromAyah + 1), 0)

  if (logs.length === 0) {
    return (
      <div className="page">
        {header}
        <div className="card" style={{ margin: "16px 20px 0", padding: "36px 28px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            لم تبدأ رحلتك بعد
          </div>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 }}>
            عندما تبدأ أول جلسة، ستبدأ الرحلة في تسجيل الأيام والمقاطع والملاحظات هنا.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {header}
      <div style={{ padding: "0 20px" }}>
      {/* Reflective header */}
      <div style={{ textAlign: "center", padding: "14px 0 28px" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)", lineHeight: 1.65 }}>
          لحفظك قصّةٌ تُكتب،<br />يومًا بعد يوم
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--gold-deep)" }}>
              {formatNumberAr(logs.length)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>جلسة</div>
          </div>
          <div style={{ width: 1, background: "var(--line)" }} />
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 600, color: "var(--gold-deep)" }}>
              {formatNumberAr(totalAyat)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>آية محفوظة</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ position: "relative", paddingInlineStart: 6 }}>
        {logs.map((log, i) => {
          const added = log.addedSegmentIds?.length ?? 0
          const reviewed = log.reviewedSegmentIds?.length ?? 0
          const isToday = log.date.slice(0, 10) === new Date().toISOString().slice(0, 10)
          return (
            <div key={log.date} style={{ display: "flex", gap: 16, paddingBottom: i === logs.length - 1 ? 0 : 8 }}>
              {/* Rail */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4, flexShrink: 0 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                  background: isToday ? "var(--gold)" : "var(--surface)",
                  boxShadow: isToday
                    ? "0 0 0 3px rgba(176,138,79,.2)"
                    : "inset 0 0 0 2px var(--line-2)",
                }} />
                {i < logs.length - 1 && (
                  <span style={{ flex: 1, width: 2, background: "var(--line)", marginTop: 4, minHeight: 28 }} />
                )}
              </div>

              {/* Card */}
              <div className="card" style={{ flex: 1, padding: "14px 18px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{relDay(log.date)}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{fmtShort(log.date)}</span>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  {added > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--gold-deep)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      +{formatNumberAr(added)} مقطع
                    </span>
                  )}
                  {reviewed > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--verdant)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"/>
                      </svg>
                      {formatNumberAr(reviewed)} مراجعة
                    </span>
                  )}
                  {added === 0 && reviewed === 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>
                      جلسة هادئة
                    </span>
                  )}
                </div>

                {/* Ratings */}
                {log.reviewedSegmentIds?.length > 0 && Object.keys(log.ratings ?? {}).length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(log.ratings).slice(0, 3).map(([segId, rating]) => {
                      const seg = store.segments[segId]
                      return (
                        <span key={segId} style={{
                          fontSize: 11.5, padding: "3px 10px", borderRadius: 9999,
                          background: rating === "excellent" ? "var(--verdant-soft)" : rating === "good" ? "var(--gold-soft)" : "var(--due-soft)",
                          color: rating === "excellent" ? "var(--verdant)" : rating === "good" ? "var(--gold-deep)" : "var(--due)",
                          fontWeight: 600,
                        }}>
                          {seg ? `سورة ${seg.surahName.replace(/^ٱل/, "ال")} · ` : ""}{RATING_LABEL[rating as Rating]}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Session note — gold border inline */}
                {(log.sessionNotes?.length ?? 0) > 0 && (
                  <div style={{
                    marginTop: 12, fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink-soft)",
                    lineHeight: 1.7, borderInlineStart: "2px solid rgba(176,138,79,.4)", paddingInlineStart: 12,
                  }}>
                    {log.sessionNotes[0]}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ height: 40 }} />
      </div>{/* /padding wrapper */}
    </div>
  )
}
