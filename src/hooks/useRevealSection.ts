import { useCallback, useEffect, useRef } from 'react';

/** Centers newly expanded fields after React has rendered them, only on user action. */
export function useRevealSection() {
  const frame = useRef<number>();

  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);

  return useCallback((control: HTMLElement, selector = '[data-reveal-content]') => {
    const section = control.closest('[data-reveal-section]');
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (!section?.isConnected) return;
      const content = section.querySelector<HTMLElement>(selector);
      content?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });
  }, []);
}
