const EBML_ID = 0x1a45dfa3;
const SEGMENT_ID = 0x18538067;
const DOC_TYPE_ID = 0x4282;
const INFO_ID = 0x1549a966;
const SEEK_HEAD_ID = 0x114d9b74;
const TRACKS_ID = 0x1654ae6b;
const TRACK_ENTRY_ID = 0xae;
const TRACK_TYPE_ID = 0x83;
const CODEC_ID = 0x86;
const VIDEO_ID = 0xe0;
const CLUSTER_ID = 0x1f43b675;
const SIMPLE_BLOCK_ID = 0xa3;
const BLOCK_GROUP_ID = 0xa0;
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
  trackType: number | null;
  hasCodec: boolean;
  hasVideo: boolean;
};

type ValidationState = {
  docTypeWebm: boolean;
  hasTracks: boolean;
  hasVideoTrack: boolean;
  hasCluster: boolean;
  hasBlock: boolean;
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
    return { kind: "track-entry", track: { trackType: null, hasCodec: false, hasVideo: false } };
  }
  if (context.kind === "track-entry" && id === VIDEO_ID) return { kind: "video" };
  if (context.kind === "segment" && id === CLUSTER_ID) return { kind: "cluster" };
  if (context.kind === "cluster" && id === BLOCK_GROUP_ID) return { kind: "block-group" };
  return { kind: "generic" };
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
    if (id === TRACK_TYPE_ID) context.track.trackType = unsignedValue(bytes, payloadStart, payloadEnd);
    if (id === CODEC_ID) {
      const codec = decodeUtf8(bytes, payloadStart, payloadEnd);
      context.track.hasCodec = codec.trim().length > 0;
    }
    if (id === VIDEO_ID) context.track.hasVideo = true;
  }

  if (context.kind === "cluster") {
    if (id === SIMPLE_BLOCK_ID) {
      // A SimpleBlock must contain at least a TrackNumber VINT, Timecode, and
      // Flags before its encoded frame payload.
      if (payloadEnd - payloadStart < 4) invalid();
      state.hasBlock = true;
    }
    if (id === BLOCK_GROUP_ID) state.hasBlock = true;
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
        && nestedContext.track.trackType === 1
        && nestedContext.track.hasCodec
        && nestedContext.track.hasVideo) {
        state.hasVideoTrack = true;
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
      hasCluster: false,
      hasBlock: false,
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

    return state.docTypeWebm
      && state.hasTracks
      && state.hasVideoTrack
      && state.hasCluster
      && state.hasBlock;
  } catch {
    return false;
  }
}
