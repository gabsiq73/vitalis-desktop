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
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-100 sticky top-0 z-40">

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
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Pesquisar pedidos, clientes..."
              type="text"
            />
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">

        <button className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal border-2 border-white" />
        </button>

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
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Administrador</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shadow-sm shadow-primary/20">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
