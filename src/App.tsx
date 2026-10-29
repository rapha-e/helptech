import React, { useState } from 'react';
import { useAppStore } from './lib/store';
import { env } from './lib/env';
import { SchoolPortal } from './components/SchoolPortal';
import { TechFieldPWA } from './components/TechFieldPWA';
import { CentralAdminDashboard } from './components/CentralAdminDashboard';
import { TicketOSModal } from './components/TicketOSModal';
import { AuthModal } from './components/AuthModal';
import type { Ticket } from './data/seedData';
import type { AuthUserProfile, UserRole } from './lib/authService';
import { getStoredSession } from './lib/authService';
import {
  Building2,
  Smartphone,
  ShieldCheck,
  Headphones,
  Lock,
  User,
  ShieldAlert,
  Database,
  RefreshCw,
  AlertTriangle,
  LogIn
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(() => {
    return getStoredSession();
  });

  // O papel visual ativo deriva estritamente do perfil autenticado
  const [activeViewRole, setActiveViewRole] = useState<UserRole | null>(() => {
    return currentUser?.role || null;
  });

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [viewingOsTicket, setViewingOsTicket] = useState<Ticket | null>(null);

  const {
    tickets,
    technicians,
    systemUsers,
    schools,
    categories,
    regions,
    remoteStatus,
    isSyncing,
    refreshData,
    createTicket,
    acceptTicket,
    refuseTicket,
    checkInTechnician,
    submitQuote,
    decideQuote,
    completeTicket,
    scheduleVisit,
    setWaitingParts,
    setWaitingThirdParty,
    resumeService,
    manualDispatch,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    toggleTechnicianStatus,
    createSystemUser,
    updateSystemUser,
    deleteSystemUser,
    toggleSystemUserActive,
    resetDatabase
  } = useAppStore();

  const handleUserChange = (user: AuthUserProfile | null) => {
    setCurrentUser(user);
    setActiveViewRole(user?.role || null);
  };

  // Papel efetivo garantido por RBAC
  const effectiveRole = currentUser?.role || null;
  // Apenas Administradores podem alternar a visualização para suporte/auditoria
  const isAdministrator = effectiveRole === 'ROLE_ADMIN';
  const currentRole = isAdministrator ? (activeViewRole || 'ROLE_ADMIN') : effectiveRole;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* AVISO DE AMBIENTE LOCAL / DEMONSTRAÇÃO SE APLICÁVEL */}
      {env.appEnv !== 'production' && currentUser?.isMockUser && (
        <div className="bg-amber-500 text-slate-900 px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm border-b border-amber-600">
          <AlertTriangle size={15} />
          <span>AMBIENTE DE TESTES / SESSÃO LOCAL — Dados operacionais isolados. Não aplicável em produção.</span>
        </div>
      )}

      {/* HEADER INSTITUCIONAL GLOBAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Marca / Identidade */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <Headphones size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">
                  HelpTech Informática
                </h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-400/30">
                  v2.0 Master
                </span>
                <button
                  onClick={() => refreshData()}
                  title={
                    remoteStatus === 'conectado'
                      ? 'Supabase PostgreSQL Conectado. Clique para sincronizar.'
                      : 'Modo Offline / Fallback Local. Clique para tentar reconectar.'
                  }
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    remoteStatus === 'conectado'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30'
                  }`}
                >
                  <Database size={10} />
                  <span>{remoteStatus === 'conectado' ? 'Supabase DB' : 'Cache Local'}</span>
                  <RefreshCw size={9} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Service Desk & Field Service Inteligente
              </p>
            </div>
          </div>

          {/* PERFIS DE ACESSO AO SISTEMA (RBAC ESTRITO) */}
          <div className="flex flex-wrap items-center gap-2">
            {currentUser && isAdministrator && (
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-inner">
                <button
                  onClick={() => setActiveViewRole('ROLE_SCHOOL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    currentRole === 'ROLE_SCHOOL'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Visão de Unidade Escolar (Supervisão Admin)"
                >
                  <Building2 size={14} />
                  <span>Escola</span>
                </button>

                <button
                  onClick={() => setActiveViewRole('ROLE_TECH')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    currentRole === 'ROLE_TECH'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Visão de Técnico de Campo (Supervisão Admin)"
                >
                  <Smartphone size={14} />
                  <span>Técnico</span>
                </button>

                <button
                  onClick={() => setActiveViewRole('ROLE_ADMIN')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    currentRole === 'ROLE_ADMIN'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Painel Central e Controladoria"
                >
                  <ShieldCheck size={14} />
                  <span>Controladoria</span>
                </button>
              </div>
            )}

            {/* IDENTIFICAÇÃO DO USUÁRIO & AUTENTICAÇÃO */}
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-all shadow-inner"
              title="Gerenciar sessão de autenticação"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                <User size={12} />
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-bold text-[11px] text-white leading-tight truncate max-w-[140px]">
                  {currentUser?.name || 'Não Autenticado'}
                </div>
                <div className="text-[9.5px] text-slate-400 truncate max-w-[140px]">
                  {currentUser
                    ? currentUser.role === 'ROLE_ADMIN'
                      ? 'Controladoria / DTI'
                      : currentUser.role === 'ROLE_TECH'
                      ? 'Técnico de Campo'
                      : 'Gestor Escolar'
                    : 'Clique para Entrar'}
                </div>
              </div>
              <Lock size={12} className="text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL COM BARREIRA DE AUTENTICAÇÃO (FAIL-CLOSED) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4">
        {!currentUser ? (
          /* BARREIRA DE ACESSO PARA USUÁRIO NÃO AUTENTICADO */
          <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Autenticação Obrigatória</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                O HelpTech Escolas DF exige identificação institucional prévia para visualização e abertura de Ordens de Serviço operacionais.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <LogIn size={16} /> Entrar com Credencial SEEDF / HelpTech
              </button>
            </div>
          </div>
        ) : currentRole === 'ROLE_ADMIN' && currentUser.role !== 'ROLE_ADMIN' ? (
          /* TENTATIVA DE ESCALAÇÃO DE PRIVILÉGIOS (403 FORBIDDEN) */
          <div className="max-w-xl mx-auto my-12 bg-white p-8 rounded-3xl border border-rose-200 shadow-xl text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Acesso Restrito: 403 Forbidden</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                A visualização da Controladoria e Gestão Central exige perfil de Administrador ou Auditoria SEEDF. O perfil autenticado atual (<strong>{currentUser?.name}</strong>) não possui autorização para este painel.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md inline-flex items-center gap-2"
              >
                <Lock size={14} /> Autenticar com Conta Autorizada
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* PERFIL 1: UNIDADES ESCOLARES */}
            {currentRole === 'ROLE_SCHOOL' && (
              <SchoolPortal
                schools={schools}
                categories={categories}
                regions={regions}
                tickets={tickets}
                onCreateTicket={createTicket}
                onDecideQuote={decideQuote}
                onViewOS={(ticket) => setViewingOsTicket(ticket)}
              />
            )}

            {/* PERFIL 2: TÉCNICO DE CAMPO (PWA MOBILE) */}
            {currentRole === 'ROLE_TECH' && (
              <TechFieldPWA
                technicians={technicians}
                tickets={tickets}
                schools={schools}
                onAcceptTicket={acceptTicket}
                onRefuseTicket={refuseTicket}
                onCheckIn={checkInTechnician}
                onSubmitQuote={submitQuote}
                onCompleteTicket={completeTicket}
                onScheduleVisit={scheduleVisit}
                onSetWaitingParts={setWaitingParts}
                onSetWaitingThirdParty={setWaitingThirdParty}
                onResumeService={resumeService}
                onViewOS={(ticket) => setViewingOsTicket(ticket)}
              />
            )}

            {/* PERFIL 3: CONTROLADORIA & CENTRAL (KANBAN, GESTÃO & AUDITORIA) */}
            {currentRole === 'ROLE_ADMIN' && (
              <CentralAdminDashboard
                tickets={tickets}
                technicians={technicians}
                systemUsers={systemUsers}
                schools={schools}
                regions={regions}
                categories={categories}
                onManualDispatch={manualDispatch}
                onDecideQuote={decideQuote}
                onViewOS={(ticket) => setViewingOsTicket(ticket)}
                onCreateTechnician={createTechnician}
                onUpdateTechnician={updateTechnician}
                onDeleteTechnician={deleteTechnician}
                onToggleTechnicianStatus={toggleTechnicianStatus}
                onCreateSystemUser={createSystemUser}
                onUpdateSystemUser={updateSystemUser}
                onDeleteSystemUser={deleteSystemUser}
                onToggleSystemUserActive={toggleSystemUserActive}
                onResetDatabase={resetDatabase}
              />
            )}
          </>
        )}
      </main>

      {/* MODAL DE ORDEM DE SERVIÇO OFICIAL SE SELECIONADA */}
      {viewingOsTicket && (
        <TicketOSModal
          ticket={viewingOsTicket}
          onClose={() => setViewingOsTicket(null)}
        />
      )}

      {/* MODAL DE AUTENTICAÇÃO */}
      {showAuthModal && (
        <AuthModal
          currentUser={currentUser}
          onUserChange={handleUserChange}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-3 text-center text-[11px]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>HelpTech Informática &bull; Contrato SEEDF Manutenção de TI</span>
          </div>
          <div>
            Service Desk & Field Service Inteligente &bull; Suporte: (61) 3333-0000
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

