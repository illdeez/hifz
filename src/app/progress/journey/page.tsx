"use client"

import { JourneyView } from "@/components/journey-view"
import { PageHeader } from "@/components/page-header"

export default function ProgressJourneyPage() {
  return (
    <JourneyView
      header={<PageHeader title="الرحلة" backHref="/progress" />}
    />
  )
}
