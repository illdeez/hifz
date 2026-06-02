"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Bottom navigation — ported verbatim from the design handoff.
 *
 * CSS class `.ic-stroke` on every SVG path/circle matches the design's
 * `className='ic-stroke'` pattern so that
 *   `.app-bottom-nav-item.is-active .ic-stroke { stroke: var(--gold-deep) }`
 * overrides `stroke="currentColor"` for the active tab.
 *
 * Icon SVG paths taken directly from data.jsx in the design bundle.
 * Icon size: 23px (sw: active 1.9, inactive 1.6) — from ui.jsx TabBar.
 */

const TABS = [
  { href: "/",         label: "الرئيسية",  Icon: HomeIcon },
  { href: "/mushaf",   label: "المصحف",    Icon: MushafIcon },
  { href: "/review",   label: "المراجعة",  Icon: ReviewIcon },
  { href: "/progress", label: "التقدّم",   Icon: ProgressIcon },
  { href: "/settings", label: "الإعدادات", Icon: SettingsIcon },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav dir="rtl" className="app-bottom-nav">
      <div className="app-bottom-nav-inner">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`app-bottom-nav-item${active ? " is-active" : ""}`}
            >
              <span className="app-bottom-nav-icon">
                <Icon active={active} />
              </span>
              <span className="app-bottom-nav-label">{label}</span>
              <span className="app-bottom-nav-dot" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Icons — paths verbatim from data.jsx in the design bundle ──────────── */

const SW_ACTIVE = 1.9
const SW_INACTIVE = 1.6
const COMMON = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "ic-stroke",
}

function HomeIcon({ active }: { active: boolean }) {
  const sw = active ? SW_ACTIVE : SW_INACTIVE
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <path {...COMMON} strokeWidth={sw} d="M4 11.5 12 5l8 6.5" />
      <path {...COMMON} strokeWidth={sw} d="M6 10.5V19h12v-8.5" />
      <path {...COMMON} strokeWidth={sw} d="M10 19v-4h4v4" />
    </svg>
  )
}

function MushafIcon({ active }: { active: boolean }) {
  const sw = active ? SW_ACTIVE : SW_INACTIVE
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <path {...COMMON} strokeWidth={sw} d="M5 5.5C5 4.7 5.7 4 6.5 4H18a1 1 0 0 1 1 1v13.5" />
      <path {...COMMON} strokeWidth={sw} d="M6.5 16H19v2.5a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 18.5V6" />
      <path {...COMMON} strokeWidth={sw} d="M9 8.5h6M9 11h4" />
    </svg>
  )
}

function ReviewIcon({ active }: { active: boolean }) {
  const sw = active ? SW_ACTIVE : SW_INACTIVE
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <path {...COMMON} strokeWidth={sw} d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path {...COMMON} strokeWidth={sw} d="M20 4v3.5h-3.5" />
    </svg>
  )
}

function ProgressIcon({ active }: { active: boolean }) {
  const sw = active ? SW_ACTIVE : SW_INACTIVE
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <path {...COMMON} strokeWidth={sw} d="M5 19V10" />
      <path {...COMMON} strokeWidth={sw} d="M12 19V5" />
      <path {...COMMON} strokeWidth={sw} d="M19 19v-6" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  const sw = active ? SW_ACTIVE : SW_INACTIVE
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <circle {...COMMON} strokeWidth={sw} cx="12" cy="12" r="3" />
      <path
        {...COMMON}
        strokeWidth={sw}
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
      />
    </svg>
  )
}
