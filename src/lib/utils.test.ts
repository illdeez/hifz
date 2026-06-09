import test from "node:test"
import assert from "node:assert/strict"

import { describePagesAr } from "./utils"

test("describePagesAr always returns a numeric value with a صفحة unit", () => {
  for (const input of [0, 0.286, 0.7, 1.1, 4.13]) {
    assert.equal(describePagesAr(input).unit, "صفحة")
  }
})

test("describePagesAr rounds to the nearest quarter page", () => {
  // 4.13 → 4.25, formatted with the Arabic decimal separator.
  assert.equal(describePagesAr(4.13).text, new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(4.25))
  assert.equal(describePagesAr(0.7).text, new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(0.75))
  assert.equal(describePagesAr(2.4).text, new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(2.5))
})
