import assert from "node:assert/strict";
import test from "node:test";

import { validMp4Bytes } from "./media-test-fixtures.js";
import { isValidMp4 } from "./mp4-validation.js";

test("accepts a real one-frame H.264 MP4", () => {
  assert.equal(isValidMp4(validMp4Bytes()), true);
});

test("rejects truncated, missing-media, and non-video containers", () => {
  const valid = validMp4Bytes();
  assert.equal(isValidMp4(valid.slice(0, 300)), false);

  const withoutMedia = valid.slice(0, valid.indexOf(0x6d, 900));
  assert.equal(isValidMp4(withoutMedia), false);

  const audioOnly = valid.slice();
  const handler = Buffer.from(audioOnly).indexOf(Buffer.from("vide"));
  assert.ok(handler >= 0);
  audioOnly.set(new TextEncoder().encode("soun"), handler);
  assert.equal(isValidMp4(audioOnly), false);
});
