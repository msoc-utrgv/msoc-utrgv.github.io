// File uploads for the editor, including shrinking large photos before upload.
import { safeUrl } from '../core/dom.js';
import { api } from './api.js';

const MAX_DIMENSION = 2000;       // longest side in pixels
const SKIP_BELOW_BYTES = 300 * 1024;

export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

export function isImagePath(path) {
  return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(path ?? '');
}

/**
 * Phone photos and exported flyers are often 5-20 MB. Scale them down and
 * re-encode as WebP so pages stay fast; keep the original if that is not smaller.
 */
async function optimiseImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < SKIP_BELOW_BYTES) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
  // Browsers that cannot write WebP hand back a PNG instead.
  if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: blob.type });
}

// A file saved through the Worker takes about a minute to appear on the live
// site, so the editor shows its own copy of anything uploaded in this visit.
const localCopies = new Map();

export async function uploadFile(file, { folder, keepOriginal = false }) {
  const prepared = keepOriginal ? file : await optimiseImage(file);
  const path = await api.upload(folder, prepared);
  if (prepared.type.startsWith('image/')) localCopies.set(path, URL.createObjectURL(prepared));
  return path;
}

/** The address to use for showing a stored image inside the editor. */
export function displayUrl(path) {
  return localCopies.get(path) ?? safeUrl(path);
}

/** True when a drag event carries files from the computer (not a reorder drag). */
export function hasFiles(event) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}
