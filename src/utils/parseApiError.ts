import { isAxiosError } from 'axios';

export function cashMovementApiError(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 403) return 'Acesso restrito a administradores para operar e consultar o livro-caixa.';
  if (isAxiosError(error) && error.response?.status === 401) return 'Sessão inválida. Entre novamente para operar o livro-caixa.';
  return parseApiError(error);
}

export function parseApiError(err: unknown): string {
  if (!isAxiosError(err)) return 'Não foi possível conectar ao sistema. Tente novamente.';
  if (!err.response) return 'Não foi possível conectar ao sistema. Tente novamente.';
  const data = err.response?.data as Record<string, unknown> | undefined;
  if (!data) return 'Não foi possível concluir a operação. Tente novamente.';
  // Validation errors (422): { errors: [{field, message}] }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0] as Record<string, unknown>;
    if (typeof first.message === 'string') return first.message;
  }
  // Business/resource errors (400, 404): { message: string }
  if (typeof data.message === 'string' && data.message) {
    if (data.message.includes('JSON')) return 'Revise os dados informados e tente novamente.';
    return data.message;
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
