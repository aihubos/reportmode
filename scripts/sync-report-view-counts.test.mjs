import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCounts } from "./sync-report-view-counts.mjs";

test("normalizes only non-negative integer view counts in stable key order", () => {
  assert.deepEqual(
    normalizeCounts({
      zeta: 3,
      alpha: 0,
    }),
    { alpha: 0, zeta: 3 },
  );
});

test("rejects malformed view count payloads", () => {
  assert.throws(() => normalizeCounts(null), /object/);
  assert.throws(() => normalizeCounts({ sample: -1 }), /non-negative integer/);
  assert.throws(() => normalizeCounts({ sample: "4" }), /non-negative integer/);
  assert.throws(() => normalizeCounts({ sample: 1.5 }), /non-negative integer/);
  assert.throws(() => normalizeCounts({ sample: Number.POSITIVE_INFINITY }), /non-negative integer/);
});
