export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatOrderId(id: string): string {
  return `#${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}

export function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export function getOrderStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
    PROCESSING: { label: 'Em Processamento', className: 'bg-blue-100 text-blue-700' },
    SHIPPED: { label: 'Em Trânsito', className: 'bg-blue-100 text-blue-700' },
    DELIVERED: { label: 'Entregue', className: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
    OVERDUE: { label: 'Atrasado', className: 'bg-red-100 text-red-700' },
  };
  return map[status.toUpperCase()] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

export function getPaymentStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Aguardando', className: 'bg-orange-100 text-orange-700' },
    PAID: { label: 'Pago', className: 'bg-green-100 text-green-700' },
    OVERDUE: { label: 'Em Atraso', className: 'bg-red-100 text-red-700' },
    CANCELLED: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' },
  };
  return map[status.toUpperCase()] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}
