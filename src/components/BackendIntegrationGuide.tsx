import { CheckCircle2, RefreshCw, Server, WifiOff, X } from 'lucide-react';
import { MODEL_DEFINITIONS, type ModelsStatusResponse } from '../types/restoration';

interface BackendIntegrationGuideProps {
  isOpen: boolean;
  onClose: () => void;
  modelsStatus: ModelsStatusResponse | null;
  isLoadingStatus: boolean;
  onRefreshStatus: () => void;
}

export function BackendIntegrationGuide({
  isOpen,
  onClose,
  modelsStatus,
  isLoadingStatus,
  onRefreshStatus,
}: BackendIntegrationGuideProps) {
  if (!isOpen) return null;

  return (
    <div
      id="backend-menu-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="integration-heading"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#161618] p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Server className="h-5 w-5 text-[#FF7A00]" aria-hidden="true" />
            <div>
              <h2 id="integration-heading" className="text-base font-semibold text-white">
                PyTorch Backend &amp; Model Status
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                REST endpoints connected via <code className="font-mono text-zinc-300">PYTORCH_API_URL</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close backend status panel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {modelsStatus ? (
              modelsStatus.backendConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Python PyTorch service connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <WifiOff className="h-4 w-4" aria-hidden="true" />
                  <span>PyTorch service not connected</span>
                </span>
              )
            ) : (
              <span className="text-xs text-zinc-400">Checking backend availability...</span>
            )}

            <button
              type="button"
              onClick={onRefreshStatus}
              disabled={isLoadingStatus}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 whitespace-nowrap transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7A00] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isLoadingStatus ? 'Checking...' : 'Refresh status'}</span>
            </button>
          </div>

          <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#111113]">
            {MODEL_DEFINITIONS.map((def) => {
              const status = modelsStatus?.models?.[def.id];
              const available = status?.available ?? false;

              return (
                <div key={def.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {def.name} ({def.shortLabel})
                    </p>
                    <p className="font-mono text-xs text-zinc-400">
                      {status?.checkpointPath ?? def.checkpointFile}
                    </p>
                  </div>

                  {available ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Unavailable</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#111113] px-3.5 py-2.5 font-mono text-xs text-zinc-400">
            <div>GET /api/models/status</div>
            <div className="mt-1">POST /api/restore (image, model=gan|diffusion|transformer|all)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
