"use client"

import Link from "next/link"
import { use, useMemo, useState } from "react"
import { SegmentDraftForm, createInitialSegmentDraft } from "@/components/segment-draft-form"
import { Ring, SurahBand, BucketDot } from "@/components/ds"
import { PageHeader } from "@/components/page-header"
import { getSurahMeta } from "@/lib/quran-metadata"
import { useKunehStore } from "@/lib/store"
import { formatNumberAr, reviewRelativeLabel, today } from "@/lib/utils"
import type { Rating, SegmentDraft } from "@/lib/types"

const BUCKET_LABEL: Record<string, string> = {
  overdue:    "فات موعدها",
  due:        "اليوم",
  threatened: "تحتاج تثبيتًا",
  stable:     "راسخة",
}

export default function SurahDetailPage({ params }: { params: Promise<{ surahId: string }> }) {
  const resolved = use(params)
  const surahId = Number(resolved.surahId)
  const surahMeta = getSurahMeta(surahId)
  const { allSegments, submitRating, saveDailyLog, addSegment } = useKunehStore()
  const [showAddSegment, setShowAddSegment] = useState(false)
  const [draft, setDraft] = useState<SegmentDraft>(createInitialSegmentDraft(surahId))
  const [draftError, setDraftError] = useState<string | null>(null)

  if (!surahMeta) {
    return (
      <div className="page">
        <PageHeader title="المصحف" backHref="/mushaf" />
        <p style={{ color: "var(--ink-muted)", fontSize: 14, padding: "20px" }}>السورة غير موجودة.</p>
      </div>
    )
  }

  const segments = allSegments
    .filter(s => s.surahId === surahId)
    .sort((a, b) => a.fromAyah - b.fromAyah)

  const memorizedAyahs = segments.reduce((n, s) => n + (s.toAyah - s.fromAyah + 1), 0)
  const coverageRatio = Math.min(1, memorizedAyahs / surahMeta.ayahCount)
  const coveragePercent = Math.round(coverageRatio * 100)
  const upcomingReviews = [...segments]
    .filter((segment) => Boolean(segment.nextReview))
    .sort((a, b) => (a.nextReview ?? "").localeCompare(b.nextReview ?? ""))
    .slice(0, 3)

  const ringColor = coveragePercent >= 95 ? "var(--verdant)" : "var(--gold)"
  const statusText = coveragePercent >= 95
    ? "أتممت حفظ هذه السورة"
    : coveragePercent > 0
    ? `${formatNumberAr(segments.length)} مقطع محفوظ`
    : "لم تبدأ بعد"

  function quickReview(segmentId: string, rating: Rating) {
    submitRating(segmentId, rating)
    saveDailyLog({
      date: today(),
      reviewedSegmentIds: [segmentId],
      addedSegmentIds: [],
      ratings: { [segmentId]: rating },
      sessionNotes: [],
    })
  }

  function handleAddSegment() {
    const result = addSegment(draft)
    if (!result.ok) {
      setDraftError(result.error)
      return
    }
    saveDailyLog({
      date: today(),
      reviewedSegmentIds: [],
      addedSegmentIds: [result.id],
      ratings: {},
      sessionNotes: [],
    })
    setDraft(createInitialSegmentDraft(surahId))
    setDraftError(null)
    setShowAddSegment(false)
  }

  const logHref = useMemo(() => {
    const p = new URLSearchParams({
      source: "surah",
      action: "log",
      surahId: String(surahId),
      returnTo: `/mushaf/${surahId}`,
    })
    return `/?${p.toString()}`
  }, [surahId])

  return (
    <div className="overlay" style={{ overflowY: "auto" }}>

      <PageHeader title={`سورة ${surahMeta.name.replace(/^ٱل/, "ال")}`} backHref="/mushaf" />

      {/* ── Surah title ──────────────────────────────── */}
      <div style={{ padding: "22px 20px 0" }}>
        <SurahBand name={surahMeta.name} meta={`${surahMeta.ayahCount} آية`} />
      </div>

      {/* ── Progress hero ────────────────────────────── */}
      <div style={{
        padding: "30px 20px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* Ring */}
        <Ring value={coverageRatio} size={132} sw={9} color={ringColor}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--serif)",
              fontSize: 28,
              fontWeight: 600,
              color: "var(--ink)",
              lineHeight: 1,
            }}>
              {formatNumberAr(coveragePercent)}
              <span style={{ fontSize: 13 }}>٪</span>
            </div>
          </div>
        </Ring>

        {/* Count + status */}
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--serif)",
            fontSize: 21,
            fontWeight: 600,
            color: "var(--ink)",
          }}>
            {formatNumberAr(memorizedAyahs)} من {formatNumberAr(surahMeta.ayahCount)} آية
          </div>
          <div style={{
            fontSize: 12.5,
            color: "var(--ink-muted)",
            marginTop: 6,
          }}>
            {statusText}
          </div>
        </div>

        {/* Ornament divider */}
        <div style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: 160,
        }}>
          <div style={{
            flex: 1, height: 1,
            background: "linear-gradient(90deg, transparent, var(--line-gold))",
          }} />
          <div style={{
            width: 5, height: 5,
            transform: "rotate(45deg)",
            background: "var(--gold)",
            opacity: 0.65,
            flexShrink: 0,
          }} />
          <div style={{
            flex: 1, height: 1,
            background: "linear-gradient(270deg, transparent, var(--line-gold))",
          }} />
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 0",
          }}
        >
          <div style={{ flex: 1, textAlign: "center", padding: "0 22px" }}>
            <div style={{
              fontFamily: "var(--serif)",
              fontSize: 28,
              fontWeight: 600,
              color: "var(--ink)",
              lineHeight: 1,
            }}>
              {formatNumberAr(surahMeta.ayahCount)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 6 }}>
              عدد الآيات
            </div>
          </div>
          <div style={{ width: 1, height: 38, background: "var(--line-2)", flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: "center", padding: "0 22px" }}>
            <div style={{
              fontFamily: "var(--serif)",
              fontSize: 28,
              fontWeight: 600,
              color: "var(--ink)",
              lineHeight: 1,
            }}>
              {formatNumberAr(segments.length)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 6 }}>
              المقاطع المحفوظة
            </div>
          </div>
        </div>
      </div>

      {/* ── Upcoming reviews ─────────────────────────── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>المراجعات القادمة</div>
        {upcomingReviews.length > 0 ? (
          <div className="card" style={{ padding: "4px 18px" }}>
            {upcomingReviews.map((segment, index) => (
              <div key={segment.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 2px" }}>
                  <BucketDot bucket={(segment.bucket ?? "stable") as "overdue" | "due" | "threatened" | "stable"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                      الآيات {formatNumberAr(segment.fromAyah)}–{formatNumberAr(segment.toAyah)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}>
                      {reviewRelativeLabel(segment.nextReview)}
                    </div>
                  </div>
                </div>
                {index < upcomingReviews.length - 1 && <div className="hr" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="well" style={{
            padding: "18px 20px",
            textAlign: "center",
            color: "var(--ink-muted)",
            fontSize: 13.5,
            borderRadius: 18,
          }}>
            لا توجد مراجعات قادمة الآن
          </div>
        )}
      </div>

      {/* ── Memorized segments ───────────────────────── */}
      <div style={{ padding: "22px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>المقاطع المحفوظة</div>
        {segments.length > 0 ? (
          <div className="card" style={{ padding: "4px 18px" }}>
            {segments.map((seg, i) => (
              <div key={seg.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 2px" }}>
                  <BucketDot bucket={(seg.bucket ?? "stable") as "overdue" | "due" | "threatened" | "stable"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                      الآيات {formatNumberAr(seg.fromAyah)}–{formatNumberAr(seg.toAyah)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}>
                      {BUCKET_LABEL[seg.bucket ?? "stable"] ?? ""} · {reviewRelativeLabel(seg.nextReview)}
                      {seg.notes ? " · ✎" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => quickReview(seg.id, "good")}
                    style={{
                      width: 38, height: 38, borderRadius: 11,
                      background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "none", cursor: "pointer", flexShrink: 0,
                    }}
                    title="مراجعة سريعة"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"/>
                    </svg>
                  </button>
                </div>
                {seg.notes && (
                  <div style={{
                    fontSize: 12.5,
                    color: "var(--ink-soft)",
                    padding: "0 0 12px 22px",
                    fontStyle: "italic",
                  }}>
                    {seg.notes}
                  </div>
                )}
                {i < segments.length - 1 && <div className="hr" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="well" style={{
            padding: "22px",
            textAlign: "center",
            color: "var(--ink-muted)",
            fontSize: 13.5,
            borderRadius: 18,
          }}>
            لا مقاطع محفوظة في هذه السورة بعد
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────── */}
      <div style={{ padding: "26px 20px 50px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 14 }}
            onClick={() => {
              setShowAddSegment(true)
              setDraft(createInitialSegmentDraft(surahId))
              setDraftError(null)
            }}
          >
            أضِف مقطعًا
          </button>
          <Link
            href={logHref}
            className="btn btn-gold"
            style={{ fontSize: 14 }}
          >
            سجّل حفظًا
          </Link>
        </div>
        {segments.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Link
              href="/review"
              className="btn btn-quiet btn-block"
              style={{ fontSize: 14 }}
            >
              راجِع الآن
            </Link>
          </div>
        )}
      </div>

      {/* ── Add segment sheet ────────────────────────── */}
      {showAddSegment && (
        <div
          className="fixed inset-0 z-40 flex items-end"
          onClick={() => {
            setShowAddSegment(false)
            setDraft(createInitialSegmentDraft(surahId))
            setDraftError(null)
          }}
        >
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
          <div
            className="sheet-frame relative z-50 w-full p-5"
            onClick={(event) => event.stopPropagation()}
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-2)]" />
            <p className="mb-1 text-lg font-bold text-[var(--ink)]">أضف مقطعًا</p>
            <p className="mb-4 text-sm text-[var(--ink-muted)]">
              ستبقى السورة مقفلة على سورة {surahMeta.name}، وعدّل فقط الآيات بحسب ما حفظته فعلًا.
            </p>
            <SegmentDraftForm
              draft={draft}
              error={draftError}
              submitLabel="حفظ المقطع"
              surahOptions={[{ id: surahMeta.id, name: surahMeta.name }]}
              lockSurah
              onChange={(nextDraft) => {
                setDraft(nextDraft)
                setDraftError(null)
              }}
              onSubmit={handleAddSegment}
              onCancel={() => {
                setShowAddSegment(false)
                setDraft(createInitialSegmentDraft(surahId))
                setDraftError(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
