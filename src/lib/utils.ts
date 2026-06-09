function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`)
}

export function today(): string {
  return toDateKey(new Date())
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000)
}

export function daysUntil(dateStr: string): number {
  return Math.max(0, daysBetween(today(), dateStr))
}

export function formatDateAr(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "long",
  })
}

export function formatDateYearAr(dateStr: string): string {
  return `${formatDateAr(dateStr)} ${formatYearAr(parseDate(dateStr).getFullYear())}`
}

export function formatDateFullAr(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString("ar-SA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function formatNumberAr(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value)
}

export function formatYearAr(value: number): string {
  return new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(value)
}

/** Formats a page count: up to 2 decimals, trailing zeros trimmed (٠٫٥, ٢٫٢٥, ٣). */
export function formatPagesAr(value: number): string {
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Describes a page count for the home KPI. Rounds to the nearest quarter page
 * and renders it numerically (٠٫٧٥، ٤٫٢٥) with a separate صفحة unit — compact
 * enough to stay prominent on a small tile.
 */
export function describePagesAr(value: number): { text: string; unit: string } {
  const rounded = Math.round(value * 4) / 4
  return { text: formatPagesAr(rounded), unit: "صفحة" }
}

export function toArabicNumeral(n: number): string {
  return formatNumberAr(n)
}

export function lastNDates(n: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < n; i++) {
    dates.push(addDays(today(), -i))
  }
  return dates
}

export function reviewRelativeLabel(dateStr: string | null): string {
  if (!dateStr) return "غير محدد"
  const diff = daysBetween(today(), dateStr)
  if (diff < 0) return "متأخر"
  if (diff === 0) return "مستحق اليوم"
  if (diff === 1) return "غدًا"
  if (diff === 2) return "بعد يومين"
  return `بعد ${formatNumberAr(diff)} أيام`
}
