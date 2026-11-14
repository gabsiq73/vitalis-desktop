import { Link, useNavigate } from 'react-router-dom';
import { UserForm } from '../components/UserForm';
import { publicHttp } from '../api/http';
import { useNotification } from '../hooks/useNotification';
import type { UserRequestDTO, UserUpdateDTO, UserResponseDTO } from '../types';

export function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useNotification();

  async function register(data: UserRequestDTO | UserUpdateDTO) {
    const response = await publicHttp.post<UserResponseDTO>('/users', data);
    notify('Conta criada com sucesso. Entre com seu usuário e senha.', 'success');
    navigate('/login', { replace: true, state: { registeredUsername: response.data.username } });
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-lg bg-surface border border-outline-variant rounded-xl shadow-sm">
        <div className="px-6 pt-6">
          <Link to="/login" className="text-primary hover:underline">Voltar para login</Link>
          <h1 className="text-h1 text-on-surface mt-4">Criar conta</h1>
          <p className="text-body-md text-on-surface-variant">Cadastre um Administrador ou Vendedor para acessar o Vitalis.</p>
        </div>
        <UserForm publicRegistration onSubmit={register} onClose={() => navigate('/login')} />
      </section>
    </main>
  );
}
