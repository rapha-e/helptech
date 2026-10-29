import React, { useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Building2,
  Smartphone,
  LogOut,
  User,
  AlertCircle
} from 'lucide-react';
import type { AuthUserProfile } from '../lib/authService';
import { signIn, signOut } from '../lib/authService';

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
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const fillPresetEmail = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('');
    setErrorMessage('');
  };

  const handleLogout = async () => {
    await signOut();
    onUserChange(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Autenticação & Controle de Acesso</h3>
              <p className="text-[11px] text-slate-500">Supabase Auth & RBAC Operacional</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Status da Sessão Ativa */}
        {currentUser ? (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <User size={14} className="text-blue-600" /> Usuário Autenticado:
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-100 text-blue-800">
                {currentUser.role === 'ROLE_ADMIN' ? 'Controladoria / DTI' : currentUser.role === 'ROLE_TECH' ? 'Técnico de Campo' : 'Gestor Escolar'}
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
              <LogOut size={14} /> Encerrar Sessão (Logout)
            </button>
          </div>
        ) : (
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Nenhuma sessão ativa. Faça login para acessar áreas restritas do sistema.</span>
          </div>
        )}

        {/* Formulário de Login Tradicional */}
        <form onSubmit={handleLogin} className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              E-mail Institucional ou Credencial *
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@edu.se.df.gov.br ou helptech"
                required
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Senha de Acesso *
            </label>
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
            {isLoading ? 'Autenticando no Supabase...' : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Sugestões de E-mails Institucionais Autorizados */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Preencher E-mail Institucional Homologado:
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => fillPresetEmail('direcao.ec09@edu.se.df.gov.br')}
              className="p-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 flex flex-col items-center gap-1 font-semibold transition-all text-center"
              title="Preencher e-mail da Escola"
            >
              <Building2 size={16} className="text-blue-600" />
              <span>Escola</span>
            </button>
            <button
              type="button"
              onClick={() => fillPresetEmail('carlos.tecnico@fieldservice.df.gov.br')}
              className="p-2 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 flex flex-col items-center gap-1 font-semibold transition-all text-center"
              title="Preencher e-mail do Técnico"
            >
              <Smartphone size={16} className="text-emerald-600" />
              <span>Técnico</span>
            </button>
            <button
              type="button"
              onClick={() => fillPresetEmail('admin@helptech.seedf.gov.br')}
              className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 flex flex-col items-center gap-1 font-semibold transition-all text-center"
              title="Preencher e-mail da Controladoria"
            >
              <ShieldCheck size={16} className="text-indigo-600" />
              <span>Central</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

