type Mp4Box = {
  type: string;
  payloadStart: number;
  end: number;
};

type SampleSizeTable = {
  count: number;
  sizeAt: (index: number) => number | null;
};

type SampleToChunkEntry = {
  firstChunk: number;
  samplesPerChunk: number;
};

type ByteRange = {
  start: number;
  end: number;
};

const textDecoder = new TextDecoder("ascii", { fatal: false });
const MAX_VIDEO_SAMPLES = 1_000_000;
const MAX_VIDEO_CHUNKS = 250_000;

function boxType(bytes: Uint8Array, start: number) {
  return textDecoder.decode(bytes.subarray(start + 4, start + 8));
}

function readBox(bytes: Uint8Array, start: number, limit: number): Mp4Box | null {
  if (start < 0 || limit > bytes.byteLength || limit - start < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size32 = view.getUint32(start);
  let headerSize = 8;
  let size = size32;

  if (size32 === 1) {
    if (limit - start < 16) return null;
    const extendedSize = view.getBigUint64(start + 8);
    if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size32 === 0) {
    size = limit - start;
  }

  if (!Number.isSafeInteger(size) || size < headerSize || size > limit - start) return null;
  return {
    type: boxType(bytes, start),
    payloadStart: start + headerSize,
    end: start + size,
  };
}

function readBoxes(bytes: Uint8Array, start: number, limit: number): Mp4Box[] | null {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < limit) {
    const box = readBox(bytes, offset, limit);
    if (!box || box.end <= offset) return null;
    boxes.push(box);
    offset = box.end;
  }
  return offset === limit ? boxes : null;
}

function safeAdd(left: number, right: number) {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || right < 0) return null;
  const result = left + right;
  return Number.isSafeInteger(result) ? result : null;
}

function parseSampleSizes(bytes: Uint8Array, box: Mp4Box): SampleSizeTable | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const payloadSize = box.end - box.payloadStart;

  if (box.type === "stsz") {
    if (payloadSize < 12) return null;
    const fixedSize = view.getUint32(box.payloadStart + 4);
    const count = view.getUint32(box.payloadStart + 8);
    const entriesStart = box.payloadStart + 12;
    if (fixedSize > 0) {
      if (entriesStart !== box.end) return null;
      return { count, sizeAt: () => fixedSize };
    }
    if (count > Math.floor((box.end - entriesStart) / 4)) return null;
    if (entriesStart + (count * 4) !== box.end) return null;
    return {
      count,
      sizeAt: (index) => index >= 0 && index < count
        ? view.getUint32(entriesStart + (index * 4))
        : null,
    };
  }

  if (box.type !== "stz2" || payloadSize < 12) return null;
  const fieldSize = bytes[box.payloadStart + 7];
  const count = view.getUint32(box.payloadStart + 8);
  const entriesStart = box.payloadStart + 12;
  if (fieldSize !== 4 && fieldSize !== 8 && fieldSize !== 16) return null;
  const entryBytes = fieldSize === 4 ? Math.ceil(count / 2) : count * (fieldSize / 8);
  if (!Number.isSafeInteger(entryBytes) || entriesStart + entryBytes !== box.end) return null;

  return {
    count,
    sizeAt: (index) => {
      if (index < 0 || index >= count) return null;
      if (fieldSize === 4) {
        const packed = bytes[entriesStart + Math.floor(index / 2)];
        return index % 2 === 0 ? packed >> 4 : packed & 0x0f;
      }
      if (fieldSize === 8) return bytes[entriesStart + index];
      return view.getUint16(entriesStart + (index * 2));
    },
  };
}

function parseSampleToChunk(bytes: Uint8Array, box: Mp4Box) {
  const payloadSize = box.end - box.payloadStart;
  if (payloadSize < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(box.payloadStart + 4);
  const entriesStart = box.payloadStart + 8;
  if (count === 0 || count > Math.floor((box.end - entriesStart) / 12)) return null;
  if (entriesStart + (count * 12) !== box.end) return null;

  const entries: SampleToChunkEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = entriesStart + (index * 12);
    const firstChunk = view.getUint32(offset);
    const samplesPerChunk = view.getUint32(offset + 4);
    const sampleDescriptionIndex = view.getUint32(offset + 8);
    if (firstChunk === 0 || samplesPerChunk === 0 || sampleDescriptionIndex === 0) return null;
    if (index === 0 && firstChunk !== 1) return null;
    if (entries.length > 0 && firstChunk <= entries[entries.length - 1].firstChunk) return null;
    entries.push({ firstChunk, samplesPerChunk });
  }
  return entries;
}

function parseChunkOffsets(bytes: Uint8Array, box: Mp4Box) {
  const payloadSize = box.end - box.payloadStart;
  if (payloadSize < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(box.payloadStart + 4);
  const entriesStart = box.payloadStart + 8;
  const width = box.type === "co64" ? 8 : 4;
  if (count === 0 || count > Math.floor((box.end - entriesStart) / width)) return null;
  if (entriesStart + (count * width) !== box.end) return null;

  const offsets: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = entriesStart + (index * width);
    if (box.type === "co64") {
      const value = view.getBigUint64(offset);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      offsets.push(Number(value));
    } else {
      offsets.push(view.getUint32(offset));
    }
  }
  return offsets;
}

function containsRange(mediaData: Mp4Box[], start: number, end: number) {
  return mediaData.some((box) => start >= box.payloadStart && end <= box.end);
}

function validateSampleTable(bytes: Uint8Array, table: Mp4Box, mediaData: Mp4Box[]) {
  const children = readBoxes(bytes, table.payloadStart, table.end);
  if (!children) return false;

  const sizeBoxes = children.filter((box) => box.type === "stsz" || box.type === "stz2");
  const chunkMaps = children.filter((box) => box.type === "stsc");
  const offsetBoxes = children.filter((box) => box.type === "stco" || box.type === "co64");
  if (sizeBoxes.length !== 1 || chunkMaps.length !== 1 || offsetBoxes.length !== 1) return false;

  const sampleSizes = parseSampleSizes(bytes, sizeBoxes[0]);
  const sampleToChunk = parseSampleToChunk(bytes, chunkMaps[0]);
  const chunkOffsets = parseChunkOffsets(bytes, offsetBoxes[0]);
  if (!sampleSizes || !sampleToChunk || !chunkOffsets || sampleSizes.count === 0) return false;
  if (sampleSizes.count > MAX_VIDEO_SAMPLES || chunkOffsets.length > MAX_VIDEO_CHUNKS) return false;

  let mediaPayloadBytes = 0;
  for (const box of mediaData) {
    const next = safeAdd(mediaPayloadBytes, box.end - box.payloadStart);
    if (next === null) return false;
    mediaPayloadBytes = next;
  }
  if (sampleSizes.count > mediaPayloadBytes || chunkOffsets.length > sampleSizes.count) return false;
  if (sampleToChunk[sampleToChunk.length - 1].firstChunk > chunkOffsets.length) return false;

  const chunkRanges: ByteRange[] = [];
  let sampleIndex = 0;
  let mapIndex = 0;
  for (let chunkIndex = 1; chunkIndex <= chunkOffsets.length; chunkIndex += 1) {
    while (mapIndex + 1 < sampleToChunk.length
      && sampleToChunk[mapIndex + 1].firstChunk <= chunkIndex) {
      mapIndex += 1;
    }
    const samplesPerChunk = sampleToChunk[mapIndex].samplesPerChunk;
    if (samplesPerChunk > sampleSizes.count - sampleIndex) return false;

    const chunkStart = chunkOffsets[chunkIndex - 1];
    let cursor = chunkStart;
    for (let inChunk = 0; inChunk < samplesPerChunk; inChunk += 1) {
      const size = sampleSizes.sizeAt(sampleIndex);
      if (size === null || size <= 0) return false;
      const end = safeAdd(cursor, size);
      if (end === null || !containsRange(mediaData, cursor, end)) return false;
      cursor = end;
      sampleIndex += 1;
    }
    chunkRanges.push({ start: chunkStart, end: cursor });
  }
  if (sampleIndex !== sampleSizes.count) return false;

  chunkRanges.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < chunkRanges.length; index += 1) {
    if (chunkRanges[index].start < chunkRanges[index - 1].end) return false;
  }
  return true;
}

function handlerType(bytes: Uint8Array, box: Mp4Box) {
  if (box.end - box.payloadStart < 12) return "";
  return textDecoder.decode(bytes.subarray(box.payloadStart + 8, box.payloadStart + 12));
}

function hasCompleteVideoSamples(bytes: Uint8Array, moov: Mp4Box, mediaData: Mp4Box[]) {
  const moovChildren = readBoxes(bytes, moov.payloadStart, moov.end);
  if (!moovChildren) return false;
  let videoTrackCount = 0;

  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const trakChildren = readBoxes(bytes, trak.payloadStart, trak.end);
    if (!trakChildren) return false;
    for (const mdia of trakChildren.filter((box) => box.type === "mdia")) {
      const mdiaChildren = readBoxes(bytes, mdia.payloadStart, mdia.end);
      if (!mdiaChildren) return false;
      if (!mdiaChildren.some((box) => box.type === "hdlr" && handlerType(bytes, box) === "vide")) {
        continue;
      }
      videoTrackCount += 1;
      const minfBoxes = mdiaChildren.filter((box) => box.type === "minf");
      if (minfBoxes.length !== 1) return false;
      const minfChildren = readBoxes(bytes, minfBoxes[0].payloadStart, minfBoxes[0].end);
      if (!minfChildren) return false;
      const sampleTables = minfChildren.filter((box) => box.type === "stbl");
      if (sampleTables.length !== 1 || !validateSampleTable(bytes, sampleTables[0], mediaData)) {
        return false;
      }
    }
  }
  return videoTrackCount > 0;
}

/**
 * Validate the bounded MP4 container and declared video sample ranges available
 * inside a Worker. This deliberately does not claim codec decoding or playback
 * quality; the local release gate verifies those separately with ffprobe and a
 * browser.
 */
export function isValidMp4(bytes: Uint8Array) {
  const topLevel = readBoxes(bytes, 0, bytes.byteLength);
  if (!topLevel) return false;

  const ftyp = topLevel.find((box) => box.type === "ftyp");
  const moov = topLevel.find((box) => box.type === "moov");
  const mediaData = topLevel.filter((box) => box.type === "mdat");
  if (!ftyp || ftyp.end - ftyp.payloadStart < 8 || !moov) return false;
  if (!mediaData.some((box) => box.end > box.payloadStart)) return false;
  return hasCompleteVideoSamples(bytes, moov, mediaData);
}
