"use client"

/**
 * SegmentDraftForm — redesigned for the dark session overlay
 *
 * Lives natively on var(--surface-ink) #211D18 background.
 * No white card. Steppers for ayah range. Dark pill level selector.
 * Matches the app's Quiet Luxury × Mission Control tone.
 */

import { getSurahMeta, SURAHS } from "@/lib/quran-metadata"
import { formatNumberAr } from "@/lib/utils"
import type { SegmentDraft, SegmentLevel } from "@/lib/types"

const LEVEL_OPTIONS: Array<{ value: SegmentLevel; label: string; dot: string }> = [
  { value: 0, label: "لم يحفظ", dot: "rgba(237,230,214,.28)" },
  { value: 1, label: "ضعيف",    dot: "#C08552" },
  { value: 2, label: "متوسط",   dot: "#C7A86A" },
  { value: 3, label: "قوي",     dot: "#7FA98C" },
]

export function createInitialSegmentDraft(surahId?: number): SegmentDraft {
  return {
    surahId: surahId ?? 1,
    fromAyah: 1,
    toAyah: 1,
    memorization: 1,
    meaning: 1,
    notes: "",
  }
}

export function isDraftRangeValidForContext(
  draft: Pick<SegmentDraft, "fromAyah" | "toAyah">,
  minAyah: number,
  maxAyah: number
): boolean {
  return draft.fromAyah >= minAyah && draft.toAyah <= maxAyah && draft.fromAyah <= draft.toAyah
}

export function updateDraftAyahRangeForContext(
  draft: SegmentDraft,
  field: "fromAyah" | "toAyah",
  nextValue: number,
  minAyah: number,
  maxAyah: number
): SegmentDraft {
  const boundedValue = Math.min(maxAyah, Math.max(minAyah, nextValue))
  let fromAyah = Math.min(maxAyah, Math.max(minAyah, draft.fromAyah))
  let toAyah = Math.min(maxAyah, Math.max(minAyah, draft.toAyah))

  if (field === "fromAyah") {
    fromAyah = boundedValue
    if (fromAyah > toAyah) {
      toAyah = fromAyah
    }
  } else {
    toAyah = boundedValue
    if (toAyah < fromAyah) {
      fromAyah = toAyah
    }
  }

  return {
    ...draft,
    fromAyah,
    toAyah,
  }
}

export function SegmentDraftForm({
  draft,
  error,
  submitLabel,
  surahOptions,
  lockSurah = false,
  contextStartAyah,
  contextEndAyah,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: SegmentDraft
  error?: string | null
  submitLabel: string
  surahOptions?: Array<{ id: number; name: string }>
  lockSurah?: boolean
  contextStartAyah?: number
  contextEndAyah?: number
  onChange: (draft: SegmentDraft) => void
  onSubmit: () => void
  onCancel?: () => void
}) {
  const surah = getSurahMeta(draft.surahId)
  const options = surahOptions ?? SURAHS
  const maxAyah = surah?.ayahCount ?? 286
  const minContextAyah = Math.max(1, Math.min(contextStartAyah ?? 1, maxAyah))
  const maxContextAyah = Math.max(minContextAyah, Math.min(contextEndAyah ?? maxAyah, maxAyah))
  const isValidRange = isDraftRangeValidForContext(draft, minContextAyah, maxContextAyah)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Surah ─────────────────────────────────────────────── */}
      {lockSurah && surah ? (
        // Locked: show surah name as a display element, not an input
        <div style={{ textAlign: "center" }}>
          <div
            className="eyebrow"
            style={{ color: "rgba(190,154,94,.80)", marginBottom: 8 }}
          >
            السورة
          </div>
          <div
            style={{
              fontFamily: "var(--serif)",
              fontSize: 26, fontWeight: 600,
              color: "#F1EAD9", lineHeight: 1.2,
            }}
          >
            {"سورة " + surah.name.replace(/^ٱل/, "ال")}
          </div>
          <div style={{ fontSize: 12, color: "rgba(237,230,214,.4)", marginTop: 5 }}>
            {formatNumberAr(surah.ayahCount)} آية
          </div>
        </div>
      ) : (
        // Free: dark-styled selector
        <div>
          <div
            style={{
              fontSize: 12, fontWeight: 600,
              color: "rgba(237,230,214,.5)",
              marginBottom: 8, letterSpacing: ".08em",
            }}
          >
            السورة
          </div>
          <select
            value={draft.surahId}
            onChange={(e) =>
              onChange({ ...draft, surahId: Number(e.target.value), fromAyah: 1, toAyah: 1 })
            }
            style={{
              width: "100%", height: 52, borderRadius: 14,
              border: "1px solid rgba(237,230,214,.14)",
              background: "rgba(237,230,214,.07)",
              color: "#F1EAD9",
              fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600,
              padding: "0 16px", direction: "rtl",
              WebkitAppearance: "none", appearance: "none",
            }}
          >
            {options.map((item) => (
              <option key={item.id} value={item.id} style={{ background: "#211D18" }}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Ayah range — stepper controls ─────────────────────── */}
      <div>
        <div
          style={{
            fontSize: 12, fontWeight: 600,
            color: "rgba(237,230,214,.5)",
            marginBottom: 14, letterSpacing: ".08em", textAlign: "center",
          }}
        >
          نطاق الآيات
        </div>
        <div
          style={{
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 0,
            background: "rgba(237,230,214,.05)",
            boxShadow: "inset 0 0 0 1px rgba(237,230,214,.1)",
            borderRadius: 18, padding: "18px 20px",
          }}
        >
          <StepperField
            label="من آية"
            value={draft.fromAyah}
            min={minContextAyah}
            max={maxContextAyah}
            onChange={(v) => onChange(updateDraftAyahRangeForContext(draft, "fromAyah", v, minContextAyah, maxContextAyah))}
          />
          <div
            style={{
              width: 1, height: 56,
              background: "rgba(237,230,214,.1)",
              margin: "0 20px", flexShrink: 0,
            }}
          />
          <StepperField
            label="إلى آية"
            value={draft.toAyah}
            min={minContextAyah}
            max={maxContextAyah}
            onChange={(v) => onChange(updateDraftAyahRangeForContext(draft, "toAyah", v, minContextAyah, maxContextAyah))}
          />
        </div>
        {surah && (
          <div
            style={{
              textAlign: "center", marginTop: 8,
              fontSize: 11.5, color: "rgba(237,230,214,.35)",
            }}
          >
            السورة {formatNumberAr(surah.ayahCount)} آية ·{" "}
            السياق {formatNumberAr(minContextAyah)}–{formatNumberAr(maxContextAyah)} ·{" "}
            المقطع {formatNumberAr(Math.max(0, draft.toAyah - draft.fromAyah + 1))} آية
          </div>
        )}
      </div>

      {/* ── Memorization level ────────────────────────────────── */}
      <DarkLevelPicker
        label="مستوى الحفظ"
        value={draft.memorization}
        onChange={(v) => onChange({ ...draft, memorization: v })}
      />

      {/* ── Meaning level ─────────────────────────────────────── */}
      <DarkLevelPicker
        label="مستوى المعاني"
        value={draft.meaning}
        onChange={(v) => onChange({ ...draft, meaning: v })}
      />

      {/* ── Notes ─────────────────────────────────────────────── */}
      <div>
        <div
          style={{
            fontSize: 12, fontWeight: 600,
            color: "rgba(237,230,214,.5)",
            marginBottom: 8, letterSpacing: ".08em",
          }}
        >
          ملاحظة اختيارية
        </div>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          placeholder="مثال: الآية ٤ تحتاج تثبيتًا أكثر"
          style={{
            width: "100%", borderRadius: 14,
            border: "1px solid rgba(237,230,214,.12)",
            background: "rgba(237,230,214,.05)",
            color: "#F1EAD9",
            fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.7,
            padding: "12px 16px", resize: "none",
            direction: "rtl",
          }}
        />
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <p style={{ fontSize: 13, color: "#C08552", textAlign: "center" }}>
          {error}
        </p>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, height: 54, borderRadius: 16,
              background: "rgba(237,230,214,.07)",
              color: "rgba(237,230,214,.6)",
              boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
              border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 15, fontWeight: 600,
            }}
          >
            إلغاء
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="btn btn-gold"
          disabled={!isValidRange}
          style={{
            flex: onCancel ? 1.5 : 1,
            height: 54,
            opacity: isValidRange ? 1 : 0.5,
            cursor: isValidRange ? "pointer" : "not-allowed",
          }}
        >
          {submitLabel}
        </button>
      </div>

    </div>
  )
}

// ── Stepper field — + / number / − ──────────────────────────
function StepperField({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div
        style={{
          fontSize: 11, color: "rgba(237,230,214,.4)",
          marginBottom: 10, letterSpacing: ".06em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(237,230,214,.08)",
            boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer", color: "rgba(237,230,214,.7)",
            fontSize: 18, lineHeight: 1, fontFamily: "inherit",
          }}
        >
          −
        </button>
        <div
          style={{
            fontFamily: "var(--serif)", fontSize: 28, fontWeight: 600,
            color: "#F1EAD9", minWidth: 44, textAlign: "center", lineHeight: 1,
          }}
        >
          {formatNumberAr(value)}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(237,230,214,.08)",
            boxShadow: "inset 0 0 0 1px rgba(237,230,214,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer", color: "rgba(237,230,214,.7)",
            fontSize: 18, lineHeight: 1, fontFamily: "inherit",
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Dark level picker — 4 horizontal pills ──────────────────
function DarkLevelPicker({
  label, value, onChange,
}: {
  label: string; value: SegmentLevel
  onChange: (v: SegmentLevel) => void
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12, fontWeight: 600,
          color: "rgba(237,230,214,.5)",
          marginBottom: 10, letterSpacing: ".08em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {LEVEL_OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1, height: 54, borderRadius: 13,
                background: active
                  ? "rgba(237,230,214,.1)"
                  : "rgba(237,230,214,.04)",
                boxShadow: active
                  ? `inset 0 0 0 1.5px ${opt.dot}`
                  : "inset 0 0 0 1px rgba(237,230,214,.08)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 5,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "box-shadow .18s, background .18s",
              }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: active ? opt.dot : "rgba(237,230,214,.2)",
                  display: "block",
                  transition: "background .18s",
                }}
              />
              <span
                style={{
                  fontSize: 11, fontWeight: 600,
                  color: active ? "#F1EAD9" : "rgba(237,230,214,.38)",
                  transition: "color .18s",
                }}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
