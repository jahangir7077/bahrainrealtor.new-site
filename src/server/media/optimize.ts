import sharp from 'sharp';
import { MAX_MEDIA_PIXELS } from './validation.ts';

export const MAX_OPTIMIZED_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_DELIVERY_WIDTH = 1600;
export const MAX_DELIVERY_HEIGHT = 1200;

export async function optimizeImage(input: Uint8Array) {
  const source = sharp(input, {
    failOn: 'warning',
    limitInputPixels: MAX_MEDIA_PIXELS,
    sequentialRead: true,
  });
  const metadata = await source.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) !== 1) {
    throw new Error('Unsupported or animated image');
  }
  const { data, info } = await source
    .rotate()
    .resize({
      width: MAX_DELIVERY_WIDTH,
      height: MAX_DELIVERY_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  if (data.byteLength < 1 || data.byteLength > MAX_OPTIMIZED_MEDIA_BYTES ||
      info.width < 1 || info.height < 1 ||
      info.width > MAX_DELIVERY_WIDTH || info.height > MAX_DELIVERY_HEIGHT) {
    throw new Error('Optimized image exceeds configured limits');
  }
  return { bytes: data, width: info.width, height: info.height };
}
