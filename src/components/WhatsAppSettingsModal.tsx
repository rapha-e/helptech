import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  X,
  Shield,
  Zap,
  Sliders,
  Terminal
} from 'lucide-react';
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  getWhatsAppLogs,
  testWhatsAppGatewayConnection,
  type WhatsAppConfig,
  type WhatsAppLogEntry
} from '../lib/whatsappService';

interface WhatsAppSettingsModalProps {
  onClose: () => void;
}

export const WhatsAppSettingsModal: React.FC<WhatsAppSettingsModalProps> = ({ onClose }) => {
  const [config, setConfig] = useState<WhatsAppConfig>(getWhatsAppConfig);
  const [logs, setLogs] = useState<WhatsAppLogEntry[]>(getWhatsAppLogs);
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'logs'>('config');

  // Teste de Disparo
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Status de salvamento
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveWhatsAppConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    setIsTesting(true);
    setTestFeedback(null);

    try {
      const res = await testWhatsAppGatewayConnection(testPhone, config);
      if (res.success) {
        setTestFeedback({ type: 'success', message: res.message });
      } else {
        setTestFeedback({ type: 'error', message: res.message });
      }
      setLogs(getWhatsAppLogs());
    } catch (err: any) {
      setTestFeedback({ type: 'error', message: err.message || 'Erro inesperado no envio.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                WhatsApp Business API — Automação de Disparos
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  config.provider === 'simulated'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                }`}>
                  {config.provider === 'meta_cloud'
                    ? 'Meta Cloud API'
                    : config.provider === 'z_api'
                    ? 'Z-API Gateway'
                    : config.provider === 'evolution'
                    ? 'Evolution API'
                    : 'Modo Simulado'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Notificações 100% autônomas para técnicos e gestores escolares sem ação humana
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Abas Internas */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs border-b-2 transition-all ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={13} />
            Configuração do Provedor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs border-b-2 transition-all ${
              activeTab === 'test'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send size={13} />
            Testar Disparo em Tempo Real
          </button>
          <button
            type="button"
            onClick={() => {
              setLogs(getWhatsAppLogs());
              setActiveTab('logs');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs border-b-2 transition-all ${
              activeTab === 'logs'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal size={13} />
            Auditoria / Logs ({logs.length})
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Seleção do Provedor */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Provedor de Conexão WhatsApp
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'z_api',
                      name: 'Z-API Gateway',
                      desc: 'Conexão via QR Code em 2 min, sem burocracia de aprovação Meta.',
                      tag: 'Mais Rápido / Recomendado'
                    },
                    {
                      id: 'meta_cloud',
                      name: 'Meta Cloud API Oficial',
                      desc: 'API Oficial corporativa da Meta (Graph API v20). Requer Meta Business.',
                      tag: 'Oficial Meta'
                    },
                    {
                      id: 'evolution',
                      name: 'Evolution API',
                      desc: 'Gateway open-source hospedável em VPS/Docker próprio.',
                      tag: 'Open-Source'
                    },
                    {
                      id: 'simulated',
                      name: 'Modo Simulado / Desenvolvimento',
                      desc: 'Registra logs e dispara fallback sem consumir mensagens reais.',
                      tag: 'Sem Custos'
                    }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setConfig({ ...config, provider: p.id as any })}
                      className={`text-left p-3 rounded-2xl border-2 transition-all ${
                        config.provider === p.id
                          ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{p.name}</span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos específicos do provedor */}
              {config.provider === 'meta_cloud' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
                    <Shield size={13} className="text-blue-600" />
                    Parâmetros Meta WhatsApp Cloud API
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-0.5">Phone Number ID *</label>
                    <input
                      type="text"
                      value={config.metaPhoneNumberId || ''}
                      onChange={(e) => setConfig({ ...config, metaPhoneNumberId: e.target.value })}
                      placeholder="Ex: 104598234857102"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-0.5">Access Token Permanente (Bearer) *</label>
                    <input
                      type="password"
                      value={config.metaAccessToken || ''}
                      onChange={(e) => setConfig({ ...config, metaAccessToken: e.target.value })}
                      placeholder="EAAG..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {(config.provider === 'z_api' || config.provider === 'evolution') && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
                    <Zap size={13} className="text-amber-500" />
                    Parâmetros de Conexão Gateway ({config.provider === 'z_api' ? 'Z-API' : 'Evolution API'})
                  </div>
                  {config.provider === 'evolution' && (
                    <div>
                      <label className="block font-semibold text-slate-600 mb-0.5">Endpoint Base da API *</label>
                      <input
                        type="url"
                        value={config.apiUrl || ''}
                        onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                        placeholder="https://sua-evolution-api.dominio.com"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-0.5">ID da Instância *</label>
                      <input
                        type="text"
                        value={config.instanceId || ''}
                        onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                        placeholder="Ex: 3C4B892..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-0.5">Token / Client-Token *</label>
                      <input
                        type="password"
                        value={config.apiToken || ''}
                        onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                        placeholder="Token secreto da instância"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Toggles de Automação de Gatilhos */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Gatilhos de Notificação Automática (Sem Ação Humana)
                </span>
                {[
                  {
                    key: 'autoDispatch' as const,
                    title: 'Atribuição & Despacho ao Técnico',
                    desc: 'Envia mensagem automática no WhatsApp do técnico com defeito, escola e rota GPS.'
                  },
                  {
                    key: 'autoQuote' as const,
                    title: 'Envio de Orçamento ao Diretor da Escola',
                    desc: 'Envia o laudo com peças, discriminativo de valores R$ e link de aprovação com 1 clique.'
                  },
                  {
                    key: 'autoCompletion' as const,
                    title: 'Encerramento de Chamado com Termo e CSAT',
                    desc: 'Notifica a direção com o comprovante assinado e o link da pesquisa de satisfação.'
                  },
                  {
                    key: 'openWaMeOnFailure' as const,
                    title: 'Contingência: Abrir WhatsApp Web caso a API falhe',
                    desc: 'Garante que nenhuma mensagem se perca caso o chip ou gateway esteja temporariamente sem sinal.'
                  }
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(config[item.key])}
                      onChange={(e) => setConfig({ ...config, [item.key]: e.target.checked })}
                      className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-extrabold text-slate-800 block text-xs">{item.title}</span>
                      <span className="text-[11px] text-slate-500">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Botão de Salvar */}
              <div className="flex items-center justify-between pt-2">
                {saveSuccess ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5 text-xs">
                    <CheckCircle2 size={15} /> Configuração salva com sucesso!
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">As configurações são salvas com segurança.</span>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={15} /> Salvar Parâmetros
                </button>
              </div>
            </form>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-900 leading-relaxed">
                <span className="font-extrabold block text-xs mb-1">Como funciona o teste de disparo?</span>
                Digite seu número com DDD (ex: <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono font-bold">61992295814</code>). 
                O sistema enviará uma mensagem instantânea usando as credenciais do provedor ativo para você conferir a entrega no seu celular.
              </div>

              <form onSubmit={handleRunTest} className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Número de WhatsApp para Receber o Teste *
                  </label>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="(61) 99229-5814"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all shadow flex items-center justify-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" /> Enviando mensagem de teste via API...
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Disparar Mensagem de Teste Agora
                    </>
                  )}
                </button>
              </form>

              {testFeedback && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-start gap-2.5 animate-fadeIn ${
                    testFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {testFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-extrabold block">{testFeedback.type === 'success' ? 'Disparo Realizado' : 'Falha no Disparo'}</span>
                    <span className="text-[11px]">{testFeedback.message}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-bold">Histórico dos 50 Últimos Disparos</span>
                <button
                  type="button"
                  onClick={() => setLogs(getWhatsAppLogs())}
                  className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw size={12} /> Atualizar Logs
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhum disparo registrado ainda. Realize um teste ou atribua um técnico para iniciar o histórico.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              log.status === 'enviado'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : log.status === 'simulado'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {log.phone}
                          </span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="font-semibold text-slate-600 text-[11px] truncate max-w-[150px]">
                            {log.recipientName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-lg font-mono text-[10px] text-slate-600 whitespace-pre-wrap line-clamp-3">
                        {log.message}
                      </div>
                      {log.responsePayload && (
                        <div className="text-[9.5px] text-slate-400 truncate">
                          Retorno: {log.responsePayload}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
