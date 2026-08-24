export const VALID_MP4_BASE64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMVbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAACgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAj90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAACgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAAoAAAAAAABAAAAAAG3bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAAgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABYm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAinoAAAAAAAAABhzdHRzAAAAAAAAAAEAAAABAAACAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAALFAAAAAQAAABRzdGNvAAAAAAAAAAEAAANFAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2Mi4xMi4xMDEAAAAIZnJlZQAAAs1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAAr//72c3wKa22xgQ==";

export function validMp4Bytes() {
  return new Uint8Array(Buffer.from(VALID_MP4_BASE64, "base64"));
}

function typeOffset(bytes: Uint8Array, type: string) {
  const offset = Buffer.from(bytes).indexOf(Buffer.from(type, "ascii"));
  if (offset < 4) throw new Error(`missing MP4 box: ${type}`);
  return offset;
}

export function mp4WithOneByteMdat() {
  const source = validMp4Bytes();
  const boxStart = typeOffset(source, "mdat") - 4;
  const result = new Uint8Array(boxStart + 9);
  result.set(source.subarray(0, boxStart + 8));
  new DataView(result.buffer).setUint32(boxStart, 9);
  result[boxStart + 8] = source[boxStart + 8];
  return result;
}

export function mp4WithZeroVideoSamples() {
  const result = validMp4Bytes();
  const stszType = typeOffset(result, "stsz");
  new DataView(result.buffer).setUint32(stszType + 12, 0);
  return result;
}

export function mp4WithOversizedVideoSample() {
  const result = validMp4Bytes();
  const stszType = typeOffset(result, "stsz");
  new DataView(result.buffer).setUint32(stszType + 8, 0xffffffff);
  return result;
}

export function mp4WithInvalidChunkOffset() {
  const result = validMp4Bytes();
  const stcoType = typeOffset(result, "stco");
  new DataView(result.buffer).setUint32(stcoType + 12, 0);
  return result;
}

function uint32(...values: number[]) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value));
  return bytes;
}

function uint64(...values: bigint[]) {
  const bytes = new Uint8Array(values.length * 8);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setBigUint64(index * 8, value));
  return bytes;
}

function concatenate(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function mp4Box(type: string, ...payload: Uint8Array[]) {
  const content = concatenate(...payload);
  const result = new Uint8Array(8 + content.byteLength);
  new DataView(result.buffer).setUint32(0, result.byteLength);
  result.set(new TextEncoder().encode(type), 4);
  result.set(content, 8);
  return result;
}

function compactSampleSizes(sizes: number[]) {
  return new Uint8Array(sizes);
}

type SyntheticMp4Options = {
  sampleSizes?: number[];
  chunkRelativeOffsets?: number[];
  absoluteChunkOffsets?: bigint[];
  mdatPayloadSize?: number;
  compactSizes?: boolean;
  useCo64?: boolean;
};

/** Minimal sample-table fixture for parser boundary tests; it is not a codec fixture. */
export function syntheticSampleTableMp4(options: SyntheticMp4Options = {}) {
  const sampleSizes = options.sampleSizes || [2, 2];
  const relativeOffsets = options.chunkRelativeOffsets || sampleSizes.map((_, index) => index * 2);
  const mdatPayloadSize = options.mdatPayloadSize ?? sampleSizes.reduce((total, size) => total + size, 0);
  const ftyp = mp4Box("ftyp", new TextEncoder().encode("isom"), uint32(0));
  const mdat = mp4Box("mdat", new Uint8Array(mdatPayloadSize).fill(0x80));

  const sizeTable = options.compactSizes
    ? mp4Box("stz2", uint32(0), new Uint8Array([0, 0, 0, 8]), uint32(sampleSizes.length), compactSampleSizes(sampleSizes))
    : mp4Box("stsz", uint32(0, 0, sampleSizes.length, ...sampleSizes));
  const sampleToChunk = mp4Box("stsc", uint32(0, 1, 1, 1, 1));

  const makeMoov = (chunkOffsets: bigint[]) => {
    const offsetTable = options.useCo64
      ? mp4Box("co64", uint32(0, chunkOffsets.length), uint64(...chunkOffsets))
      : mp4Box("stco", uint32(0, chunkOffsets.length, ...chunkOffsets.map(Number)));
    const sampleTable = mp4Box("stbl", sizeTable, sampleToChunk, offsetTable);
    const mediaInfo = mp4Box("minf", sampleTable);
    const handler = mp4Box("hdlr", uint32(0, 0), new TextEncoder().encode("vide"));
    return mp4Box("moov", mp4Box("trak", mp4Box("mdia", handler, mediaInfo)));
  };

  const placeholderOffsets = relativeOffsets.map(() => 0n);
  const placeholderMoov = makeMoov(placeholderOffsets);
  const mdatPayloadStart = BigInt(ftyp.byteLength + placeholderMoov.byteLength + 8);
  const chunkOffsets = options.absoluteChunkOffsets
    || relativeOffsets.map((offset) => mdatPayloadStart + BigInt(offset));
  const moov = makeMoov(chunkOffsets);
  return concatenate(ftyp, moov, mdat);
}
