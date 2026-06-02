import assert from "node:assert/strict"
import test from "node:test"
import { buildSelectedAyahRanges, getSelectedAyahCount, getSelectedSurahCount, getSurahSelectionState } from "./plan-selection"

test("selecting juz 27 produces synced full and partial surah states", () => {
  const selectedAyahRanges = buildSelectedAyahRanges({
    targetJuz: [27],
    targetSurahs: [],
    targetSegments: [],
  })

  const surah51 = getSurahSelectionState(51, selectedAyahRanges)
  const surah52 = getSurahSelectionState(52, selectedAyahRanges)
  const surah57 = getSurahSelectionState(57, selectedAyahRanges)
  const surah58 = getSurahSelectionState(58, selectedAyahRanges)

  assert.equal(surah51.kind, "partial")
  assert.equal(surah51.coveredAyahs, 30)
  assert.equal(surah51.totalAyahs, 60)

  assert.equal(surah52.kind, "full")
  assert.equal(surah52.coveredAyahs, 49)
  assert.equal(surah57.kind, "full")
  assert.equal(surah57.coveredAyahs, 29)

  assert.equal(surah58.kind, "none")
  assert.equal(surah58.coveredAyahs, 0)
  assert.equal(getSelectedSurahCount(selectedAyahRanges), 7)
})

test("selected ayah ranges dedupe overlapping juz, surah, and custom selections", () => {
  const selectedAyahRanges = buildSelectedAyahRanges({
    targetJuz: [27],
    targetSurahs: [56],
    targetSegments: [{ surahId: 51, fromAyah: 40, toAyah: 45 }],
  })

  assert.equal(getSelectedAyahCount(selectedAyahRanges), 399)
  assert.deepEqual(
    selectedAyahRanges.filter((range) => range.surahId === 51),
    [{ surahId: 51, fromAyah: 31, toAyah: 60 }]
  )
  assert.deepEqual(
    selectedAyahRanges.filter((range) => range.surahId === 56),
    [{ surahId: 56, fromAyah: 1, toAyah: 96 }]
  )
})
