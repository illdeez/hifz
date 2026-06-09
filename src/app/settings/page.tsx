"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { PlanBasketEditor } from "@/components/plan-basket-editor"
import { TargetDateSheet } from "@/components/target-date-sheet"
import { clampDailyPacePages, formatDailyPacePages } from "@/lib/pace-planner"
import { exportBackupAsJSON, validateImportedBackup, getBackupPreview, applyImportedBackup, type HufzBackup, type BackupPreview } from "@/lib/storage"
import { useKunehStore } from "@/lib/store"
import { formatDateYearAr, formatNumberAr } from "@/lib/utils"

export default function SettingsPage() {
  const {
    store, updateSettings, resetAllData, renameActivePlan,
    addJuzToActivePlan, removeJuzFromActivePlan,
    addSurahToActivePlan, removeSurahFromActivePlan,
    addSegmentTargetToActivePlan, removeSegmentTargetFromActivePlan,
  } = useKunehStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetText, setResetText] = useState("")
  const [planEditorOpen, setPlanEditorOpen] = useState(false)
  const [planNameDraft, setPlanNameDraft] = useState("")
  const [goalOpen, setGoalOpen] = useState(false)
  const [paceOpen, setPaceOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<{ backup: HufzBackup; preview: BackupPreview } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)

  const settings = store.settings
  const canReset = resetText.trim() === "تصفير"
  const plan = store.activePlan

  // Sync plan name draft when overlay opens
  useEffect(() => {
    if (planEditorOpen) setPlanNameDraft(store.activePlan?.name ?? "")
  }, [planEditorOpen, store.activePlan?.name])

  const QURANIC_LINE = "﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾"

  return (
    <div className="page">
      <PageHeader title="الإعدادات" showBack={false} />

      {/* Profile card */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div className="card" style={{ padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 600, color: "var(--gold)" }}>ع</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>حافظ القرآن</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
              {plan
                ? `على عهدٍ مع القرآن · ${plan.name}`
                : "لا توجد خطة نشطة بعد"}
            </div>
          </div>
        </div>
      </div>

      {/* Active plan management */}
      {plan && (
        <div style={{ padding: "14px 20px 0" }}>
          <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>الخطة النشطة</div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{plan.name}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--ink-muted)" }}>
                  <span>{formatNumberAr(plan.targetJuz.length)} جزء</span>
                  <span>{formatNumberAr(plan.targetSurahs.length)} سورة</span>
                  <span>{formatNumberAr(plan.targetSegments.length)} نطاق</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPlanEditorOpen(true)}
              className="btn btn-ghost btn-block"
              style={{ marginTop: 16, height: 46, gap: 10 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              إدارة الخطة
            </button>
          </div>
        </div>
      )}

      {/* Daily rhythm */}
      <div style={{ padding: "18px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>الإيقاع اليومي</div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {/* Memorization goal */}
          <SettingsRow
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
            title="حفظ جديد كل يوم"
            right={
              <Stepper
                value={settings.dailyMemorizationGoal}
                unit="صفحة"
                onChange={v => updateSettings({ ...settings, dailyMemorizationGoal: v })}
                min={0} max={10}
              />
            }
          />
          <div className="hr" />
          {/* Review goal stepper */}
          <SettingsRow
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.36-3.36L23 10M1 14l5.13 4.36A9 9 0 0020.49 15"/>
              </svg>
            }
            title="مراجعة كل يوم"
            right={
              <Stepper
                value={settings.dailyReviewGoal}
                unit="مقطع"
                onChange={v => updateSettings({ ...settings, dailyReviewGoal: v })}
                min={0} max={20}
              />
            }
          />
          <div className="hr" />
          {/* Target date — opens calendar popup */}
          <SettingsRow
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18"/><path d="M7 8c0-2 1.8-3.5 5-3.5s5 1.5 5 3.5-2 3-5 3-5 1-5 3 1.8 3.5 5 3.5 5-1.5 5-3.5"/>
              </svg>
            }
            title="وتيرة الحفظ اليومية"
            sub={formatDailyPacePages(settings.dailyPacePages)}
            onClick={() => setPaceOpen(true)}
            right={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            }
          />
          <div className="hr" />
          <SettingsRow
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5.5" width="16" height="15" rx="2.5"/>
                <path d="M4 9.5h16M8.5 3.5v4M15.5 3.5v4"/>
              </svg>
            }
            title="هدف الإتمام"
            sub={formatDateYearAr(settings.targetDate)}
            onClick={() => setGoalOpen(true)}
            right={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            }
            last
          />
        </div>
      </div>

      {/* Backup */}
      <div style={{ padding: "18px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>النسخ الاحتياطي</div>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.8, marginBottom: 16 }}>
            بياناتك محفوظة على هذا الجهاز فقط. احرص على تصدير نسخة احتياطية من وقت لآخر.
          </div>

          {importError && (
            <div style={{ borderRadius: 14, padding: "12px 16px", marginBottom: 12, background: "var(--due-soft)", fontSize: 13.5, color: "var(--due)", lineHeight: 1.7 }}>
              {importError}
            </div>
          )}
          {importSuccess && (
            <div style={{ borderRadius: 14, padding: "12px 16px", marginBottom: 12, background: "var(--verdant-soft)", fontSize: 13.5, color: "var(--verdant)", lineHeight: 1.7 }}>
              تم استيراد النسخة الاحتياطية بنجاح.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ height: 46, gap: 8 }}
              onClick={() => {
                const json = exportBackupAsJSON()
                const blob = new Blob([json], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `hufz-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              تصدير البيانات
            </button>
            <label
              className="btn btn-ghost"
              style={{ height: 46, gap: 8, cursor: "pointer" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              استيراد نسخة احتياطية
              <input
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImportError(null)
                  setImportSuccess(false)
                  const reader = new FileReader()
                  reader.onload = () => {
                    try {
                      const parsed = JSON.parse(reader.result as string)
                      const result = validateImportedBackup(parsed)
                      if (!result.ok) {
                        setImportError(result.error)
                        return
                      }
                      const preview = getBackupPreview(result.backup)
                      setImportPreview({ backup: result.backup, preview })
                    } catch {
                      setImportError("تعذر قراءة الملف. تأكد أنه ملف JSON صالح.")
                    }
                  }
                  reader.readAsText(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Data */}
      <div style={{ padding: "18px 20px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10, padding: "0 2px" }}>البيانات</div>
        <div className="card" style={{ padding: "4px 18px" }}>
          <SettingsRow
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--due)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            }
            title="إعادة تعيين كل البيانات"
            sub="يحذف المقاطع والسجل ولا يمكن التراجع"
            onClick={() => setConfirmReset(true)}
            right={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" style={{ transform: "scaleX(-1)", transformOrigin: "center" }}/>
              </svg>
            }
            last
          />
        </div>
      </div>

      {/* ── Plan editor — full-screen overlay ────────────── */}
      {planEditorOpen && plan && (
        <div className="overlay">
          {/* Header — not scrollable */}
          <div style={{
            flexShrink: 0,
            background: "var(--paper)",
            borderBottom: "1px solid var(--line-2)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}>
            <div style={{ height: 54, display: "flex", alignItems: "center", padding: "0 20px" }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>
                إدارة الخطة
              </span>
              <button
                onClick={() => setPlanEditorOpen(false)}
                aria-label="إغلاق"
                style={{
                  marginInlineStart: "auto",
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", cursor: "pointer", color: "var(--ink-soft)", flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable content — fills remaining height */}
          <div className="scrollbar-none" style={{ flex: 1, overflowY: "auto", padding: "20px 20px 20px" }}>
            {/* Plan name field */}
            <div style={{ marginBottom: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>اسم الخطة</div>
              <input
                value={planNameDraft}
                onChange={e => setPlanNameDraft(e.target.value)}
                style={{
                  width: "100%", height: 54, borderRadius: 16,
                  border: "1px solid var(--line-2)", background: "var(--surface)",
                  fontFamily: "var(--serif)", fontSize: 19, fontWeight: 600,
                  color: "var(--ink)", padding: "0 18px", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <PlanBasketEditor
              draft={{
                name: planNameDraft,
                targetJuz: plan.targetJuz ?? [],
                targetSurahs: plan.targetSurahs ?? [],
                targetSegments: plan.targetSegments ?? [],
              }}
              title="أهداف الخطة"
              description="عدّل نفس سلة الأهداف التي بدأت بها: أجزاء، سور، ومقاطع مخصصة داخل خطة واحدة."
              showNameField={false}
              onNameChange={setPlanNameDraft}
              onToggleJuz={(id) => plan.targetJuz.includes(id) ? removeJuzFromActivePlan(id) : addJuzToActivePlan(id)}
              onToggleSurah={(id) => plan.targetSurahs.includes(id) ? removeSurahFromActivePlan(id) : addSurahToActivePlan(id)}
              onAddSegmentTarget={addSegmentTargetToActivePlan}
              onRemoveSegmentTarget={removeSegmentTargetFromActivePlan}
            />
            <div style={{ height: 8 }} />
          </div>

          {/* Bottom action bar — pinned, NOT fixed */}
          <div style={{
            flexShrink: 0,
            padding: "14px 20px calc(env(safe-area-inset-bottom, 20px) + 14px)",
            borderTop: "1px solid var(--line)",
            background: "var(--paper)",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          }}>
            <button
              className="btn btn-gold btn-lg"
              style={{ gap: 8 }}
              onClick={() => {
                renameActivePlan(planNameDraft.trim() || plan.name)
                setPlanEditorOpen(false)
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5 10 17l9-10"/>
              </svg>
              حفظ التعديلات
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPlanEditorOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Target date popup */}
      {goalOpen && (
        <TargetDateSheet
          value={settings.targetDate}
          onClose={() => setGoalOpen(false)}
          onSave={(iso) => updateSettings({ ...settings, targetDate: iso })}
        />
      )}

      {paceOpen && (
        <DailyPaceSheet
          value={settings.dailyPacePages}
          onClose={() => setPaceOpen(false)}
          onSave={(value) => {
            updateSettings({ ...settings, dailyPacePages: clampDailyPacePages(value) })
            setPaceOpen(false)
          }}
        />
      )}

      {/* Reset confirmation bottom sheet */}
      {confirmReset && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(23,18,13,.34)", backdropFilter: "blur(2px)" }} onClick={() => setConfirmReset(false)} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 51, background: "var(--surface)", borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px -12px rgba(23,18,13,.4)", padding: "10px 20px calc(28px + env(safe-area-inset-bottom,0px))", animation: "sheetUp .42s cubic-bezier(.2,.8,.25,1) both" }}>
            <div style={{ width: 38, height: 5, borderRadius: 9, background: "var(--line-2)", margin: "0 auto 18px" }} />
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--due-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--due)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)", textAlign: "center" }}>
              إعادة تعيين كل البيانات؟
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted)", margin: "10px auto 16px", lineHeight: 1.6, maxWidth: 280, textAlign: "center" }}>
              سيُحذف كل ما سجّلت من حفظ ومراجعة وسجل الرحلة، وتعود إلى البداية.
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8, textAlign: "center" }}>
              اكتب "تصفير" للتأكيد
            </p>
            <input
              value={resetText}
              onChange={e => setResetText(e.target.value)}
              placeholder="تصفير"
              style={{ marginBottom: 14 }}
              className="px-4 py-3"
            />
            <button
              style={{ width: "100%", height: 52, borderRadius: 16, background: canReset ? "var(--due)" : "var(--paper-deep)", color: canReset ? "#fff" : "var(--ink-faint)", fontWeight: 700, fontSize: 15, marginBottom: 10, border: "none", cursor: canReset ? "pointer" : "default", fontFamily: "inherit" }}
              onClick={() => { if (!canReset) return; resetAllData(); setConfirmReset(false); setResetText("") }}
              disabled={!canReset}
            >
              نعم، أعِد التعيين
            </button>
            <button
              style={{ width: "100%", height: 52, borderRadius: 16, background: "transparent", color: "var(--ink-soft)", fontWeight: 600, fontSize: 15, boxShadow: "inset 0 0 0 1px var(--line-2)", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => setConfirmReset(false)}
            >
              إلغاء
            </button>
          </div>
        </>
      )}

      {/* Import preview confirmation */}
      {importPreview && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(23,18,13,.34)", backdropFilter: "blur(2px)" }} onClick={() => setImportPreview(null)} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 51, background: "var(--surface)", borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px -12px rgba(23,18,13,.4)", padding: "10px 20px calc(28px + env(safe-area-inset-bottom,0px))", animation: "sheetUp .42s cubic-bezier(.2,.8,.25,1) both" }}>
            <div style={{ width: 38, height: 5, borderRadius: 9, background: "var(--line-2)", margin: "0 auto 18px" }} />
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold-deep)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)", textAlign: "center" }}>
              استيراد نسخة احتياطية؟
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted)", margin: "10px auto 0", lineHeight: 1.6, maxWidth: 300, textAlign: "center" }}>
              سيتم استبدال بياناتك الحالية بالبيانات الموجودة في هذه النسخة. سيتم تصدير نسخة احتياطية من بياناتك الحالية تلقائيًا قبل الاستيراد.
            </p>

            <div style={{ marginTop: 16, borderRadius: 16, background: "var(--paper-deep)", padding: "14px 18px" }}>
              <ImportPreviewRow label="الخطة" value={importPreview.preview.planName ?? "لا توجد خطة"} />
              <ImportPreviewRow label="المقاطع المحفوظة" value={formatNumberAr(importPreview.preview.segmentCount)} />
              <ImportPreviewRow label="أيام السجل" value={formatNumberAr(importPreview.preview.logCount)} />
              <ImportPreviewRow label="هدف الإتمام" value={formatDateYearAr(importPreview.preview.targetDate)} />
              <ImportPreviewRow label="تاريخ التصدير" value={new Date(importPreview.preview.exportedAt).toLocaleDateString("ar-SA")} last />
            </div>

            <button
              style={{ width: "100%", height: 52, borderRadius: 16, background: "var(--gold)", color: "white", fontWeight: 700, fontSize: 15, marginTop: 14, border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => {
                // Safety backup of current data before import
                const safetyJson = exportBackupAsJSON()
                const blob = new Blob([safetyJson], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `hufz-safety-backup-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)

                // Apply the import
                applyImportedBackup(importPreview.backup)
                setImportPreview(null)
                setImportSuccess(true)
                // Reload after a brief delay so user sees the success message
                setTimeout(() => window.location.reload(), 800)
              }}
            >
              نعم، استورد النسخة
            </button>
            <button
              style={{ width: "100%", height: 52, borderRadius: 16, background: "transparent", color: "var(--ink-soft)", fontWeight: 600, fontSize: 15, boxShadow: "inset 0 0 0 1px var(--line-2)", border: "none", cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}
              onClick={() => setImportPreview(null)}
            >
              إلغاء
            </button>
          </div>
        </>
      )}

      {/* Quranic close */}
      <div style={{ textAlign: "center", padding: "28px 20px 8px" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink-muted)" }}>{QURANIC_LINE}</div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}

// ── SettingsRow ──────────────────────────────────────────────
function SettingsRow({
  icon, title, sub, right, onClick, last = false,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  right?: React.ReactNode
  onClick?: () => void
  last?: boolean
}) {
  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "15px 4px",
    width: "100%",
    textAlign: "inherit",
    background: "none",
    border: "none",
    fontFamily: "inherit",
    cursor: onClick ? "pointer" : "default",
  }

  const rowContent = (
    <>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--gold-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </>
  )

  return (
    <div>
      {onClick ? (
        <button
          style={rowStyle}
          onClick={onClick}
          type="button"
        >
          {rowContent}
        </button>
      ) : (
        <div style={rowStyle}>
          {rowContent}
        </div>
      )}
      {!last && <div className="hr" />}
    </div>
  )
}

// ── Stepper ──────────────────────────────────────────────────
function Stepper({ value, unit, onChange, min, max }: { value: number; unit: string; onChange: (v: number) => void; min: number; max: number }) {
  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 9,
    background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", cursor: "pointer", flexShrink: 0,
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
      <button type="button" style={btnStyle} onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, value + 1)) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <div style={{ textAlign: "center", minWidth: 44 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{formatNumberAr(value)}</span>
        <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 1 }}>{unit}</div>
      </div>
      <button type="button" style={btnStyle} onClick={(e) => { e.stopPropagation(); onChange(Math.max(min, value - 1)) }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  )
}

function DailyPaceSheet({
  value,
  onClose,
  onSave,
}: {
  value: number
  onClose: () => void
  onSave: (value: number) => void
}) {
  const presetMode = value === 0.5 ? "0.5" : value === 1 ? "1" : value === 2 ? "2" : "custom"
  const [mode, setMode] = useState<"0.5" | "1" | "2" | "custom">(presetMode)
  const [custom, setCustom] = useState(String(value))
  const selected = mode === "custom" ? clampDailyPacePages(Number(custom) || 0.5) : Number(mode)

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(23,18,13,.34)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, background: "var(--surface)", borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 40px -12px rgba(23,18,13,.4)", padding: "12px 20px calc(24px + env(safe-area-inset-bottom,0px))" }}>
        <div style={{ width: 38, height: 5, borderRadius: 9, background: "var(--line-2)", margin: "0 auto 18px" }} />
        <div style={{ fontFamily: "var(--serif)", fontSize: 21, fontWeight: 600, color: "var(--ink)", textAlign: "center", marginBottom: 8 }}>
          وتيرة الحفظ اليومية
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.7, margin: "0 auto 16px", maxWidth: 300 }}>
          اختر الوتيرة التي تناسبك، وسيعرض حفظ أثرها المتوقع على تاريخ الإنجاز.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { value: "0.5" as const, label: "نصف صفحة يوميًا" },
            { value: "1" as const, label: "صفحة يوميًا" },
            { value: "2" as const, label: "صفحتان يوميًا" },
            { value: "custom" as const, label: "مخصص" },
          ].map((option) => {
            const isSelected = mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: "none",
                  background: isSelected ? "var(--ink)" : "var(--paper-deep)",
                  color: isSelected ? "white" : "var(--ink-soft)",
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

        {mode === "custom" && (
          <div style={{ marginTop: 12 }}>
            <input
              type="number"
              min={0.25}
              max={10}
              step={0.25}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              style={{
                width: "100%", height: 50, borderRadius: 14,
                border: "1px solid var(--line-2)", background: "white",
                fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600,
                color: "var(--ink)", padding: "0 14px", textAlign: "right", outline: "none",
              }}
            />
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7 }}>
              بين ربع صفحة و10 صفحات يوميًا، مع دعم الكسور مثل 0.25 و0.5 و0.75 و1.5.
            </p>
          </div>
        )}

        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "var(--paper-deep)", fontSize: 13.5, color: "var(--ink-soft)" }}>
          وتيرتك الحالية: {formatDailyPacePages(selected)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" style={{ height: 48 }} onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-gold" style={{ height: 48 }} onClick={() => onSave(selected)}>حفظ الوتيرة</button>
        </div>
      </div>
    </>
  )
}

function ImportPreviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{value}</span>
    </div>
  )
}
