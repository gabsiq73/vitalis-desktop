import { useEffect, useRef } from 'react';

/**
 * Scrolls the attached element into view whenever `trigger` becomes truthy
 * (a non-empty error string, a non-empty error array, etc.), so inline error
 * banners are visible even if the page was scrolled elsewhere when the error appeared.
 */
export function useScrollToError<T extends HTMLElement = HTMLDivElement>(trigger: unknown) {
  const ref = useRef<T>(null);
  const hasContent = Array.isArray(trigger) ? trigger.length > 0 : Boolean(trigger);

  useEffect(() => {
    if (hasContent) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent]);

  return ref;
}
