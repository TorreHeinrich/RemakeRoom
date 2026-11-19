import { SupportedAspectRatio } from '../types';

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

const ASPECT_RATIO_CANDIDATES: Array<{ label: SupportedAspectRatio; value: number }> = [
  { label: '1:1', value: 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
];

function detectClosestAspectRatio(width: number, height: number): SupportedAspectRatio {
  if (!width || !height) return '4:3';
  const ratio = width / height;
  let closest = ASPECT_RATIO_CANDIDATES[0];
  let minDiff = Math.abs(ratio - closest.value);

  for (const candidate of ASPECT_RATIO_CANDIDATES) {
    const diff = Math.abs(ratio - candidate.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candidate;
    }
  }
  return closest.label;
}

function resizeImageElement(img: HTMLImageElement): {
  dataUrl: string;
  aspectRatio: SupportedAspectRatio;
} {
  let { width, height } = img;
  const aspectRatio = detectClosestAspectRatio(width, height);

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width >= height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Bildverarbeitung im Browser nicht verfügbar.');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
    aspectRatio,
  };
}

export async function fileToCompressedImage(file: File): Promise<{
  dataUrl: string;
  aspectRatio: SupportedAspectRatio;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Bitte wählen Sie eine gültige Bilddatei (JPG, PNG oder WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Das Bild konnte nicht geladen werden.'));
      image.src = objectUrl;
    });
    return resizeImageElement(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const result = await fileToCompressedImage(file);
  return result.dataUrl;
}

export async function assetUrlToCompressedImage(assetUrl: string): Promise<{
  dataUrl: string;
  aspectRatio: SupportedAspectRatio;
}> {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error('Das Beispielbild konnte nicht geladen werden.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Das Beispielbild konnte nicht verarbeitet werden.'));
      image.src = objectUrl;
    });
    return resizeImageElement(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function assetUrlToCompressedDataUrl(assetUrl: string): Promise<string> {
  const result = await assetUrlToCompressedImage(assetUrl);
  return result.dataUrl;
}
