"use client"

/**
 * TargetDateSheet — centered modal popup calendar.
 *
 * Centered via flexbox on a full-screen fixed scrim (no translateX, no RTL issues).
 * Calendar logic ported verbatim from TargetDateSheet in the design handoff.
 * Week starts Saturday. RTL-correct prev/next navigation.
 */

import { useMemo, useState } from "react"
import { formatNumberAr, formatYearAr } from "@/lib/utils"

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]
const WEEKDAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"] // Saturday-first

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function colOf(d: Date): number {
  return (d.getDay() + 1) % 7 // Saturday = 0
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.round(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) /
        (30 * 86400000),
    ),
  )
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function clampFutureDate(d: Date, min: Date): Date {
  return d.getTime() < min.getTime() ? new Date(min) : d
}

const NAV_BTN: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10,
  background: "var(--paper-deep)",
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "none", cursor: "pointer", flexShrink: 0,
}

interface Props {
  value: string
  onClose: () => void
  onSave: (iso: string) => void
}

export function TargetDateSheet({ value, onClose, onSave }: Props) {
  const today = startOfDay(new Date())
  const init = clampFutureDate(startOfDay(
    value ? new Date(value) : new Date(today.getTime() + 120 * 86400000),
  ), today)
  const [sel, setSel] = useState<Date>(init)
  const [view, setView] = useState<Date>(
    new Date(init.getFullYear(), init.getMonth(), 1),
  )
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)

  const y = view.getFullYear()
  const m = view.getMonth()

  const firstCol = colOf(new Date(y, m, 1))
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: Array<Date | null> = []
  for (let i = 0; i < firstCol; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7) cells.push(null)

  const isPast = (d: Date) => d.getTime() < today.getTime()
  const canPrev = new Date(y, m, 1) > new Date(today.getFullYear(), today.getMonth(), 1)
  const isSelectedPast = isPast(sel)

  const monthsAway = monthsBetween(today, sel)
  const fmtSel = `${formatNumberAr(sel.getDate())} ${MONTHS[sel.getMonth()]} ${formatYearAr(sel.getFullYear())}`
  const yearOptions = useMemo(() => Array.from({ length: 5 }, (_, index) => today.getFullYear() + index), [today])

  function jump(delta: number) { setView(new Date(y, m + delta, 1)) }

  function quick(months: number) {
    const d = startOfDay(new Date(today))
    d.setMonth(d.getMonth() + months)
    setSel(clampFutureDate(d, today))
    setView(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  function pickYear(nextYear: number) {
    const nextMonth = view.getMonth()
    const nextDay = Math.min(sel.getDate(), new Date(nextYear, nextMonth + 1, 0).getDate())
    const nextDate = clampFutureDate(startOfDay(new Date(nextYear, nextMonth, nextDay)), today)
    setSel(nextDate)
    setView(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setYearPickerOpen(false)
  }

  function pickMonth(nextMonth: number) {
    const nextYear = view.getFullYear()
    const nextDay = Math.min(sel.getDate(), new Date(nextYear, nextMonth + 1, 0).getDate())
    const nextDate = clampFutureDate(startOfDay(new Date(nextYear, nextMonth, nextDay)), today)
    setSel(nextDate)
    setView(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
    setMonthPickerOpen(false)
  }

  function save() {
    if (isSelectedPast) return
    onSave(toIso(sel))
    onClose()
  }

  const CHIPS = [
    { label: "٣ أشهر", m: 3 },
    { label: "٦ أشهر", m: 6 },
    { label: "سنة",    m: 12 },
    { label: "سنتان",  m: 24 },
  ]

  return (
    /* Full-screen scrim — flex centres the popup, click-outside closes */
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
        background: "rgba(23,18,13,.42)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        animation: "fadeIn .2s ease both",
      }}
      onClick={onClose}
    >
      {/* Popup card — stopPropagation so clicks inside don't close */}
      <div
        style={{
          width: "100%", maxWidth: 390,
          background: "var(--surface)",
          borderRadius: 24,
          boxShadow: "0 24px 60px -16px rgba(23,18,13,.45), 0 2px 8px rgba(23,18,13,.08)",
          padding: "22px 18px 18px",
          overflowY: "auto",
          maxHeight: "calc(100dvh - 40px)",
          animation: "popUp .25s cubic-bezier(.2,.7,.3,1) both",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header: selected date + distance ─────────────── */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>هدف الإتمام</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>
            {fmtSel}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--gold-deep)", marginTop: 4, fontWeight: 600 }}>
            {monthsAway <= 0
              ? "اليوم"
              : `على بُعد ${formatNumberAr(monthsAway)} ${
                  monthsAway === 1 ? "شهر" : monthsAway === 2 ? "شهرين" : "أشهر"
                } تقريبًا`}
          </div>
        </div>

        {/* ── Quick-pick chips ──────────────────────────────── */}
        <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
          {CHIPS.map(c => {
            const d = startOfDay(new Date(today))
            d.setMonth(d.getMonth() + c.m)
            const on = sameDay(d, sel)
            return (
              <button
                type="button"
                key={c.m}
                className={`chip${on ? " is-on" : ""}`}
                style={{ cursor: "pointer", height: 30, fontSize: 12.5, padding: "0 12px" }}
                onClick={() => quick(c.m)}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* ── Month switcher ────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          {/* Prev — visual right in RTL */}
          <button
            type="button"
            style={{ ...NAV_BTN, opacity: canPrev ? 1 : 0.3, cursor: canPrev ? "pointer" : "default" }}
            onClick={() => canPrev && jump(-1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setMonthPickerOpen((open) => !open)}
              style={{
                border: "none",
                background: "var(--paper-deep)",
                borderRadius: 11,
                padding: "6px 12px",
                fontFamily: "var(--serif)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              {MONTHS[m]}
            </button>
            <button
              type="button"
              onClick={() => setYearPickerOpen((open) => !open)}
              style={{
                border: "none",
                background: "var(--paper-deep)",
                borderRadius: 11,
                padding: "6px 12px",
                fontFamily: "var(--serif)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              {formatYearAr(y)}
            </button>
          </div>

          {/* Next — visual left in RTL */}
          <button type="button" style={NAV_BTN} onClick={() => jump(1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {monthPickerOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {MONTHS.map((monthName, monthIndex) => {
              const selectedMonth = monthIndex === m
              return (
                <button
                  key={monthName}
                  type="button"
                  onClick={() => pickMonth(monthIndex)}
                  style={{
                    minHeight: 40,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: selectedMonth ? "linear-gradient(177deg,#BE9A5E,#A9824A)" : "var(--paper-deep)",
                    color: selectedMonth ? "#231d12" : "var(--ink)",
                    fontFamily: "var(--serif)",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "10px 8px",
                  }}
                >
                  {monthName}
                </button>
              )
            })}
          </div>
        )}

        {yearPickerOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {yearOptions.map((year) => {
              const selectedYear = year === y
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => pickYear(year)}
                  style={{
                    height: 40,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: selectedYear ? "linear-gradient(177deg,#BE9A5E,#A9824A)" : "var(--paper-deep)",
                    color: selectedYear ? "#231d12" : "var(--ink)",
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {formatYearAr(year)}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Weekday header ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
          {WEEKDAYS.map((w, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink-faint)", paddingBottom: 5 }}>
              {w}
            </div>
          ))}
        </div>

        {/* ── Day grid ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const selected = sameDay(d, sel)
            const isToday = sameDay(d, today)
            const past = isPast(d)
            return (
              <button
                type="button"
                key={i}
                disabled={past}
                onClick={() => !past && setSel(d)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--serif)", fontSize: 14, fontWeight: 600,
                  border: "none",
                  cursor: past ? "default" : "pointer",
                  background: selected ? "linear-gradient(177deg,#BE9A5E,#A9824A)" : "transparent",
                  color: selected ? "#231d12" : past ? "var(--ink-faint)" : "var(--ink-soft)",
                  opacity: past ? 0.35 : 1,
                  boxShadow: selected
                    ? "0 4px 12px -6px rgba(142,108,57,.65)"
                    : isToday
                    ? "inset 0 0 0 1.5px var(--line-gold)"
                    : "none",
                  transition: ".14s",
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatNumberAr(d.getDate())}
                </span>
              </button>
            )
          })}
        </div>

        {isSelectedPast && (
          <div style={{ marginTop: 12, textAlign: "center", fontSize: 12.5, color: "var(--due)", fontWeight: 600 }}>
            اختر تاريخًا قادمًا لهدفك
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 14, height: 46 }} onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn btn-gold"
            style={{ fontSize: 14, height: 46, opacity: isSelectedPast ? 0.55 : 1, cursor: isSelectedPast ? "default" : "pointer" }}
            onClick={save}
            disabled={isSelectedPast}
          >
            تثبيت الهدف
          </button>
        </div>
      </div>
    </div>
  )
}
