import { useAuth } from '../hooks/useAuth';

export function TopBar() {
  const { auth } = useAuth();

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-surface border-b border-outline-variant sticky top-0 z-40">
      <div className="relative w-64">
        <span
          className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline"
          style={{ fontSize: '20px' }}
        >
          search
        </span>
        <input
          className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          placeholder="Search orders, clients..."
          type="text"
        />
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 text-on-surface-variant hover:text-primary transition-all">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 text-on-surface-variant hover:text-primary transition-all">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-on-surface leading-none">{auth?.username ?? 'Admin'}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Administrator</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-bold border border-outline-variant">
            {auth?.username?.charAt(0).toUpperCase() ?? 'A'}
          </div>
        </div>
      </div>
    </header>
  );
}
