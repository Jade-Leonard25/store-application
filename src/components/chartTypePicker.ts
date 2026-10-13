import type { ChartType } from '@/shared/types';
import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';
import { Button } from '@/components/ui/button';

const TYPES: Array<{ value: ChartType; label: string }> = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'area', label: 'Area' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'pie', label: 'Pie' }
];

export function createChartTypePicker(
  active: ChartType,
  onChange: (t: ChartType) => void
): Component {
  const root = el('div', { class: 'flex flex-wrap gap-1.5' });

  for (const t of TYPES) {
    const isActive = t.value === active;
    const btn = Button({
      variant: isActive ? 'default' : 'outline',
      size: 'sm',
      text: t.label,
      className: 'rounded-full',
      onclick: () => onChange(t.value)
    });
    btn.setAttribute('data-type', t.value);
    root.appendChild(btn);
  }

  return { el: root };
}