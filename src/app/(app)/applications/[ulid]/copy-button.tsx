'use client';

import { useState } from 'react';

/** Copies `text` for pasting into the job platform's form. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setState('copied');
        } catch {
            setState('failed');
        }

        setTimeout(() => setState('idle'), 2000);
    }

    return (
        <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface print:hidden"
            aria-live="polite"
        >
            {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed' : label}
        </button>
    );
}

/** Opens the print dialog; `fileName` becomes the suggested name of a saved PDF. */
export function PrintButton({ fileName }: { fileName: string }) {
    return (
        <button
            type="button"
            onClick={() => {
                document.title = fileName;
                window.print();
            }}
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background print:hidden"
        >
            Print / Save as PDF
        </button>
    );
}
