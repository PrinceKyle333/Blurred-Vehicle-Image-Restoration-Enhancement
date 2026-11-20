import type {
  ModelSelection,
  RestorationHistoryEntry,
  RestoredModelResult,
} from '../types/restoration';

export const HISTORY_STORAGE_KEY = 'vehicle_restoration_history_v1';
export const MAX_HISTORY_ENTRIES = 10;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function createHistoryEntry(params: {
  originalFilename: string;
  originalMimeType: string;
  originalSizeBytes: number;
  originalWidth: number | null;
  originalHeight: number | null;
  originalImageDataUrl: string;
  selectedModel: ModelSelection;
  totalElapsedMs: number;
  results: RestoredModelResult[];
  now?: Date;
  id?: string;
}): RestorationHistoryEntry {
  const timestamp = (params.now ?? new Date()).toISOString();
  const id =
    params.id ??
    `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    createdAt: timestamp,
    originalFilename: params.originalFilename,
    originalMimeType: params.originalMimeType,
    originalSizeBytes: params.originalSizeBytes,
    originalWidth: params.originalWidth,
    originalHeight: params.originalHeight,
    originalImageDataUrl: params.originalImageDataUrl,
    selectedModel: params.selectedModel,
    totalElapsedMs: params.totalElapsedMs,
    results: params.results,
  };
}

export function prependHistoryEntry(
  history: RestorationHistoryEntry[],
  entry: RestorationHistoryEntry,
  maxEntries: number = MAX_HISTORY_ENTRIES
): RestorationHistoryEntry[] {
  const filtered = history.filter((item) => item.id !== entry.id);
  return [entry, ...filtered].slice(0, Math.max(1, maxEntries));
}

export function removeHistoryEntry(
  history: RestorationHistoryEntry[],
  entryId: string
): RestorationHistoryEntry[] {
  return history.filter((item) => item.id !== entryId);
}

function isValidHistoryEntry(value: unknown): value is RestorationHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.originalFilename === 'string' &&
    typeof obj.originalImageDataUrl === 'string' &&
    Array.isArray(obj.results) &&
    obj.results.length > 0
  );
}

export function loadHistoryFromStorage(storage: StorageLike | null | undefined): RestorationHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHistoryEntry).slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveHistoryToStorage(
  storage: StorageLike | null | undefined,
  history: RestorationHistoryEntry[]
): RestorationHistoryEntry[] {
  if (!storage) return history;

  if (history.length === 0) {
    try {
      storage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore storage errors when clearing
    }
    return [];
  }

  let candidate = history.slice(0, MAX_HISTORY_ENTRIES);
  while (candidate.length > 0) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(candidate));
      return candidate;
    } catch {
      candidate = candidate.slice(0, -1);
    }
  }

  return [];
}

export function formatHistoryTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatHistoryModelSummary(entry: RestorationHistoryEntry): string {
  if (entry.selectedModel === 'all') {
    return `Compare All (${entry.results.length})`;
  }
  return entry.results[0]?.modelName ?? entry.selectedModel;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
