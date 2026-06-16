import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { TopBar } from '../components/TopBar';
import type {
  SystemConfigDTO, SpringPage, ClientResponseDTO,
  ProductResponseDTO, StockResponseDTO, GasSupplierResponseDTO, UserResponseDTO,
} from '../types';

// ── CSV utilities ──────────────────────────────────────────────────────────────

function escField(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function makeCSV(headers: string[], rows: unknown[][]): string {
  return [headers.join(','), ...rows.map(r => r.map(escField).join(','))].join('\n');
}

function triggerDownload(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function parseCSVText(text: string): Record<string, string>[] {
  const norm = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = norm.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const splitRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
  });
}

// ── Counter (unchanged) ────────────────────────────────────────────────────────

function Counter({ value, onChange, min = 0, step = 1 }: {
  value: string; onChange: (v: string) => void; min?: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(String(Math.max(min, parseFloat(value) - step)))}
        className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500 flex items-center justify-center font-bold text-lg transition-all">−</button>
      <input type="number" min={min} step={step} value={value} onChange={e => onChange(e.target.value)}
        className="w-20 border border-slate-200 rounded-lg bg-white text-slate-800 text-center font-bold text-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      <button type="button" onClick={() => onChange(String(parseFloat(value) + step))}
        className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-600 flex items-center justify-center font-bold text-lg transition-all">+</button>
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────

type DataKey = 'clients' | 'products' | 'stock' | 'suppliers';

const DATA_OPTS: { key: DataKey; label: string; icon: string }[] = [
  { key: 'clients',   label: 'Clientes',      icon: 'group' },
  { key: 'products',  label: 'Produtos',       icon: 'inventory_2' },
  { key: 'stock',     label: 'Estoque',        icon: 'warehouse' },
  { key: 'suppliers', label: 'Fornecedores',   icon: 'local_shipping' },
];

const TEMPLATES: Record<DataKey, { headers: string[]; rows: unknown[][] }> = {
  clients:   { headers: ['nome','telefone','endereco','notas','tipo'],
               rows: [['João Silva','11999999999','Rua das Flores 123','cliente antigo','RETAIL'],
                      ['Maria Costa','11988888888','Av. Principal 456','','RESELLER']] },
  products:  { headers: ['nome','preco_base','tipo'],
               rows: [['Água 20L','12.00','WATER'],['Gás 13kg','120.00','GAS']] },
  stock:     { headers: ['produto','quantidade'],
               rows: [['Água 20L','50']] },
  suppliers: { headers: ['nome','notas'],
               rows: [['Distribuidora ABC','fornecedor principal']] },
};

const TIPO_HINTS: Record<DataKey, string> = {
  clients:   'tipo: RETAIL, RESELLER ou AVULSO',
  products:  'tipo: WATER ou GAS · preco_base: número decimal (ex: 12.50)',
  stock:     'produto: nome exato do produto cadastrado · define a quantidade absoluta',
  suppliers: 'nome é obrigatório · notas é opcional',
};

// ── Main ───────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { http, auth } = useAuth();
  const { notify } = useNotification();

  // tab + role
  const [activeTab, setActiveTab] = useState<'config' | 'data'>('config');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!http || !auth) return;
    http.get<UserResponseDTO[]>('/users')
      .then(r => setIsAdmin(r.data.some(u => u.username === auth.username && u.userRole === 'ADMIN')))
      .catch(() => {});
  }, [http, auth]);

  // config state
  const [cfgLoading, setCfgLoading] = useState(true);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgError, setCfgError] = useState('');
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
      .catch(() => setCfgError('Erro ao carregar configurações.'))
      .finally(() => setCfgLoading(false));
  }, [http]);

  async function handleSave() {
    if (!http) return;
    const ppi = parseInt(pointsPerItem), ppw = parseInt(pointsPerWater), dc = parseInt(discountCents);
    if (isNaN(ppi) || ppi < 1) { setCfgError('Pontos por item deve ser ≥ 1.'); return; }
    if (isNaN(ppw) || ppw < 1) { setCfgError('Pontos para água deve ser ≥ 1.'); return; }
    if (isNaN(dc) || dc < 0)   { setCfgError('Desconto não pode ser negativo.'); return; }
    setCfgSaving(true); setCfgError('');
    try {
      await http.patch<SystemConfigDTO>('/config', { pointsPerWaterItem: ppi, pointsPerFreeWater: ppw, pickupDiscountCents: dc });
      notify('Configurações salvas com sucesso.', 'success');
    } catch {
      setCfgError('Erro ao salvar configurações.');
      notify('Erro ao salvar configurações.', 'error');
    } finally { setCfgSaving(false); }
  }

  // export state
  const [exportSel, setExportSel] = useState<Record<DataKey, boolean>>(
    { clients: true, products: true, stock: true, suppliers: true }
  );
  const [exporting, setExporting] = useState(false);

  async function fetchAll<T>(url: string): Promise<T[]> {
    if (!http) return [];
    const all: T[] = [];
    let page = 0;
    while (true) {
      const r = await http.get<SpringPage<T>>(url, { params: { page, size: 500 } });
      all.push(...r.data.content);
      if (page >= r.data.totalPages - 1) break;
      page++;
    }
    return all;
  }

  async function handleExport() {
    const selected = DATA_OPTS.filter(o => exportSel[o.key]);
    if (!selected.length) { notify('Selecione ao menos um tipo de dado.', 'error'); return; }
    setExporting(true);
    try {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

      if (exportSel.clients) {
        const d = await fetchAll<ClientResponseDTO>('/clients');
        triggerDownload('clientes.csv', makeCSV(
          ['nome','telefone','endereco','notas','tipo','saldo','pontos_fidelidade'],
          d.map(c => [c.name, c.phone ?? '', c.address ?? '', c.notes ?? '', c.clientType, c.balance, c.fidelityPoints])
        ));
        await delay(400);
      }
      if (exportSel.products) {
        const d = await fetchAll<ProductResponseDTO>('/products');
        triggerDownload('produtos.csv', makeCSV(
          ['nome','preco_base','preco_revendedor','tipo','ativo'],
          d.map(p => [p.name, p.basePrice, p.resellerPrice ?? '', p.type, p.isActive])
        ));
        await delay(400);
      }
      if (exportSel.stock) {
        const d = await fetchAll<StockResponseDTO>('/stocks');
        triggerDownload('estoque.csv', makeCSV(
          ['produto','quantidade_atual','estoque_minimo'],
          d.map(s => [s.productName, s.quantityInStock, s.minimumStock])
        ));
        await delay(400);
      }
      if (exportSel.suppliers) {
        const d = await fetchAll<GasSupplierResponseDTO>('/suppliers');
        triggerDownload('fornecedores.csv', makeCSV(
          ['nome','notas'],
          d.map(s => [s.name, s.notes ?? ''])
        ));
      }
      notify('Exportação concluída!', 'success');
    } catch {
      notify('Erro ao exportar dados.', 'error');
    } finally { setExporting(false); }
  }

  // import state
  const [importEntity, setImportEntity] = useState<DataKey>('clients');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCSVText(ev.target?.result as string);
      setParsedRows(rows.length ? rows : null);
      setImportResult(null);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  function clearImport() {
    setParsedRows(null);
    setImportResult(null);
    setImportProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleImport() {
    if (!http || !parsedRows?.length) return;
    setImporting(true);
    setImportProgress(0);
    setImportTotal(parsedRows.length);
    setImportResult(null);

    let success = 0;
    const errors: string[] = [];

    let prodNameToId: Record<string, string> = {};
    let prodNameToStock: Record<string, number> = {};

    if (importEntity === 'stock') {
      try {
        const prods = await fetchAll<ProductResponseDTO>('/products');
        prods.forEach(p => { prodNameToId[p.name] = p.id; });
        const stocks = await fetchAll<StockResponseDTO>('/stocks');
        stocks.forEach(s => { prodNameToStock[s.productName] = s.quantityInStock; });
      } catch {
        notify('Erro ao carregar produtos/estoque.', 'error');
        setImporting(false);
        return;
      }
    }

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const lbl = `Linha ${i + 2}`;
      try {
        if (importEntity === 'clients') {
          const name = row.nome?.trim();
          if (!name) { errors.push(`${lbl}: 'nome' obrigatório`); continue; }
          const tipo = row.tipo?.trim().toUpperCase();
          await http.post('/clients', {
            name,
            phone: row.telefone?.trim() || '',
            address: row.endereco?.trim() || '',
            notes: row.notas?.trim() || '',
            clientType: ['RETAIL','RESELLER','AVULSO'].includes(tipo) ? tipo : 'RETAIL',
            clientStatus: 'PAID',
          });
          success++;
        } else if (importEntity === 'products') {
          const name = row.nome?.trim();
          const basePrice = parseFloat(row.preco_base ?? '');
          const tipo = row.tipo?.trim().toUpperCase();
          if (!name) { errors.push(`${lbl}: 'nome' obrigatório`); continue; }
          if (isNaN(basePrice)) { errors.push(`${lbl}: 'preco_base' inválido`); continue; }
          if (!['WATER','GAS'].includes(tipo)) { errors.push(`${lbl}: 'tipo' deve ser WATER ou GAS`); continue; }
          await http.post('/products', { name, basePrice, type: tipo });
          success++;
        } else if (importEntity === 'stock') {
          const prodName = row.produto?.trim();
          const qty = parseInt(row.quantidade ?? '');
          if (!prodName) { errors.push(`${lbl}: 'produto' obrigatório`); continue; }
          if (isNaN(qty) || qty < 0) { errors.push(`${lbl}: 'quantidade' inválida`); continue; }
          const prodId = prodNameToId[prodName];
          if (!prodId) { errors.push(`${lbl}: produto '${prodName}' não encontrado`); continue; }
          if (prodNameToStock[prodName] === undefined) { errors.push(`${lbl}: '${prodName}' sem controle de estoque (GÁS?)`); continue; }
          const delta = qty - prodNameToStock[prodName];
          if (delta !== 0) await http.patch(`/stocks/products/${prodId}`, delta);
          success++;
        } else if (importEntity === 'suppliers') {
          const name = row.nome?.trim();
          if (!name) { errors.push(`${lbl}: 'nome' obrigatório`); continue; }
          await http.post('/suppliers', { name, notes: row.notas?.trim() || undefined });
          success++;
        }
      } catch {
        errors.push(`${lbl}: erro ao salvar`);
      }
      setImportProgress(i + 1);
    }

    setImportResult({ success, errors });
    setImporting(false);
    if (success > 0) notify(`${success} registro(s) importado(s)!`, 'success');
    if (errors.length > 0) notify(`${errors.length} erro(s) na importação.`, 'error');
  }

  // config layout data (unchanged)
  const settings = [
    {
      section: 'Programa de Fidelidade', sectionIcon: 'workspace_premium', sectionColor: 'text-amber-500',
      items: [
        { icon: 'water_drop', iconColor: 'text-blue-600', iconBg: 'bg-blue-50',
          title: 'Pontos por Galão de Água',
          description: 'Quantos pontos o cliente recebe por cada unidade de água paga na entrega.',
          unit: 'ponto(s) por unidade', control: <Counter value={pointsPerItem} onChange={setPointsPerItem} min={1} /> },
        { icon: 'redeem', iconColor: 'text-amber-600', iconBg: 'bg-amber-50',
          title: 'Pontos para 1 Água Bônus',
          description: 'Quantos pontos o cliente precisa acumular para ganhar 1 galão de água grátis.',
          unit: 'pontos para resgate', control: <Counter value={pointsPerWater} onChange={setPointsPerWater} min={1} /> },
      ],
    },
    {
      section: 'Política de Preços', sectionIcon: 'sell', sectionColor: 'text-primary',
      items: [
        { icon: 'shopping_bag', iconColor: 'text-primary', iconBg: 'bg-primary/10',
          title: 'Desconto na Retirada (Varejo)',
          description: 'Valor em centavos descontado quando o cliente RETAIL retira no balcão.',
          unit: `= R$ ${(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')} de desconto`,
          control: <Counter value={discountCents} onChange={setDiscountCents} min={0} step={10} /> },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar title="Configurações" subtitle="Parâmetros operacionais do sistema" />

      <main className="p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([
            { key: 'config', label: 'Configurações', icon: 'settings' },
            ...(isAdmin ? [{ key: 'data', label: 'Exportar / Importar', icon: 'sync_alt' }] : []),
          ] as { key: 'config' | 'data'; label: string; icon: string }[]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Config tab ── */}
        {activeTab === 'config' && (
          <>
            {cfgError && (
              <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: '20px' }}>error</span>
                <span className="text-sm font-medium text-red-700">{cfgError}</span>
              </div>
            )}

            {cfgLoading ? (
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
                          <div className="flex-shrink-0">{item.control}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>preview</span>
                    <h2 className="text-[14px] font-semibold text-slate-700">Resumo Atual</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Pontos por galão',   value: `${pointsPerItem} pt${parseInt(pointsPerItem) !== 1 ? 's' : ''}`, icon: 'water_drop', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'Pontos p/ água bônus', value: `${pointsPerWater} pts`, icon: 'redeem', color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Desconto retirada',  value: `R$ ${(parseInt(discountCents || '0') / 100).toFixed(2).replace('.', ',')}`, icon: 'sell', color: 'text-primary', bg: 'bg-primary/8' },
                    ].map(item => (
                      <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                        <span className={`material-symbols-outlined ${item.color} mb-1`} style={{ fontSize: '20px' }}>{item.icon}</span>
                        <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                        <p className="text-xl font-bold text-slate-800 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSave} disabled={cfgSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm shadow-sm shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-70">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                    {cfgSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Data tab ── */}
        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* ── Export card ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: '18px' }}>download</span>
                <h2 className="text-[14px] font-semibold text-slate-700">Exportar CSV</h2>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-[12px] text-slate-500">Selecione os dados que deseja exportar. Cada tipo gera um arquivo CSV separado.</p>
                <div className="space-y-2">
                  {DATA_OPTS.map(opt => (
                    <label key={opt.key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={exportSel[opt.key]}
                        onChange={e => setExportSel(p => ({ ...p, [opt.key]: e.target.checked }))}
                        className="w-4 h-4 accent-primary rounded" />
                      <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '18px' }}>{opt.icon}</span>
                      <span className="text-[13px] font-medium text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <button onClick={handleExport} disabled={exporting || !DATA_OPTS.some(o => exportSel[o.key])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 mt-2">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                  {exporting ? 'Exportando...' : 'Exportar Selecionados'}
                </button>
              </div>
            </div>

            {/* ── Import card ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600" style={{ fontSize: '18px' }}>upload</span>
                <h2 className="text-[14px] font-semibold text-slate-700">Importar CSV</h2>
              </div>
              <div className="p-5 space-y-4">

                {/* Entity selector */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo de dado</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DATA_OPTS.map(opt => (
                      <button key={opt.key} onClick={() => { setImportEntity(opt.key); clearImport(); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${importEntity === opt.key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format hint + template download */}
                <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-slate-400 flex-shrink-0" style={{ fontSize: '16px' }}>info</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500">{TIPO_HINTS[importEntity]}</p>
                    <button onClick={() => triggerDownload(`modelo_${importEntity}.csv`, makeCSV(TEMPLATES[importEntity].headers, TEMPLATES[importEntity].rows))}
                      className="text-[11px] font-semibold text-blue-600 hover:underline mt-0.5">
                      Baixar modelo CSV
                    </button>
                  </div>
                </div>

                {/* File drop zone */}
                <div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all group">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-400 transition-colors" style={{ fontSize: '32px' }}>upload_file</span>
                    <p className="text-[13px] font-medium text-slate-600 mt-2">
                      {parsedRows ? `${parsedRows.length} linha(s) lidas` : 'Clique para selecionar arquivo CSV'}
                    </p>
                    {parsedRows && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Arquivo carregado · clique para trocar</p>
                    )}
                  </button>
                </div>

                {/* Preview */}
                {parsedRows && parsedRows.length > 0 && (() => {
                  const headers = Object.keys(parsedRows[0]);
                  const preview = parsedRows.slice(0, 5);
                  return (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-[11px]">
                        <thead className="bg-slate-50">
                          <tr>
                            {headers.map(h => (
                              <th key={h} className="px-2.5 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {headers.map(h => (
                                <td key={h} className="px-2.5 py-1.5 text-slate-700 max-w-[120px] truncate">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {parsedRows.length > 5 && (
                        <p className="text-[11px] text-slate-400 px-3 py-1.5 bg-slate-50 border-t border-slate-100">
                          +{parsedRows.length - 5} linha(s) não exibidas
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Progress bar */}
                {importing && importTotal > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Importando...</span>
                      <span>{importProgress}/{importTotal}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${(importProgress / importTotal) * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* Import button */}
                <button onClick={handleImport}
                  disabled={importing || !parsedRows?.length}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                  {importing ? 'Importando...' : `Importar ${parsedRows?.length ?? 0} Linha(s)`}
                </button>

                {/* Result */}
                {importResult && (
                  <div className="space-y-2">
                    {importResult.success > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: '16px' }}>check_circle</span>
                        <span className="text-[12px] font-medium text-emerald-700">{importResult.success} registro(s) importado(s) com sucesso</span>
                      </div>
                    )}
                    {importResult.errors.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                        <p className="text-[12px] font-semibold text-red-700">{importResult.errors.length} erro(s):</p>
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {importResult.errors.map((e, i) => (
                            <p key={i} className="text-[11px] text-red-600">{e}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
