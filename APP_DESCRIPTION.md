# كُنه (Kuneh) — Complete App Description

*A Quran memorization (حفظ / hifz) companion. This document explains every screen, every component, and every piece of logic in the app, without skipping anything.*

---

## 1. What the app is, in one paragraph

Kuneh is a **mobile-first, fully client-side Quran memorization companion**. There is no server, no account, and no login — everything the user does lives in the browser's `localStorage` under the key `"kuneh-v3"`. The app's job is to take a memorization *goal* (memorize this juz / these surahs / this range of ayahs by this date), break it into small **segments**, drive a **daily session** that reviews what is fading and adds a little new material, and use a **spaced-repetition engine** to decide what needs attention and when. The entire interface is in Arabic, right-to-left, and is laid out to fit a phone screen without scrolling where possible.

---

## 2. Technology stack and project shape

- **Framework**: Next.js 16.2 (App Router). A custom rule in `AGENTS.md` warns that this is a breaking-change version of Next.js — the docs in `node_modules/next/dist/docs/` are the source of truth, not prior knowledge.
- **UI**: React 19.2, Tailwind CSS 4, plus a large amount of inline-style design work. TypeScript 5 throughout.
- **Testing**: tests run via `tsx --test`. Playwright is installed for browser testing.
- **Deployment**: Vercel (a `.vercel` folder is present), with auto-deploy on push.
- **Rendering model**: Every page is a client component (`"use client"`). There is no backend route, no database, no API. All state is held in React and mirrored to `localStorage`.
- **Language/direction**: The root `<html>` is set to Arabic and RTL. Two font families are loaded: **IBM Plex Sans Arabic** for UI text (`--font-ui`) and **Scheherazade New** for Quranic/serif display (`--font-serif`).

### Folder layout
- `src/app/` — the App Router pages: home (`page.tsx`), onboarding, mushaf (list) + mushaf/[surahId] (detail), review, progress + progress/journey, journey, settings, plus `layout.tsx`, `loading.tsx`, `error.tsx`, `globals.css`.
- `src/lib/` — all the domain logic: `types.ts`, `review-engine.ts`, `store.ts`, `storage.ts`, `utils.ts`, `pace-planner.ts`, `session-state.ts`, `plan-selection.ts`, `page-coverage.ts`, `page-coverage-metadata.ts` (a generated data file), `quran-metadata.ts`, `juz-ranges.ts`, `algorithms.ts`.
- `src/components/` — reusable UI: `app-shell.tsx`, `nav.tsx`, `ds.tsx` (design-system primitives), `page-header.tsx`, `plan-manager.tsx`, `plan-basket-editor.tsx`, `segment-draft-form.tsx`, `target-date-sheet.tsx`, `journey-view.tsx`, `plan-editor-modal.tsx`.

---

## 3. The data model (the heart of everything)

All types live in `src/lib/types.ts`. Understanding these makes every screen legible.

### Segment — the atomic unit
A **`HifzSegment`** is one chunk of memorized (or being-memorized) Quran. Its fields:
- `id` — a string built as `"${surahId}:${fromAyah}-${toAyah}"` (so a segment is uniquely identified by its surah and ayah range).
- `surahId`, `surahName`, `fromAyah`, `toAyah` — what ayahs it covers.
- `memorization` — a level 0–3: how well the *recitation* is memorized (0 = not yet, 3 = solid).
- `meaning` — a level 0–3: how well the *meaning* is understood.
- `stability` — a number 0–100 representing how firmly the segment is fixed in memory. This is the core spaced-repetition value.
- `lastReviewed` — date string of the last review (or null).
- `nextReview` — date string of when it's next due.
- `reviewCount` — how many times it's been reviewed.
- `notes` — free text.
- `createdAt` / `updatedAt` — timestamps.

`SegmentLevel` is the `0 | 1 | 2 | 3` type used for both `memorization` and `meaning`.

A **`SegmentDraft`** is the lightweight form used when creating/editing a segment: `surahId`, `fromAyah`, `toAyah`, `memorization`, `meaning`, `notes`. The `id`, `stability`, and review fields are derived when the draft is committed.

### Plan — the goal
A **`MemorizationPlan` / `ActivePlan`** defines what the user is working toward. There is exactly **one active plan at a time**. Its targets are expressed three ways, which can be combined:
- `targetJuz: number[]` — whole juz (1–30).
- `targetSurahs: number[]` — whole surahs (1–114).
- `targetSegments: PlanTargetSegment[]` — explicit ayah ranges, each `{ surahId, fromAyah, toAyah }`.

It also carries `name`, `createdAt`, `updatedAt`. The combination of these targets defines the universe of ayahs the plan covers; the app continually compares that universe against the segments the user has actually memorized.

### Daily log — the diary
A **`DailyLog`** records one day's activity: `date`, `reviewedSegmentIds[]`, `addedSegmentIds[]`, `ratings` (a map of segmentId → Rating), and `sessionNotes[]`. The journey/timeline view is built from the list of these logs.

### Settings
**`AppSettings`** holds: `dailyMemorizationGoal` (how many *ayahs* of new material per day; default 1), `dailyReviewGoal` (how many segments to review per day; default 5), `targetDate` (the completion goal date; default `"2027-02-07"`), and `dailyPacePages` (chosen pace in pages/day; default 0.5).

### The store
**`KunehStore`** is the whole persisted state: `{ settings, activePlan, segments (a record keyed by id), logs[] }`.

### Derived/enriched types
- **`EnrichedSegment`** — a `HifzSegment` plus computed fields: `status` (none/weak/medium/strong), `effectiveStability` (stability after time-decay), `bucket` (overdue/due/threatened/none), and page-reference info. These are what the UI actually renders.
- **`SurahMeta`**, **`JuzMeta`**, **`AyahMeta`** — static reference data.
- **`SurahSummary`**, **`ProgressMetrics`**, **`PlanProgress`** — aggregate views built for the progress screens.

---

## 4. Static Quran reference data

Three data files give the app its knowledge of the Quran's structure.

- **`quran-metadata.ts`** — `SURAHS[]`: all 114 surahs, each with its Arabic name and `ayahCount`. `JUZ[]` is derived from `JUZ_RANGES`. Helpers `getSurahMeta(id)` and `getJuzMeta(id)` look these up.
- **`juz-ranges.ts`** — `JUZ_RANGES`: the 30 juz, each described as a set of ranges `{ surahId, fromAyah, toAyah }` so the app knows exactly which ayahs belong to each juz (juz boundaries fall in the middle of surahs).
- **`page-coverage-metadata.ts`** — a large generated file. `PAGE_COUNT = 604` (the standard Madani mushaf). `AYAH_PAGE_METADATA` maps **every single ayah** to the physical mushaf page it appears on. `JUZ_PAGE_MAP` maps each juz to its pages. This is what lets the app think in *pages* (the natural unit memorizers use) rather than just ayahs.

---

## 5. The spaced-repetition engine (`review-engine.ts`)

This is the most important logic in the app. It decides, for every segment, how strong it is, when it should next be seen, and which "bucket" of urgency it falls into.

### Ratings and their effects
When a user reviews a segment, they rate it. There are three ratings, each with two consequences — a **stability change** and a **next-review interval**:

| Rating (Arabic) | meaning | stability delta | next review in |
|---|---|---|---|
| struggled (تعثرت) | barely recalled | **+3** | **1 day** |
| good (جيدة) | recalled with effort | **+8** | **3 days** |
| excellent (ممتازة) | recalled effortlessly | **+15** | **7 days** |

These live in `RATING_DELTA` and `RATING_DAYS`. Stability is always clamped to the 0–100 range. So a struggled review still nudges you forward but brings the card back tomorrow; an excellent review pushes stability up sharply and lets you wait a week.

### Memorization score
`memorizationScore` converts a `memorization` level (0–3) into a percentage as `level × 33` (so 0/33/66/99). This is used to express "how memorized" a segment is in human terms.

### Stability status (the color bands)
`stabilityStatus(stability)` maps a number to a label:
- `≤ 0` → **none** (not started)
- `< 40` → **weak** (ضعيف)
- `< 70` → **medium** (متوسط)
- `≥ 70` → **strong** (قوي)

These map to colors and dots used everywhere (red/amber/green families).

### Effective stability — the decay model
Raw `stability` is what you earned at your last review. But memory fades with time. `effectiveStability` computes the *current* strength:
- It looks at how many days have passed since `nextReview`.
- There's a **2-day grace period** past the due date where nothing decays.
- After that grace, stability **decays by 5 points per day**.
- The result is floored at 0.

So a segment rated "excellent" (stability ~85) that is then ignored for a week or two will visibly weaken, which is what pulls it back into review.

### Next-review date
`computeSegmentNextReviewDate` takes the last-reviewed date and the rating's interval (`RATING_DAYS`) and produces the `nextReview` date. `applyRating(segment, rating)` is the full transition: it bumps stability by the delta (clamped), sets `lastReviewed` to today, sets `nextReview` via the interval, and increments `reviewCount`.

### The three buckets (urgency classification)
Every memorized segment is sorted into a bucket by comparing `nextReview` and `effectiveStability` to today:
- **overdue** — `nextReview` is *before* today. It missed its slot.
- **due** — `nextReview` is *today or earlier* but not yet classified overdue (i.e. due today).
- **threatened** — not due yet, but **either** `effectiveStability < 45` **or** it has already decayed by ≥ 10 points. This is a *preventive* signal: "this is getting shaky, catch it before it's late."

`isDue`, `isOverdue`, `isThreatened`, and `buildSegmentBuckets` implement this. `buildSegmentBuckets` returns `{ overdue, due, threatened }` arrays, which is what the review screen and the daily session consume.

### Creating a segment from a draft
`createSegmentFromDraft` turns a draft into a full segment:
- Initial `stability = memorization × 25`, capped at 100. (So memorizing at level 3 starts you at 75 stability — already "strong"; level 1 starts at 25 — "weak".)
- `nextReview` is set to **tomorrow** (today + 1), *unless* `memorization` is 0, in which case it isn't scheduled for review.
- `validateSegmentDraft` guards the input: the surah must exist, the ayah range must be valid (from ≤ to, within the surah's ayah count), etc., returning an error string the form displays.

### Reference pages
`getReferencePages` / `describeReferencePages` use the ayah→page metadata to tell the user which physical mushaf pages a segment spans (e.g. "صفحة ٣ من المصحف"), so they can open the right page.

### Surah-level aggregation
`computeSurahProgress` and `buildSurahSummaries` roll segments up per surah: how many ayahs are covered, the average strength, the overall status. This powers the mushaf list and progress views.

### Plan membership helpers
A set of functions decides whether a given segment or surah is "inside" the active plan:
- `isSegmentInsidePlan` — is this segment covered by the plan's juz/surah/segment targets?
- `getSurahPlanReason` — *why* is this surah in the plan (because of a juz target, a surah target, or a segment target)?
- `isSurahInsidePlan` — boolean version.
- `getPlannedSegmentBuckets` — like `buildSegmentBuckets` but filtered to only the segments inside the active plan (so the daily session focuses on plan work).

### Plan progress
`buildPlanProgress` computes how far through the plan the user is — `planCompletionPercent` and supporting counts — by comparing covered ayahs/pages to the plan's total universe.

### Overall metrics
`buildProgressMetrics` produces the dashboard numbers, including `mostNeedySurahs` — the top 3 surahs sorted first by overdue count, then by (low) stability. These are the surahs the user is most at risk of losing.

### Display helpers
`describeSegment(segment)` produces a human label like "سورة البقرة ١–٥". `mergeDailyLog` merges a new day's activity into the logs (combining if a log for that date already exists). There are also Arabic label maps: status colors, status dots, status labels, and `MEMORIZATION_LABEL` / `MEANING_LABEL` (Arabic words for levels 0–3).

---

## 6. Persistence layer (`storage.ts`)

- `STORAGE_KEY = "kuneh-v3"` — the localStorage key (the v3 suffix implies two prior schema iterations).
- `getDefaultSettings()` — returns the defaults listed in §3 (memo goal 1, review goal 5, target date 2027-02-07, pace 0.5 pages).
- `createEmptyStore()` — a fresh store with default settings, no active plan, no segments, no logs.
- **Normalize functions** — when loading from localStorage, the raw JSON is run through normalizers that fill in missing fields, coerce types, and protect against corrupted/old data shapes. This is the migration safety net.
- `loadStore()` / `saveStore(store)` — read/write the whole store to localStorage (guarded for SSR where `window` is absent).
- `resetStoredData()` — wipes the key.
- `buildSegmentId(surahId, fromAyah, toAyah)` — the canonical id builder (`"${surahId}:${fromAyah}-${toAyah}"`), used so the same range always maps to the same segment.

---

## 7. The store hook (`store.ts`) — the app's brain in React

`useKunehStore()` is a custom hook used by every page. It loads the store on mount, holds it in state, and exposes both **mutations** (which update state *and* persist) and **memoized derived views**.

### State + core updater
- `store` — the live `KunehStore`.
- `updateStore(updater)` — applies a change and immediately calls `saveStore`.

### Segment CRUD
- `addSegment(draft)` — validates, builds a segment via `createSegmentFromDraft`, stores it. Returns `{ ok, id }` or `{ ok: false, error }`.
- `addSegments(drafts[])` — bulk version (used for "I memorized the whole surah/juz"). Returns the list of created ids.
- `applySegmentDraftsToStore(drafts)` — a *replace* operation: deletes any existing segments contained by the new drafts, then re-adds. Used when re-defining a region so you don't get overlapping duplicates.
- `updateSegmentLevels(id, memorization, meaning)` — adjust the two level values directly.

### Plan mutations
- `setActivePlan(plan)` / `clearActivePlan()`.
- Granular target editing: add/remove a juz, add/remove a surah, add/remove a segment target.
- `renamePlan(name)`.

### Review + logging
- `submitRating(segmentId, rating)` — applies the rating to the segment (via `applyRating`) and persists.
- `saveDailyLog(log)` — merges the day's activity into `logs` (by date).
- `updateSettings(partial)` — patch settings.
- `resetAllData()` — full wipe.

### Memoized derived views (recomputed when the store changes)
- `allSegments` — every segment, enriched.
- `todayBuckets` — the overdue/due/threatened buckets. **If there's an active plan, these are restricted to plan segments; otherwise all segments.**
- `todayLog` — the log entry for today (if any).
- `progressMetrics` — the dashboard aggregate.
- `surahSummaries` — per-surah rollups.
- `planProgress` — plan completion stats.

This hook is the single source of truth that every screen reads from and writes to.

---

## 8. Utilities (`utils.ts`)

Date and formatting helpers used everywhere:
- `parseDate` — parses a `YYYY-MM-DD` string using `T12:00:00` (noon) to avoid timezone-boundary off-by-one bugs.
- `today()` — today's date as a normalized string.
- `addDays(date, n)`, `daysBetween(a, b)`, `daysUntil(date)` — date arithmetic.
- Arabic number/date formatters: `formatNumberAr` (Western → Arabic-Indic digits ٠١٢٣…), `formatDateAr`, `formatYearAr`, etc.
- `reviewRelativeLabel(date)` — turns a next-review date into a relative Arabic phrase ("غدًا", "بعد ٣ أيام", "متأخر").

---

## 9. Pace planning (`pace-planner.ts` + `page-coverage.ts` + `plan-selection.ts`)

This subsystem answers: *"At my chosen daily pace, will I finish the plan before my target date?"* It works in **pages**, because that's how memorizers naturally measure effort.

### Page coverage (`page-coverage.ts`)
Using the ayah→page metadata:
- `getPagesForSurah / getPagesForSegment / getPagesForJuz` — which pages a unit touches.
- `getPlanPages(plan)` — the full set of pages the plan covers.
- `getCoveredPages(segments)` — the pages the user has actually memorized.
- `getRemainingPlanPages(plan, segments)` — plan pages minus covered pages.

### Plan selection (`plan-selection.ts`)
- `buildSelectedAyahRanges(plan)` — merges and compacts the plan's juz + surah + segment targets into a single clean, non-overlapping list of ayah ranges. (Critical because a juz target and a surah target might overlap.)
- Coverage-state helpers classify each unit as **none / partial / full** covered — used by the basket editor to show what's already selected.

### Pace summary (`pace-planner.ts`)
- `clampDailyPacePages(value)` — pace is constrained to **0.25–10 pages/day in quarter-page steps**.
- `formatDailyPacePages(value)` — human label ("نصف صفحة يوميًا", "صفحة يوميًا"…).
- `getMemorizationMode(surahId)` — classifies a surah as **short / medium / long**, based on a `SHORT_SURAH_IDS` set plus a ≤46-ayah threshold. This changes how the daily-session quick options are presented (short surahs are memorized in ayah counts; longer ones in pages/fractions).
- `buildPacePlanSummary(...)` — the big one. It computes: remaining pages, remaining ayahs, the **required daily pace** to hit the target date, the **selected** daily pace, a projected **finish date**, and an `onTrack` boolean (selected ≥ required). This is what the home page's "وتيرة الحفظ" card and the progress screen render.

---

## 10. Session state machine (`session-state.ts`)

A daily session is modeled as an immutable state object that gets transformed by pure functions. Phases: **review → new-segment → summary**. Modes: **daily** or **review-only**.

- `createTodaySession(buckets, reviewGoal, memoGoal, mode)` — builds a session. It fills a `reviewQueue` from the buckets (overdue first, then due, then threatened, up to the review goal) and sets the new-segment target from the memo goal.
- `createReviewSessionFromSegments(segments)` — a one-off review of specific segments (used by "extra review" / review-a-single-segment).
- `withReviewResult(session, segmentId, rating)` — records a rating, moves the segment to `doneReviewed`, advances the queue.
- `withSegmentAdded` / `withSegmentsAdded` — record newly memorized segment id(s) into `addedSegmentIds`.
- `withSegmentDraftStepSkipped` — skip the new-memorization step.
- `withSessionNote(session, note)` — attach a note.

The session object tracks: `reviewQueue`, `doneReviewed`, `addedSegmentIds`, `ratings`, `note`, and the current phase. The home page reads this to render the engine and, at the end, writes it into a `DailyLog`.

---

## 11. Components (`src/components/`)

- **`app-shell.tsx`** — `AppShell` is the phone-frame wrapper that constrains width and centers the app on larger screens; `Surface` and `SheetFrame` are container primitives (cards and bottom-sheet frames).
- **`nav.tsx`** — the fixed bottom navigation with 5 tabs, each an inline SVG icon: الرئيسية (home), المصحف (mushaf), المراجعة (review), التقدّم (progress), الإعدادات (settings).
- **`ds.tsx`** — the design-system kit: `Ring` (circular progress), `SurahAvatar`, `SurahBand` (decorative surah title divider), `ScreenHead`, `Bar` (progress bar), `Strength` (strength indicator), `BucketDot` (urgency dot), `MushafMap` (a 604-cell grid visualizing which pages are memorized/threatened/etc.), `DayGrid` (a consistency/streak calendar), `MapLegend`.
- **`page-header.tsx`** — standard screen header.
- **`plan-manager.tsx`** — manage the active plan (rename, view targets, expand).
- **`plan-basket-editor.tsx`** — a tabbed picker (juz / surah / segment) used to build or edit a plan's target set, showing none/partial/full coverage state per unit.
- **`segment-draft-form.tsx`** — the dark-themed form for entering a new segment: surah selector, from/to ayah steppers, and the memorization + meaning level pickers (0–3 each).
- **`target-date-sheet.tsx`** — an Arabic-calendar modal for picking the completion target date.
- **`journey-view.tsx`** — renders the timeline of `DailyLog` entries (what you reviewed/added each day).
- **`plan-editor-modal.tsx`** — modal wrapper for plan editing.

---

## 12. Screens (`src/app/`)

### `layout.tsx`
Sets `<html lang="ar" dir="rtl">`, loads the two fonts as CSS variables, and wraps everything in `AppShell` + the bottom `Nav`. `loading.tsx` and `error.tsx` provide the route-level loading and error fallbacks.

### Onboarding (`onboarding/page.tsx`) — the first run
An 808-line, 4-step flow that produces the first active plan:
1. **Content** — choose what to memorize (juz / surahs / segments) via the basket editor.
2. **Target date** — pick the completion date (target-date sheet).
3. **Daily pace** — choose pages/day; the planner shows whether that pace hits the date.
4. **Summary** — review and confirm. On confirm it builds a `MemorizationPlan` and calls `setActivePlan`, then routes to home.

### Home / "Today" (`page.tsx`) — the central hub (~3,400 lines)
This is the largest and most complex screen. It is the daily driver.

**If there's no active plan**, it renders `HomeOnboardingGateway` (a prompt to start onboarding).

**Otherwise**, the home view renders, top to bottom:
- **Header** — a time-of-day Arabic greeting (`homeGreeting()`: سحر مبارك / صباح النور / نهار مبارك / مساء النور / ليلة مباركة by hour), today's **Hijri date** (`hijriDateLine()`, via `toLocaleDateString("ar-SA-u-ca-islamic")`), and a small **progress ring** (links to settings) showing today's memorization ratio.
- **Greeting headline** — "أهلًا بعودتك، إلى وِردك اليوم" or, if today's session is done, "أتممت وِردَك اليوم، جزاك الله خيرًا". Below it a chip linking to the mushaf showing the active plan's name.
- **Hero card (وِرد اليوم)** — three states:
  - *Completed*: `HomeCompletedCard` — "أتممت جلستك اليوم", showing counts reviewed/added, with "مراجعة إضافية" and "حفظ إضافي" buttons.
  - *Has a next task*: `WardCard` — shows the next memorization goal (surah name + ayah range + count), a "+N للمراجعة" badge if reviews are due, and a big "ابدأ جلسة اليوم" CTA.
  - *Plan fully memorized*: a celebratory card prompting the user to expand the plan.
- **Glance row** — two `GlanceTile`s: "حُفظ اليوم" (ayahs memorized today vs. goal) and "مراجعة اليوم" (due count). Each is tappable.
- **Goal countdown (`GoalCountdownCard`)** — a big days-left number to the target date, a human breakdown ("≈ ٣ أشهر و٥ أيام"), and an elapsed-time progress bar from `planCreatedAt` to `targetDate`. If no target is set, it becomes a "حدِّد هدف الإتمام" prompt.
- **Pace comparison (`PaceComparisonCard`)** — current pace vs. required pace, remaining pages, projected finish date, and an on-track/behind message (green if you'll finish before target, amber with "you'll finish N days late" otherwise).
- **Plan progress strip** — a thin bar showing `planCompletionPercent`.
- **FAB** — a floating "سجّل حفظًا" (log memorization) button that jumps straight into extra-memorization mode.

**The session engine** (the overlay). When a session starts, the screen swaps to a full-screen dark overlay with three phases:
- `SessionOverview` — a calm intro screen showing how many reviews and whether there's new memorization, with a "begin" button. (Skipped for quick "extra" sessions.)
- `SessionView` (the engine) — walks through the review queue one segment at a time, presenting the segment and three rating buttons (struggled/good/excellent). After reviews, it moves to the **new-segment step**: the user picks a goal (a juz, surah, or segment target from their plan, or "outside plan"), then chooses how much they memorized via **quick range options** (e.g. "حفظت نصف الصفحة", "حفظت ٥ آيات", "حفظت السورة كاملة") or a manual ayah picker, sets memorization/meaning levels, and commits.
- `SessionDone` — a completion screen with reviewed/added counts and a "home" button.

**The new-segment logic** (a major chunk of this file) is sophisticated. It computes, for the chosen goal:
- The **first uncovered block** (`getFirstUncoveredBlock`) — scans the goal's ayah range, finds the earliest ayah you *haven't* memorized yet, and the contiguous uncovered run after it. This is how the app always suggests "the next thing" rather than something you've already done.
- **Page chunks** (`getGoalPageChunks`) — splits the goal into per-page chunks so it can offer page-based shortcuts.
- **Memorization mode** drives which shortcuts appear: short surahs → ayah-count options ("٣ آيات", "السورة كاملة"); medium/long → page/fraction options ("نصف صفحة", "صفحة", "ربع الجزء").
- Helper builders (`getPageSpanDraft`, `getHalfPageDraft`, `getHalfSegmentDraft`, `getAyahCountDraft`) produce the exact `SegmentDraft` for each shortcut, and a family of `describe…Shortcut` functions produce the Arabic labels.
- **Bulk intents** (`prepareFullSurahConfirmation`, `prepareFullJuzConfirmation`) let the user mark an entire surah or juz as memorized in one action, generating all the underlying segment drafts.
- When a segment is added that falls *outside* the current plan, the plan is automatically extended with a new `targetSegments` entry so the plan stays consistent with what was actually memorized.

**Deep linking**: the home page reads `searchParams` — `source`, `action=log`, `surahId`, `returnTo`. The mushaf detail page's "سجّل حفظًا" button links here as `/?source=surah&action=log&surahId=…&returnTo=…`, so logging from a surah opens the engine pre-targeted to that surah and returns the user where they came from when done.

### Mushaf list (`mushaf/page.tsx`)
A scrollable list of surahs with a toggle between **plan-only** and **all 114**. Each row shows the surah name, its coverage/strength, and links to the detail page.

### Mushaf detail (`mushaf/[surahId]/page.tsx`)
A single surah's page: a coverage **ring**, the list of memorized segments within it, an **add-segment** bottom sheet, a quick-review entry point, and the "سجّل حفظًا" button that deep-links into the home engine for this surah.

### Review (`review/page.tsx`)
Shows the three buckets (overdue / due / threatened) as grouped lists. Tapping starts a dark **ReviewRunner** overlay that walks through the selected segments with the rating buttons — the same rating logic as the session engine, but review-only.

### Progress (`progress/page.tsx`)
The dashboard: dual progress **rings**, the `MushafMap` (604-page grid colored by memorization state), the **pace planner** comparison, a consistency `DayGrid` (streak calendar built from daily logs), the `mostNeedySurahs` list, and a link to the journey timeline.

### Journey (`journey/` and `progress/journey/`)
Both render `JourneyView` — the chronological timeline of daily logs (what was reviewed/added/noted each day).

### Settings (`settings/page.tsx`)
The control center (~550 lines): profile area, **plan management** (rename/edit/expand the plan, swap targets), **daily rhythm** steppers (daily memorization goal + daily review goal), the **target-date** sheet, the **pace** sheet, and a **reset** action guarded by a confirmation that requires the user to type the word "تصفير" before wiping all data.

---

## 13. The end-to-end flow, narrated

1. **First open** → no plan → onboarding. The user picks content (juz/surahs/segments), a target date, and a daily pace. A plan is created and saved to localStorage.
2. **Each day** → home shows the greeting, today's ward (next thing to memorize + reviews due), the countdown to the target, and whether the pace is on track.
3. **Start session** → the engine reviews everything overdue/due/threatened (each review adjusts stability and reschedules via the rating), then offers a small bite of new memorization from the plan (auto-targeting the first uncovered ayahs), committed at a chosen memorization/meaning level.
4. **Behind the scenes** → each new segment starts with stability = memorization×25 and a next-review of tomorrow. Over the following days, `effectiveStability` decays if untouched, pulling segments back into the due/threatened buckets, which the next session surfaces.
5. **Over weeks** → the progress screen's rings, mushaf map, and pace card show the plan filling in; the journey timeline records the history; the pace planner keeps projecting the finish date against the target.
6. **When the plan is done** → home invites the user to expand the plan (add a juz/surah), and the cycle continues.

---

## 14. Design language

- **Aesthetic**: warm, calm, "paper and gold" — CSS variables like `--gold`, `--gold-deep`, `--gold-soft`, `--ink`, `--ink-muted`, `--paper`, `--paper-deep`, `--verdant` (green), `--due` (review-amber). Serif (Scheherazade) for Quranic display, sans (IBM Plex Arabic) for UI.
- **Motion**: subtle entrance animations (`.rise` with staggered `animationDelay`), `.press` tap feedback, and ring/bar transitions on long cubic-bezier easings.
- **Layout**: everything is built inside a phone-width shell, RTL, with safe-area insets respected (notch/home-bar padding via `env(safe-area-inset-*)`).
- **Tone of copy**: gentle, encouraging, religious register (وِرد، جزاك الله خيرًا، المسير حتى الهدف) — the app frames memorization as a calm daily journey rather than a productivity grind.

---

*That is the whole app: a local-first, Arabic, mobile spaced-repetition system for Quran memorization, built on a clean segment/plan/log data model, a decay-based review engine, a page-aware pace planner, and a guided daily session that always knows the next right thing to do.*
