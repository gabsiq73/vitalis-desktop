import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { icon: 'shopping_cart', label: 'Orders', path: '/orders' },
  { icon: 'group', label: 'Clients', path: '/clients' },
  { icon: 'inventory_2', label: 'Stock', path: '/stock' },
  { icon: 'category', label: 'Products', path: '/products' },
  { icon: 'propane_tank', label: 'Bottles', path: '/bottles' },
  { icon: 'local_shipping', label: 'Suppliers', path: '/suppliers' },
  { icon: 'payments', label: 'Gas Settlements', path: '/gas-settlements' },
  { icon: 'assessment', label: 'Reports', path: '/reports' },
  { icon: 'person_outline', label: 'Users', path: '/users' },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  function isActive(path: string): boolean {
    if (pathname === path) return true;
    if (path !== '/dashboard' && pathname.startsWith(path + '/')) return true;
    return false;
  }

  return (
    <aside className="w-64 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-on-secondary-fixed shadow-lg overflow-y-auto z-10">
      <div className="px-6 py-8 flex-shrink-0">
        <h1 className="text-h2 font-black text-surface-container-lowest tracking-tighter">
          Vitalis
        </h1>
        <p className="text-xs text-secondary-fixed-dim opacity-70 mt-0.5">Logistics System</p>
      </div>

      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-2 rounded text-body-md transition-colors ${
                    active
                      ? 'text-primary-fixed-dim font-bold border-l-4 border-primary-fixed-dim bg-on-secondary-fixed-variant/20'
                      : 'text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 flex-shrink-0 border-t border-on-secondary-fixed-variant/20">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-error-container text-on-error-container py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            logout
          </span>
          Logout
        </button>
      </div>
    </aside>
  );
}
