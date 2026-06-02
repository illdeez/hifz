"use client"

/**
 * ds.tsx — Claude Design System primitives
 * Shared across all screens: Ring, SurahAvatar, SurahBand,
 * ScreenHead, Bar, Strength, MushafMap, DayGrid
 */

import React from "react"

// ── Ring ─────────────────────────────────────────────────────
// Animated SVG arc progress ring
export function Ring({
  value = 0, size = 88, sw = 6,
  track = "var(--paper-deep)",
  color = "var(--gold)",
  children,
}: {
  value?: number
  size?: number
  sw?: number
  track?: string
  color?: string
  children?: React.ReactNode
}) {
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, value)))
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg) scaleX(-1)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  )
}

// ── SurahAvatar ───────────────────────────────────────────────
// Rounded-rect with first meaningful letter of surah name
const TONE_MAP: Record<string, [string, string]> = {
  gold:    ["rgba(176,138,79,.12)",  "#8E6C39"],
  due:     ["rgba(168,116,63,.12)",  "#A8743F"],
  verdant: ["rgba(76,97,81,.12)",    "#4C6151"],
  ink:     ["rgba(33,29,24,.1)",     "#4B443A"],
}

function monogram(name: string): string {
  return (name.replace(/^ٱل|^ال/, "")[0] ?? name[0] ?? "؟")
}

export function SurahAvatar({
  name, tone = "gold", size = 44,
}: {
  name: string
  tone?: keyof typeof TONE_MAP
  size?: number
}) {
  const [bg, fg] = TONE_MAP[tone as string] ?? TONE_MAP.gold
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: bg, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontFamily: "var(--serif)", fontSize: size * 0.42, fontWeight: 600, color: fg, lineHeight: 1 }}>
        {monogram(name)}
      </span>
    </div>
  )
}

// ── SurahBand ─────────────────────────────────────────────────
// Ornamental rules + diamonds + surah name
export function SurahBand({ name, meta }: { name: string; meta?: string }) {
  const clean = name.replace(/^ٱل/, "ال")
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: "6px 0" }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(176,138,79,.45))" }} />
        <Diamond />
        <span style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
          {"سورة " + clean}
        </span>
        <Diamond />
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(176,138,79,.45))" }} />
      </div>
      {meta && <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4, letterSpacing: ".04em" }}>{meta}</div>}
    </div>
  )
}

function Diamond() {
  return (
    <div style={{ width: 6, height: 6, transform: "rotate(45deg)", background: "var(--gold)", opacity: 0.75, flexShrink: 0 }} />
  )
}

// ── ScreenHead ────────────────────────────────────────────────
// Eyebrow + large Scheherazade title + optional right action
export function ScreenHead({
  eyebrow, title, action, pad = "4px 24px 14px",
}: {
  eyebrow?: string
  title: string
  action?: React.ReactNode
  pad?: string
}) {
  return (
    <div style={{ padding: pad, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 34, fontWeight: 600, lineHeight: 1.1, color: "var(--ink)" }}>
          {title}
        </h1>
      </div>
      {action}
    </div>
  )
}

// ── Bar ───────────────────────────────────────────────────────
// Thin animated linear progress bar (value 0–1)
export function Bar({
  value = 0, color = "var(--gold)", track = "var(--paper-deep)", h = 5,
}: {
  value?: number; color?: string; track?: string; h?: number
}) {
  return (
    <div style={{ height: h, borderRadius: h, background: track, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.max(0, Math.min(1, value)) * 100}%`,
        background: color, borderRadius: h,
        transition: "width 1s cubic-bezier(.2,.7,.3,1)",
      }} />
    </div>
  )
}

// ── Strength ──────────────────────────────────────────────────
// 5 quiet dots — never a bar of shame (value 0–1)
export function Strength({ value, tone = "gold" }: { value: number; tone?: "due" | "gold" | "verdant" }) {
  const dots = 5
  const filled = Math.round(value * dots)
  const col = tone === "due" ? "var(--due)" : tone === "verdant" ? "var(--verdant)" : "var(--gold)"
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: i < filled ? col : "var(--paper-deep)",
        }} />
      ))}
    </div>
  )
}

// ── BucketDot ─────────────────────────────────────────────────
// 8px colored dot for review bucket status
export function BucketDot({ bucket }: { bucket: "overdue" | "due" | "threatened" | "stable" }) {
  const col = bucket === "overdue" ? "var(--due)" : bucket === "stable" ? "var(--verdant)" : "var(--gold)"
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, display: "inline-block", flexShrink: 0 }} />
}

// ── MushafMap ─────────────────────────────────────────────────
// 30 juz in 6×5 RTL grid; each cell: done | progress | none
export function MushafMap({
  juzStatus, size = 14, gap = 5,
}: {
  juzStatus: Array<"done" | "progress" | "none">
  size?: number
  gap?: number
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(6, ${size}px)`, gap, justifyContent: "center", direction: "rtl" }}>
      {juzStatus.map((s, i) => {
        const bg = s === "done" ? "var(--verdant)" : s === "progress" ? "var(--gold)" : "var(--paper-deep)"
        return (
          <div key={i} title={`الجزء ${i + 1}`} style={{
            width: size, height: size, borderRadius: 4,
            background: bg,
            opacity: s === "progress" ? 0.6 : 1,
            boxShadow: s === "none" ? "inset 0 0 0 1px var(--line)" : "none",
          }} />
        )
      })}
    </div>
  )
}

// ── DayGrid ───────────────────────────────────────────────────
// Monthly consistency grid — active days highlighted in verdant
export function DayGrid({
  year, month, activeDates,
}: {
  year: number
  month: number
  activeDates: Set<string>
}) {
  const today = new Date()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDateNum =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null

  return (
    <div className="daygrid">
      {Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        const active = activeDates.has(dateStr)
        return (
          <div
            key={d}
            className={`day${active ? " on" : ""}${d === todayDateNum ? " today" : ""}`}
          />
        )
      })}
    </div>
  )
}

// ── Legend item ───────────────────────────────────────────────
export function MapLegend({ color, label, opacity = 1 }: { color: string; label: string; opacity?: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-muted)" }}>
      <i style={{ width: 10, height: 10, borderRadius: 3, background: color, opacity, display: "inline-block", boxShadow: opacity === 1 && color === "var(--paper-deep)" ? "inset 0 0 0 1px var(--line)" : "none" }} />
      {label}
    </span>
  )
}
