import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDownloadFilename,
  clampSliderPercentage,
  formatFileSize,
  formatInferenceTime,
  getSelectedModelNames,
  MAX_IMAGE_SIZE_BYTES,
  normalizeRestoreError,
  validateImageFile,
} from './restorationHelpers';

test('validateImageFile accepts valid JPG, JPEG, and PNG files', () => {
  assert.deepEqual(
    validateImageFile({ name: 'sedan.jpg', type: 'image/jpeg', size: 1024 * 500 }),
    { valid: true }
  );
  assert.deepEqual(
    validateImageFile({ name: 'plate.JPEG', type: 'image/jpeg', size: 2048 }),
    { valid: true }
  );
  assert.deepEqual(
    validateImageFile({ name: 'dashcam.png', type: 'image/png', size: 4096 }),
    { valid: true }
  );
});

test('validateImageFile rejects unsupported file formats and empty/oversized files', () => {
  const txtResult = validateImageFile({ name: 'notes.txt', type: 'text/plain', size: 100 });
  assert.equal(txtResult.valid, false);
  assert.match(txtResult.error ?? '', /Unsupported file/);

  const webpResult = validateImageFile({ name: 'car.webp', type: 'image/webp', size: 1000 });
  assert.equal(webpResult.valid, false);

  const emptyResult = validateImageFile({ name: 'blank.png', type: 'image/png', size: 0 });
  assert.equal(emptyResult.valid, false);

  const hugeResult = validateImageFile({
    name: 'huge.png',
    type: 'image/png',
    size: MAX_IMAGE_SIZE_BYTES + 1,
  });
  assert.equal(hugeResult.valid, false);
  assert.match(hugeResult.error ?? '', /10 MB/);
});

test('formatInferenceTime renders ms below 1s and seconds at or above 1s', () => {
  assert.equal(formatInferenceTime(384.6), '385 ms');
  assert.equal(formatInferenceTime(999), '999 ms');
  assert.equal(formatInferenceTime(1000), '1.00 s');
  assert.equal(formatInferenceTime(2475), '2.48 s');
  assert.equal(formatInferenceTime(-1), '—');
});

test('formatFileSize formats bytes, KB, and MB accurately', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(2 * 1024 * 1024), '2.00 MB');
});

test('buildDownloadFilename sanitizes names and appends model id', () => {
  assert.equal(
    buildDownloadFilename('Traffic Cam 01.jpg', 'transformer'),
    'Traffic_Cam_01_restored_transformer.png'
  );
  assert.equal(buildDownloadFilename('   .png', 'gan'), 'vehicle_image_restored_gan.png');
});

test('getSelectedModelNames resolves single models and compare-all mode', () => {
  assert.deepEqual(getSelectedModelNames('gan'), ['DeblurGAN-v2 (GAN)']);
  assert.deepEqual(getSelectedModelNames('all'), [
    'DeblurGAN-v2 (GAN)',
    'Conditional DDPM (Diffusion)',
    'Restormer (Transformer)',
  ]);
});

test('clampSliderPercentage bounds values between 0 and 100', () => {
  assert.equal(clampSliderPercentage(-15), 0);
  assert.equal(clampSliderPercentage(142), 100);
  assert.equal(clampSliderPercentage(47.34), 47.3);
  assert.equal(clampSliderPercentage(Number.NaN), 50);
});

test('normalizeRestoreError produces clean Model Unavailable payloads for 503', () => {
  const err = normalizeRestoreError(503, {
    code: 'MODEL_UNAVAILABLE',
    message: 'Checkpoint missing for Restormer',
    unavailableModels: ['transformer'],
  });
  assert.equal(err.status, 'unavailable');
  assert.equal(err.code, 'MODEL_UNAVAILABLE');
  assert.equal(err.message, 'Checkpoint missing for Restormer');
  assert.deepEqual(err.unavailableModels, ['transformer']);
});
