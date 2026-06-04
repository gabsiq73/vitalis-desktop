import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { TopBar } from '../components/TopBar';
import type { SystemConfigDTO } from '../types';

function Counter({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(min, parseFloat(value) - step)))}
        className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center font-bold text-lg transition-all"
      >−</button>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-20 border border-slate-200 rounded-lg bg-white text-slate-800 text-center font-bold text-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      />
      <button
        type="button"
        onClick={() => onChange(String(parseFloat(value) + step))}
        className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-600 flex items-center justify-center font-bold text-lg transition-all"
      >+</button>
    </div>
  );
}

export function SettingsPage() {
  const { http } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [pointsPerItem, setPointsPerItem] = useState('1');
  const [pointsPerWater, setPointsPerWater] = useState('10');
  const [discountCents, setDiscountCents] = useState('50');

  useEffect(() => {
    if (!http) return;
    http.get<SystemConfigDTO>('/config')
      .then(r => {
        setPointsPerItem(String(r.data.pointsPerWaterItem));
        setPointsPerWater(String(r.data.pointsPerFreeWater));
        setDiscountCents(String(r.data.pickupDiscountCents));
      })
      .catch(() => setError('Erro ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, [http]);

  async function handleSave() {
    if (!http) return;
    const ppi = parseInt(pointsPerItem);
    const ppw = parseInt(pointsPerWater);
    const dc = parseInt(discountCents);
    if (isNaN(ppi) || ppi < 1) { setError('Pontos por item deve ser ≥ 1.'); return; }
    if (isNaN(ppw) || ppw < 1) { setError('Pontos para água deve ser ≥ 1.'); return; }
    if (isNaN(dc) || dc < 0)   { setError('Desconto não pode ser negativo.'); return; }
    setSaving(true);
    setError('');
    try {
      await http.patch<SystemConfigDTO>('/config', {
        pointsPerWaterItem: ppi,
        pointsPerFreeWater: ppw,
        pickupDiscountCents: dc,
      });
      notify('Configurações salvas com sucesso.', 'success');
    } catch {
      setError('Erro ao salvar configurações.');
      notify('Erro ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const settings = [
    {
      section: 'Programa de Fidelidade',
      sectionIcon: 'workspace_premium',
      sectionColor: 'text-amber-500',
      items: [
        {
          icon: 'water_drop',
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-50',
          title: 'Pontos por Galão de Água',
          description: 'Quantos pontos o cliente recebe por cada unidade de água paga na entrega.',
          unit: 'ponto(s) por unidade',
          control: <Counter value={pointsPerItem} onChange={setPointsPerItem} min={1} />,
        },
        {
          icon: 'redeem',
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-50',
          title: 'Pontos para 1 Água Bônus',
          description: 'Quantos pontos o cliente precisa acumular para ganhar 1 galão de água grátis.',
          unit: 'pontos para resgate',
          control: <Counter value={pointsPerWater} onChange={setPointsPerWater} min={1} />,
        },
      ],
    },
    {
      section: 'Política de Preços',
      sectionIcon: 'sell',
      sectionColor: 'text-primary',
      items: [
        {
          icon: 'shopping_bag',
          iconColor: 'text-primary',
          iconBg: 'bg-primary/10',
          title: 'Desconto na Retirada (Varejo)',
          description: 'Valor em centavos descontado quando o cliente RETAIL retira no balcão.',
          unit: `= R$ ${(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')} de desconto`,
          control: <Counter value={discountCents} onChange={setDiscountCents} min={0} step={10} />,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Configurações" subtitle="Parâmetros operacionais do sistema" />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">

        {error && (
          <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl">
            <span className="material-symbols-outlined text-red-500" style={{ fontSize: '20px' }}>error</span>
            <span className="text-sm font-medium text-red-700">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {settings.map(group => (
              <div key={group.section} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className={`material-symbols-outlined ${group.sectionColor}`} style={{ fontSize: '18px' }}>{group.sectionIcon}</span>
                  <h2 className="text-[14px] font-semibold text-slate-700">{group.section}</h2>
                </div>

                <div className="divide-y divide-slate-50">
                  {group.items.map(item => (
                    <div key={item.title} className="flex items-center gap-5 px-5 py-5">
                      <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`material-symbols-outlined ${item.iconColor}`} style={{ fontSize: '22px' }}>{item.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-slate-800">{item.title}</p>
                        <p className="text-[12px] text-slate-500 mt-0.5">{item.description}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{item.unit}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {item.control}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Summary preview */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>preview</span>
                <h2 className="text-[14px] font-semibold text-slate-700">Resumo Atual</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Pontos por galão', value: `${pointsPerItem} pt${parseInt(pointsPerItem) !== 1 ? 's' : ''}`, icon: 'water_drop', color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Pontos p/ água bônus', value: `${pointsPerWater} pts`, icon: 'redeem', color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Desconto retirada', value: `R$ ${(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')}`, icon: 'sell', color: 'text-primary', bg: 'bg-primary/8' },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                    <span className={`material-symbols-outlined ${item.color} mb-1`} style={{ fontSize: '20px' }}>{item.icon}</span>
                    <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm shadow-sm shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
