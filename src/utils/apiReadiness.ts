export async function waitForApiReady(
  probe: (signal: AbortSignal) => Promise<boolean>,
  options: { signal: AbortSignal; timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal.aborted) return false;
  options.signal.addEventListener('abort', abort, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<false>(resolve => {
    timeout = setTimeout(() => { controller.abort(); resolve(false); }, options.timeoutMs ?? 60000);
  });
  const cancellation = new Promise<false>(resolve => controller.signal.addEventListener('abort', () => resolve(false), { once: true }));
  try {
    const polling = async () => {
      while (!controller.signal.aborted) {
        try { if (await probe(controller.signal)) return true; } catch { /* API still starting */ }
        if (controller.signal.aborted) break;
        await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, options.intervalMs ?? 500);
          controller.signal.addEventListener('abort', done, { once: true });
        });
      }
      return false;
    };
    return await Promise.race([polling(), deadline, cancellation]);
  } finally {
    clearTimeout(timeout); controller.abort(); options.signal.removeEventListener('abort', abort);
  }
}
