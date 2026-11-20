import { Info } from 'lucide-react';

export function LimitationsNotice() {
  return (
    <aside
      aria-label="Model limitations note"
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#18181A] px-4 py-3.5"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A00]" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-zinc-300">
        <strong className="font-semibold text-white">Note:</strong> Restored images may contain
        inaccurate reconstructed details.
      </p>
    </aside>
  );
}
