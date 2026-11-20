import {
  MODEL_DEFINITIONS,
  type ModelId,
  type ModelSelection,
  type RestoreUnavailableError,
} from '../types/restoration';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.slice(dotIndex).toLowerCase();
}

export function validateImageFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidationResult {
  if (!file || !file.name) {
    return { valid: false, error: 'Please select a valid JPG, JPEG, or PNG image file.' };
  }

  const ext = getFileExtension(file.name);
  const normalizedType = file.type.toLowerCase();

  const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.has(ext);
  const hasValidMime =
    normalizedType === '' ? hasValidExtension : ALLOWED_IMAGE_MIME_TYPES.has(normalizedType);

  if (!hasValidExtension || !hasValidMime) {
    return {
      valid: false,
      error: `Unsupported file "${file.name}". Please upload a JPG, JPEG, or PNG image.`,
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected image file is empty.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the 10 MB upload limit.`,
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatInferenceTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export function buildDownloadFilename(originalFilename: string, modelId: ModelId): string {
  const baseName = originalFilename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeBase = baseName || 'vehicle_image';
  return `${safeBase}_restored_${modelId}.png`;
}

export function getSelectedModelNames(selection: ModelSelection): string[] {
  if (selection === 'all') {
    return MODEL_DEFINITIONS.map((m) => `${m.name} (${m.shortLabel})`);
  }
  const found = MODEL_DEFINITIONS.find((m) => m.id === selection);
  return found ? [`${found.name} (${found.shortLabel})`] : [];
}

export function clampSliderPercentage(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function normalizeRestoreError(
  statusCode: number,
  payload: unknown
): RestoreUnavailableError {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const code =
      obj.code === 'MODEL_UNAVAILABLE' ||
      obj.code === 'INVALID_INPUT' ||
      obj.code === 'BACKEND_ERROR'
        ? obj.code
        : statusCode === 503
          ? 'MODEL_UNAVAILABLE'
          : 'BACKEND_ERROR';
    const message =
      typeof obj.message === 'string' && obj.message.trim().length > 0
        ? obj.message
        : statusCode === 503
          ? 'The trained PyTorch restoration model is currently unavailable.'
          : 'Unable to process image restoration request.';
    const details = typeof obj.details === 'string' ? obj.details : undefined;
    const unavailableModels = Array.isArray(obj.unavailableModels)
      ? obj.unavailableModels.filter(
          (item): item is ModelId =>
            item === 'gan' || item === 'diffusion' || item === 'transformer'
        )
      : undefined;

    return {
      status: statusCode === 503 ? 'unavailable' : 'error',
      code,
      message,
      details,
      unavailableModels,
    };
  }

  return {
    status: statusCode === 503 ? 'unavailable' : 'error',
    code: statusCode === 503 ? 'MODEL_UNAVAILABLE' : 'BACKEND_ERROR',
    message:
      statusCode === 503
        ? 'Trained PyTorch models are not connected yet.'
        : 'Unexpected server error while contacting the restoration API.',
  };
}
