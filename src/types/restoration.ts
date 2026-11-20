export type ModelId = 'gan' | 'diffusion' | 'transformer';
export type ModelSelection = ModelId | 'all';

export interface ModelDefinition {
  id: ModelId;
  name: string;
  shortLabel: string;
  architecture: string;
  summary: string;
  checkpointFile: string;
}

export interface ModelAvailability {
  id: ModelId;
  name: string;
  available: boolean;
  checkpointLoaded: boolean;
  checkpointPath: string;
  device: string | null;
  reason: string;
}

export interface ModelsStatusResponse {
  backendConnected: boolean;
  backendUrlConfigured: boolean;
  checkedAt: string;
  message: string;
  models: Record<ModelId, ModelAvailability>;
}

export interface RestoredModelResult {
  modelId: ModelId;
  modelName: string;
  architecture: string;
  imageDataUrl: string;
  mimeType: string;
  inferenceTimeMs: number;
  width: number;
  height: number;
}

export interface RestoreSuccessResponse {
  status: 'ok';
  selectedModel: ModelSelection;
  totalElapsedMs: number;
  results: RestoredModelResult[];
}

export interface RestoreUnavailableError {
  status: 'unavailable' | 'error';
  code: 'MODEL_UNAVAILABLE' | 'INVALID_INPUT' | 'BACKEND_ERROR';
  message: string;
  details?: string;
  unavailableModels?: ModelId[];
}

export interface UploadedImageInfo {
  file: File;
  previewUrl: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  isSample: boolean;
}

export interface RestorationHistoryEntry {
  id: string;
  createdAt: string;
  originalFilename: string;
  originalMimeType: string;
  originalSizeBytes: number;
  originalWidth: number | null;
  originalHeight: number | null;
  originalImageDataUrl: string;
  selectedModel: ModelSelection;
  totalElapsedMs: number;
  results: RestoredModelResult[];
}

export const MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: 'gan',
    name: 'DeblurGAN-v2',
    shortLabel: 'GAN',
    architecture: 'Feature Pyramid Network + RaGAN-LS',
    summary: 'Single-pass adversarial generator tuned for sharp edges and rapid inference.',
    checkpointFile: 'checkpoints/deblurgan_v2.pth',
  },
  {
    id: 'diffusion',
    name: 'Conditional DDPM',
    shortLabel: 'Diffusion',
    architecture: 'Conditional Denoising Diffusion Probabilistic Model',
    summary: 'Iterative denoising conditioned on the blurred input for fine texture synthesis.',
    checkpointFile: 'checkpoints/conditional_ddpm.pt',
  },
  {
    id: 'transformer',
    name: 'Restormer',
    shortLabel: 'Transformer',
    architecture: 'Multi-Dconv Head Transposed Attention',
    summary: 'Hierarchical Vision Transformer capturing long-range motion blur across high-res frames.',
    checkpointFile: 'checkpoints/restormer.pth',
  },
];
