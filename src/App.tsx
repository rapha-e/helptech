import React, { useState } from 'react';
import { useAppStore } from './lib/store';
import { SchoolPortal } from './components/SchoolPortal';
import { TechFieldPWA } from './components/TechFieldPWA';
import { CentralAdminDashboard } from './components/CentralAdminDashboard';
import { TicketOSModal } from './components/TicketOSModal';
import type { Ticket } from './data/seedData';
import {
  Building2,
  Briefcase,
  Smartphone,
  ShieldCheck,
  Headphones
} from 'lucide-react';

export type UserRole = 'ROLE_SCHOOL' | 'ROLE_HELPTECH';
export type HelpTechSubView = 'field' | 'central';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>('ROLE_SCHOOL');
  const [helpTechView, setHelpTechView] = useState<HelpTechSubView>('central');
  const [viewingOsTicket, setViewingOsTicket] = useState<Ticket | null>(null);

  const {
    tickets,
    technicians,
    systemUsers,
    schools,
    categories,
    regions,
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
              </div>
              <p className="text-[11px] text-slate-400">
                Service Desk & Field Service Inteligente
              </p>
            </div>
          </div>

          {/* PERFIS DE ACESSO: UNIDADES ESCOLARES vs PROFISSIONAIS DA HELPTECH */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-inner">
            <button
              onClick={() => setCurrentRole('ROLE_SCHOOL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentRole === 'ROLE_SCHOOL'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={14} />
              <span>Unidades Escolares</span>
            </button>

            <button
              onClick={() => setCurrentRole('ROLE_HELPTECH')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentRole === 'ROLE_HELPTECH'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase size={14} />
              <span>Profissionais da HelpTech</span>
            </button>
          </div>
        </div>

        {/* SUB-BARRA DE NAVEGAÇÃO INTERNA PARA OS PROFISSIONAIS DA HELPTECH */}
        {currentRole === 'ROLE_HELPTECH' && (
          <div className="bg-slate-950/80 border-t border-slate-800/80 px-3 sm:px-6 py-1.5 animate-fadeIn">
            <div className="max-w-[1440px] mx-auto flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Painel HelpTech:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHelpTechView('field')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    helpTechView === 'field'
                      ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={13} />
                  <span>Técnico de Campo (PWA Mobile)</span>
                </button>

                <button
                  onClick={() => setHelpTechView('central')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    helpTechView === 'central'
                      ? 'bg-slate-800 text-blue-400 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span>Controladoria & Gestão (Kanban / Despacho)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (COM MENOS ESPAÇOS VAGOS NAS MARGENS) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4">
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

        {/* PERFIL 2: PROFISSIONAIS DA HELPTECH */}
        {currentRole === 'ROLE_HELPTECH' && (
          <>
            {helpTechView === 'field' ? (
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

      {/* RODAPÉ DO SISTEMA */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>HelpTech Informática • Motor de Despacho e Earthdistance Supabase 16 Operacional</span>
          </div>
          <div>
            Service Desk & Field Service Inteligente
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
