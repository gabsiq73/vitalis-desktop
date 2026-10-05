import { useState, useCallback, useRef } from 'react';
import { NotificationContext, type AppNotification, type NotificationType } from './notification';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = crypto.randomUUID();
    const n: AppNotification = { id, message, type, timestamp: new Date(), read: false };

    setNotifications(prev => [n, ...prev]);
    setToasts(prev => [n, ...prev]);

    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, 4500);
    timers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, toasts, unreadCount, notify, markAllRead, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
}
