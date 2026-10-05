import { useContext } from 'react';
import { NotificationContext } from '../contexts/notification';

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside NotificationProvider');
  return ctx;
}
