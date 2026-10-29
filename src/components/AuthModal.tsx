import React, { useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Smartphone,
  LogOut,
  User,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  Phone
} from 'lucide-react';
import type { AuthUserProfile } from '../lib/authService';
import { signIn, signOut, requestPasswordReset } from '../lib/authService';

interface AuthModalProps {
  currentUser: AuthUserProfile | null;
  onUserChange: (user: AuthUserProfile | null) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  onUserChange,
  onClose
}) => {
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const res = await signIn(email, password);
    setIsLoading(false);

    if (res.success && res.profile) {
      onUserChange(res.profile);
      onClose();
    } else {
      setErrorMessage(res.error || 'Falha ao autenticar. Verifique e-mail e senha.');
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setRecoverySuccessMsg('');
    setIsLoading(true);

    const res = await requestPasswordReset(email);
    setIsLoading(false);

    if (res.success) {
      setRecoverySuccessMsg(res.message);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleLogout = async () => {
    await signOut();
    onUserChange(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
        {/* Header do Modal */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                {mode === 'login' ? 'Controle de Acesso HelpTech' : 'Recuperação de Login & Senha'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === 'login' ? 'Área Restrita: Técnicos e Controladoria' : 'Redefinição de Credencial'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Status da Sessão Ativa */}
        {currentUser && mode === 'login' && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <User size={14} className="text-blue-600" /> Sessão Ativa:
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-100 text-blue-800">
                {currentUser.role === 'ROLE_ADMIN'
                  ? 'Controladoria HelpTech'
                  : currentUser.role === 'ROLE_TECH'
                  ? 'Técnico de Campo'
                  : 'Gestor Escolar'}
              </span>
            </div>
            <div className="text-slate-600 space-y-0.5">
              <p><strong>Nome:</strong> {currentUser.name}</p>
              <p className="font-mono text-[11px] text-slate-500"><strong>E-mail:</strong> {currentUser.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-2 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut size={14} /> Encerrar Sessão (Sair do Sistema)
            </button>
          </div>
        )}

        {/* MODO 1: FORMULÁRIO DE LOGIN */}
        {mode === 'login' && (
          <>
            {!currentUser && (
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-800">
                  <AlertCircle size={15} className="text-blue-600 shrink-0" />
                  <span>Acesso Aberto para Escolas</span>
                </div>
                <p className="text-[11px] text-blue-700">
                  O perfil <strong>Escola</strong> é público: para abrir chamados ou consultar protocolos, não é necessário fazer login!
                </p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  E-mail Institucional ou Credencial *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="suporte ou tecnico@helptech.com.br"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Senha de Acesso *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      setErrorMessage('');
                      setRecoverySuccessMsg('');
                    }}
                    className="text-[10.5px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {errorMessage && (
                <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center justify-center gap-1.5"
              >
                {isLoading ? 'Autenticando...' : 'Entrar no Sistema'}
              </button>
            </form>

            {/* Atalhos Rápidos para Teste e Demonstração */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Preenchimento Rápido Homologado:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('tecnico@helptech.com.br');
                    setPassword('Dio@sup.2203');
                    setErrorMessage('');
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 flex flex-col items-center gap-1 font-semibold transition-all text-center"
                  title="Acessar como Técnico de Campo"
                >
                  <Smartphone size={16} className="text-emerald-600" />
                  <span>Técnico de Campo</span>
                  <span className="text-[9.5px] text-slate-400">tecnico@helptech.com.br</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail('suporte@helptech.com.br');
                    setPassword('Dio@sup.2203');
                    setErrorMessage('');
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 flex flex-col items-center gap-1 font-semibold transition-all text-center"
                  title="Acessar como Administrador Central"
                >
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>Controladoria HelpTech</span>
                  <span className="text-[9.5px] text-slate-400">suporte@helptech.com.br</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* MODO 2: FORMULÁRIO DE RECUPERAÇÃO DE SENHA */}
        {mode === 'recovery' && (
          <div className="space-y-4 pt-1 animate-fadeIn">
            {recoverySuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto" />
                <h4 className="font-bold text-xs text-emerald-900">Solicitação Enviada!</h4>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  {recoverySuccessMsg}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRecoverySuccessMsg('');
                  }}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors inline-block"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordRecovery} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Digite seu e-mail cadastrado. Enviaremos as instruções de redefinição de senha ou consulte a Central de Atendimento.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    E-mail Cadastrado *
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu-email@helptech.com.br"
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow"
                >
                  {isLoading ? 'Verificando...' : 'Enviar Link de Redefinição'}
                </button>

                {/* Ajuda de Contato Direto */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1 mt-3">
                  <div className="font-bold flex items-center gap-1 text-slate-700">
                    <HelpCircle size={13} className="text-blue-600" /> Suporte HelpTech Informática
                  </div>
                  <p>Caso tenha esquecido sua credencial ou necessite de desbloqueio imediato:</p>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 pt-0.5">
                    <Phone size={12} /> WhatsApp Suporte: (61) 99229-5814
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage('');
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <ArrowLeft size={13} /> Voltar ao formulário de login
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
