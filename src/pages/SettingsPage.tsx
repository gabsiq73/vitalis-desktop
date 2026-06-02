import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { TopBar } from '../components/TopBar';
import type { SystemConfigDTO } from '../types';

interface SettingCardProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingCard({ icon, iconColor, iconBg, title, description, children }: SettingCardProps) {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
      <div className="flex items-start gap-4 flex-1">
        <div className={`p-3 rounded-xl ${iconBg} flex-shrink-0`}>
          <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: '28px' }}>
            {icon}
          </span>
        </div>
        <div>
          <h3 className="text-h3 text-on-surface">{title}</h3>
          <p className="text-body-md text-on-surface-variant mt-0.5">{description}</p>
        </div>
      </div>
      <div className="md:w-48 flex-shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { http } = useAuth();
  const [, setConfig] = useState<SystemConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [pointsPerItem, setPointsPerItem] = useState('1');
  const [pointsPerWater, setPointsPerWater] = useState('10');
  const [discountCents, setDiscountCents] = useState('50');

  useEffect(() => {
    if (!http) return;
    http.get<SystemConfigDTO>('/config')
      .then((r) => {
        setConfig(r.data);
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
    if (isNaN(dc) || dc < 0) { setError('Desconto não pode ser negativo.'); return; }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await http.patch<SystemConfigDTO>('/config', {
        pointsPerWaterItem: ppi,
        pointsPerFreeWater: ppw,
        pickupDiscountCents: dc,
      });
      setConfig(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full border border-outline-variant rounded-lg bg-surface-container-low text-body-md py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center font-bold text-h3';

  return (
    <>
      <TopBar />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-h1 text-on-surface">Configurações</h1>
            <p className="text-body-lg text-on-surface-variant">
              Parâmetros operacionais do sistema Vitalis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                <span className="text-sm font-bold">Salvo!</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-lg font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-container text-on-error-container rounded-xl">
            <span className="material-symbols-outlined text-error">error</span>
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seção: Fidelidade */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '20px' }}>workspace_premium</span>
                <h2 className="text-h3 text-on-surface">Programa de Fidelidade</h2>
              </div>

              <div className="space-y-3">
                <SettingCard
                  icon="water_drop"
                  iconColor="text-blue-600"
                  iconBg="bg-blue-50"
                  title="Pontos por Galão de Água"
                  description="Quantos pontos o cliente recebe por cada unidade de água paga na entrega."
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPointsPerItem((v) => String(Math.max(1, parseInt(v) - 1)))}
                        className="w-10 h-10 rounded-full bg-surface-container hover:bg-error/10 text-error flex items-center justify-center font-bold text-lg transition-colors"
                      >−</button>
                      <input
                        type="number"
                        min="1"
                        value={pointsPerItem}
                        onChange={(e) => setPointsPerItem(e.target.value)}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setPointsPerItem((v) => String(parseInt(v) + 1))}
                        className="w-10 h-10 rounded-full bg-surface-container hover:bg-primary/10 text-primary flex items-center justify-center font-bold text-lg transition-colors"
                      >+</button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant text-center mt-1">ponto(s) por unidade</p>
                  </div>
                </SettingCard>

                <SettingCard
                  icon="redeem"
                  iconColor="text-tertiary"
                  iconBg="bg-tertiary-fixed/50"
                  title="Pontos para 1 Água Bônus"
                  description="Quantos pontos o cliente precisa acumular para ganhar 1 galão de água grátis."
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPointsPerWater((v) => String(Math.max(1, parseInt(v) - 1)))}
                        className="w-10 h-10 rounded-full bg-surface-container hover:bg-error/10 text-error flex items-center justify-center font-bold text-lg transition-colors"
                      >−</button>
                      <input
                        type="number"
                        min="1"
                        value={pointsPerWater}
                        onChange={(e) => setPointsPerWater(e.target.value)}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setPointsPerWater((v) => String(parseInt(v) + 1))}
                        className="w-10 h-10 rounded-full bg-surface-container hover:bg-primary/10 text-primary flex items-center justify-center font-bold text-lg transition-colors"
                      >+</button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant text-center mt-1">pontos por água bônus</p>
                  </div>
                </SettingCard>
              </div>
            </div>

            {/* Seção: Preços */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>sell</span>
                <h2 className="text-h3 text-on-surface">Política de Preços</h2>
              </div>

              <SettingCard
                icon="shopping_bag"
                iconColor="text-primary"
                iconBg="bg-primary/10"
                title="Desconto na Retirada (Varejo)"
                description="Valor em centavos descontado no preço base quando o cliente RETAIL retira no balcão. Ex: 50 = R$ 0,50."
              >
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountCents((v) => String(Math.max(0, parseInt(v) - 10)))}
                      className="w-10 h-10 rounded-full bg-surface-container hover:bg-error/10 text-error flex items-center justify-center font-bold text-lg transition-colors"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      value={discountCents}
                      onChange={(e) => setDiscountCents(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setDiscountCents((v) => String(parseInt(v) + 10))}
                      className="w-10 h-10 rounded-full bg-surface-container hover:bg-primary/10 text-primary flex items-center justify-center font-bold text-lg transition-colors"
                    >+</button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant text-center mt-1">
                    centavos = R$ {(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </SettingCard>
            </div>

            {/* Preview */}
            <div className="bg-on-secondary-fixed rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-white/80" style={{ fontSize: '20px' }}>preview</span>
                <h3 className="text-h3 text-white">Resumo das Configurações Atuais</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Pontos por galão', value: `${pointsPerItem} pt${parseInt(pointsPerItem) !== 1 ? 's' : ''}` },
                  { label: 'Pontos p/ água bônus', value: `${pointsPerWater} pts` },
                  { label: 'Desconto retirada', value: `R$ ${(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')}` },
                ].map((item) => (
                  <div key={item.label} className="bg-white/10 rounded-lg p-4 text-center">
                    <p className="text-white/60 text-label-sm uppercase tracking-wider">{item.label}</p>
                    <p className="text-h2 font-black text-white mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
