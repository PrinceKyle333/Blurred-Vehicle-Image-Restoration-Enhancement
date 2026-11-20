import {
  AlertTriangle,
  Clock,
  Download,
  Image as ImageIcon,
  Loader2,
  ServerOff,
} from 'lucide-react';
import {
  MODEL_DEFINITIONS,
  type ModelId,
  type ModelSelection,
  type RestoredModelResult,
  type RestoreUnavailableError,
  type UploadedImageInfo,
} from '../types/restoration';
import {
  buildDownloadFilename,
  formatFileSize,
  formatInferenceTime,
} from '../utils/restorationHelpers';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ResultsSectionProps {
  uploadedImage: UploadedImageInfo | null;
  selectedModel: ModelSelection;
  isProcessing: boolean;
  elapsedWaitingMs: number;
  results: RestoredModelResult[];
  restoreError: RestoreUnavailableError | null;
  activeSliderModelId: ModelId | null;
  onSelectForSlider: (modelId: ModelId) => void;
}

export function ResultsSection({
  uploadedImage,
  selectedModel,
  isProcessing,
  elapsedWaitingMs,
  results,
  restoreError,
  activeSliderModelId,
  onSelectForSlider,
}: ResultsSectionProps) {
  const requestedModels =
    selectedModel === 'all'
      ? MODEL_DEFINITIONS
      : MODEL_DEFINITIONS.filter((m) => m.id === selectedModel);

  return (
    <section id="results" aria-labelledby="results-heading" className="space-y-4 border-t border-white/10 pt-6">
      <div className="flex items-center gap-2.5">
        <ImageIcon className="h-4 w-4 text-[#FF7A00]" aria-hidden="true" />
        <h2 id="results-heading" className="text-base font-semibold text-white">
          Results
        </h2>
      </div>

      {!uploadedImage ? (
        <div className="rounded-2xl border border-white/10 bg-[#121214] px-5 py-8 text-center">
          <p className="text-sm font-medium text-zinc-200">No restoration results yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Upload a blurry vehicle photo and tap Restore Image to compare before and after.
          </p>
        </div>
      ) : isProcessing ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121214] px-5 py-10 text-center"
        >
          <Loader2 className="h-7 w-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-white">
            Running PyTorch model inference...
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {requestedModels.map((m) => `${m.name} (${m.shortLabel})`).join(' · ')}
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-zinc-500">
            Elapsed: {formatInferenceTime(elapsedWaitingMs)}
          </p>
        </div>
      ) : restoreError ? (
        <div
          role="alert"
          className="space-y-4 rounded-2xl border border-amber-500/25 bg-amber-950/20 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-[#FF7A00]">
              {restoreError.code === 'MODEL_UNAVAILABLE' ? (
                <ServerOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {restoreError.code === 'MODEL_UNAVAILABLE'
                  ? 'Model Unavailable'
                  : 'Inference Request Failed'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{restoreError.message}</p>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <p className="text-xs font-medium text-zinc-400">Requested checkpoints:</p>
            <ul className="divide-y divide-white/8 text-xs">
              {requestedModels.map((model) => (
                <li
                  key={model.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                >
                  <span className="font-medium text-zinc-200">
                    {model.name} ({model.shortLabel})
                  </span>
                  <span className="font-mono text-zinc-400">{model.checkpointFile}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#121214] px-5 py-7 text-center">
          <p className="text-sm font-medium text-zinc-200">Ready to restore</p>
          <p className="mt-1 text-xs text-zinc-400">
            Tap Restore Image to process with{' '}
            {requestedModels.map((m) => `${m.name} (${m.shortLabel})`).join(', ')}.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Interactive Before & After Comparison Slider matching reference */}
          <BeforeAfterSlider
            originalImageUrl={uploadedImage.previewUrl}
            results={results}
            activeModelId={activeSliderModelId}
            onSelectActiveModel={onSelectForSlider}
          />

          {/* Side-by-Side Original + Restored Output Cards with Model Names, Inference Times, and Download */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121214]">
              <div className="aspect-16/10 w-full bg-black/50">
                <img
                  src={uploadedImage.previewUrl}
                  alt={`Original blurred vehicle image: ${uploadedImage.name}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="space-y-1 border-t border-white/10 p-3.5">
                <h3 className="text-sm font-semibold text-white">Original (Blurred)</h3>
                <p className="font-mono text-xs tabular-nums text-zinc-400">
                  {uploadedImage.width && uploadedImage.height
                    ? `${uploadedImage.width} × ${uploadedImage.height} px · `
                    : ''}
                  {formatFileSize(uploadedImage.sizeBytes)}
                </p>
              </div>
            </article>

            {results.map((result) => {
              const downloadFilename = buildDownloadFilename(uploadedImage.name, result.modelId);
              const isInSlider = activeSliderModelId === result.modelId;

              return (
                <article
                  key={result.modelId}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-[#121214] transition-colors ${
                    isInSlider ? 'border-[#FF7A00]/60' : 'border-white/10'
                  }`}
                >
                  <div className="aspect-16/10 w-full bg-black/50">
                    <img
                      src={result.imageDataUrl}
                      alt={`Restored vehicle output from ${result.modelName}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-3 border-t border-white/10 p-3.5">
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{result.modelName}</h3>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-[#FF7A00] whitespace-nowrap shrink-0">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatInferenceTime(result.inferenceTimeMs)}
                        </span>
                      </div>
                      <p className="font-mono text-xs tabular-nums text-zinc-400">
                        {result.width} × {result.height} px
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectForSlider(result.modelId)}
                        className={`inline-flex min-h-[38px] flex-1 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] ${
                          isInSlider
                            ? 'border-[#FF7A00]/50 bg-[#FF7A00]/15 text-[#FF7A00]'
                            : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {isInSlider ? 'In Slider' : 'Inspect'}
                      </button>

                      <a
                        href={result.imageDataUrl}
                        download={downloadFilename}
                        aria-label={`Download ${result.modelName} restored image`}
                        className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#FF7A00] px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-[#e86e00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
