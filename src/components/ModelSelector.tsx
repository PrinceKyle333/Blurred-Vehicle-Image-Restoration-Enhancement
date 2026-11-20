import { useId } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import {
  MODEL_DEFINITIONS,
  type ModelSelection,
  type ModelsStatusResponse,
} from '../types/restoration';

interface ModelSelectorProps {
  selectedModel: ModelSelection;
  onSelectModel: (model: ModelSelection) => void;
  modelsStatus: ModelsStatusResponse | null;
  isLoadingStatus: boolean;
  disabled: boolean;
}

export function ModelSelector({
  selectedModel,
  onSelectModel,
  modelsStatus,
  isLoadingStatus,
  disabled,
}: ModelSelectorProps) {
  const selectId = useId();
  const activeAvailability =
    selectedModel === 'all' ? null : modelsStatus?.models?.[selectedModel];

  return (
    <section aria-labelledby={`${selectId}-label`} className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label
          id={`${selectId}-label`}
          htmlFor={selectId}
          className="inline-flex items-center gap-2.5 text-sm font-semibold text-white"
        >
          <Layers className="h-4 w-4 text-[#FF7A00]" aria-hidden="true" />
          <span>Select Model</span>
        </label>

        {!isLoadingStatus && modelsStatus && (
          <span className="text-xs text-zinc-400">
            {selectedModel === 'all'
              ? modelsStatus.backendConnected
                ? '3 models ready'
                : 'Checkpoints disconnected'
              : activeAvailability?.available
                ? 'Checkpoint ready'
                : 'Checkpoint unavailable'}
          </span>
        )}
      </div>

      <div className="relative">
        <select
          id={selectId}
          value={selectedModel}
          disabled={disabled}
          onChange={(event) => onSelectModel(event.target.value as ModelSelection)}
          className="min-h-[46px] w-full appearance-none rounded-xl border border-white/15 bg-[#121214] px-4 py-3 pr-10 text-sm font-medium text-white transition-colors hover:border-white/25 focus-visible:border-[#FF7A00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <option value="all" className="bg-[#18181A] text-white">
            Compare All Models
          </option>
          {MODEL_DEFINITIONS.map((model) => (
            <option key={model.id} value={model.id} className="bg-[#18181A] text-white">
              {model.name} ({model.shortLabel})
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-zinc-300"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
