"use client"

import { useMemo, useState } from "react"
import { SegmentDraftForm, createInitialSegmentDraft } from "@/components/segment-draft-form"
import { JUZ, SURAHS } from "@/lib/quran-metadata"
import {
  buildSelectedAyahRanges,
  formatSurahCoverageLabel,
  getSelectedAyahCount,
  getSelectedSurahCount,
  getSurahSelectionState,
} from "@/lib/plan-selection"
import { formatNumberAr } from "@/lib/utils"
import type { PlanTargetSegment, SegmentDraft } from "@/lib/types"

export type PlanBasketDraft = {
  name: string
  targetJuz: number[]
  targetSurahs: number[]
  targetSegments: PlanTargetSegment[]
}

export function PlanBasketEditor({
  draft,
  title,
  description,
  mode = "edit",
  showNameField = true,
  submitLabel,
  submitDisabled = false,
  submitHint,
  showFullQuranShortcut = false,
  onNameChange,
  onToggleJuz,
  onToggleSurah,
  onAddSegmentTarget,
  onRemoveSegmentTarget,
  onSubmit,
  onSelectFullQuran,
}: {
  draft: PlanBasketDraft
  title: string
  description: string
  mode?: "create" | "edit"
  showNameField?: boolean
  submitLabel?: string
  submitDisabled?: boolean
  submitHint?: string
  showFullQuranShortcut?: boolean
  onNameChange: (value: string) => void
  onToggleJuz: (juzId: number) => void
  onToggleSurah: (surahId: number) => void
  onAddSegmentTarget: (target: PlanTargetSegment) => void
  onRemoveSegmentTarget: (segmentKey: string) => void
  onSubmit?: () => void
  onSelectFullQuran?: () => void
}) {
  const [goalType, setGoalType] = useState<"juz" | "surah" | "segment">("juz")
  const [surahQuery, setSurahQuery] = useState("")
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>(createInitialSegmentDraft())

  const filteredSurahs = useMemo(
    () => SURAHS.filter((s) => s.name.includes(surahQuery.trim())),
    [surahQuery]
  )
  const selectedAyahRanges = useMemo(() => buildSelectedAyahRanges(draft), [draft])
  const totalAyahs = useMemo(() => getSelectedAyahCount(selectedAyahRanges), [selectedAyahRanges])
  const selectedSurahCount = useMemo(() => getSelectedSurahCount(selectedAyahRanges), [selectedAyahRanges])
  const selectedSurahNames = draft.targetSurahs
    .map((id) => SURAHS.find((s) => s.id === id)?.name)
    .filter((n): n is string => Boolean(n))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header: section label + title + description ──── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>محتوى الخطة</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2, marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 }}>{description}</div>
        </div>
        {showFullQuranShortcut && onSelectFullQuran && (
          <button
            type="button"
            onClick={onSelectFullQuran}
            className="chip"
            style={{ cursor: "pointer", flexShrink: 0 }}
          >
            القرآن كامل
          </button>
        )}
      </div>

      {/* ── Stat cards ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatCard label="الأجزاء"  value={draft.targetJuz.length} />
        <StatCard label="السور"    value={selectedSurahCount} />
        <StatCard label="المقاطع" value={draft.targetSegments.length} />
      </div>

      {/* ── Plan name field ───────────────────────────────── */}
      {showNameField && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>اسم الخطة</div>
          <input
            value={draft.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="خطة المرحلة الحالية"
            style={{
              width: "100%", height: 54, borderRadius: 16,
              border: "1px solid var(--line-2)",
              background: "var(--surface)",
              fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600,
              color: "var(--ink)", padding: "0 18px",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* ── Content type tabs ────────────────────────────── */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>محتوى الخطة</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
          {([
            { key: "juz"     as const, label: "جزء",       icon: <LayersIcon /> },
            { key: "surah"   as const, label: "سورة",      icon: <BookIcon /> },
            { key: "segment" as const, label: "نطاق آيات", icon: <RangeIcon /> },
          ]).map(({ key, label, icon }) => {
            const active = goalType === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setGoalType(key)}
                style={{
                  height: 42, borderRadius: 14,
                  border: "none",
                  background: active ? "var(--ink)" : "var(--surface)",
                  color: active ? "#F4EEE2" : "var(--ink-soft)",
                  boxShadow: active ? "none" : "inset 0 0 0 1px var(--line-2)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "background .15s, color .15s",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ opacity: active ? 0.75 : 0.45 }}>{icon}</span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Juz grid ─────────────────────────────────────── */}
      {goalType === "juz" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
          {JUZ.map((juz) => {
            const sel = draft.targetJuz.includes(juz.id)
            return (
              <button
                key={juz.id}
                type="button"
                onClick={() => onToggleJuz(juz.id)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 14,
                  border: "none",
                  background: sel
                    ? "linear-gradient(177deg,#BE9A5E,#A9824A)"
                    : "var(--surface)",
                  color: sel ? "#231d12" : "var(--ink-soft)",
                  boxShadow: sel
                    ? "0 4px 10px -4px rgba(142,108,57,.5)"
                    : "inset 0 0 0 1px var(--line-2)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  transition: "background .12s, box-shadow .12s",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, lineHeight: 1 }}>
                  {formatNumberAr(juz.id)}
                </span>
                <span style={{ fontSize: 9.5, marginTop: 3, opacity: sel ? 0.65 : 0.4 }}>جزء</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Surah list ────────────────────────────────────── */}
      {goalType === "surah" && (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ padding: "12px 14px 8px" }}>
            <input
              value={surahQuery}
              onChange={(e) => setSurahQuery(e.target.value)}
              placeholder="ابحث عن سورة…"
              style={{
                width: "100%", height: 42, borderRadius: 12,
                border: "1px solid var(--line-2)",
                background: "var(--paper-deep)",
                color: "var(--ink)", fontSize: 14,
                padding: "0 14px", outline: "none",
                boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ maxHeight: "36vh", overflowY: "auto" }}>
            {filteredSurahs.map((surah, index) => {
              const added = draft.targetSurahs.includes(surah.id)
              const state = getSurahSelectionState(surah.id, selectedAyahRanges)
              const selected = state.kind !== "none"
              return (
                <button
                  key={surah.id}
                  type="button"
                  onClick={() => onToggleSurah(surah.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    padding: "13px 18px", gap: 12,
                    background: "transparent", border: "none",
                    borderTop: index > 0 ? "1px solid var(--line)" : "none",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: state.kind === "full" ? "var(--ink)" : state.kind === "partial" ? "var(--gold-soft)" : "transparent",
                    boxShadow: `inset 0 0 0 ${state.kind === "none" ? 1.5 : state.kind === "partial" ? 1 : 0}px ${state.kind === "partial" ? "var(--gold-deep)" : "var(--line-2)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {state.kind === "full" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white" }} />}
                    {state.kind === "partial" && <div style={{ width: 8, height: 2, borderRadius: 999, background: "var(--gold-deep)" }} />}
                  </div>
                  {/* Label */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, color: selected ? "var(--ink)" : "var(--ink-soft)" }}>
                        {surah.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{formatNumberAr(surah.id)}</span>
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--ink-muted)", flexShrink: 0 }}>
                      {state.kind === "partial"
                        ? `جزئي · ${formatSurahCoverageLabel(state)}`
                        : added ? "هدف مباشر" : formatSurahCoverageLabel(state)}
                    </span>
                  </div>
                </button>
              )
            })}
            {filteredSurahs.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13.5, color: "var(--ink-muted)" }}>
                ما لقيت سورة بهذا الاسم
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Segment picker ────────────────────────────────── */}
      {goalType === "segment" && (
        <div>
          {selectedAyahRanges.length > 0 && (
            <div className="well" style={{ padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}>النطاقات المحددة</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedAyahRanges.map((r) => {
                  const name = SURAHS.find((s) => s.id === r.surahId)?.name ?? `${r.surahId}`
                  return (
                    <span key={`r-${r.surahId}-${r.fromAyah}`} className="chip" style={{ fontSize: 11.5 }}>
                      {name} {formatNumberAr(r.fromAyah)}–{formatNumberAr(r.toAyah)}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
          <SegmentDraftForm
            draft={segmentDraft}
            submitLabel="أضف هذا المقطع"
            onChange={setSegmentDraft}
            onSubmit={() => onAddSegmentTarget({ surahId: segmentDraft.surahId, fromAyah: segmentDraft.fromAyah, toAyah: segmentDraft.toAyah })}
          />
        </div>
      )}

      {/* ── Selection summary chips ───────────────────────── */}
      {(draft.targetJuz.length > 0 || draft.targetSurahs.length > 0 || draft.targetSegments.length > 0) && (
        <div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 8 }}>
            سلة الخطة · {formatNumberAr(totalAyahs)} آية
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {draft.targetJuz.map((id) => (
              <Chip key={`j-${id}`} label={`الجزء ${formatNumberAr(id)}`} onRemove={() => onToggleJuz(id)} />
            ))}
            {draft.targetSurahs.map((id) => (
              <Chip key={`s-${id}`} label={SURAHS.find((s) => s.id === id)?.name ?? `${id}`} onRemove={() => onToggleSurah(id)} />
            ))}
            {draft.targetSegments.map((seg) => {
              const name = SURAHS.find((s) => s.id === seg.surahId)?.name ?? `${seg.surahId}`
              return (
                <Chip
                  key={`seg-${seg.surahId}-${seg.fromAyah}-${seg.toAyah}`}
                  label={`${name} ${formatNumberAr(seg.fromAyah)}–${formatNumberAr(seg.toAyah)}`}
                  onRemove={() => onRemoveSegmentTarget(`${seg.surahId}:${seg.fromAyah}-${seg.toAyah}`)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Draft summary card ────────────────────────────── */}
      <div className="well" style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          {buildDraftSummaryTitle(draft)}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.7 }}>
          {buildDraftSummaryDetail(draft, selectedSurahNames)}
        </div>
      </div>

      {/* ── Create mode submit button ─────────────────────── */}
      {mode === "create" && onSubmit && submitLabel && (
        <div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="btn btn-gold btn-lg btn-block"
            style={{ opacity: submitDisabled ? 0.5 : 1, cursor: submitDisabled ? "not-allowed" : "pointer" }}
          >
            {submitLabel}
          </button>
          {submitHint && (
            <p style={{ marginTop: 8, textAlign: "center", fontSize: 12.5, color: "var(--ink-muted)" }}>
              {submitHint}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────

function buildDraftSummaryTitle(draft: PlanBasketDraft) {
  if (draft.targetJuz.length + draft.targetSurahs.length + draft.targetSegments.length === 0) {
    return "ابدأ بإضافة هدفك الأول"
  }
  return `خطة حفظك: ${draft.name.trim() || "خطة المرحلة الحالية"}`
}

function buildDraftSummaryDetail(draft: PlanBasketDraft, selectedSurahNames: string[]) {
  const parts: string[] = []
  if (draft.targetJuz.length > 0)
    parts.push(`الأجزاء: ${draft.targetJuz.map((id) => `الجزء ${formatNumberAr(id)}`).join("، ")}`)
  if (selectedSurahNames.length > 0)
    parts.push(`السور: ${selectedSurahNames.slice(0, 4).join("، ")}${selectedSurahNames.length > 4 ? ` +${formatNumberAr(selectedSurahNames.length - 4)}` : ""}`)
  if (draft.targetSegments.length > 0)
    parts.push(`المقاطع المخصصة: ${formatNumberAr(draft.targetSegments.length)}`)
  if (parts.length === 0)
    return "ابنِ خطتك بالطريقة التي تناسبك: أجزاء، سور، ومقاطع مخصصة داخل سلة واحدة."
  return parts.join(" · ")
}

// ── StatCard ─────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="well" style={{ padding: "14px 8px", textAlign: "center" }}>
      <div style={{
        fontFamily: "var(--serif)", fontSize: 28, fontWeight: 700, lineHeight: 1,
        color: value > 0 ? "var(--gold-deep)" : "var(--ink-faint)",
      }}>
        {formatNumberAr(value)}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 5 }}>{label}</div>
    </div>
  )
}

// ── Chip ─────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 28, borderRadius: 10, padding: "0 10px",
        background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)",
        fontSize: 12, fontWeight: 500, color: "var(--ink-soft)",
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", padding: 0, fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
      >
        ×
      </button>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────

function LayersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}
function RangeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>
    </svg>
  )
}
