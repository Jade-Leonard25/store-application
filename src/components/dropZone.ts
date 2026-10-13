import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';
import { Button } from '@/components/ui/button';

export interface DropZoneCallbacks {
  onFile: (bytes: Uint8Array, name: string) => void;
  onBrowse: () => void;
  onError: (msg: string) => void;
}

export function createDropZone(cb: DropZoneCallbacks): Component {
  const input = el('input', {
    type: 'file',
    accept: '.csv,.tsv,.xlsx,.xls',
    class: 'hidden'
  });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (f) await handleFile(f);
    input.value = '';
  });

  const browseBtn = Button({
    variant: 'default',
    size: 'lg',
    text: 'Browse files…',
    onclick: () => cb.onBrowse()
  });

  const root = el(
    'div',
    {
      class:
        'border-2 border-dashed border-border rounded-xl bg-bg-elev px-12 py-12 text-center w-full max-w-[520px] transition-colors'
    },
    [
      el('div', { class: 'text-5xl leading-none' }, ['📊']),
      el('h2', { class: 'mt-3 mb-1 text-lg font-semibold' }, ['Drop a CSV or Excel file']),
      el('p', { class: 'text-fg-muted mb-3' }, ['or']),
      browseBtn,
      el('p', { class: 'text-fg-muted text-xs mt-3' }, ['Supports .csv, .tsv, .xlsx']),
      input
    ]
  );

  root.addEventListener('dragover', (e) => {
    e.preventDefault();
    root.classList.add('border-accent', 'bg-bg-elev-2');
  });
  root.addEventListener('dragleave', () => {
    root.classList.remove('border-accent', 'bg-bg-elev-2');
  });
  root.addEventListener('drop', async (e) => {
    e.preventDefault();
    root.classList.remove('border-accent', 'bg-bg-elev-2');
    const f = e.dataTransfer?.files?.[0];
    if (f) await handleFile(f);
  });

  async function handleFile(file: File): Promise<void> {
    try {
      if (file.size > 100 * 1024 * 1024) {
        cb.onError(`File "${file.name}" exceeds the 100 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        return;
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      cb.onFile(buf, file.name);
    } catch (err) {
      cb.onError(err instanceof Error ? err.message : String(err));
    }
  }

  return { el: root };
}