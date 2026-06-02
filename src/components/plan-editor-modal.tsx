"use client"

import { useEffect, useMemo, useState } from "react"
import { PlanBasketEditor, type PlanBasketDraft } from "@/components/plan-basket-editor"
import { useKunehStore } from "@/lib/store"
import { today } from "@/lib/utils"
import type { PlanTargetSegment } from "@/lib/types"

export function PlanEditorModal({ onClose }: { onClose: () => void }) {
  const { store, setActivePlan } = useKunehStore()
  const plan = store.activePlan

  const [draft, setDraft] = useState<PlanBasketDraft | null>(
    plan
      ? {
          name: plan.name,
          targetJuz: [...(plan.targetJuz ?? [])],
          targetSurahs: [...(plan.targetSurahs ?? [])],
          targetSegments: [...(plan.targetSegments ?? [])],
        }
      : null
  )

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!plan) {
      setDraft(null)
      return
    }

    setDraft({
      name: plan.name,
      targetJuz: [...(plan.targetJuz ?? [])],
      targetSurahs: [...(plan.targetSurahs ?? [])],
      targetSegments: [...(plan.targetSegments ?? [])],
    })
  }, [plan])

  const canSave = useMemo(() => {
    if (!draft) return false
    return draft.targetJuz.length + draft.targetSurahs.length + draft.targetSegments.length > 0
  }, [draft])

  function toggleJuz(juzId: number) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            targetJuz: previous.targetJuz.includes(juzId)
              ? previous.targetJuz.filter((id) => id !== juzId)
              : [...previous.targetJuz, juzId],
          }
        : previous
    )
  }

  function toggleSurah(surahId: number) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            targetSurahs: previous.targetSurahs.includes(surahId)
              ? previous.targetSurahs.filter((id) => id !== surahId)
              : [...previous.targetSurahs, surahId],
          }
        : previous
    )
  }

  function addSegmentTarget(target: PlanTargetSegment) {
    const targetKey = `${target.surahId}:${target.fromAyah}-${target.toAyah}`
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            targetSegments: previous.targetSegments.some(
              (item) => `${item.surahId}:${item.fromAyah}-${item.toAyah}` === targetKey
            )
              ? previous.targetSegments
              : [...previous.targetSegments, target],
          }
        : previous
    )
  }

  function removeSegmentTarget(segmentKey: string) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            targetSegments: previous.targetSegments.filter(
              (item) => `${item.surahId}:${item.fromAyah}-${item.toAyah}` !== segmentKey
            ),
          }
        : previous
    )
  }

  function handleSave() {
    if (!plan || !draft || !canSave) return

    setActivePlan({
      ...plan,
      name: draft.name.trim() || plan.name,
      targetJuz: draft.targetJuz,
      targetSurahs: draft.targetSurahs,
      targetSegments: draft.targetSegments,
      updatedAt: today(),
    })
    onClose()
  }

  if (!plan || !draft) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        background: "rgba(33,29,24,0.18)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "min(100%, 430px)",
          height: "100%",
          background: "var(--paper)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 10px",
          }}
        >
          <div style={{ width: 36 }} />
          <span
            style={{
              fontFamily: "var(--serif)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "0.01em",
            }}
          >
            إدارة الخطة
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "white",
              border: "none",
              boxShadow: "inset 0 0 0 1px rgba(33,29,24,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--ink-soft)",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2px 20px 24px",
            WebkitOverflowScrolling: "touch" as never,
          }}
        >
          <PlanBasketEditor
            draft={draft}
            title="أهداف الخطة"
            description="عدّل نفس سلة الأهداف التي بدأت بها: أجزاء، سور، ومقاطع مخصصة داخل خطة واحدة."
            mode="edit"
            showNameField
            onNameChange={(value) => setDraft((previous) => (previous ? { ...previous, name: value } : previous))}
            onToggleJuz={toggleJuz}
            onToggleSurah={toggleSurah}
            onAddSegmentTarget={addSegmentTarget}
            onRemoveSegmentTarget={removeSegmentTarget}
          />
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "12px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(to top, rgba(245,241,233,0.98), rgba(245,241,233,0.88))",
            borderTop: "1px solid rgba(33,29,24,0.08)",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 16,
                background: "transparent",
                color: "var(--ink-soft)",
                fontWeight: 600,
                fontSize: 15,
                boxShadow: "inset 0 0 0 1px var(--line-2)",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                flex: 1.35,
                height: 50,
                borderRadius: 16,
                background: canSave ? "var(--gold)" : "var(--paper-deep)",
                color: canSave ? "white" : "var(--ink-faint)",
                fontWeight: 700,
                fontSize: 15,
                border: "none",
                cursor: canSave ? "pointer" : "default",
                fontFamily: "inherit",
                boxShadow: canSave ? "0 10px 28px rgba(176,138,79,0.24)" : "none",
              }}
            >
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
