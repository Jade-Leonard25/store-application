/**
 * Spreadsheet Grapher — Button primitive
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { el } from '@/lib/dom';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-md font-medium whitespace-nowrap select-none',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
    'disabled:opacity-50 disabled:pointer-events-none cursor-pointer'
  ],
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover border border-accent',
        secondary: 'bg-bg-elev-2 text-fg border border-border hover:bg-border',
        outline: 'bg-transparent text-fg border border-border hover:bg-bg-elev-2',
        ghost: 'bg-transparent text-fg hover:bg-bg-elev-2 border border-transparent',
        danger: 'bg-danger text-white border border-danger hover:opacity-90',
        link: 'bg-transparent text-accent underline-offset-4 hover:underline border-0 px-0'
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-9 w-9 p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

type NativeButtonProps = Partial<
  Omit<
    HTMLButtonElement,
    | 'className'
    | 'classList'
    | 'style'
    | 'children'
    | 'innerHTML'
    | 'outerHTML'
    | 'textContent'
    | 'innerText'
    | 'outerText'
    | 'dataset'
    | 'attributes'
  >
>;

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ButtonProps extends NativeButtonProps, ButtonVariantProps {
  className?: string;
  style?: string;
  text?: string;
  children?: Array<Node | string>;
}

export function Button(props: ButtonProps = {}): HTMLButtonElement {
  const { variant, size, className, style, text, children, ...rest } = props;

  const btn = el('button', {
    type: 'button',
    ...rest,
    class: cn(buttonVariants({ variant, size }), className),
    style
  });

  if (text != null) btn.textContent = text;

  if (children) {
    for (const child of children) {
      btn.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }

  return btn;
}

export { buttonVariants };
export type { ButtonProps, ButtonVariantProps };