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

export function formatShortDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export function isScheduledOrder(status: string, deliveryDate?: string | null): boolean {
  if (status !== 'PENDING' || !deliveryDate) return false;
  return new Date(deliveryDate).getTime() - Date.now() > 10 * 60 * 1000;
}

export function getOrderStatusBadge(
  status: string,
  deliveryDate?: string | null,
): { label: string; className: string } {
  if (isScheduledOrder(status, deliveryDate)) {
    return { label: 'Agendado', className: 'bg-violet-100 text-violet-700' };
  }
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
    PROCESSING: { label: 'Em Processamento', className: 'bg-blue-100 text-blue-700' },
    SHIPPED: { label: 'Em Trânsito', className: 'bg-blue-100 text-blue-700' },
    DELIVERED: { label: 'Entregue', className: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
  };
  return map[status.toUpperCase()] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

export function getPaymentStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Aguardando', className: 'bg-orange-100 text-orange-700' },
    PARTIAL: { label: 'Parcial', className: 'bg-yellow-100 text-yellow-700' },
    PAID: { label: 'Pago', className: 'bg-green-100 text-green-700' },
  };
  return map[status.toUpperCase()] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}
