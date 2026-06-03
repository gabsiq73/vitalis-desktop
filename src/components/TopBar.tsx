import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface TopBarProps {
  title?: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const username = auth?.username ?? 'Admin';
  const initial = username.charAt(0).toUpperCase();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-surface border-b border-outline-variant sticky top-0 z-40">

      {/* Left: page context or search */}
      <div className="flex items-center gap-4">
        {title ? (
          <div>
            <h2 className="text-[15px] font-bold text-on-surface leading-none">{title}</h2>
            {subtitle && <p className="text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
        ) : (
          <div className="relative w-60">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
              style={{ fontSize: '17px' }}
            >
              search
            </span>
            <input
              className="w-full pl-9 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Pesquisar pedidos, clientes..."
              type="text"
            />
          </div>
        )}
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-1">

        {/* Notification bell */}
        <button className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
          {/* dot indicator */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal border-2 border-surface" />
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all"
          title="Configurações"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</span>
        </button>

        <div className="h-5 w-px bg-outline-variant mx-1" />

        {/* User */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden sm:block text-right">
            <p className="text-[13px] font-bold text-on-surface leading-none">{username}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">Administrador</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-black text-sm">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
