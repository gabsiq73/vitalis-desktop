import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification, type NotificationType } from '../contexts/NotificationContext';

interface TopBarProps {
  title?: string;
  subtitle?: string;
}

const TYPE_ICON: Record<NotificationType, string> = {
  success: 'check_circle',
  error:   'error',
  warning: 'warning',
  info:    'info',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  success: 'text-green-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
};

const TYPE_ROW_BG: Record<NotificationType, string> = {
  error:   'bg-red-50/80',
  warning: 'bg-amber-50/80',
  success: '',
  info:    '',
};

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead } = useNotification();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const username = auth?.username ?? 'Admin';
  const initial = username.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggleOpen() {
    if (!open) markAllRead();
    setOpen(v => !v);
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 sticky top-0 z-40">

      {/* Left */}
      <div className="flex items-center gap-4">
        {title ? (
          <div>
            <h2 className="text-[15px] font-bold text-slate-800 leading-none">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        ) : (
          <div className="relative w-64">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              style={{ fontSize: '17px' }}
            >
              search
            </span>
            <input
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Pesquisar pedidos, clientes..."
              type="text"
            />
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">

        {/* Notification bell */}
        <div ref={ref} className="relative">
          <button
            onClick={toggleOpen}
            className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 border-2 border-white text-white text-[9px] font-black flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {unreadCount === 0 && notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal border-2 border-white" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-card-hover z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-700">Últimas notificações</p>
                <span className="text-[11px] text-slate-400">{notifications.length > 5 ? `${notifications.length} total` : `${notifications.length} total`}</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <span className="material-symbols-outlined mb-2" style={{ fontSize: '32px' }}>notifications_none</span>
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.slice(0, 5).map(n => (
                    <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0 ${TYPE_ROW_BG[n.type]}`}>
                      <span className={`material-symbols-outlined flex-shrink-0 mt-0.5 ${TYPE_COLOR[n.type]}`} style={{ fontSize: '16px' }}>
                        {TYPE_ICON[n.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-700 leading-snug">{n.message}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{formatTime(n.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
                {notifications.length > 5 && (
                  <p className="px-4 py-2 text-[11px] text-slate-400 text-center border-t border-slate-50">
                    +{notifications.length - 5} notificação(ões) mais antigas
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          title="Configurações"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</span>
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-semibold text-slate-700 leading-none">{username}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Administrador</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shadow-sm shadow-primary/20">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
