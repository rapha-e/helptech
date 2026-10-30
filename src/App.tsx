import React, { useState, Suspense, lazy } from 'react';
import { useAppStore } from './lib/store';
import type { Ticket } from './data/seedData';
import type { AuthUserProfile, UserRole } from './lib/authService';
import { getStoredSession, signOut } from './lib/authService';
import {
  Building2,
  Smartphone,
  ShieldCheck,
  Headphones,
  Lock,
  User,
  Database,
  RefreshCw,
  LogIn,
  LogOut
} from 'lucide-react';

// Code-splitting via React.lazy para máxima performance em conexões móveis e carregamento instantâneo
const SchoolPortal = lazy(() =>
  import('./components/SchoolPortal').then((m) => ({ default: m.SchoolPortal }))
);
const TechFieldPWA = lazy(() =>
  import('./components/TechFieldPWA').then((m) => ({ default: m.TechFieldPWA }))
);
const CentralAdminDashboard = lazy(() =>
  import('./components/CentralAdminDashboard').then((m) => ({ default: m.CentralAdminDashboard }))
);
const TicketOSModal = lazy(() =>
  import('./components/TicketOSModal').then((m) => ({ default: m.TicketOSModal }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

const ViewSkeletonFallback: React.FC = () => (
  <div className="w-full py-16 flex flex-col items-center justify-center space-y-4 animate-pulse">
    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
      <RefreshCw size={24} className="animate-spin" />
    </div>
    <div className="text-center space-y-1.5">
      <div className="h-4 w-44 bg-slate-200 rounded-md mx-auto" />
      <div className="h-3 w-32 bg-slate-100 rounded-md mx-auto" />
    </div>
  </div>
);

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(() => {
    return getStoredSession();
  });

  // O perfil Escola é o padrão aberto do sistema para qualquer visitante
  const [activeViewRole, setActiveViewRole] = useState<UserRole>(() => {
    return currentUser?.role || 'ROLE_SCHOOL';
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
    updateTicketAdmin,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    toggleTechnicianStatus,
    createSystemUser,
    updateSystemUser,
    deleteSystemUser,
    toggleSystemUserActive,
    resetDatabase,
    inventory,
    updateInventoryQuantity,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    submitTicketCsat
  } = useAppStore();

  const handleUserChange = (user: AuthUserProfile | null) => {
    setCurrentUser(user);
    if (user?.role) {
      setActiveViewRole(user.role);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setActiveViewRole('ROLE_SCHOOL');
  };

  const handleSelectTab = (tab: UserRole) => {
    if (tab === 'ROLE_SCHOOL') {
      setActiveViewRole('ROLE_SCHOOL');
      return;
    }

    if (tab === 'ROLE_TECH') {
      if (!currentUser || (currentUser.role !== 'ROLE_TECH' && currentUser.role !== 'ROLE_ADMIN')) {
        setShowAuthModal(true);
      } else {
        setActiveViewRole('ROLE_TECH');
      }
      return;
    }

    if (tab === 'ROLE_ADMIN') {
      if (!currentUser || currentUser.role !== 'ROLE_ADMIN') {
        setShowAuthModal(true);
      } else {
        setActiveViewRole('ROLE_ADMIN');
      }
      return;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">

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

          {/* NAVEGAÇÃO DE MÓDULOS (ESCOLA ABERTA / TÉCNICO & CENTRAL RESTRITOS) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => handleSelectTab('ROLE_SCHOOL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeViewRole === 'ROLE_SCHOOL'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Acesso Público para Abertura e Consulta de Chamados"
              >
                <Building2 size={14} />
                <span>Escola (Aberto)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('ROLE_TECH')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeViewRole === 'ROLE_TECH'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Área do Técnico de Campo"
              >
                <Smartphone size={14} />
                <span>Técnico</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('ROLE_ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeViewRole === 'ROLE_ADMIN'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Painel de Gestão e Controladoria HelpTech"
              >
                <ShieldCheck size={14} />
                <span>Controladoria</span>
              </button>
            </div>

            {/* IDENTIFICAÇÃO DO USUÁRIO & BOTÃO SAIR */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-all shadow-inner"
                  title="Detalhes da Sessão Ativa"
                >
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    <User size={12} />
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="font-bold text-[11px] text-white leading-tight truncate max-w-[130px]">
                      {currentUser.name}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate max-w-[130px]">
                      {currentUser.role === 'ROLE_ADMIN'
                        ? 'Controladoria HelpTech'
                        : currentUser.role === 'ROLE_TECH'
                        ? 'Técnico de Campo'
                        : 'Gestor Escolar'}
                    </div>
                  </div>
                </button>

                {/* BOTÃO EXPLICITO DE SAIR DO SISTEMA (LOGOUT) */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm"
                  title="Encerrar sessão de forma segura"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow"
                title="Acessar Área Restrita (Técnico / Central)"
              >
                <LogIn size={13} />
                <span>Entrar no Sistema</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (ESCOLA ABERTA / RESTRIÇÃO CONDICIONAL POR ABA) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4">
        <Suspense fallback={<ViewSkeletonFallback />}>
          {/* MÓDULO 1: UNIDADES ESCOLARES (100% PÚBLICO E ABERTO) */}
          {activeViewRole === 'ROLE_SCHOOL' && (
            <SchoolPortal
              schools={schools}
              categories={categories}
              regions={regions}
              tickets={tickets}
              onCreateTicket={createTicket}
              onDecideQuote={decideQuote}
              onViewOS={(ticket) => setViewingOsTicket(ticket)}
              onSubmitCsat={submitTicketCsat}
            />
          )}

          {/* MÓDULO 2: TÉCNICO DE CAMPO (PWA MOBILE) */}
          {activeViewRole === 'ROLE_TECH' && (
            currentUser && (currentUser.role === 'ROLE_TECH' || currentUser.role === 'ROLE_ADMIN') ? (
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
            ) : (
              <div className="max-w-md mx-auto my-14 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4 animate-fadeIn">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <Smartphone size={32} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Área do Técnico de Campo</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    A visualização do PWA de atendimento e ordens de serviço requer identificação do técnico HelpTech.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center justify-center gap-2"
                  >
                    <LogIn size={15} /> Entrar como Técnico de Campo
                  </button>
                </div>
              </div>
            )
          )}

          {/* MÓDULO 3: CONTROLADORIA & CENTRAL (KANBAN, GESTÃO & AUDITORIA) */}
          {activeViewRole === 'ROLE_ADMIN' && (
            currentUser && currentUser.role === 'ROLE_ADMIN' ? (
              <CentralAdminDashboard
                tickets={tickets}
                technicians={technicians}
                systemUsers={systemUsers}
                schools={schools}
                regions={regions}
                categories={categories}
                onManualDispatch={manualDispatch}
                onAdminUpdateTicket={updateTicketAdmin}
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
                inventory={inventory}
                onUpdateInventoryQuantity={updateInventoryQuantity}
                onAddInventoryItem={addInventoryItem}
                onUpdateInventoryItem={updateInventoryItem}
                onDeleteInventoryItem={deleteInventoryItem}
              />
            ) : (
              <div className="max-w-md mx-auto my-14 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4 animate-fadeIn">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <Lock size={32} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Controladoria HelpTech</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    O acesso à visão gerencial, despacho e auditoria exige credencial autorizada de administrador.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center justify-center gap-2"
                  >
                    <LogIn size={15} /> Entrar como Administrador
                  </button>
                </div>
              </div>
            )
          )}
        </Suspense>
      </main>

      {/* MODAL DE ORDEM DE SERVIÇO OFICIAL SE SELECIONADA */}
      <Suspense fallback={null}>
        {viewingOsTicket && (
          <TicketOSModal
            ticket={tickets.find((t) => t.id === viewingOsTicket.id) || viewingOsTicket}
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
      </Suspense>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-3 text-center text-[11px]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>HelpTech Informática &bull; Sistema Proprietário de Gestão de Suporte & Field Service</span>
          </div>
          <div>
            Central de Suporte HelpTech: (61) 99229-5814
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
