import { useState } from 'react';
import { X, Sparkles, External } from './icons';

/**
 * Prompts the user for their own Gemini API key (BYOK). Shown only when the
 * deployment has no server-side key. The key is used to call Google directly
 * from the browser and is never sent to our servers.
 */
export default function KeyModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (key: string, remember: boolean) => void;
  onClose: () => void;
}) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
              <Sparkles width={17} height={17} />
            </span>
            <h3 className="text-base font-bold">Add your Gemini key</h3>
          </div>
          <button onClick={onClose} className="text-[#8a8880] hover:text-white">
            <X width={18} height={18} />
          </button>
        </div>

        <p className="mb-4 text-[13px] leading-relaxed text-[#98958d]">
          Paste a free Gemini API key to unlock AI review &amp; copywriting. Your key is sent{' '}
          <b className="text-[#b9b6ae]">only to Google, directly from your browser</b> — never to
          our servers.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) onSubmit(key.trim(), remember);
          }}
        >
          <input
            autoFocus
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza… or AQ.…"
            className="field font-mono"
            autoComplete="off"
            spellCheck={false}
          />

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-[#b9b6ae]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Remember for this browser session
          </label>

          <div className="mt-4 flex items-center justify-between gap-3">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#8a8880] hover:text-brand"
            >
              <External width={13} height={13} /> Get a free key
            </a>
            <button type="submit" className="btn-primary" disabled={!key.trim()}>
              <Sparkles /> Use key &amp; polish
            </button>
          </div>
        </form>

        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-[#6c6a64]">
          Stored only in this browser tab{remember ? ' (session storage)' : ' (memory)'}, cleared when
          you close it. ShopiCat is open-source — you can verify this in the code.
        </p>
      </div>
    </div>
  );
}
