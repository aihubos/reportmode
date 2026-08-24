const EBML_ID = 0x1a45dfa3;
const SEGMENT_ID = 0x18538067;
const DOC_TYPE_ID = 0x4282;
const INFO_ID = 0x1549a966;
const SEEK_HEAD_ID = 0x114d9b74;
const TRACKS_ID = 0x1654ae6b;
const TRACK_ENTRY_ID = 0xae;
const TRACK_NUMBER_ID = 0xd7;
const TRACK_TYPE_ID = 0x83;
const CODEC_ID = 0x86;
const VIDEO_ID = 0xe0;
const CLUSTER_ID = 0x1f43b675;
const SIMPLE_BLOCK_ID = 0xa3;
const BLOCK_GROUP_ID = 0xa0;
const BLOCK_ID = 0xa1;
const CUES_ID = 0x1c53bb6b;
const ATTACHMENTS_ID = 0x1941a469;
const CHAPTERS_ID = 0x1043a770;
const TAGS_ID = 0x1254c367;
const VOID_ID = 0xec;
const CRC32_ID = 0xbf;

const MAX_EBML_DEPTH = 32;
const MAX_EBML_ELEMENTS = 200_000;

const MASTER_IDS = new Set([
  EBML_ID,
  SEGMENT_ID,
  SEEK_HEAD_ID,
  0x4dbb, // Seek
  INFO_ID,
  CLUSTER_ID,
  TRACKS_ID,
  TRACK_ENTRY_ID,
  VIDEO_ID,
  BLOCK_GROUP_ID,
  CUES_ID,
  0xbb, // CuePoint
  0xb7, // CueTrackPositions
  ATTACHMENTS_ID,
  0x61a7, // AttachedFile
  CHAPTERS_ID,
  0x45b9, // EditionEntry
  0xb6, // ChapterAtom
  TAGS_ID,
  0x7373, // Tag
  0x67c8, // SimpleTag
]);

// Unknown-sized master elements are bounded by the next element at their
// parent level. These are the IDs that can legally follow a Cluster in a
// Segment. Block payloads are skipped by their finite element size, so an ID
// embedded in a block cannot accidentally terminate an unknown Cluster.
const SEGMENT_LEVEL_IDS = new Set([
  SEEK_HEAD_ID,
  INFO_ID,
  CLUSTER_ID,
  TRACKS_ID,
  CUES_ID,
  ATTACHMENTS_ID,
  CHAPTERS_ID,
  TAGS_ID,
  VOID_ID,
  CRC32_ID,
]);

class InvalidEbml extends Error {}

type IdInfo = {
  value: number;
  length: number;
};

type SizeInfo = {
  length: number;
  value: number;
  unknown: boolean;
};

type TrackState = {
  trackNumber: number | null;
  trackType: number | null;
  codecId: string;
  hasVideo: boolean;
};

type FrameCandidate = {
  trackNumber: number;
  start: number;
  end: number;
};

type ValidationState = {
  docTypeWebm: boolean;
  hasTracks: boolean;
  hasVideoTrack: boolean;
  videoTrackCodecs: Map<number, string>;
  frameCandidates: FrameCandidate[];
  hasCluster: boolean;
  elementCount: number;
};

type WalkContext = {
  kind: "generic" | "ebml" | "segment" | "tracks" | "track-entry" | "video" | "cluster" | "block-group";
  track?: TrackState;
};

function invalid(): never {
  throw new InvalidEbml();
}

function readElementId(bytes: Uint8Array, offset: number, end: number): IdInfo {
  if (offset >= end || offset >= bytes.byteLength) invalid();
  const first = bytes[offset];
  if (first === 0) invalid();
  let mask = 0x80;
  let length = 1;
  while (length <= 4 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 4 || offset + length > end) invalid();

  let value = first;
  for (let index = 1; index < length; index += 1) value = value * 0x100 + bytes[offset + index];
  return { value, length };
}

function readElementSize(bytes: Uint8Array, offset: number, end: number): SizeInfo {
  if (offset >= end || offset >= bytes.byteLength) invalid();
  const first = bytes[offset];
  if (first === 0) invalid();
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > end) invalid();

  let value = BigInt(first & (mask - 1));
  for (let index = 1; index < length; index += 1) value = value * 0x100n + BigInt(bytes[offset + index]);
  const unknown = value === (1n << BigInt(length * 7)) - 1n;
  if (unknown) return { length, value: 0, unknown: true };
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
  return { length, value: Number(value), unknown: false };
}

function decodeUtf8(bytes: Uint8Array, start: number, end: number): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start, end));
  } catch {
    invalid();
  }
}

function unsignedValue(bytes: Uint8Array, start: number, end: number): number {
  const length = end - start;
  if (length < 1 || length > 8) invalid();
  let value = 0n;
  for (let index = start; index < end; index += 1) value = value * 0x100n + BigInt(bytes[index]);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
  return Number(value);
}

function childContext(context: WalkContext, id: number): WalkContext {
  if (id === EBML_ID) return { kind: "ebml" };
  if (id === SEGMENT_ID) return { kind: "segment" };
  if (context.kind === "segment" && id === TRACKS_ID) return { kind: "tracks" };
  if (context.kind === "tracks" && id === TRACK_ENTRY_ID) {
    return {
      kind: "track-entry",
      track: { trackNumber: null, trackType: null, codecId: "", hasVideo: false },
    };
  }
  if (context.kind === "track-entry" && id === VIDEO_ID) return { kind: "video" };
  if (context.kind === "segment" && id === CLUSTER_ID) return { kind: "cluster" };
  if (context.kind === "cluster" && id === BLOCK_GROUP_ID) return { kind: "block-group" };
  return { kind: "generic" };
}

function blockFrame(bytes: Uint8Array, payloadStart: number, payloadEnd: number): FrameCandidate {
  const track = readElementSize(bytes, payloadStart, payloadEnd);
  if (track.unknown || !Number.isInteger(track.value) || track.value <= 0) invalid();

  const timecodeStart = payloadStart + track.length;
  const flagsOffset = timecodeStart + 2;
  const frameStart = flagsOffset + 1;
  if (flagsOffset >= payloadEnd || frameStart >= payloadEnd) invalid();

  // WebM video produced by the browser path is not laced. Reject laced video
  // blocks here instead of mistaking lace metadata for encoded frame bytes.
  if ((bytes[flagsOffset] & 0x06) !== 0) invalid();
  return { trackNumber: track.value, start: frameStart, end: payloadEnd };
}

function hasPlausibleFrame(bytes: Uint8Array, candidate: FrameCandidate, codecId: string): boolean {
  const length = candidate.end - candidate.start;
  if (length < 3) return false;

  if (codecId === "V_VP8") {
    if (length < 10) return false;
    const frameTag = bytes[candidate.start]
      | (bytes[candidate.start + 1] << 8)
      | (bytes[candidate.start + 2] << 16);
    const isKeyFrame = (frameTag & 0x01) === 0;
    const firstPartitionSize = (frameTag >>> 5) & 0x7ffff;
    const width = (bytes[candidate.start + 6] | (bytes[candidate.start + 7] << 8)) & 0x3fff;
    const height = (bytes[candidate.start + 8] | (bytes[candidate.start + 9] << 8)) & 0x3fff;
    return isKeyFrame
      && firstPartitionSize > 0
      && length >= 10 + firstPartitionSize
      && bytes[candidate.start + 3] === 0x9d
      && bytes[candidate.start + 4] === 0x01
      && bytes[candidate.start + 5] === 0x2a
      && width > 0
      && height > 0;
  }

  if (codecId === "V_VP9") {
    let bitOffset = candidate.start * 8;
    const endBit = candidate.end * 8;
    const readBits = (count: number) => {
      if (count < 1 || count > 24 || bitOffset + count > endBit) return null;
      let value = 0;
      for (let index = 0; index < count; index += 1) {
        const byte = bytes[Math.floor(bitOffset / 8)];
        value = value * 2 + ((byte >> (7 - (bitOffset % 8))) & 0x01);
        bitOffset += 1;
      }
      return value;
    };

    if (readBits(2) !== 0x02) return false;
    const profileLow = readBits(1);
    const profileHigh = readBits(1);
    if (profileLow === null || profileHigh === null) return false;
    const profile = profileLow | (profileHigh << 1);
    // Profile 3 adds a reserved bit and is outside the browser output contract.
    if (profile === 3) return false;
    if (readBits(1) !== 0 || readBits(1) !== 0) return false; // show-existing, frame-type
    if (readBits(1) === null || readBits(1) === null) return false; // show-frame, error-resilient
    if (readBits(24) !== 0x498342) return false;

    if (profile >= 2 && readBits(1) === null) return false; // bit depth
    const colorSpace = readBits(3);
    if (colorSpace === null) return false;
    if (colorSpace === 7) {
      if (profile !== 1 || readBits(1) !== 0) return false;
    } else {
      if (readBits(1) === null) return false; // color range
      if (profile === 1 && (readBits(1) === null || readBits(1) === null || readBits(1) !== 0)) return false;
    }

    const widthMinusOne = readBits(16);
    const heightMinusOne = readBits(16);
    if (widthMinusOne === null || heightMinusOne === null) return false;
    const renderSizeDifferent = readBits(1);
    if (renderSizeDifferent === null) return false;
    if (renderSizeDifferent === 1 && (readBits(16) === null || readBits(16) === null)) return false;

    // A parsed uncompressed header alone is not an encoded frame. Keep at
    // least two bytes for the compressed header/data without claiming decode.
    return endBit - bitOffset >= 16;
  }
  return false;
}

function processElement(
  bytes: Uint8Array,
  context: WalkContext,
  id: number,
  payloadStart: number,
  payloadEnd: number,
  state: ValidationState,
) {
  if (context.kind === "ebml" && id === DOC_TYPE_ID) {
    if (decodeUtf8(bytes, payloadStart, payloadEnd) !== "webm") invalid();
    state.docTypeWebm = true;
  }

  if (context.kind === "segment") {
    if (id === TRACKS_ID) state.hasTracks = true;
    if (id === CLUSTER_ID) state.hasCluster = true;
  }

  if (context.kind === "track-entry" && context.track) {
    if (id === TRACK_NUMBER_ID) {
      const trackNumber = unsignedValue(bytes, payloadStart, payloadEnd);
      if (!Number.isInteger(trackNumber) || trackNumber <= 0) invalid();
      context.track.trackNumber = trackNumber;
    }
    if (id === TRACK_TYPE_ID) context.track.trackType = unsignedValue(bytes, payloadStart, payloadEnd);
    if (id === CODEC_ID) {
      const codec = decodeUtf8(bytes, payloadStart, payloadEnd);
      context.track.codecId = codec.trim();
    }
    if (id === VIDEO_ID) context.track.hasVideo = true;
  }

  if (context.kind === "cluster" && id === SIMPLE_BLOCK_ID) {
    state.frameCandidates.push(blockFrame(bytes, payloadStart, payloadEnd));
  }
  if (context.kind === "block-group" && id === BLOCK_ID) {
    state.frameCandidates.push(blockFrame(bytes, payloadStart, payloadEnd));
  }
}

function walkRange(
  bytes: Uint8Array,
  start: number,
  end: number,
  context: WalkContext,
  state: ValidationState,
  depth: number,
  stopIds: Set<number>,
): number {
  if (depth > MAX_EBML_DEPTH || start > end || end > bytes.byteLength) invalid();
  let offset = start;

  while (offset < end) {
    state.elementCount += 1;
    if (state.elementCount > MAX_EBML_ELEMENTS) invalid();

    const idInfo = readElementId(bytes, offset, end);
    if (stopIds.has(idInfo.value)) return offset;
    const sizeInfo = readElementSize(bytes, offset + idInfo.length, end);
    const payloadStart = offset + idInfo.length + sizeInfo.length;
    let payloadEnd: number;

    if (sizeInfo.unknown) {
      if (idInfo.value !== SEGMENT_ID && idInfo.value !== CLUSTER_ID) invalid();
      const nestedContext = childContext(context, idInfo.value);
      const nestedStopIds = idInfo.value === CLUSTER_ID ? SEGMENT_LEVEL_IDS : new Set<number>();
      payloadEnd = walkRange(bytes, payloadStart, end, nestedContext, state, depth + 1, nestedStopIds);
    } else {
      payloadEnd = payloadStart + sizeInfo.value;
      if (payloadEnd > end) invalid();
    }

    processElement(bytes, context, idInfo.value, payloadStart, payloadEnd, state);

    if (!sizeInfo.unknown && MASTER_IDS.has(idInfo.value)) {
      const nestedContext = childContext(context, idInfo.value);
      walkRange(bytes, payloadStart, payloadEnd, nestedContext, state, depth + 1, new Set<number>());
      if (nestedContext.kind === "track-entry" && nestedContext.track
        && nestedContext.track.trackNumber !== null
        && nestedContext.track.trackType === 1
        && nestedContext.track.codecId
        && nestedContext.track.hasVideo) {
        state.hasVideoTrack = true;
        state.videoTrackCodecs.set(nestedContext.track.trackNumber, nestedContext.track.codecId);
      }
    }

    offset = payloadEnd;
  }
  return offset;
}

function readRootElement(bytes: Uint8Array, offset: number, end: number) {
  const idInfo = readElementId(bytes, offset, end);
  const sizeInfo = readElementSize(bytes, offset + idInfo.length, end);
  const payloadStart = offset + idInfo.length + sizeInfo.length;
  const payloadEnd = sizeInfo.unknown ? end : payloadStart + sizeInfo.value;
  if (payloadEnd > end) invalid();
  return { id: idInfo.value, payloadStart, payloadEnd, unknown: sizeInfo.unknown };
}

/**
 * Validates the complete stored object as a bounded WebM/EBML structure.
 * The boolean result intentionally does not expose parser details to clients.
 */
export function isValidWebm(bytes: Uint8Array): boolean {
  try {
    if (!bytes.byteLength) return false;
    const state: ValidationState = {
      docTypeWebm: false,
      hasTracks: false,
      hasVideoTrack: false,
      videoTrackCodecs: new Map<number, string>(),
      frameCandidates: [],
      hasCluster: false,
      elementCount: 0,
    };

    const header = readRootElement(bytes, 0, bytes.byteLength);
    if (header.id !== EBML_ID || header.unknown) return false;
    walkRange(bytes, header.payloadStart, header.payloadEnd, { kind: "ebml" }, state, 0, new Set<number>());

    const segment = readRootElement(bytes, header.payloadEnd, bytes.byteLength);
    if (segment.id !== SEGMENT_ID) return false;
    // A WebM object has one Segment occupying the rest of the stored bytes.
    // Unknown-sized Segments are represented by a size of all 1 bits and are
    // bounded by the R2 object's end.
    if (segment.payloadEnd !== bytes.byteLength) return false;
    const segmentPayloadEnd = segment.payloadEnd;
    walkRange(bytes, segment.payloadStart, segmentPayloadEnd, { kind: "segment" }, state, 0, new Set<number>());

    const hasVideoFrame = state.frameCandidates.some((candidate) => {
      const codecId = state.videoTrackCodecs.get(candidate.trackNumber);
      return codecId ? hasPlausibleFrame(bytes, candidate, codecId) : false;
    });
    return state.docTypeWebm
      && state.hasTracks
      && state.hasVideoTrack
      && state.hasCluster
      && hasVideoFrame;
  } catch {
    return false;
  }
}
