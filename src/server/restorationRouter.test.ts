import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createRestorationRouter } from './restorationRouter.ts';

async function startTestApp(router: express.Router) {
  const app = express();
  app.use('/api', router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral port');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('GET /api/models/status reports unavailable when PYTORCH_API_URL is unset', async () => {
  const router = createRestorationRouter({ pytorchApiUrl: '' });
  const srv = await startTestApp(router);
  try {
    const res = await fetch(`${srv.baseUrl}/api/models/status`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      backendConnected: boolean;
      models: Record<string, { available: boolean }>;
    };
    assert.equal(data.backendConnected, false);
    assert.equal(data.models.gan.available, false);
    assert.equal(data.models.diffusion.available, false);
    assert.equal(data.models.transformer.available, false);
  } finally {
    await srv.close();
  }
});

test('POST /api/restore returns 503 MODEL_UNAVAILABLE when models are not connected', async () => {
  const router = createRestorationRouter({ pytorchApiUrl: '' });
  const srv = await startTestApp(router);
  try {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'car.png');
    form.append('model', 'all');

    const res = await fetch(`${srv.baseUrl}/api/restore`, { method: 'POST', body: form });
    assert.equal(res.status, 503);
    const data = (await res.json()) as {
      code: string;
      unavailableModels: string[];
    };
    assert.equal(data.code, 'MODEL_UNAVAILABLE');
    assert.deepEqual(data.unavailableModels, ['gan', 'diffusion', 'transformer']);
  } finally {
    await srv.close();
  }
});

test('POST /api/restore rejects unsupported file types with 400 INVALID_INPUT', async () => {
  const router = createRestorationRouter({ pytorchApiUrl: '' });
  const srv = await startTestApp(router);
  try {
    const form = new FormData();
    form.append('image', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    form.append('model', 'gan');

    const res = await fetch(`${srv.baseUrl}/api/restore`, { method: 'POST', body: form });
    assert.equal(res.status, 400);
    const data = (await res.json()) as { code: string };
    assert.equal(data.code, 'INVALID_INPUT');
  } finally {
    await srv.close();
  }
});

test('POST /api/restore forwards real PyTorch inference output and measured inference times', async () => {
  const mockPyTorchFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/v1/restore')) {
      return new Response(
        JSON.stringify({
          totalElapsedMs: 428.5,
          results: [
            {
              modelId: 'transformer',
              modelName: 'Restormer (Transformer)',
              imageBase64: 'iVBORw0KGgo=',
              mimeType: 'image/png',
              inferenceTimeMs: 428.5,
              width: 1280,
              height: 720,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 404 });
  };

  const router = createRestorationRouter({
    pytorchApiUrl: 'http://127.0.0.1:8000',
    fetchFn: mockPyTorchFetch,
  });
  const srv = await startTestApp(router);
  try {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }), 'car.jpg');
    form.append('model', 'transformer');

    const res = await fetch(`${srv.baseUrl}/api/restore`, { method: 'POST', body: form });
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      status: string;
      results: Array<{
        modelId: string;
        imageDataUrl: string;
        inferenceTimeMs: number;
      }>;
    };
    assert.equal(data.status, 'ok');
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].modelId, 'transformer');
    assert.equal(data.results[0].imageDataUrl, 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(data.results[0].inferenceTimeMs, 428.5);
  } finally {
    await srv.close();
  }
});
