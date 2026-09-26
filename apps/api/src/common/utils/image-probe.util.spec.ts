import { describe, expect, it } from 'vitest';

import { probeImage } from './image-probe.util';

// 1×1 transparent PNG and a 2×3 baseline JPEG header.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const jpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x03, 0x00, 0x02, 0x03, 0x01, 0x22,
  0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01
]);

describe('probeImage', () => {
  it('reads PNG type and size', () => {
    expect(probeImage(png)).toEqual({ mimeType: 'image/png', extension: 'png', width: 1, height: 1 });
  });

  it('reads JPEG type and size from the start-of-frame marker', () => {
    expect(probeImage(jpeg)).toEqual({ mimeType: 'image/jpeg', extension: 'jpg', width: 2, height: 3 });
  });

  it('rejects files that only claim to be images', () => {
    expect(probeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(probeImage(Buffer.from('GIF89a......................'))).toBeNull();
    expect(probeImage(Buffer.alloc(4))).toBeNull();
  });
});
