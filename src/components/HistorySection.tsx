import { Clock, Download, Eye, History, Trash2 } from 'lucide-react';
import type { RestorationHistoryEntry } from '../types/restoration';
import {
  buildDownloadFilename,
  formatInferenceTime,
} from '../utils/restorationHelpers';
import {
  formatHistoryModelSummary,
  formatHistoryTimestamp,
} from '../utils/restorationHistory';

interface HistorySectionProps {
  entries: RestorationHistoryEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: RestorationHistoryEntry) => void;
  onRemoveEntry: (entryId: string) => void;
  onClearHistory: () => void;
}

export function HistorySection({
  entries,
  activeEntryId,
  onSelectEntry,
  onRemoveEntry,
  onClearHistory,
}: HistorySectionProps) {
  return (
    <section
      id="history"
      aria-labelledby="history-heading"
      className="space-y-4 border-t border-white/10 pt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="h-4 w-4 text-[#FF7A00]" aria-hidden="true" />
          <h2 id="history-heading" className="text-base font-semibold text-white">
            History
          </h2>
          <span className="font-mono text-xs tabular-nums text-zinc-400">
            ({entries.length})
          </span>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 whitespace-nowrap transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#121214] px-5 py-6 text-center">
          <p className="text-sm font-medium text-zinc-300">No restored images in history yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Completed restorations from connected PyTorch models are saved here for quick
            comparison and download.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry) => {
            const primaryResult = entry.results[0];
            const isActive = activeEntryId === entry.id;
            const downloadName = buildDownloadFilename(
              entry.originalFilename,
              primaryResult.modelId
            );

            return (
              <li
                key={entry.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-[#121214] p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isActive ? 'border-[#FF7A00]/60' : 'border-white/10'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/50">
                    <img
                      src={primaryResult.imageDataUrl}
                      alt={`Restored preview for ${entry.originalFilename}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-white">
                      {entry.originalFilename}
                    </p>
                    <p className="text-xs text-zinc-300">{formatHistoryModelSummary(entry)}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#FF7A00] whitespace-nowrap">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatInferenceTime(entry.totalElapsedMs)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-zinc-500 whitespace-nowrap">
                        {formatHistoryTimestamp(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry)}
                    aria-label={`View ${entry.originalFilename} restoration`}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] ${
                      isActive
                        ? 'border-[#FF7A00]/50 bg-[#FF7A00]/15 text-[#FF7A00]'
                        : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isActive ? 'Viewing' : 'View'}</span>
                  </button>

                  <a
                    href={primaryResult.imageDataUrl}
                    download={downloadName}
                    aria-label={`Download restored ${entry.originalFilename}`}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap transition-colors hover:bg-[#e86e00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => onRemoveEntry(entry.id)}
                    aria-label={`Remove ${entry.originalFilename} from history`}
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
