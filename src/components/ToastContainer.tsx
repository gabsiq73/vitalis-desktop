import { useNotification, type NotificationType } from '../contexts/NotificationContext';

const TOAST_STYLES: Record<NotificationType, { bg: string; border: string; icon: string; iconColor: string; textColor: string }> = {
  success: { bg: 'bg-white', border: 'border-green-200', icon: 'check_circle', iconColor: 'text-green-500', textColor: 'text-slate-700' },
  error:   { bg: 'bg-white', border: 'border-red-200',   icon: 'error',        iconColor: 'text-red-500',   textColor: 'text-slate-700' },
  warning: { bg: 'bg-white', border: 'border-amber-200', icon: 'warning',      iconColor: 'text-amber-500', textColor: 'text-slate-700' },
  info:    { bg: 'bg-white', border: 'border-blue-200',  icon: 'info',         iconColor: 'text-blue-500',  textColor: 'text-slate-700' },
};

const ACCENT: Record<NotificationType, string> = {
  success: 'bg-green-500',
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useNotification();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((toast) => {
        const s = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border ${s.bg} ${s.border} shadow-card-hover min-w-[280px] max-w-sm animate-[slideIn_0.2s_ease-out]`}
          >
            <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${ACCENT[toast.type]}`} style={{ position: 'relative', width: '3px', flexShrink: 0 }}>
            </div>
            <span className={`material-symbols-outlined flex-shrink-0 mt-0.5 ${s.iconColor}`} style={{ fontSize: '18px' }}>
              {s.icon}
            </span>
            <p className={`flex-1 text-sm font-medium ${s.textColor} leading-snug`}>{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded text-slate-300 hover:text-slate-500 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
