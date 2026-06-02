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
