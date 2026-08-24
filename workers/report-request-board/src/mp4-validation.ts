type Mp4Box = {
  type: string;
  payloadStart: number;
  end: number;
};

const textDecoder = new TextDecoder("ascii", { fatal: false });

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

  if (size < headerSize || start + size > limit) return null;
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

function hasVideoHandler(bytes: Uint8Array, moov: Mp4Box) {
  const moovChildren = readBoxes(bytes, moov.payloadStart, moov.end);
  if (!moovChildren) return false;

  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const trakChildren = readBoxes(bytes, trak.payloadStart, trak.end);
    if (!trakChildren) continue;
    for (const mdia of trakChildren.filter((box) => box.type === "mdia")) {
      const mdiaChildren = readBoxes(bytes, mdia.payloadStart, mdia.end);
      if (!mdiaChildren) continue;
      for (const handler of mdiaChildren.filter((box) => box.type === "hdlr")) {
        // hdlr is a FullBox: version/flags (4), pre_defined (4), handler_type (4).
        if (handler.end - handler.payloadStart < 12) continue;
        const handlerType = textDecoder.decode(
          bytes.subarray(handler.payloadStart + 8, handler.payloadStart + 12),
        );
        if (handlerType === "vide") return true;
      }
    }
  }
  return false;
}

/**
 * Validate the bounded MP4 container structure available inside a Worker.
 * This deliberately does not claim codec decoding or playback quality; the
 * local release gate verifies those separately with ffprobe and a browser.
 */
export function isValidMp4(bytes: Uint8Array) {
  const topLevel = readBoxes(bytes, 0, bytes.byteLength);
  if (!topLevel) return false;

  const ftyp = topLevel.find((box) => box.type === "ftyp");
  const moov = topLevel.find((box) => box.type === "moov");
  const mediaData = topLevel.filter((box) => box.type === "mdat");
  if (!ftyp || ftyp.end - ftyp.payloadStart < 8 || !moov) return false;
  if (!mediaData.some((box) => box.end > box.payloadStart)) return false;
  return hasVideoHandler(bytes, moov);
}
