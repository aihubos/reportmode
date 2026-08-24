import assert from "node:assert/strict";
import test from "node:test";

import {
  mp4WithInvalidChunkOffset,
  mp4WithOneByteMdat,
  mp4WithOversizedVideoSample,
  mp4WithZeroVideoSamples,
  syntheticSampleTableMp4,
  validMp4Bytes,
} from "./media-test-fixtures.js";
import { isValidMp4 } from "./mp4-validation.js";

test("accepts a real one-frame H.264 MP4", () => {
  assert.equal(isValidMp4(validMp4Bytes()), true);
});

test("accepts compact sample sizes and 64-bit chunk offsets", () => {
  assert.equal(isValidMp4(syntheticSampleTableMp4({ compactSizes: true, useCo64: true })), true);
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

test("rejects declared samples that are absent or outside mdat", () => {
  assert.equal(isValidMp4(mp4WithOneByteMdat()), false);
  assert.equal(isValidMp4(mp4WithZeroVideoSamples()), false);
  assert.equal(isValidMp4(mp4WithOversizedVideoSample()), false);
  assert.equal(isValidMp4(mp4WithInvalidChunkOffset()), false);
});

test("rejects overlapping and unsafe 64-bit sample ranges", () => {
  const overlapping = syntheticSampleTableMp4({
    sampleSizes: [2, 2],
    chunkRelativeOffsets: [0, 1],
    mdatPayloadSize: 4,
  });
  assert.equal(isValidMp4(overlapping), false);

  const unsafeOffset = syntheticSampleTableMp4({
    sampleSizes: [2],
    absoluteChunkOffsets: [BigInt(Number.MAX_SAFE_INTEGER) + 1n],
    mdatPayloadSize: 2,
    useCo64: true,
  });
  assert.equal(isValidMp4(unsafeOffset), false);
});
