import { createContext } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
}

export interface NotificationContextType {
  notifications: AppNotification[];
  toasts: AppNotification[];
  unreadCount: number;
  notify: (message: string, type?: NotificationType) => void;
  markAllRead: () => void;
  dismissToast: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);
