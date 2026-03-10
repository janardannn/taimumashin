const THUMBNAIL_MAX_WIDTH = 300;
const WEBP_QUALITY = 0.7;
const JPEG_QUALITY = 0.7;

// Image extensions that can be rendered on a canvas
const CANVAS_SUPPORTED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
]);

/**
 * Returns true if the file is an image type we can generate a client-side
 * thumbnail for. HEIC/HEIF are excluded — Lambda handles those.
 */
export function canGenerateThumbnail(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return CANVAS_SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Generate a compressed thumbnail blob (~300px wide) from an image file.
 * Prefers WebP; falls back to JPEG for browsers that don't support WebP export.
 */
export async function generateImageThumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = THUMBNAIL_MAX_WIDTH / bitmap.width;
  const width = THUMBNAIL_MAX_WIDTH;
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2d context from OffscreenCanvas");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try WebP first, fall back to JPEG
  try {
    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: WEBP_QUALITY,
    });
    // Some browsers return a png when webp isn't supported — check mime
    if (blob.type === "image/webp") {
      return blob;
    }
  } catch {
    // WebP not supported, fall through
  }

  return canvas.convertToBlob({
    type: "image/jpeg",
    quality: JPEG_QUALITY,
  });
}
