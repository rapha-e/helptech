import React from 'react';
import {
  FileText,
  Navigation,
  Wrench,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import type { Ticket } from '../data/seedData';

interface TicketJourneyTrackerProps {
  ticket: Ticket;
}

export const TicketJourneyTracker: React.FC<TicketJourneyTrackerProps> = ({ ticket }) => {
  const isCanceled = ticket.status === 'cancelado';
  const isCompleted = ticket.status === 'concluido';

  // Define os 5 marcos da jornada do chamado
  // Status canônicos: aberto, despachado, aceito, em_deslocamento, em_atendimento, visita_agendada, aguardando_orcamento, aguardando_peca, aguardando_terceiro, concluido, cancelado
  const steps = [
    {
      id: 'abertura',
      label: 'Chamado Aberto',
      desc: 'Registrado pela escola',
      icon: FileText,
      active: true,
      done: true
    },
    {
      id: 'despacho',
      label: 'Técnico Atribuído',
      desc: ticket.assigned_technician_name ? `${ticket.assigned_technician_name}` : 'Aguardando despacho',
      icon: Navigation,
      active: ['despachado', 'aceito', 'em_deslocamento', 'em_atendimento', 'visita_agendada', 'aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido'].includes(ticket.status),
      done: ['aceito', 'em_deslocamento', 'em_atendimento', 'visita_agendada', 'aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido'].includes(ticket.status)
    },
    {
      id: 'atendimento',
      label: 'Diagnóstico em Campo',
      desc: ticket.arrived_at ? 'Check-in realizado' : 'Em deslocamento / rota',
      icon: Wrench,
      active: ['em_atendimento', 'visita_agendada', 'aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido'].includes(ticket.status),
      done: ['aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido'].includes(ticket.status)
    },
    {
      id: 'pecas_orcamento',
      label: 'Orçamento & Logística',
      desc: ticket.quote ? `R$ ${ticket.quote.total_amount.toFixed(2)} (${ticket.quote.status})` : 'Sem pendência de peças',
      icon: PackageCheck,
      active: ['aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro', 'concluido'].includes(ticket.status),
      done: ['concluido'].includes(ticket.status)
    },
    {
      id: 'conclusao',
      label: 'Concluído com OS',
      desc: ticket.resolved_at ? 'Assinatura digital atestada' : 'Aguardando conclusão',
      icon: CheckCircle2,
      active: isCompleted,
      done: isCompleted
    }
  ];

  if (isCanceled) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1">
        <div className="flex items-center gap-2 text-rose-800 font-bold">
          <XCircle size={18} className="text-rose-600 shrink-0" />
          <span>Chamado Cancelado</span>
        </div>
        <p className="text-rose-700 text-[11.5px]">
          Este chamado foi cancelado e arquivado para prestação de contas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Clock size={13} className="text-blue-600" /> Linha do Tempo do Atendimento (Tempo Real)
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
          Etapa {steps.filter((s) => s.done).length} de 5
        </span>
      </div>

      {/* Esteira Horizontal Responsiva */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 relative">
        {steps.map((step) => {
          const Icon = step.icon;
          const isCurrent = step.active && !step.done;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex sm:flex-col items-center sm:text-center gap-2.5 sm:gap-1.5 ${
                step.done
                  ? 'bg-white border-emerald-300 shadow-xs'
                  : isCurrent
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-white/50 border-slate-200 opacity-60'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  step.done
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Icon size={16} />
              </div>

              <div className="min-w-0 flex-1 sm:flex-initial">
                <p className="font-bold text-xs text-slate-900 truncate">{step.label}</p>
                <p className="text-[10.5px] text-slate-500 truncate">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
