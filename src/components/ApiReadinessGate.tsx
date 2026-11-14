import { useEffect, useState, type ReactNode } from 'react';
import { configureApi, publicHttp } from '../api/http';
import { waitForApiReady } from '../utils/apiReadiness';

export function ApiReadinessGate({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [logsPath, setLogsPath] = useState('%APPDATA%\\Vitalis\\logs');
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    let configured = false;
    void window.vitalis?.getLogsPath().then(path => { if (!controller.signal.aborted) setLogsPath(path); }).catch(() => undefined);
    void waitForApiReady(async signal => {
      if (!configured && window.vitalis) configureApi(await window.vitalis.getApiUrl());
      configured = true;
      const response = await publicHttp.get<{ status: string }>('/health', { signal, timeout: 1000 });
      return response.data.status === 'UP';
    }, { signal: controller.signal }).then(ready => {
      if (!controller.signal.aborted) setState(ready ? 'ready' : 'error');
    });
    return () => controller.abort();
  }, [attempt]);
  if (state === 'ready') return <>{children}</>;
  return <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <main className="w-full max-w-lg bg-white rounded-xl shadow-card border border-slate-200 p-8 space-y-5 text-center">
      <h1 className="text-xl font-bold text-primary">Vitalis</h1>
      {state === 'loading' ? <div role="status" className="space-y-4"><div className="w-10 h-10 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" /><h2 className="font-semibold text-slate-800">Iniciando o sistema…</h2><p className="text-sm text-slate-600">Aguardando a API local. Login e cadastro serão liberados quando o sistema estiver pronto. Isso pode levar até 60 segundos.</p></div> :
        <div role="alert" className="space-y-4"><h2 className="font-semibold text-red-700">O sistema não ficou pronto em 60 segundos.</h2><p className="text-sm text-slate-600">Confira se a API e o PostgreSQL estão em execução. Consulte os logs em:</p><p className="text-sm text-slate-700 break-all font-mono">{logsPath}</p><button className="px-5 py-3 rounded-lg bg-primary text-white font-semibold" onClick={() => setAttempt(n => n + 1)}>Tentar de novo</button></div>}
    </main>
  </div>;
}
