"use client"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page px-4 pt-7">
      <div className="state-panel">
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--gold-deep)]">ERROR</p>
        <h1 className="mt-3 text-[30px] font-black text-[var(--ink)]">صار خلل غير متوقع</h1>
        <p className="mt-3 text-sm leading-8 text-[var(--ink-muted)]">
          الصفحة لم تكتمل كما ينبغي. جرّب إعادة المحاولة، وإذا استمر الخلل ارجع خطوة وستبقى بياناتك المحلية كما هي.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-[22px] bg-[var(--verdant)] px-5 py-3 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
