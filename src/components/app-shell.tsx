"use client"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-stage">
      <div className="app-phone-shell">
        <div className="app-phone-inner">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Surface({
  children,
  className = "",
  tone = "default",
}: {
  children: React.ReactNode
  className?: string
  tone?: "default" | "muted" | "gold"
}) {
  const toneClass =
    tone === "gold"
      ? "surface-card surface-card-gold"
      : tone === "muted"
        ? "surface-card surface-card-muted"
        : "surface-card"

  return <div className={`${toneClass} ${className}`.trim()}>{children}</div>
}

export function SheetFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`sheet-frame ${className}`.trim()}>{children}</div>
}
