import { isAxiosError } from 'axios';

export function parseApiError(err: unknown): string {
  if (!isAxiosError(err)) return 'Erro de conexão. Verifique se o servidor está rodando.';
  const status = err.response?.status;
  const data = err.response?.data as Record<string, unknown> | undefined;
  if (!data) return `Erro no servidor (${status ?? 'desconhecido'}). Tente novamente.`;
  // Validation errors (422): { errors: [{field, message}] }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const first = data.errors[0] as Record<string, unknown>;
    if (typeof first.message === 'string') return first.message;
  }
  // Business/resource errors (400, 404): { message: string }
  if (typeof data.message === 'string' && data.message) return data.message;
  return `Erro no servidor (${status ?? 'desconhecido'}). Tente novamente.`;
}
