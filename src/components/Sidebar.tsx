import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
    label: 'GERAL',
    items: [
      { icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
      { icon: 'shopping_cart', label: 'Pedidos', path: '/orders' },
      { icon: 'group', label: 'Clientes', path: '/clients' },
    ],
  },
  {
    label: 'PRODUTOS',
    items: [
      {
        icon: 'category',
        label: 'Produtos',
        path: '/products',
        children: [
          { icon: 'inventory_2', label: 'Estoque', path: '/stock' },
          { icon: 'propane_tank', label: 'Vasilhames', path: '/bottles' },
        ],
      },
      { icon: 'local_shipping', label: 'Fornecedores', path: '/suppliers' },
    ],
  },
  {
    label: 'OPERAÇÕES',
    items: [
      { icon: 'payments', label: 'Acertos de Gás', path: '/gas-settlements', badge: 'EM BREVE' },
      { icon: 'assessment', label: 'Relatórios', path: '/reports', badge: 'EM BREVE' },
    ],
  },
  {
    label: 'SISTEMA',
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
        if (item.children && item.children.some((c) => pathname === c.path || pathname.startsWith(c.path + '/'))) {
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
  }, [pathname]);

  function toggleExpand(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  const username = auth?.username ?? 'Admin';
  const initial = username.charAt(0).toUpperCase();

  return (
    <aside className="w-64 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-on-secondary-fixed shadow-lg overflow-y-auto z-10">

      {/* Logo */}
      <div className="px-5 pt-7 pb-6 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>propane</span>
        </div>
        <div>
          <h1 className="text-[17px] font-black text-white tracking-tight leading-none">Vitalis</h1>
          <p className="text-[10px] text-secondary-fixed-dim opacity-60 mt-0.5 uppercase tracking-widest">Logistics</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 space-y-5 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-bold tracking-[0.12em] text-secondary-fixed-dim/40 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const childActive = hasActiveChild(item);
                const isExpanded = expanded[item.path];
                const hasChildren = !!item.children?.length;

                return (
                  <li key={item.path}>
                    {hasChildren ? (
                      <button
                        onClick={() => toggleExpand(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-body-md transition-all ${
                          childActive || active
                            ? 'text-white bg-on-secondary-fixed-variant/40'
                            : 'text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant/30 hover:text-white'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined flex-shrink-0 ${childActive || active ? 'text-teal' : ''}`}
                          style={{ fontSize: '18px' }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left font-medium text-[13px]">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-on-secondary-fixed-variant/50 text-secondary-fixed-dim uppercase tracking-wide">
                            {item.badge}
                          </span>
                        )}
                        <span
                          className={`material-symbols-outlined transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
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
                            ? 'text-white bg-on-secondary-fixed-variant/40 border-l-2 border-teal'
                            : 'text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant/30 hover:text-white'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined flex-shrink-0 ${active ? 'text-teal' : ''}`}
                          style={{ fontSize: '18px' }}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-on-secondary-fixed-variant/50 text-secondary-fixed-dim uppercase tracking-wide">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Sub-items */}
                    {hasChildren && isExpanded && (
                      <ul className="mt-0.5 ml-3 pl-3 border-l border-on-secondary-fixed-variant/30 space-y-0.5">
                        {item.children!.map((child) => {
                          const childIsActive = isActive(child.path);
                          return (
                            <li key={child.path}>
                              <Link
                                to={child.path}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                                  childIsActive
                                    ? 'text-white bg-on-secondary-fixed-variant/40 border-l-2 border-teal'
                                    : 'text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant/30 hover:text-white'
                                }`}
                              >
                                <span
                                  className={`material-symbols-outlined flex-shrink-0 ${childIsActive ? 'text-teal' : ''}`}
                                  style={{ fontSize: '15px' }}
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
      <div className="flex-shrink-0 border-t border-on-secondary-fixed-variant/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate">{username}</p>
            <p className="text-[10px] text-secondary-fixed-dim/60 uppercase tracking-wider">Administrador</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-secondary-fixed-dim hover:text-error hover:bg-error/10 transition-all"
            title="Sair"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
