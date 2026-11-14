import type { UserRequestDTO, UserUpdateDTO } from '../types';

export function validateUser(data: UserRequestDTO | UserUpdateDTO, confirmation: string, editing = false): string {
  if (!data.firstName || data.firstName.length < 2 || data.firstName.length > 20) return 'Nome deve ter entre 2 e 20 caracteres.';
  if (data.lastName && (data.lastName.length < 2 || data.lastName.length > 20)) return 'Sobrenome deve ter entre 2 e 20 caracteres.';
  if (!data.username || data.username.length < 2 || data.username.length > 30) return 'Nome de usuário deve ter entre 2 e 30 caracteres.';
  if (!data.email || data.email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Informe um email válido com até 100 caracteres.';
  if ((!editing || data.password) && (!data.password?.trim() || data.password.length < 6)) return 'Senha deve ter no mínimo 6 caracteres.';
  if (!editing && data.password !== confirmation) return 'A confirmação de senha deve ser igual à senha.';
  if (data.userRole !== 'ADMIN' && data.userRole !== 'SELLER') return 'Selecione Administrador ou Vendedor.';
  return '';
}
