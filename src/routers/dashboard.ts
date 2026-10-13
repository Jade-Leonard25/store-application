import { el } from '@/lib/dom';
import { createDropZone } from '@/components/dropZone';

export interface DashboardOptions {
  onFile: (bytes: Uint8Array, name: string) => void;
  onBrowse: () => void;
}

export interface DashboardComponent {
  el: HTMLElement;
  setError(msg: string | null): void;
  destroy(): void;
}

export function createDashboard(opts: DashboardOptions): DashboardComponent {
  const errorBanner = el('div', {
    class:
      'hidden w-full max-w-[520px] bg-danger/10 border border-danger/40 text-danger ' +
      'px-3.5 py-2.5 rounded-lg text-sm'
  });

  let errorTimeout: number | undefined;

  function setError(msg: string | null): void {
    if (errorTimeout) {
      window.clearTimeout(errorTimeout);
      errorTimeout = undefined;
    }

    if (!msg) {
      errorBanner.classList.add('hidden');
      return;
    }

    errorBanner.textContent = msg;
    errorBanner.classList.remove('hidden');

    errorTimeout = window.setTimeout(() => {
      errorBanner.classList.add('hidden');
      errorTimeout = undefined;
    }, 8000);
  }

  const dropZone = createDropZone({
    onFile: opts.onFile,
    onBrowse: opts.onBrowse,
    onError: setError
  });

  const hero = el(
    'div',
    { class: 'flex flex-col items-center gap-2 text-center max-w-[520px]' },
    [
      el('div', { class: 'text-6xl leading-none mb-2 select-none' }, ['📊']),
      el('h1', { class: 'text-2xl font-semibold tracking-tight' }, [
        'Spreadsheet Grapher'
      ]),
      el('p', { class: 'text-fg-muted text-sm' }, [
        'Upload a CSV or Excel file and see it as a chart in seconds.'
      ])
    ]
  );

  const hints = el(
    'ul',
    { class: 'flex flex-col gap-1.5 text-xs text-fg-muted mt-2' },
    [
      hint('Everything runs locally — nothing leaves your machine'),
      hint('Handles files with hundreds of thousands of rows'),
      hint('Auto-detects column types and picks a chart for you')
    ]
  );

  const root = el(
    'div',
    { class: 'flex-1 flex flex-col items-center justify-center gap-6 p-8' },
    [hero, errorBanner, dropZone.el, hints]
  );

  return {
    el: root,
    setError,
    destroy() {
      if (errorTimeout) window.clearTimeout(errorTimeout);
      dropZone.destroy?.();
    }
  };
}

function hint(text: string): HTMLElement {
  return el('li', { class: 'flex items-center gap-2' }, [
    el('span', { class: 'text-accent select-none', 'aria-hidden': 'true' }, ['✓']),
    text
  ]);
}