import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import logoVitalis from '../assets/logo vitalis.png';

interface NavChild {
  icon: string;
  label: string;
  path: string;
}

interface NavItem {
  icon: string;
  label: string;
  path: string;
  badge?: string;
  children?: NavChild[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Geral',
    items: [
      { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
      { icon: 'shopping_cart', label: 'Pedidos', path: '/orders' },
      { icon: 'group', label: 'Clientes', path: '/clients' },
    ],
  },
  {
    label: 'Produtos',
    items: [
      { icon: 'category', label: 'Produtos', path: '/products' },
      { icon: 'inventory_2', label: 'Estoque', path: '/stock' },
      { icon: 'local_shipping', label: 'Fornecedores', path: '/suppliers' },
    ],
  },
  {
    label: 'Operações',
    items: [
      { icon: 'propane_tank', label: 'Vasilhames', path: '/bottles' },
      { icon: 'payments', label: 'Acertos de Gás', path: '/gas-settlements', badge: 'Em Breve' },
      { icon: 'assessment', label: 'Relatórios', path: '/reports', badge: 'Em Breve' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { icon: 'manage_accounts', label: 'Usuários', path: '/users' },
      { icon: 'settings', label: 'Configurações', path: '/settings' },
    ],
  },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { logout, auth } = useAuth();

  function isActive(path: string): boolean {
    if (pathname === path) return true;
    if (path !== '/dashboard' && pathname.startsWith(path + '/')) return true;
    return false;
  }

  function hasActiveChild(item: NavItem): boolean {
    return item.children?.some((c) => isActive(c.path)) ?? false;
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children?.some((c) => pathname === c.path || pathname.startsWith(c.path + '/'))) {
          initial[item.path] = true;
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children && hasActiveChild(item)) {
          setExpanded((prev) => ({ ...prev, [item.path]: true }));
        }
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  const username = auth?.username ?? 'Admin';
  const initial = username.charAt(0).toUpperCase();

  return (
    <aside className="w-64 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r border-slate-200 z-10">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0 border-b border-slate-200">
        <img src={logoVitalis} alt="Vitalis" className="h-9 w-auto object-contain" />
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const childActive = hasActiveChild(item);
                const isExpanded = expanded[item.path];
                const hasChildren = !!item.children?.length;
                const highlighted = active || childActive;

                return (
                  <li key={item.path}>
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpand(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                          highlighted
                            ? 'bg-primary/8 text-primary'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined flex-shrink-0 ${highlighted ? 'text-primary' : 'text-slate-400'}`}
                          style={{ fontSize: '18px' }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        <span
                          className={`material-symbols-outlined transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''} ${highlighted ? 'text-primary' : 'text-slate-300'}`}
                          style={{ fontSize: '16px' }}
                        >
                          expand_more
                        </span>
                      </button>
                    ) : (
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                          active
                            ? 'bg-primary/8 text-primary'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined flex-shrink-0 ${active ? 'text-primary' : 'text-slate-400'}`}
                          style={{ fontSize: '18px' }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Sub-items */}
                    {hasChildren && isExpanded && (
                      <ul className="mt-1 ml-4 pl-3 border-l-2 border-slate-100 space-y-0.5">
                        {item.children!.map((child) => {
                          const childIsActive = isActive(child.path);
                          return (
                            <li key={child.path}>
                              <Link
                                to={child.path}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                                  childIsActive
                                    ? 'bg-primary/8 text-primary'
                                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                }`}
                              >
                                <span
                                  className={`material-symbols-outlined flex-shrink-0 ${childIsActive ? 'text-primary' : 'text-slate-300'}`}
                                  style={{ fontSize: '16px' }}
                                >
                                  {child.icon}
                                </span>
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-700 truncate leading-none">{username}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Administrador</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-error hover:bg-red-50 transition-all"
            title="Sair"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
