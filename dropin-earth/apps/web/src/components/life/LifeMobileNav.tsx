'use client';

import type { FocusEvent, ReactNode } from 'react';

/** Keep keyboard focus fully visible without scrolling the surrounding page. */
export function LifeMobileNav({ children, className, label }: { children: ReactNode; className: string | undefined; label: string }) {
  function revealFocus(event: FocusEvent<HTMLElement>) {
    const navigation = event.currentTarget;
    const target = event.target.getBoundingClientRect();
    const viewport = navigation.getBoundingClientRect();
    const margin = 8;
    const delta = target.right > viewport.right - margin ? target.right - viewport.right + margin
      : target.left < viewport.left + margin ? target.left - viewport.left - margin : 0;
    if (delta) navigation.scrollBy({ left: delta, behavior: 'instant' });
  }
  return <nav className={className} aria-label={label} onFocus={revealFocus}>{children}</nav>;
}
