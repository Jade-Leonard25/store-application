/**
 * Spreadsheet Grapher — Input primitive
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { el, type Attrs } from '@/lib/dom';

const inputVariants = cva(
  [
    'flex w-full rounded-md border text-fg bg-bg',
    'placeholder:text-fg-muted',
    'transition-[color,background-color,border-color,box-shadow] duration-150 ease-press',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg'
  ],
  {
    variants: {
      variant: {
        default: 'border-border hover:border-fg-muted/60',
        filled: 'border-transparent bg-bg-elev-2 hover:bg-border',
        ghost: 'border-transparent bg-transparent hover:bg-bg-elev-2'
      },
      size: {
        sm: 'h-7 px-2 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-3.5 text-sm'
      },
      invalid: {
        true: 'border-danger focus-visible:ring-danger focus-visible:border-danger',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      invalid: false
    }
  }
);

/* ---------------------------------------------------------------------------
 * Pass-through attributes
 *
 * Explicit allow-list instead of `Omit<HTMLInputElement, ...>`.
 *
 * Why: HTMLInputElement (and its parents Element / Node / EventTarget) has
 * dozens of properties — `size`, `prefix`, `style`, `value`, `form`, and so
 * on. Every name we choose as a variant or a slot risks colliding with one
 * of them, and the collision list grows silently as the DOM spec evolves.
 *
 * An allow-list is honest: it says exactly what the caller can pass, no
 * surprises, no version drift. Add an entry here when you need it — that's
 * a deliberate one-line change, not a bug.
 * ------------------------------------------------------------------------ */

export interface InputAttributes {
  // Identity
  id?: string;
  name?: string;
  type?: 'text' | 'search' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'file';

  // Value
  value?: string;
  defaultValue?: string;
  placeholder?: string;

  // State
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autofocus?: boolean;
  spellcheck?: boolean;

  // Native size attribute (character width). Renamed to avoid colliding
  // with our `size` variant, which is the visual height/padding recipe.
  htmlSize?: number;

  // Constraints
  min?: string | number;
  max?: string | number;
  step?: string | number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Hints
  autocomplete?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';

  // ARIA (only the ones we actually use)
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;

  // Events
  oninput?: (e: Event) => void;
  onchange?: (e: Event) => void;
  onfocus?: (e: FocusEvent) => void;
  onblur?: (e: FocusEvent) => void;
  onclick?: (e: MouseEvent) => void;
  onkeydown?: (e: KeyboardEvent) => void;
  onkeyup?: (e: KeyboardEvent) => void;
}

type InputVariantProps = VariantProps<typeof inputVariants>;

export interface InputProps extends InputAttributes, InputVariantProps {
  className?: string;
  style?: string;
  /** Node rendered before the input, inside the wrapper. Good for icons. */
  prefix?: Node;
  /** Node rendered after the input, inside the wrapper. Good for units, clear buttons. */
  suffix?: Node;
}

export interface InputComponent {
  /** The wrapper element (flex container). Append this to your layout. */
  el: HTMLElement;
  /** The actual <input> element. Use for focus(), value, selection, etc. */
  input: HTMLInputElement;
}

export function Input(props: InputProps = {}): InputComponent {
  const {
    variant,
    size,
    invalid,
    className,
    style,
    prefix,
    suffix,
    htmlSize,
    ...rest
  } = props;

   const input = el('input', {
    ...rest,
    size: htmlSize,
    class: cn(
      inputVariants({ variant, size, invalid }),
      (prefix || suffix) && 'border-0 focus-visible:ring-0 rounded-none bg-transparent px-0',
      className
    ),
    style: prefix || suffix ? undefined : style
  } as Attrs<'input'>);

  if (!prefix && !suffix) {
    return { el: input as unknown as HTMLElement, input };
  }

  const wrapper = el('div', {
    class: cn(
      'flex items-center gap-2 rounded-md border border-border bg-bg px-3',
      size === 'sm' && 'h-7 text-xs',
      (size === 'md' || !size) && 'h-9 text-sm',
      size === 'lg' && 'h-10 text-sm',
      'transition-[border-color,box-shadow] duration-150 ease-press',
      'focus-within:ring-1 focus-within:ring-accent focus-within:border-accent',
      invalid && 'border-danger focus-within:ring-danger focus-within:border-danger',
      'hover:border-fg-muted/60',
      className
    ),
    style
  });

  if (prefix) {
    wrapper.appendChild(
      el('span', { class: 'text-fg-muted shrink-0 flex items-center' }, [prefix])
    );
  }
  wrapper.appendChild(input);
  if (suffix) {
    wrapper.appendChild(
      el('span', { class: 'text-fg-muted shrink-0 flex items-center' }, [suffix])
    );
  }

  return { el: wrapper, input };
}

export { inputVariants };
export type { InputVariantProps };