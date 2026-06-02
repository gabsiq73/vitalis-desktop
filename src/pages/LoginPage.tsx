import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const REMEMBER_KEY = 'vitalis_remember_user';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    if (rememberUser) {
      localStorage.setItem(REMEMBER_KEY, username);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC] p-6">
      <main className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2 rounded-lg bg-primary-container mb-4">
            <span
              className="material-symbols-outlined text-on-primary-container"
              style={{ fontSize: '30px' }}
            >
              vital_signs
            </span>
          </div>
          <h1 className="text-h1 text-on-background tracking-tighter">Vitalis</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Logistics ERP System Control</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-[0_1px_2px_0_rgba(15,23,42,0.05),0_10px_15px_-3px_rgba(15,23,42,0.1)]">
          <div className="p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-h2 text-on-surface">Login</h2>
              <p className="text-body-md text-on-surface-variant">
                Acesse sua conta para gerenciar operações.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="flex items-center gap-2 p-4 bg-error-container text-on-error-container rounded-lg border border-error/20">
                  <span className="material-symbols-outlined text-error">error</span>
                  <span className="text-label-sm">
                    Credenciais inválidas. Verifique os dados e tente novamente.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-label-sm text-secondary" htmlFor="username">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="Seu nome de usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-label-sm text-secondary" htmlFor="password">
                    Password
                  </label>
                  <span className="text-label-sm text-primary cursor-pointer hover:underline">
                    Esqueceu a senha?
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-12 py-3 bg-white border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="rememberUser"
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20 cursor-pointer"
                />
                <label
                  htmlFor="rememberUser"
                  className="text-body-md text-on-surface-variant cursor-pointer select-none"
                >
                  Salvar usuário
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary text-h3 py-4 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  'Entrando...'
                ) : (
                  <>
                    Entrar
                    <span className="material-symbols-outlined">login</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-surface-container-low p-4 border-t border-outline-variant text-center">
            <p className="text-label-sm text-on-secondary-container">
              © 2024 Vitalis Logistics. All rights reserved.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            <span className="text-label-sm text-outline uppercase tracking-widest">
              Sistemas Operacionais
            </span>
          </div>
          <span className="text-outline text-xs opacity-30">|</span>
          <span className="text-label-sm text-outline uppercase tracking-widest">v2.4.0-build</span>
        </div>
      </main>
    </div>
  );
}
