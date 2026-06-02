"use client"

import { useRouter } from "next/navigation"

/**
 * PageHeader — unified RTL-native app page header.
 *
 * No direction override — inherits `direction: rtl` from the body.
 * In RTL flex-row: title sits at the start (visual right), back button
 * is pushed to the end (visual left) via marginInlineStart: auto.
 *
 * Works inside both `.page` (window scroll) and `.overlay` (overflowY: auto).
 * Set `showBack={false}` for root tab pages with no back destination.
 */
export function PageHeader({
  title,
  backHref,
  showBack = true,
}: {
  title: string
  backHref?: string
  showBack?: boolean
}) {
  const router = useRouter()

  function handleBack() {
    if (backHref) {
      router.push(backHref)
      return
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        flexShrink: 0,
        background: "var(--paper)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 8,
        }}
      >
        {/* Title — first child → visual RIGHT in RTL (natural start side) */}
        <span
          style={{
            fontFamily: "var(--serif)",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          {title}
        </span>

        {/* Back button — pushed to visual LEFT via marginInlineStart: auto */}
        {showBack && (
          <button
            onClick={handleBack}
            aria-label="رجوع"
            style={{
              marginInlineStart: "auto",
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              color: "var(--gold-deep)",
              flexShrink: 0,
            }}
          >
            {/* Right-pointing chevron — "back" direction in RTL */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
