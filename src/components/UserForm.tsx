import { useRef, useState } from 'react';
import type { UserRequestDTO, UserResponseDTO, UserUpdateDTO, UserRole } from '../types';
import { useScrollToError } from '../hooks/useScrollToError';
import { parseApiError } from '../utils/parseApiError';
import { validateUser } from '../utils/userValidation';

interface UserFormProps {
  initial?: UserResponseDTO;
  publicRegistration?: boolean;
  onSubmit: (data: UserRequestDTO | UserUpdateDTO) => Promise<void>;
  onClose: () => void;
}

export function UserForm({ initial, onSubmit, onClose, publicRegistration = false }: UserFormProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const submitting = useRef(false);
  const [userRole, setUserRole] = useState<UserRole>(initial?.userRole ?? 'SELLER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useScrollToError<HTMLParagraphElement>(error);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const validation = validateUser({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, username: username.trim(), email: email.trim(), password, userRole }, confirmation, !!initial);
    if (validation) { setError(validation); return; }
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      if (initial) {
        const update: UserUpdateDTO = {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          username: username.trim(),
          email: email.trim(),
          userRole,
          ...(password ? { password } : {}),
        };
        await onSubmit(update);
      } else {
        const create: UserRequestDTO = {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          username: username.trim(),
          email: email.trim(),
          password,
          userRole,
        };
        await onSubmit(create);
        setPassword('');
        setConfirmation('');
      }
    } catch (error) {
      setError(parseApiError(error));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="p-6 space-y-4 min-h-0 overflow-y-auto">
      <fieldset disabled={loading} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="user-firstName" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
              Nome *
            </label>
            <input
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="João"
              id="user-firstName" value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={20}
            />
          </div>
          <div>
            <label htmlFor="user-lastName" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
              Sobrenome
            </label>
            <input
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="Silva"
              id="user-lastName" value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        <div>
          <label htmlFor="user-username" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Nome de usuário *
          </label>
          <input
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="joao_silva"
            id="user-username" value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
          />
        </div>

        <div>
          <label htmlFor="user-email" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Email *
          </label>
          <input
            type="email"
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="email@vitalis.com"
            id="user-email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="user-password" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            {initial ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="••••••"
            id="user-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
          />
        </div>

        {!initial && (
          <div>
            <label htmlFor="user-confirmation" className="block text-label-sm text-on-surface-variant uppercase mb-1.5">Confirmação de senha *</label>
            <input id="user-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 outline-none" />
          </div>
        )}
        <div>
          <label className="block text-label-sm text-on-surface-variant uppercase mb-1.5">
            Perfil de Acesso *
          </label>
          <div className="flex gap-3">
            {(['SELLER', 'ADMIN'] as UserRole[]).map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={userRole === role}
                onClick={() => setUserRole(role)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-bold text-sm transition-all ${
                  userRole === role
                    ? 'bg-primary text-on-primary border-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {role === 'ADMIN' ? 'admin_panel_settings' : 'sell'}
                </span>
                {role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
              </button>
            ))}
          </div>
        </div>

      </fieldset>
      {error && <p role="alert" ref={errorRef} className="text-sm text-error">{error}</p>}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2.5 border border-outline-variant rounded-lg font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
        >
          {publicRegistration ? 'Voltar para login' : 'Cancelar'}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
        >
          {loading ? 'Salvando...' : initial ? 'Salvar Alterações' : publicRegistration ? 'Criar conta' : 'Criar Usuário'}
        </button>
      </div>
    </form>
  );
}

