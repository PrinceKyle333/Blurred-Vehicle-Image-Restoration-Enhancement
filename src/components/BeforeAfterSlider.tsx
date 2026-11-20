import { useRef, useState, type PointerEvent } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import type { ModelId, RestoredModelResult } from '../types/restoration';
import { clampSliderPercentage, formatInferenceTime } from '../utils/restorationHelpers';

interface BeforeAfterSliderProps {
  originalImageUrl: string | null;
  results: RestoredModelResult[];
  activeModelId: ModelId | null;
  onSelectActiveModel: (modelId: ModelId) => void;
}

export function BeforeAfterSlider({
  originalImageUrl,
  results,
  activeModelId,
  onSelectActiveModel,
}: BeforeAfterSliderProps) {
  const [sliderPercent, setSliderPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const activeResult =
    results.find((item) => item.modelId === activeModelId) ?? results[0] ?? null;

  const updateFromPointer = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rawPercent = ((clientX - rect.left) / rect.width) * 100;
    setSliderPercent(clampSliderPercentage(rawPercent));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!activeResult || !originalImageUrl) return;
    isDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    updateFromPointer(event.clientX);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  if (!originalImageUrl || !activeResult) {
    return null;
  }

  return (
    <div id="before-after-comparison" className="space-y-3">
      {results.length > 1 && (
        <div
          role="tablist"
          aria-label="Select restored model for comparison slider"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#121214] p-1"
        >
          {results.map((result) => {
            const isActive = activeResult.modelId === result.modelId;
            return (
              <button
                key={result.modelId}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectActiveModel(result.modelId)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] ${
                  isActive
                    ? 'bg-[#FF7A00] text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {result.modelName}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        data-testid="before-after-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative aspect-16/10 w-full cursor-ew-resize select-none overflow-hidden rounded-2xl border border-white/12 bg-black/60"
      >
        {/* Restored image (Right / full underlying layer) */}
        <img
          src={activeResult.imageDataUrl}
          alt={`Restored vehicle image by ${activeResult.modelName}`}
          referrerPolicy="no-referrer"
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />

        {/* Original blurred image (Left / clipped layer) */}
        <div
          style={{ clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` }}
          className="pointer-events-none absolute inset-0"
        >
          <img
            src={originalImageUrl}
            alt="Original blurred vehicle input"
            referrerPolicy="no-referrer"
            draggable={false}
            className="h-full w-full object-contain"
          />
        </div>

        {/* White divider line & orange circular handle */}
        <div
          style={{ left: `${sliderPercent}%` }}
          className="pointer-events-none absolute inset-y-0 -translate-x-1/2"
        >
          <div className="h-full w-0.5 bg-white shadow-sm" />
          <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FF7A00] text-white shadow-md">
            <ChevronsLeftRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        {/* Bottom-left Before & bottom-right After markers matching reference */}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
          Before
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-[#FF7A00] px-3 py-1 text-xs font-medium text-white shadow-xs">
          After ·{' '}
          <span className="font-mono tabular-nums">
            {formatInferenceTime(activeResult.inferenceTimeMs)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1">
        <label
          htmlFor="comparison-range"
          className="text-xs font-medium text-zinc-400 whitespace-nowrap shrink-0"
        >
          Slider
        </label>
        <input
          id="comparison-range"
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={sliderPercent}
          onChange={(e) => setSliderPercent(clampSliderPercentage(Number(e.target.value)))}
          aria-label="Before and after comparison slider"
          className="h-1.5 w-full cursor-pointer accent-[#FF7A00]"
        />
        <span className="w-10 text-right font-mono text-xs tabular-nums text-zinc-400">
          {Math.round(sliderPercent)}%
        </span>
      </div>
    </div>
  );
}
