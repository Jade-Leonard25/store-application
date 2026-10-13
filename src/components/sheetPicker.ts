import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';
import { Button } from '@/components/ui/button';

export function createSheetPicker(
  sheets: string[],
  activeIndex: number,
  onChange: (index: number) => void
): Component {
  const root = el('div', { class: 'flex flex-wrap gap-1' });

  sheets.forEach((name, i) => {
    const isActive = i === activeIndex;
    const btn = Button({
      variant: isActive ? 'secondary' : 'ghost',
      size: 'sm',
      text: name,
      title: name,
      className: isActive ? 'border-accent' : '',
      onclick: () => onChange(i)
    });
    root.appendChild(btn);
  });

  return { el: root };
}