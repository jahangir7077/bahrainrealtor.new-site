export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 40_000_000;
export const MAX_MEDIA_DIMENSION = 8_000;

const formats = {
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/webp': { extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

export type MediaType = keyof typeof formats;

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (length < 1 || data + length > bytes.length) return null;
    if (kind === 'VP8X' && length >= 10) {
      return {
        width: 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16),
        height: 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16),
      };
    }
    if (kind === 'VP8 ' && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      return { width: ((bytes[data + 6] | (bytes[data + 7] << 8)) & 0x3fff), height: ((bytes[data + 8] | (bytes[data + 9] << 8)) & 0x3fff) };
    }
    if (kind === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
      return {
        width: 1 + bytes[data + 1] + ((bytes[data + 2] & 0x3f) << 8),
        height: 1 + (bytes[data + 2] >> 6) + (bytes[data + 3] << 2) + ((bytes[data + 4] & 0x0f) << 10),
      };
    }
    offset = data + length + (length % 2);
  }
  return null;
}

function dimensions(type: MediaType, bytes: Uint8Array): { width: number; height: number } | null {
  if (type === 'image/png') {
    if (bytes.length < 24 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === 'image/jpeg') return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

export async function validateImage(file: File) {
  if (!(file.type in formats) || file.size < 1 || file.size > MAX_MEDIA_BYTES) return null;
  const type = file.type as MediaType;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = formats[type].signature;
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  const size = dimensions(type, bytes);
  if (!size || !Number.isSafeInteger(size.width) || !Number.isSafeInteger(size.height) ||
      size.width < 1 || size.height < 1 || size.width > MAX_MEDIA_DIMENSION ||
      size.height > MAX_MEDIA_DIMENSION || size.width * size.height > MAX_MEDIA_PIXELS) return null;
  return { type, extension: formats[type].extension, bytes, ...size };
}

export function safeObjectKey(itemId: string, revisionId: string, extension: string, randomId = crypto.randomUUID()) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(itemId) || !uuid.test(revisionId) || !uuid.test(randomId) || !['jpg', 'png', 'webp'].includes(extension)) {
    throw new Error('Invalid media key parts');
  }
  return `${itemId.toLowerCase()}/${revisionId.toLowerCase()}/${randomId.toLowerCase()}.${extension}`;
}
