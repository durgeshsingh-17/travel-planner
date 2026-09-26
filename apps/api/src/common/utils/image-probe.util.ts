export interface ImageInfo {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  extension: 'jpg' | 'png' | 'webp' | 'avif';
  width: number | null;
  height: number | null;
}

/**
 * Identifies an image from its bytes (never trust the client's Content-Type)
 * and reads its dimensions from the header where the format makes that cheap.
 */
export function probeImage(buffer: Buffer): ImageInfo | null {
  if (buffer.length < 16) {
    return null;
  }

  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return {
      mimeType: 'image/png',
      extension: 'png',
      width: buffer.length >= 24 ? buffer.readUInt32BE(16) : null,
      height: buffer.length >= 24 ? buffer.readUInt32BE(20) : null
    };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg', ...jpegSize(buffer) };
  }

  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp', extension: 'webp', ...webpSize(buffer) };
  }

  if (buffer.toString('ascii', 4, 8) === 'ftyp' && /avi[fs]/.test(buffer.toString('ascii', 8, 12))) {
    return { mimeType: 'image/avif', extension: 'avif', width: null, height: null };
  }

  return null;
}

function jpegSize(buffer: Buffer): { width: number | null; height: number | null } {
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    // Start-of-frame markers carry the dimensions (excluding DHT, JPG and DAC).
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }

  return { width: null, height: null };
}

function webpSize(buffer: Buffer): { width: number | null; height: number | null } {
  const chunk = buffer.toString('ascii', 12, 16);

  if (chunk === 'VP8X' && buffer.length >= 30) {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }

  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }

  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  return { width: null, height: null };
}
