import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNotification } from '../contexts/NotificationContext';
import type { OrderResponseDTO, SpringPage } from '../types';

export function useDeliveryNotifications() {
  const { http } = useAuth();
  const { notify } = useNotification();
  const timersByKey = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!http) return;

    let cancelled = false;

    async function scheduleNotifications() {
      try {
        const [activeRes, pendingRes] = await Promise.allSettled([
          http!.get<OrderResponseDTO[]>('/orders/active'),
          http!.get<SpringPage<OrderResponseDTO>>('/orders', {
            params: { status: 'PENDING', size: 50 },
          }),
        ]);

        if (cancelled) return;

        const now = Date.now();
        const all: OrderResponseDTO[] = [];
        if (activeRes.status === 'fulfilled') all.push(...activeRes.value.data);
        if (pendingRes.status === 'fulfilled') all.push(...pendingRes.value.data.content);

        all
          .filter((o) => o.deliveryDate && new Date(o.deliveryDate).getTime() > now)
          .forEach((o) => {
            const deliveryMs = new Date(o.deliveryDate!).getTime();
            const shortId = o.id.slice(-6).toUpperCase();

            const enqueue = (key: string, delay: number, message: string, type: 'warning' | 'error') => {
              if (delay > 0 && !timersByKey.current.has(key)) {
                const t = setTimeout(() => {
                  timersByKey.current.delete(key);
                  notify(message, type);
                }, delay);
                timersByKey.current.set(key, t);
              }
            };

            enqueue(
              `${o.id}-30`,
              deliveryMs - 30 * 60 * 1000 - now,
              `Entrega #${shortId} (${o.clientName}) em 30 minutos`,
              'warning',
            );

            enqueue(
              `${o.id}-10`,
              deliveryMs - 10 * 60 * 1000 - now,
              `URGENTE: Entrega #${shortId} (${o.clientName}) em 10 minutos!`,
              'error',
            );
          });
      } catch {
        // silently ignore — non-critical background feature
      }
    }

    scheduleNotifications();
    const interval = setInterval(() => {
      if (!cancelled) scheduleNotifications();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      timersByKey.current.forEach(clearTimeout);
      timersByKey.current.clear();
    };
  }, [http]); // eslint-disable-line react-hooks/exhaustive-deps
}
