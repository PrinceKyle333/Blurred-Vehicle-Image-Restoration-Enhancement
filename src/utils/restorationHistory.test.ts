import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistoryEntry,
  formatHistoryModelSummary,
  formatHistoryTimestamp,
  HISTORY_STORAGE_KEY,
  loadHistoryFromStorage,
  prependHistoryEntry,
  removeHistoryEntry,
  saveHistoryToStorage,
  type StorageLike,
} from './restorationHistory';

function createMemoryStorage(maxBytes?: number): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (typeof maxBytes === 'number' && value.length > maxBytes) {
        throw new Error('QuotaExceededError');
      }
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function makeSampleEntry(id: string, model: 'gan' | 'all' = 'gan') {
  return createHistoryEntry({
    id,
    now: new Date('2026-11-20T08:10:00.000Z'),
    originalFilename: `car_${id}.jpg`,
    originalMimeType: 'image/jpeg',
    originalSizeBytes: 204800,
    originalWidth: 1280,
    originalHeight: 720,
    originalImageDataUrl: 'data:image/jpeg;base64,abc',
    selectedModel: model,
    totalElapsedMs: 320,
    results: [
      {
        modelId: 'gan',
        modelName: 'DeblurGAN-v2 (GAN)',
        architecture: 'Feature Pyramid Network + RaGAN-LS',
        imageDataUrl: 'data:image/png;base64,xyz',
        mimeType: 'image/png',
        inferenceTimeMs: 320,
        width: 1280,
        height: 720,
      },
    ],
  });
}

test('prependHistoryEntry keeps newest first and caps length', () => {
  let list = [makeSampleEntry('1'), makeSampleEntry('2')];
  list = prependHistoryEntry(list, makeSampleEntry('3'), 2);
  assert.deepEqual(
    list.map((e) => e.id),
    ['3', '1']
  );
});

test('removeHistoryEntry removes only matching id', () => {
  const list = [makeSampleEntry('a'), makeSampleEntry('b')];
  const next = removeHistoryEntry(list, 'a');
  assert.deepEqual(
    next.map((e) => e.id),
    ['b']
  );
});

test('saveHistoryToStorage and loadHistoryFromStorage round-trip and handle quota limits', () => {
  const storage = createMemoryStorage();
  const entries = [makeSampleEntry('1'), makeSampleEntry('2')];
  saveHistoryToStorage(storage, entries);
  const loaded = loadHistoryFromStorage(storage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, '1');

  // Corrupt JSON safety
  storage.setItem(HISTORY_STORAGE_KEY, '{bad json');
  assert.deepEqual(loadHistoryFromStorage(storage), []);

  // Quota trimming safety: allow only 1 serialized entry
  const singleEntrySize = JSON.stringify([makeSampleEntry('1')]).length + 10;
  const tightStorage = createMemoryStorage(singleEntrySize);
  const saved = saveHistoryToStorage(tightStorage, [makeSampleEntry('1'), makeSampleEntry('2')]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, '1');
});

test('formatHistoryModelSummary and formatHistoryTimestamp format cleanly', () => {
  assert.equal(formatHistoryModelSummary(makeSampleEntry('1', 'gan')), 'DeblurGAN-v2 (GAN)');
  assert.equal(formatHistoryModelSummary(makeSampleEntry('2', 'all')), 'Compare All (1)');
  assert.equal(formatHistoryTimestamp('invalid-date'), '—');
  assert.notEqual(formatHistoryTimestamp('2026-11-20T08:10:00.000Z'), '—');
});
