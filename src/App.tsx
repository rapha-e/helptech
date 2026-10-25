import React, { useState } from 'react';
import { useAppStore } from './lib/store';
import { SchoolPortal } from './components/SchoolPortal';
import { TechFieldPWA } from './components/TechFieldPWA';
import { CentralAdminDashboard } from './components/CentralAdminDashboard';
import { TicketOSModal } from './components/TicketOSModal';
import type { Ticket } from './data/seedData';
import {
  GraduationCap,
  Smartphone,
  ShieldCheck,
  Building2
} from 'lucide-react';

export type UserRole = 'ROLE_SCHOOL_USER' | 'ROLE_FIELD_TECH' | 'ROLE_CENTRAL_ADMIN';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>('ROLE_SCHOOL_USER');
  const [viewingOsTicket, setViewingOsTicket] = useState<Ticket | null>(null);

  const {
    tickets,
    technicians,
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
    manualDispatch,
    resetDatabase
  } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* HEADER INSTITUCIONAL GLOBAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Marca / Identidade */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
              <GraduationCap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-white">
                  HelpTech Escolas DF
                </h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-400/30">
                  v2.0 Master
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Service Desk & Field Service Inteligente • SEEDF (15 Regionais / 332 Escolas)
              </p>
            </div>
          </div>

          {/* SELETOR DE PERFIL DE ACESSO (RBAC) */}
          <div className="flex items-center bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-inner">
            <button
              onClick={() => setCurrentRole('ROLE_SCHOOL_USER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentRole === 'ROLE_SCHOOL_USER'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 size={14} />
              <span>1. Gestor Escolar</span>
            </button>

            <button
              onClick={() => setCurrentRole('ROLE_FIELD_TECH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentRole === 'ROLE_FIELD_TECH'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone size={14} />
              <span>2. Técnico de Campo</span>
            </button>

            <button
              onClick={() => setCurrentRole('ROLE_CENTRAL_ADMIN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                currentRole === 'ROLE_CENTRAL_ADMIN'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck size={14} />
              <span>3. Controladoria</span>
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL DINÂMICA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* PERFIL 1: PORTAL ESCOLAR */}
        {currentRole === 'ROLE_SCHOOL_USER' && (
          <SchoolPortal
            schools={schools}
            categories={categories}
            tickets={tickets}
            onCreateTicket={createTicket}
            onDecideQuote={decideQuote}
            onViewOS={(ticket) => setViewingOsTicket(ticket)}
          />
        )}

        {/* PERFIL 2: PWA TÉCNICO DE CAMPO */}
        {currentRole === 'ROLE_FIELD_TECH' && (
          <TechFieldPWA
            technicians={technicians}
            tickets={tickets}
            schools={schools}
            onAcceptTicket={acceptTicket}
            onRefuseTicket={refuseTicket}
            onCheckIn={checkInTechnician}
            onSubmitQuote={submitQuote}
            onCompleteTicket={completeTicket}
            onViewOS={(ticket) => setViewingOsTicket(ticket)}
          />
        )}

        {/* PERFIL 3: CONTROLADORIA & OPERAÇÃO CENTRAL */}
        {currentRole === 'ROLE_CENTRAL_ADMIN' && (
          <CentralAdminDashboard
            tickets={tickets}
            technicians={technicians}
            schools={schools}
            regions={regions}
            categories={categories}
            onManualDispatch={manualDispatch}
            onDecideQuote={decideQuote}
            onViewOS={(ticket) => setViewingOsTicket(ticket)}
            onResetDatabase={resetDatabase}
          />
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
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Motor de Despacho e Earthdistance Supabase 16 Operacional</span>
          </div>
          <div>
            Desenvolvido para Governança Tecnológica das Unidades Escolares da SEEDF
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
