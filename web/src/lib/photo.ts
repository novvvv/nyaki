/**
 * 카드 사진 — 올리기 전에 브라우저에서 줄인다. 폰 사진(수 MB)을 그대로 올리지 않고
 * 긴 변 1000px webp(보통 100~200KB)로 바꾼다. 서버 한도는 2MB다.
 */

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = PHOTO_ACCEPT.split(",");
/** 고를 수 있는 원본 크기. 줄인 뒤 올리는 크기(서버 2MB)와는 따로다. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1000;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const PHOTO_MESSAGES = {
  type: "JPG, PNG, WebP 사진만 넣을 수 있어요.",
  size: "10MB보다 큰 사진은 넣을 수 없어요.",
  failed: "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
} as const;

export class PhotoError extends Error {}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) throw new PhotoError(PHOTO_MESSAGES.type);
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError(PHOTO_MESSAGES.size);

  let bitmap: ImageBitmap;
  try {
    // 폰 사진의 회전(EXIF)을 반영해서 읽는다.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(PHOTO_MESSAGES.type);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError(PHOTO_MESSAGES.failed);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // webp를 못 만드는 브라우저는 png를 돌려준다 — 그때는 jpeg로.
  let blob = await encode(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") {
    blob = await encode(canvas, "image/jpeg", 0.85);
  }
  if (!blob) throw new PhotoError(PHOTO_MESSAGES.failed);
  if (blob.size > MAX_UPLOAD_BYTES) {
    blob = await encode(canvas, "image/jpeg", 0.6);
    if (!blob || blob.size > MAX_UPLOAD_BYTES)
      throw new PhotoError(PHOTO_MESSAGES.size);
  }
  return blob;
}
