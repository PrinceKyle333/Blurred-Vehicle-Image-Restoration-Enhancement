import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { BackendIntegrationGuide } from './components/BackendIntegrationGuide';
import { Header } from './components/Header';
import { HistorySection } from './components/HistorySection';
import { ImageUploader } from './components/ImageUploader';
import { LimitationsNotice } from './components/LimitationsNotice';
import { ModelSelector } from './components/ModelSelector';
import { ResultsSection } from './components/ResultsSection';
import type {
  ModelId,
  ModelSelection,
  ModelsStatusResponse,
  RestorationHistoryEntry,
  RestoredModelResult,
  RestoreSuccessResponse,
  RestoreUnavailableError,
  UploadedImageInfo,
} from './types/restoration';
import { normalizeRestoreError } from './utils/restorationHelpers';
import {
  createHistoryEntry,
  fileToDataUrl,
  loadHistoryFromStorage,
  prependHistoryEntry,
  removeHistoryEntry,
  saveHistoryToStorage,
} from './utils/restorationHistory';

export default function App() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImageInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelSelection>('all');
  const [modelsStatus, setModelsStatus] = useState<ModelsStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [elapsedWaitingMs, setElapsedWaitingMs] = useState<number>(0);
  const [results, setResults] = useState<RestoredModelResult[]>([]);
  const [restoreError, setRestoreError] = useState<RestoreUnavailableError | null>(null);
  const [activeSliderModelId, setActiveSliderModelId] = useState<ModelId | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [historyEntries, setHistoryEntries] = useState<RestorationHistoryEntry[]>(() =>
    typeof window !== 'undefined' ? loadHistoryFromStorage(window.localStorage) : []
  );
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const fetchModelsStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/models/status');
      if (response.ok) {
        const data = (await response.json()) as ModelsStatusResponse;
        setModelsStatus(data);
      }
    } catch {
      setModelsStatus(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void fetchModelsStatus();
  }, [fetchModelsStatus]);

  useEffect(() => {
    if (!isProcessing) {
      setElapsedWaitingMs(0);
      return;
    }

    const start = performance.now();
    const timer = window.setInterval(() => {
      setElapsedWaitingMs(performance.now() - start);
    }, 100);

    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleImageSelected = (image: UploadedImageInfo) => {
    if (objectUrlRef.current && objectUrlRef.current !== image.previewUrl) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = image.previewUrl;
    setUploadedImage(image);
    setResults([]);
    setRestoreError(null);
    setActiveSliderModelId(null);
    setActiveHistoryId(null);
  };

  const handleReset = () => {
    if (isProcessing) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setUploadedImage(null);
    setValidationError(null);
    setResults([]);
    setRestoreError(null);
    setActiveSliderModelId(null);
    setActiveHistoryId(null);
  };

  const handleSelectHistoryEntry = async (entry: RestorationHistoryEntry) => {
    if (isProcessing) return;

    let restoredFile: File;
    try {
      const res = await fetch(entry.originalImageDataUrl);
      const blob = await res.blob();
      restoredFile = new File([blob], entry.originalFilename, {
        type: entry.originalMimeType || 'image/jpeg',
      });
    } catch {
      restoredFile = new File([], entry.originalFilename, {
        type: entry.originalMimeType || 'image/jpeg',
      });
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setUploadedImage({
      file: restoredFile,
      previewUrl: entry.originalImageDataUrl,
      name: entry.originalFilename,
      sizeBytes: entry.originalSizeBytes,
      mimeType: entry.originalMimeType,
      width: entry.originalWidth,
      height: entry.originalHeight,
      isSample: false,
    });
    setValidationError(null);
    setRestoreError(null);
    setSelectedModel(entry.selectedModel);
    setResults(entry.results);
    setActiveSliderModelId(entry.results[0]?.modelId ?? null);
    setActiveHistoryId(entry.id);

    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRemoveHistoryEntry = (entryId: string) => {
    setHistoryEntries((prev) => {
      const next = removeHistoryEntry(prev, entryId);
      saveHistoryToStorage(window.localStorage, next);
      return next;
    });
    if (activeHistoryId === entryId) {
      setActiveHistoryId(null);
    }
  };

  const handleClearHistory = () => {
    setHistoryEntries([]);
    saveHistoryToStorage(window.localStorage, []);
    setActiveHistoryId(null);
  };

  const handleRestore = async () => {
    if (!uploadedImage || isProcessing) return;

    setIsProcessing(true);
    setResults([]);
    setRestoreError(null);
    setActiveSliderModelId(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedImage.file);
      formData.append('model', selectedModel);

      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        setRestoreError(normalizeRestoreError(response.status, payload));
        return;
      }

      const data = payload as RestoreSuccessResponse;
      if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        setRestoreError({
          status: 'error',
          code: 'BACKEND_ERROR',
          message: 'The inference backend returned an empty restoration response.',
        });
        return;
      }

      setResults(data.results);
      setActiveSliderModelId(data.results[0].modelId);

      try {
        const originalImageDataUrl = await fileToDataUrl(uploadedImage.file);
        const entry = createHistoryEntry({
          originalFilename: uploadedImage.name,
          originalMimeType: uploadedImage.mimeType,
          originalSizeBytes: uploadedImage.sizeBytes,
          originalWidth: uploadedImage.width,
          originalHeight: uploadedImage.height,
          originalImageDataUrl,
          selectedModel,
          totalElapsedMs: data.totalElapsedMs,
          results: data.results,
        });
        setHistoryEntries((prev) => {
          const next = prependHistoryEntry(prev, entry);
          return saveHistoryToStorage(window.localStorage, next);
        });
        setActiveHistoryId(entry.id);
      } catch {
        // Ignore persistence errors if browser file reading fails
      }
    } catch {
      setRestoreError({
        status: 'unavailable',
        code: 'MODEL_UNAVAILABLE',
        message: 'Could not reach the restoration API endpoint.',
        details: 'Ensure the backend server and PyTorch inference service are running.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const canReset = Boolean(uploadedImage || results.length > 0 || restoreError || validationError);

  return (
    <div id="top" className="relative min-h-screen overflow-x-hidden bg-[#0B0B0C] text-zinc-100">
      {/* Subtle dark automotive ambient headlight accent matching reference */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-72 w-96 bg-[radial-gradient(ellipse_at_top_right,rgba(255,122,0,0.18),transparent_68%)]"
      />

      <Header isMenuOpen={isMenuOpen} onToggleMenu={() => setIsMenuOpen((prev) => !prev)} />

      <main className="relative mx-auto max-w-2xl space-y-5 px-4 pt-2 pb-10 sm:px-6">
        {/* Minimalist Hero Title */}
        <section className="space-y-2 pb-1">
          <h1 className="text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
            Vehicle Image <span className="text-[#FF7A00]">Restoration</span>
          </h1>
          <p className="text-sm text-zinc-300 sm:text-base">
            Restore blurry vehicle images into clearer images.
          </p>
          <div className="pt-1">
            <div className="h-1 w-10 rounded-full bg-[#FF7A00]" aria-hidden="true" />
          </div>
        </section>

        {/* Main Minimalist Workspace Card */}
        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#18181A] p-4 sm:p-6">
          <ImageUploader
            uploadedImage={uploadedImage}
            validationError={validationError}
            isProcessing={isProcessing}
            onImageSelected={handleImageSelected}
            onValidationError={setValidationError}
            onClearImage={handleReset}
          />

          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            modelsStatus={modelsStatus}
            isLoadingStatus={isLoadingStatus}
            disabled={isProcessing}
          />

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={!uploadedImage || isProcessing}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#FF7A00] px-6 py-3 text-base font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#e86e00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:bg-[#FF7A00]/40 disabled:text-white/60"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>{isProcessing ? 'Restoring Image...' : 'Restore Image'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={!canReset || isProcessing}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#222225] px-5 py-2.5 text-sm font-medium text-zinc-200 whitespace-nowrap transition-colors hover:border-white/20 hover:bg-[#2a2a2e] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <ResultsSection
            uploadedImage={uploadedImage}
            selectedModel={selectedModel}
            isProcessing={isProcessing}
            elapsedWaitingMs={elapsedWaitingMs}
            results={results}
            restoreError={restoreError}
            activeSliderModelId={activeSliderModelId}
            onSelectForSlider={setActiveSliderModelId}
          />

          <HistorySection
            entries={historyEntries}
            activeEntryId={activeHistoryId}
            onSelectEntry={(entry) => void handleSelectHistoryEntry(entry)}
            onRemoveEntry={handleRemoveHistoryEntry}
            onClearHistory={handleClearHistory}
          />
        </div>

        {/* Bottom Note */}
        <LimitationsNotice />
      </main>

      <BackendIntegrationGuide
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        modelsStatus={modelsStatus}
        isLoadingStatus={isLoadingStatus}
        onRefreshStatus={() => void fetchModelsStatus()}
      />
    </div>
  );
}
