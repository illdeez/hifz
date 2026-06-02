"use client"

import { useMemo, useState } from "react"
import { Ring, SurahAvatar, Strength } from "@/components/ds"
import { PageHeader } from "@/components/page-header"
import { createReviewSessionFromSegments, withReviewResult, type TodaySessionState } from "@/lib/session-state"
import { useKunehStore } from "@/lib/store"
import { describeSegment } from "@/lib/review-engine"
import { formatNumberAr, reviewRelativeLabel, today } from "@/lib/utils"
import type { EnrichedSegment, Rating } from "@/lib/types"

const DARK_RATING_OPTIONS: Array<{ value: Rating; label: string; tone: string }> = [
  { value: "struggled", label: "تعثّرت", tone: "#C08552" },
  { value: "good",      label: "جيّد",   tone: "#C7A86A" },
  { value: "excellent", label: "ممتاز",  tone: "#7FA98C" },
]

const BUCKET_META = {
  overdue:    { label: "فات موعدها", color: "var(--due)",      soft: "var(--due-soft)" },
  due:        { label: "اليوم",       color: "var(--gold-deep)", soft: "var(--gold-soft)" },
  threatened: { label: "تحتاج تثبيتًا", color: "var(--gold-deep)", soft: "var(--gold-soft)" },
  stable:     { label: "راسخة",       color: "var(--verdant)",  soft: "var(--verdant-soft)" },
}

type Bucket = keyof typeof BUCKET_META

function bucketOf(seg: EnrichedSegment): Bucket {
  if (seg.bucket === "overdue") return "overdue"
  if (seg.bucket === "due") return "due"
  if (seg.bucket === "threatened") return "threatened"
  return "stable"
}

function strengthTone(b: Bucket): "due" | "gold" | "verdant" {
  if (b === "overdue") return "due"
  if (b === "stable") return "verdant"
  return "gold"
}

export default function ReviewPage() {
  const { store, todayBuckets, submitRating, saveDailyLog } = useKunehStore()
  const [runner, setRunner] = useState<EnrichedSegment[] | null>(null)

  const due = useMemo(
    () => [...todayBuckets.overdue, ...todayBuckets.due, ...todayBuckets.threatened],
    [todayBuckets]
  )
  const allSegs = useMemo(
    () => Object.values(store.segments),
    [store.segments]
  )
  const healthyCount = allSegs.filter(s => bucketOf(s as unknown as EnrichedSegment) === "stable").length
  const healthRatio = allSegs.length ? healthyCount / allSegs.length : 1

  function startRunner(segs: EnrichedSegment[]) { setRunner(segs) }

  function handleRating(segmentId: string, rating: Rating) {
    submitRating(segmentId, rating)
  }

  function finishRunner(session: TodaySessionState) {
    saveDailyLog({
      date: today(),
      reviewedSegmentIds: session.doneReviewed,
      addedSegmentIds: [],
      ratings: session.ratings,
      sessionNotes: [],
    })
    setRunner(null)
  }

  if (runner) {
    return <ReviewRunner segs={runner} onClose={() => setRunner(null)} onFinish={finishRunner}
      onRate={handleRating} />
  }

  if (!store.activePlan) {
    return (
      <div className="page">
        <PageHeader title="المراجعة" showBack={false} />
        <div className="card" style={{ margin: "16px 20px 16px", padding: "28px 22px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            لا توجد خطة نشطة بعد
          </div>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 }}>
            ابدأ بخطة أولًا، وبعدها سيقودك التطبيق إلى ما يحتاج تثبيتًا.
          </p>
        </div>
      </div>
    )
  }

  const GROUPS = [
    { key: "overdue" as Bucket,    items: todayBuckets.overdue,    note: "الأَولى بالعناية" },
    { key: "due" as Bucket,        items: todayBuckets.due,        note: "حان وقتها" },
    { key: "threatened" as Bucket, items: todayBuckets.threatened, note: "بدأت تضعف" },
  ]

  return (
    <div className="page">
      <PageHeader title="المراجعة" showBack={false} />

      {/* Summary ring card */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Ring
              value={due.length ? Math.min(1, due.length / Math.max(1, allSegs.length)) : 0}
              size={72} sw={6}
              color={due.length ? "var(--due)" : "var(--verdant)"}
            >
              <span style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>
                {formatNumberAr(due.length)}
              </span>
            </Ring>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
                {due.length
                  ? <>{formatNumberAr(due.length)} مقاطع تنتظر مراجعتك</>
                  : "لا مراجعات مستحقّة"}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 4, lineHeight: 1.6 }}>
                {due.length
                  ? "مقطعًا مقطعًا، لتثبيت ما حفظت."
                  : "حفظك مستقرّ بإذن الله. لا عَجلة."}
              </div>
            </div>
          </div>

          {due.length > 0 && (
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 18 }}
              onClick={() => startRunner(due)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"/>
              </svg>
              راجِع {formatNumberAr(Math.min(due.length, store.settings.dailyReviewGoal))} مقاطع الآن
            </button>
          )}
        </div>
      </div>

      {/* Health bar */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "var(--ink-muted)", fontWeight: 500 }}>صحّة الحفظ</span>
          <span style={{ fontSize: 13, color: "var(--verdant)", fontWeight: 600 }}>
            {formatNumberAr(Math.round(healthRatio * 100))}٪ راسخ
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 5, background: "var(--paper-deep)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${healthRatio * 100}%`, background: "var(--verdant)", borderRadius: 5, transition: "width 1s cubic-bezier(.2,.7,.3,1)" }} />
        </div>
      </div>

      {/* Bucket groups */}
      {GROUPS.map(g => g.items.length > 0 && (
        <div key={g.key} style={{ padding: "18px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
            <span className="eyebrow" style={{ color: BUCKET_META[g.key].color }}>{BUCKET_META[g.key].label}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
              {g.note} · {formatNumberAr(g.items.length)}
            </span>
          </div>
          <div className="card" style={{ padding: "4px 18px" }}>
            {g.items.map((seg, i) => {
              const b = bucketOf(seg)
              return (
                <div key={seg.id}>
                  <button
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 2px", width: "100%", textAlign: "inherit", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    onClick={() => startRunner([seg])}
                  >
                    <SurahAvatar name={seg.surahName} tone={b === "overdue" ? "due" : b === "stable" ? "verdant" : "gold"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                        {"سورة " + seg.surahName.replace(/^ٱل/, "ال")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        {describeSegment(seg)} · {reviewRelativeLabel(seg.nextReview)}
                      </div>
                    </div>
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <Strength value={Math.min(1, (seg.effectiveStability ?? 0) / 100)} tone={strengthTone(b)} />
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 5 }}>
                        {reviewRelativeLabel(seg.nextReview)}
                      </div>
                    </div>
                  </button>
                  {i < g.items.length - 1 && <div className="hr" />}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {allSegs.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-muted)" }}>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>لم تسجّل حفظًا بعد. ابدأ من الرئيسية.</div>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}

// ── ReviewRunner — dark overlay review flow ──────────────────
function ReviewRunner({
  segs, onClose, onFinish, onRate,
}: {
  segs: EnrichedSegment[]
  onClose: () => void
  onFinish: (session: TodaySessionState) => void
  onRate: (id: string, rating: Rating) => void
}) {
  const [session, setSession] = useState(() => createReviewSessionFromSegments(segs))
  const [done, setDone] = useState(false)
  const current = session.reviewQueue[session.reviewIndex]

  function rate(segId: string, rating: Rating) {
    onRate(segId, rating)
    const next = withReviewResult(session, segId, rating)
    if (!next.reviewQueue[next.reviewIndex]) {
      onFinish(next)
      setDone(true)
    } else {
      setSession(next)
    }
  }

  return (
    <div className="overlay dark">
      {done ? (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 36px" }}>
          <div className="rise" style={{ marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--verdant-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--verdant)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)", marginBottom: 10 }}>اكتملت المراجعة</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 600, color: "#F1EAD9", lineHeight: 1.4 }}>
            ثبّتّ ما حفظت
          </div>
          <button className="btn btn-gold btn-lg btn-block" style={{ marginTop: 36 }} onClick={onClose}>
            عودة إلى المراجعة
          </button>
        </div>
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "56px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(237,230,214,.08)", boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", color: "#EDE6D6", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div style={{ textAlign: "center" }}>
              <div className="eyebrow" style={{ color: "rgba(190,154,94,.95)" }}>مراجعة</div>
              <div style={{ fontSize: 11.5, color: "rgba(237,230,214,.5)", marginTop: 3 }}>
                {formatNumberAr(session.reviewIndex + 1)} من {formatNumberAr(segs.length)}
              </div>
            </div>
            <div style={{ width: 44 }} />
          </div>
          {/* Progress track */}
          <div style={{ display: "flex", gap: 6, padding: "18px 24px 0", flexShrink: 0 }}>
            {Array.from({ length: segs.length }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i < session.reviewIndex ? "var(--gold)" : i === session.reviewIndex ? "rgba(237,230,214,.4)" : "rgba(237,230,214,.14)" }} />
            ))}
          </div>
          {/* Content */}
          {current && (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 40px" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "rgba(237,230,214,.9)", margin: 0 }}>
                  {describeSegment(current)}
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "rgba(237,230,214,.45)", background: "rgba(237,230,214,.07)", padding: "4px 12px", borderRadius: 9999 }}>
                    {reviewRelativeLabel(current.nextReview)}
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(237,230,214,.45)", background: "rgba(237,230,214,.07)", padding: "4px 12px", borderRadius: 9999 }}>
                    ثبات {formatNumberAr(Math.round(current.effectiveStability ?? 0))}٪
                  </span>
                </div>
              </div>
              <div style={{ minHeight: 110, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22, background: "rgba(237,230,214,.05)", boxShadow: "inset 0 0 0 1px rgba(237,230,214,.1)", padding: "24px 20px", marginBottom: 28, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "rgba(237,230,214,.4)", lineHeight: 1.8, margin: 0 }}>
                  استرجع الآيات من حفظك في ذهنك،<br />ثم قيّم مدى ثباتها
                </p>
              </div>
              <div style={{ textAlign: "center", fontSize: 13, color: "rgba(237,230,214,.5)", marginBottom: 14 }}>كيف كان استرجاعك؟</div>
              <div style={{ display: "flex", gap: 10 }}>
                {DARK_RATING_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => rate(current.id, opt.value)} style={{ flex: 1, height: 64, borderRadius: 16, background: "rgba(237,230,214,.06)", color: "#F1EAD9", border: "none", boxShadow: `inset 0 0 0 1px ${opt.tone}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.tone, display: "block" }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
