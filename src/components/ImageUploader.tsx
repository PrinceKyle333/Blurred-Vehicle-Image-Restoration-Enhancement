import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, Car, ImagePlus, Trash2 } from 'lucide-react';
import type { UploadedImageInfo } from '../types/restoration';
import { formatFileSize, validateImageFile } from '../utils/restorationHelpers';

export const SAMPLE_VEHICLE_IMAGE_URL =
  '/src/assets/images/sample_blurred_vehicle_1795161049848.jpg';

interface ImageUploaderProps {
  uploadedImage: UploadedImageInfo | null;
  validationError: string | null;
  isProcessing: boolean;
  onImageSelected: (image: UploadedImageInfo) => void;
  onValidationError: (message: string | null) => void;
  onClearImage: () => void;
}

function readImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function ImageUploader({
  uploadedImage,
  validationError,
  isProcessing,
  onImageSelected,
  onValidationError,
  onClearImage,
}: ImageUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false);

  const processFile = async (file: File, isSample = false) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      onValidationError(validation.error ?? 'Invalid image file.');
      return;
    }

    onValidationError(null);
    setPreviewLoadFailed(false);

    const previewUrl = URL.createObjectURL(file);
    const dims = await readImageDimensions(previewUrl);

    onImageSelected({
      file,
      previewUrl,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      isSample,
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file, false);
    }
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processFile(file, false);
    }
  };

  const handleLoadSample = async () => {
    if (isProcessing || isLoadingSample) return;
    setIsLoadingSample(true);
    onValidationError(null);
    try {
      const response = await fetch(SAMPLE_VEHICLE_IMAGE_URL);
      if (!response.ok) {
        throw new Error('Sample vehicle image could not be fetched.');
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample_blurred_vehicle.jpg', {
        type: 'image/jpeg',
      });
      await processFile(sampleFile, true);
    } catch {
      onValidationError('Could not load the sample image. Please upload a JPG or PNG from your device.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <section aria-label="Upload blurry vehicle image" className="space-y-3">
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFileChange}
        disabled={isProcessing}
        aria-hidden="true"
        tabIndex={-1}
        className="hidden"
      />

      {!uploadedImage ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-colors ${
            isDragging
              ? 'border-[#FF7A00] bg-[#FF7A00]/8'
              : 'border-white/20 bg-[#141416] hover:border-[#FF7A00]/60'
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex flex-col items-center text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-10 w-10 text-[#FF7A00]" aria-hidden="true" />
            <span className="mt-3 text-base font-semibold text-white">Upload Image</span>
            <span className="mt-1 text-sm text-zinc-400">Tap to upload or drag and drop</span>
          </button>

          <p className="mt-3 rounded-full border border-white/15 bg-black/25 px-3.5 py-1 text-xs text-zinc-300">
            JPG, JPEG, PNG (max 10 MB)
          </p>

          <button
            type="button"
            onClick={() => void handleLoadSample()}
            disabled={isProcessing || isLoadingSample}
            className="mt-3.5 inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-[#FF7A00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Car className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isLoadingSample ? 'Loading sample...' : 'Use sample blurry vehicle'}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#121214]">
          <div className="relative aspect-16/10 w-full bg-black/50">
            {!previewLoadFailed ? (
              <img
                src={uploadedImage.previewUrl}
                alt={`Uploaded blurry vehicle image: ${uploadedImage.name}`}
                referrerPolicy="no-referrer"
                onError={() => setPreviewLoadFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
                <Car className="h-8 w-8 text-zinc-500" aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-200">{uploadedImage.name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium text-white">{uploadedImage.name}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs tabular-nums text-zinc-400">
                <span className="whitespace-nowrap">
                  {uploadedImage.mimeType === 'image/png' ? 'PNG' : 'JPEG'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">{formatFileSize(uploadedImage.sizeBytes)}</span>
                {uploadedImage.width && uploadedImage.height && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">
                      {uploadedImage.width} × {uploadedImage.height} px
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 whitespace-nowrap shrink-0 transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus className="h-3.5 w-3.5 text-[#FF7A00]" aria-hidden="true" />
                <span>Replace</span>
              </button>

              <button
                type="button"
                onClick={onClearImage}
                disabled={isProcessing}
                aria-label={`Remove ${uploadedImage.name}`}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 whitespace-nowrap shrink-0 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}
    </section>
  );
}
