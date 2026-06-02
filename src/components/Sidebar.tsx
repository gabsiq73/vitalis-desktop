import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'receipt_long', label: 'Orders', path: '/orders' },
  { icon: 'propane_tank', label: 'Bottles', path: '/bottles' },
  { icon: 'group', label: 'CRM', path: '/clients' },
  { icon: 'inventory_2', label: 'Inventory', path: '/inventory' },
  { icon: 'payments', label: 'Financial', path: '/financial' },
  { icon: 'inventory', label: 'Products', path: '/products' },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-[60] flex flex-col p-4 bg-[#14161C] w-64 border-r border-white/10 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-3 px-4 py-6 mb-4">
        <div className="h-10 w-10 bg-[#1F75FE] rounded-lg flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
          V
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-none">Vitalis</h1>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1">
            Logistics ERP
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[#1F75FE] text-white shadow-[0_0_12px_rgba(31,117,254,0.3)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 space-y-2 border-t border-white/5">
        <button className="w-full bg-[#1F75FE]/10 text-[#1F75FE] border border-[#1F75FE]/30 rounded-lg py-3 font-bold uppercase tracking-widest text-[10px] hover:bg-[#1F75FE] hover:text-white transition-all">
          New Order
        </button>
        <button
          onClick={logout}
          className="w-full text-slate-500 hover:text-red-400 text-[10px] font-semibold uppercase tracking-wider py-2 transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
