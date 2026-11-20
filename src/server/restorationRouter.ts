import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import type {
  ModelAvailability,
  ModelId,
  ModelSelection,
  ModelsStatusResponse,
  RestoredModelResult,
} from '../types/restoration.ts';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const VALID_SELECTIONS = new Set<ModelSelection>(['gan', 'diffusion', 'transformer', 'all']);

interface ModelDescriptor {
  id: ModelId;
  name: string;
  architecture: string;
  defaultCheckpointPath: string;
}

const MODEL_DESCRIPTORS: Record<ModelId, ModelDescriptor> = {
  gan: {
    id: 'gan',
    name: 'DeblurGAN-v2 (GAN)',
    architecture: 'Feature Pyramid Network + RaGAN-LS',
    defaultCheckpointPath: 'checkpoints/deblurgan_v2.pth',
  },
  diffusion: {
    id: 'diffusion',
    name: 'Conditional DDPM (Diffusion)',
    architecture: 'Conditional Denoising Diffusion Probabilistic Model',
    defaultCheckpointPath: 'checkpoints/conditional_ddpm.pt',
  },
  transformer: {
    id: 'transformer',
    name: 'Restormer (Transformer)',
    architecture: 'Multi-Dconv Head Transposed Attention',
    defaultCheckpointPath: 'checkpoints/restormer.pth',
  },
};

export interface RestorationRouterOptions {
  pytorchApiUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

function buildUnavailableModelStatus(id: ModelId, reason: string): ModelAvailability {
  const desc = MODEL_DESCRIPTORS[id];
  return {
    id,
    name: desc.name,
    available: false,
    checkpointLoaded: false,
    checkpointPath: desc.defaultCheckpointPath,
    device: null,
    reason,
  };
}

function buildDisconnectedStatusResponse(reason: string, configured: boolean): ModelsStatusResponse {
  return {
    backendConnected: false,
    backendUrlConfigured: configured,
    checkedAt: new Date().toISOString(),
    message: reason,
    models: {
      gan: buildUnavailableModelStatus('gan', reason),
      diffusion: buildUnavailableModelStatus('diffusion', reason),
      transformer: buildUnavailableModelStatus('transformer', reason),
    },
  };
}

function getRequestedModelIds(selection: ModelSelection): ModelId[] {
  if (selection === 'all') {
    return ['gan', 'diffusion', 'transformer'];
  }
  return [selection];
}

export function createRestorationRouter(options: RestorationRouterOptions = {}) {
  const router = express.Router();
  const pytorchApiUrl = (options.pytorchApiUrl ?? process.env.PYTORCH_API_URL ?? '').trim();
  const timeoutMs = options.timeoutMs ?? Number(process.env.PYTORCH_TIMEOUT_MS || 120000);
  const fetchImpl = options.fetchFn ?? fetch;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
        cb(new Error('UNSUPPORTED_FILE_TYPE'));
        return;
      }
      cb(null, true);
    },
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'vehicle-image-restoration-api' });
  });

  router.get('/models/status', async (_req: Request, res: Response) => {
    if (!pytorchApiUrl) {
      res.json(
        buildDisconnectedStatusResponse(
          'PyTorch inference backend URL (PYTORCH_API_URL) is not configured or checkpoints are not connected.',
          false
        )
      );
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 5000));

    try {
      const targetUrl = `${pytorchApiUrl.replace(/\/+$/, '')}/api/v1/models/status`;
      const upstream = await fetchImpl(targetUrl, { signal: controller.signal });

      if (!upstream.ok) {
        res.json(
          buildDisconnectedStatusResponse(
            `PyTorch inference service responded with HTTP ${upstream.status}.`,
            true
          )
        );
        return;
      }

      const data = (await upstream.json()) as Partial<ModelsStatusResponse>;
      const models: Record<ModelId, ModelAvailability> = {
        gan: data.models?.gan ?? buildUnavailableModelStatus('gan', 'Model status missing from backend.'),
        diffusion:
          data.models?.diffusion ??
          buildUnavailableModelStatus('diffusion', 'Model status missing from backend.'),
        transformer:
          data.models?.transformer ??
          buildUnavailableModelStatus('transformer', 'Model status missing from backend.'),
      };

      res.json({
        backendConnected: true,
        backendUrlConfigured: true,
        checkedAt: new Date().toISOString(),
        message:
          typeof data.message === 'string'
            ? data.message
            : 'Connected to Python/PyTorch inference service.',
        models,
      } satisfies ModelsStatusResponse);
    } catch {
      res.json(
        buildDisconnectedStatusResponse(
          'Python/PyTorch inference service is unreachable. Start backend/app.py and connect trained checkpoints.',
          true
        )
      );
    } finally {
      clearTimeout(timer);
    }
  });

  router.post(
    '/restore',
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('image')(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
              status: 'error',
              code: 'INVALID_INPUT',
              message: 'Uploaded image exceeds the 10 MB maximum file size.',
            });
            return;
          }
          res.status(400).json({
            status: 'error',
            code: 'INVALID_INPUT',
            message: err.message,
          });
          return;
        }
        if (err instanceof Error && err.message === 'UNSUPPORTED_FILE_TYPE') {
          res.status(400).json({
            status: 'error',
            code: 'INVALID_INPUT',
            message: 'Unsupported image format. Only JPG, JPEG, and PNG files are accepted.',
          });
          return;
        }
        res.status(400).json({
          status: 'error',
          code: 'INVALID_INPUT',
          message: 'Unable to parse uploaded image file.',
        });
      });
    },
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_INPUT',
          message: 'No vehicle image file provided. Upload a JPG, JPEG, or PNG image.',
        });
        return;
      }

      const rawModel = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
      if (!VALID_SELECTIONS.has(rawModel as ModelSelection)) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_INPUT',
          message: 'Invalid model selection. Choose gan, diffusion, transformer, or all.',
        });
        return;
      }

      const selectedModel = rawModel as ModelSelection;
      const requestedIds = getRequestedModelIds(selectedModel);

      if (!pytorchApiUrl) {
        res.status(503).json({
          status: 'unavailable',
          code: 'MODEL_UNAVAILABLE',
          message: 'Trained PyTorch restoration models are not connected yet.',
          details:
            'Configure PYTORCH_API_URL and start the Python/PyTorch FastAPI service (backend/app.py) with trained checkpoints for DeblurGAN-v2, Conditional DDPM, and Restormer.',
          unavailableModels: requestedIds,
        });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const upstreamForm = new FormData();
        const imageBytes = new Uint8Array(file.buffer);
        const blob = new Blob([imageBytes], { type: file.mimetype });
        upstreamForm.append('image', blob, file.originalname || 'vehicle_input.jpg');
        upstreamForm.append('model', selectedModel);

        const targetUrl = `${pytorchApiUrl.replace(/\/+$/, '')}/api/v1/restore`;
        const upstream = await fetchImpl(targetUrl, {
          method: 'POST',
          body: upstreamForm,
          signal: controller.signal,
        });

        let payload: Record<string, unknown> | null = null;
        try {
          payload = (await upstream.json()) as Record<string, unknown>;
        } catch {
          payload = null;
        }

        if (upstream.status === 503) {
          res.status(503).json({
            status: 'unavailable',
            code: 'MODEL_UNAVAILABLE',
            message:
              typeof payload?.message === 'string'
                ? payload.message
                : 'One or more requested PyTorch model checkpoints are unavailable.',
            details:
              typeof payload?.details === 'string'
                ? payload.details
                : 'Load trained .pth / .pt checkpoint weights in backend/checkpoints/ to enable inference.',
            unavailableModels: Array.isArray(payload?.unavailableModels)
              ? payload.unavailableModels
              : requestedIds,
          });
          return;
        }

        if (!upstream.ok) {
          res.status(upstream.status >= 400 ? upstream.status : 502).json({
            status: 'error',
            code: 'BACKEND_ERROR',
            message:
              typeof payload?.message === 'string'
                ? payload.message
                : `PyTorch inference backend returned HTTP ${upstream.status}.`,
          });
          return;
        }

        const rawResults = Array.isArray(payload?.results) ? payload.results : [];
        const normalizedResults: RestoredModelResult[] = [];

        for (const item of rawResults) {
          if (!item || typeof item !== 'object') continue;
          const record = item as Record<string, unknown>;
          const modelId = record.modelId;
          if (modelId !== 'gan' && modelId !== 'diffusion' && modelId !== 'transformer') {
            continue;
          }
          const mimeType =
            typeof record.mimeType === 'string' && record.mimeType ? record.mimeType : 'image/png';
          const rawImageDataUrl =
            typeof record.imageDataUrl === 'string'
              ? record.imageDataUrl
              : typeof record.imageBase64 === 'string'
                ? `data:${mimeType};base64,${record.imageBase64}`
                : '';

          if (!rawImageDataUrl) continue;

          const desc = MODEL_DESCRIPTORS[modelId];
          normalizedResults.push({
            modelId,
            modelName:
              typeof record.modelName === 'string' && record.modelName ? record.modelName : desc.name,
            architecture:
              typeof record.architecture === 'string' && record.architecture
                ? record.architecture
                : desc.architecture,
            imageDataUrl: rawImageDataUrl,
            mimeType,
            inferenceTimeMs:
              typeof record.inferenceTimeMs === 'number' && Number.isFinite(record.inferenceTimeMs)
                ? record.inferenceTimeMs
                : 0,
            width: typeof record.width === 'number' ? record.width : 0,
            height: typeof record.height === 'number' ? record.height : 0,
          });
        }

        if (normalizedResults.length === 0) {
          res.status(502).json({
            status: 'error',
            code: 'BACKEND_ERROR',
            message: 'PyTorch backend returned no valid restored image payloads.',
          });
          return;
        }

        const totalElapsedMs =
          typeof payload?.totalElapsedMs === 'number' && Number.isFinite(payload.totalElapsedMs)
            ? payload.totalElapsedMs
            : normalizedResults.reduce((acc, item) => acc + item.inferenceTimeMs, 0);

        res.json({
          status: 'ok',
          selectedModel,
          totalElapsedMs,
          results: normalizedResults,
        });
      } catch (error) {
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        res.status(503).json({
          status: 'unavailable',
          code: 'MODEL_UNAVAILABLE',
          message: isTimeout
            ? 'PyTorch inference request timed out while waiting for model execution.'
            : 'Trained PyTorch models are not connected or the Python inference server is not running.',
          details:
            'Start the Python/PyTorch service at PYTORCH_API_URL with trained model checkpoints loaded.',
          unavailableModels: requestedIds,
        });
      } finally {
        clearTimeout(timer);
      }
    }
  );

  return router;
}
