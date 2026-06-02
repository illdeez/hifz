"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { PlanBasketEditor, type PlanBasketDraft } from "@/components/plan-basket-editor"
import { useKunehStore } from "@/lib/store"

export function PlanManager({
  title = "خطة حفظي",
  description = "هذه شاشة إدارة أهداف فقط: أجزاء، سور، ومقاطع مخصصة داخل خطة واحدة.",
  collapsible = false,
  defaultOpen = true,
  accent = "plain",
  showSettingsLink = false,
  hideHeader = false,
}: {
  title?: string
  description?: string
  collapsible?: boolean
  defaultOpen?: boolean
  accent?: "plain" | "tinted"
  showSettingsLink?: boolean
  hideHeader?: boolean
}) {
  const {
    store,
    renameActivePlan,
    addJuzToActivePlan,
    removeJuzFromActivePlan,
    addSurahToActivePlan,
    removeSurahFromActivePlan,
    addSegmentTargetToActivePlan,
    removeSegmentTargetFromActivePlan,
  } = useKunehStore()

  const [open, setOpen] = useState(defaultOpen)
  const [planNameDraft, setPlanNameDraft] = useState("")

  useEffect(() => {
    setPlanNameDraft(store.activePlan?.name ?? "")
  }, [store.activePlan?.name])

  const draft = useMemo<PlanBasketDraft | null>(() => {
    if (!store.activePlan) return null
    return {
      name: planNameDraft,
      targetJuz: store.activePlan.targetJuz ?? [],
      targetSurahs: store.activePlan.targetSurahs ?? [],
      targetSegments: store.activePlan.targetSegments ?? [],
    }
  }, [planNameDraft, store.activePlan])

  return (
    <section
      className={`rounded-[32px] border p-5 shadow-[0_18px_38px_rgba(56,46,34,0.05)] ${
        accent === "tinted" ? "border-[var(--line-gold)] bg-[var(--surface-gold)]/50" : "border-[var(--line)] bg-transparent"
      }`}
    >
      {!hideHeader && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-[var(--ink)]">{title}</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-muted)]">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            {showSettingsLink && (
              <Link
                href="/settings"
                className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)]"
              >
                الإعدادات
              </Link>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)]"
              >
                {open ? "إخفاء" : "تعديل الخطة"}
              </button>
            )}
          </div>
        </div>
      )}

      {(!collapsible || open) && (
        <div className="mt-5">
          {!store.activePlan || !draft ? (
            <div className="surface-card surface-card-muted px-4 py-4 text-sm text-[var(--ink-muted)]">
              لا توجد خطة نشطة بعد. أنشئ خطتك أولًا من <Link href="/onboarding" className="font-semibold text-[var(--gold-deep)]">شاشة onboarding</Link>.
            </div>
          ) : (
            <>
              <label className="mb-4 block rounded-[24px] border border-[var(--line)] bg-white/75 p-4">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink-soft)]">اسم الخطة</span>
                <div className="flex gap-2">
                  <input
                    value={planNameDraft}
                    onChange={(event) => setPlanNameDraft(event.target.value)}
                    className="px-4 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => renameActivePlan(planNameDraft.trim() || "خطة حفظي الحالية")}
                    className="shrink-0 rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--ink-soft)]"
                  >
                    حفظ
                  </button>
                </div>
              </label>

              <PlanBasketEditor
                draft={draft}
                title="أهداف الخطة"
                description="حرّك تركيزك الحالي كما تريد: أجزاء، سور، ومقاطع مخصصة داخل نفس السلة."
                showNameField={false}
                onNameChange={setPlanNameDraft}
                onToggleJuz={(juzId) =>
                  store.activePlan?.targetJuz.includes(juzId) ? removeJuzFromActivePlan(juzId) : addJuzToActivePlan(juzId)
                }
                onToggleSurah={(surahId) =>
                  store.activePlan?.targetSurahs.includes(surahId)
                    ? removeSurahFromActivePlan(surahId)
                    : addSurahToActivePlan(surahId)
                }
                onAddSegmentTarget={addSegmentTargetToActivePlan}
                onRemoveSegmentTarget={removeSegmentTargetFromActivePlan}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}
