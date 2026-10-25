import React, { useState, useEffect } from 'react';
import type { Technician, Ticket, School } from '../data/seedData';
import type { QuoteSubmissionData, TicketCompletionData } from '../lib/schemas';
import { SignaturePad } from './SignaturePad';
import {
  Smartphone,
  Navigation,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Building2,
  Phone,
  FileSpreadsheet,
  Plus,
  Trash2,
  Wrench,
  AlertCircle,
  ShieldAlert,
  Send,
  Eye,
  Calendar,
  Package,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface TechFieldPWAProps {
  technicians: Technician[];
  tickets: Ticket[];
  schools: School[];
  onAcceptTicket: (ticketId: string, techId: string) => void;
  onRefuseTicket: (ticketId: string, techId: string, reason: string) => void;
  onCheckIn: (
    ticketId: string,
    techId: string,
    lat: number,
    lng: number
  ) => { success: boolean; distanceKm: number; message: string };
  onSubmitQuote: (ticketId: string, techId: string, data: QuoteSubmissionData) => void;
  onCompleteTicket: (ticketId: string, techId: string, data: TicketCompletionData) => void;
  onScheduleVisit?: (ticketId: string, scheduledAt: string, notes: string) => void;
  onSetWaitingParts?: (ticketId: string, partNotes: string) => void;
  onSetWaitingThirdParty?: (ticketId: string, thirdPartyNotes: string) => void;
  onResumeService?: (ticketId: string) => void;
  onViewOS: (ticket: Ticket) => void;
}

export const TechFieldPWA: React.FC<TechFieldPWAProps> = ({
  technicians,
  tickets,
  schools,
  onAcceptTicket,
  onRefuseTicket,
  onCheckIn,
  onSubmitQuote,
  onCompleteTicket,
  onScheduleVisit,
  onSetWaitingParts,
  onSetWaitingThirdParty,
  onResumeService,
  onViewOS
}) => {
  const [selectedTechId, setSelectedTechId] = useState<string>(technicians[0]?.id || '');
  const [refusalReason, setRefusalReason] = useState<string>('');
  const [refusalModalTicketId, setRefusalModalTicketId] = useState<string | null>(null);

  // Agendamento de visita
  const [scheduleModalTicketId, setScheduleModalTicketId] = useState<string | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Aguardando peça
  const [partsModalTicketId, setPartsModalTicketId] = useState<string | null>(null);
  const [partNotes, setPartNotes] = useState('');

  // Aguardando terceiro
  const [thirdPartyModalTicketId, setThirdPartyModalTicketId] = useState<string | null>(null);
  const [thirdPartyNotes, setThirdPartyNotes] = useState('');

  // Orçamento
  const [quoteTicketId, setQuoteTicketId] = useState<string | null>(null);
  const [quoteDiagnosis, setQuoteDiagnosis] = useState('');
  const [quoteItems, setQuoteItems] = useState<
    { item_type: 'peca' | 'servico'; item_name: string; quantity: number; unit_price: number }[]
  >([{ item_type: 'peca', item_name: '', quantity: 1, unit_price: 0 }]);

  // Conclusão
  const [completionTicketId, setCompletionTicketId] = useState<string | null>(null);
  const [serviceSummary, setServiceSummary] = useState('');
  const [schoolRepName, setSchoolRepName] = useState('');
  const [schoolRepDoc, setSchoolRepDoc] = useState('');
  const [signatureSvg, setSignatureSvg] = useState('');

  // Notificação de feedback de check-in
  const [checkInFeedback, setCheckInFeedback] = useState<{
    ticketId: string;
    msg: string;
    dist: number;
  } | null>(null);

  const handleOpenWhatsApp = (phone: string, protocol: string, schoolName: string, requesterName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${requesterName}! Sou o técnico HelpTech responsável pelo atendimento do chamado ${protocol} na ${schoolName}. Gostaria de alinhar detalhes com você.`
    );
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  // Técnico selecionado
  const currentTech = technicians.find((t) => t.id === selectedTechId);

  // Chamados atribuídos a este técnico
  const techTickets = tickets.filter((t) => t.assigned_technician_id === selectedTechId);

  // Chamado despachado aguardando aceite (timeout de 20 min ativo)
  const pendingDispatchTicket = techTickets.find((t) => t.status === 'despachado');

  // Chamado em atendimento ou deslocamento ativo
  const activeWorkingTickets = techTickets.filter((t) =>
    [
      'visita_agendada',
      'em_deslocamento',
      'em_atendimento',
      'aguardando_orcamento',
      'aguardando_peca',
      'aguardando_terceiro'
    ].includes(t.status)
  );

  // Cálculo de tempo restante de timeout (20 min)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (!pendingDispatchTicket?.dispatch_timeout_at) {
      setTimeRemainingSeconds(0);
      return;
    }

    const target = new Date(pendingDispatchTicket.dispatch_timeout_at).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setTimeRemainingSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pendingDispatchTicket]);

  const formatMinutesSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePerformCheckIn = (ticket: Ticket) => {
    const school = schools.find((s) => s.id === ticket.school_id);
    if (!school || !currentTech) return;

    // Simula coordenadas próximas da escola (com leve variação para teste realista)
    const simulatedLat = school.latitude + 0.0008;
    const simulatedLng = school.longitude + 0.0006;

    const res = onCheckIn(ticket.id, currentTech.id, simulatedLat, simulatedLng);
    setCheckInFeedback({
      ticketId: ticket.id,
      msg: res.message,
      dist: res.distanceKm
    });
  };

  const handleAddQuoteItem = () => {
    setQuoteItems([
      ...quoteItems,
      { item_type: 'peca', item_name: '', quantity: 1, unit_price: 0 }
    ]);
  };

  const handleRemoveQuoteItem = (idx: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== idx));
  };

  const handleSendQuote = (ticketId: string) => {
    if (!currentTech || !quoteDiagnosis.trim() || quoteItems.length === 0) return;
    const validItems = quoteItems.filter((it) => it.item_name.trim().length > 0);
    if (validItems.length === 0) return;

    onSubmitQuote(ticketId, currentTech.id, {
      technical_diagnosis: quoteDiagnosis,
      items: validItems
    });

    setQuoteTicketId(null);
    setQuoteDiagnosis('');
    setQuoteItems([{ item_type: 'peca', item_name: '', quantity: 1, unit_price: 0 }]);
  };

  const handleFinalizeService = (ticketId: string) => {
    if (
      !currentTech ||
      !serviceSummary.trim() ||
      !schoolRepName.trim() ||
      !schoolRepDoc.trim() ||
      !signatureSvg
    ) {
      alert('Preencha o resumo, os dados do gestor e colete a assinatura na tela.');
      return;
    }

    onCompleteTicket(ticketId, currentTech.id, {
      service_summary: serviceSummary,
      school_representative_name: schoolRepName,
      school_representative_doc: schoolRepDoc,
      signature_svg: signatureSvg
    });

    setCompletionTicketId(null);
    setServiceSummary('');
    setSchoolRepName('');
    setSchoolRepDoc('');
    setSignatureSvg('');
  };

  return (
    <div className="max-w-md mx-auto space-y-5 pb-12 animate-fadeIn">
      {/* Top Header do PWA Mobile-First */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">HelpTech PWA de Campo</h3>
              <p className="text-[11px] text-slate-400">Atendimento Técnico DF</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> GPS Ativo
          </span>
        </div>

        {/* Seletor de Perfil do Técnico */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Técnico em Serviço Ativo:
          </label>
          <select
            value={selectedTechId}
            onChange={(e) => setSelectedTechId(e.target.value)}
            className="w-full bg-slate-800 text-white text-xs font-semibold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.primary_cre_name}) - Raio: {t.radius_km}km
              </option>
            ))}
          </select>
        </div>

        {currentTech && (
          <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Base: {currentTech.primary_cre_name}</span>
            <span className="text-blue-300 font-mono">
              Capacidade: {techTickets.length}/{currentTech.max_active_tickets} OS
            </span>
          </div>
        )}
      </div>

      {/* ALERTA DE NOVO CHAMADO DESPACHADO COM TIMEOUT DE 20 MINUTOS */}
      {pendingDispatchTicket && (
        <div className="bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl relative overflow-hidden animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-amber-700 font-black text-xs uppercase tracking-wider">
              <ShieldAlert size={18} className="animate-bounce" /> Novo Chamado Despachado!
            </div>
            <div className="flex items-center gap-1 text-xs font-mono font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full shadow-sm">
              <Clock size={12} />
              <span>{formatMinutesSeconds(timeRemainingSeconds)}</span>
            </div>
          </div>

          <h4 className="font-bold text-slate-900 text-sm leading-snug">
            {pendingDispatchTicket.title}
          </h4>

          <div className="mt-2 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Building2 size={14} className="text-amber-600" />
              {pendingDispatchTicket.school_name}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <MapPin size={13} className="text-slate-400" />
              {pendingDispatchTicket.school_address} ({pendingDispatchTicket.cre_name})
            </div>
            <div className="text-[11px] text-slate-500 pt-1">
              <strong>Urgência:</strong>{' '}
              <span className="uppercase text-amber-800 font-bold">
                {pendingDispatchTicket.urgency_level}
              </span>{' '}
              • Solicitante: {pendingDispatchTicket.requester_name}
            </div>
          </div>

          {/* Barra de progresso regressiva do timeout */}
          <div className="w-full bg-amber-200 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-600 h-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (timeRemainingSeconds / (20 * 60)) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-amber-800/80 block mt-1 text-center">
            Timeout de 20 minutos. Sem aceite, a vaga será repassada ao próximo técnico mais próximo.
          </span>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onAcceptTicket(pendingDispatchTicket.id, selectedTechId)}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={16} /> Aceitar Deslocamento
            </button>
            <button
              onClick={() => setRefusalModalTicketId(pendingDispatchTicket.id)}
              className="px-4 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
            >
              <XCircle size={16} /> Recusar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE JUSTIFICATIVA DE RECUSA */}
      {refusalModalTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600" />
              Justificativa de Recusa do Chamado
            </h4>
            <p className="text-xs text-slate-500">
              Informe o motivo da recusa para que o motor de despacho inteligente redirecione a ordem
              imediatamente:
            </p>
            <textarea
              rows={3}
              value={refusalReason}
              onChange={(e) => setRefusalReason(e.target.value)}
              placeholder="Ex: Pneu furado em rota / Em atendimento complexo que ultrapassa o SLA..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRefuseTicket(
                    refusalModalTicketId,
                    selectedTechId,
                    refusalReason || 'Recusa pelo técnico de campo'
                  );
                  setRefusalModalTicketId(null);
                  setRefusalReason('');
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow"
              >
                Confirmar Recusa
              </button>
              <button
                onClick={() => setRefusalModalTicketId(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTA DE CHAMADOS EM ATENDIMENTO / ROTA DO TÉCNICO */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Ordens de Serviço em Execução ({activeWorkingTickets.length})
          </h4>
        </div>

        {activeWorkingTickets.length === 0 && !pendingDispatchTicket && (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Wrench size={24} />
            </div>
            <h5 className="font-bold text-xs text-slate-800">Nenhum chamado em aberto no momento</h5>
            <p className="text-[11px] text-slate-400">
              Você está com status disponível. Novos chamados da CRE serão direcionados automaticamente.
            </p>
          </div>
        )}

        {activeWorkingTickets.map((ticket) => (
          <div
            key={ticket.id}
            className="bg-white rounded-3xl p-5 shadow-lg border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-700">{ticket.protocol}</span>
                <h5 className="font-bold text-xs text-slate-900 mt-0.5">{ticket.title}</h5>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  ticket.status === 'em_deslocamento'
                    ? 'bg-blue-100 text-blue-800'
                    : ticket.status === 'em_atendimento'
                    ? 'bg-purple-100 text-purple-800'
                    : ticket.status === 'aguardando_orcamento'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {ticket.status.replace('_', ' ')}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Building2 size={14} className="text-blue-600" />
                {ticket.school_name}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <MapPin size={13} className="text-slate-400" />
                {ticket.school_address}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Phone size={13} className="text-slate-400" />
                {ticket.requester_name}: {ticket.requester_phone}
              </div>
            </div>

            {/* AÇÃO RÁPIDA: CONTATO DIRETO VIA WHATSAPP COM O SOLICITANTE */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleOpenWhatsApp(ticket.requester_phone, ticket.protocol, ticket.school_name, ticket.requester_name)}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <MessageSquare size={14} /> WhatsApp com Solicitante
              </button>
              <button
                type="button"
                onClick={() => setScheduleModalTicketId(ticket.id)}
                className="py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                title="Agendar data com o solicitante"
              >
                <Calendar size={14} /> Agendar
              </button>
            </div>

            {/* FEEDBACK DE CHECK-IN GPS */}
            {checkInFeedback && checkInFeedback.ticketId === ticket.id && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{checkInFeedback.msg}</span>
              </div>
            )}

            {/* BOTÕES DE FLUXO CONFORME O STATUS DO CHAMADO */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {ticket.status === 'visita_agendada' && (
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <Calendar size={14} className="text-purple-600" /> Visita Técnica Agendada
                  </div>
                  <p className="text-[11.5px]">
                    Data/Hora: <strong>{ticket.scheduled_visit_at ? new Date(ticket.scheduled_visit_at).toLocaleString('pt-BR') : 'A definir'}</strong>
                  </p>
                  {ticket.scheduled_visit_notes && (
                    <p className="text-[11px] text-purple-700">Obs: {ticket.scheduled_visit_notes}</p>
                  )}
                  <button
                    onClick={() => onAcceptTicket(ticket.id, selectedTechId)}
                    className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Navigation size={14} /> Iniciar Deslocamento Agora
                  </button>
                </div>
              )}

              {ticket.status === 'em_deslocamento' && (
                <button
                  onClick={() => handlePerformCheckIn(ticket)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Navigation size={15} /> Realizar Check-in GPS de Chegada
                </button>
              )}

              {ticket.status === 'em_atendimento' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setQuoteTicketId(ticket.id);
                        setCompletionTicketId(null);
                      }}
                      className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow"
                    >
                      <FileSpreadsheet size={15} /> Lançar Orçamento
                    </button>
                    <button
                      onClick={() => {
                        setCompletionTicketId(ticket.id);
                        setQuoteTicketId(null);
                        setSchoolRepName(ticket.requester_name);
                      }}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow"
                    >
                      <CheckCircle2 size={15} /> Concluir com Assinatura
                    </button>
                  </div>

                  {/* Sub-ações de controle de espera */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPartsModalTicketId(ticket.id)}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Package size={13} /> Aguardar Peça
                    </button>
                    <button
                      type="button"
                      onClick={() => setThirdPartyModalTicketId(ticket.id)}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <ExternalLink size={13} /> Aguardar Terceiro
                    </button>
                  </div>
                </div>
              )}

              {ticket.status === 'aguardando_orcamento' && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <Clock size={13} /> Orçamento em Análise pelo Gestor
                  </div>
                  <p className="text-[11px]">
                    Total orçado: R$ {ticket.quote?.total_amount.toFixed(2)}. Aguardando aprovação digital da escola.
                  </p>
                </div>
              )}

              {ticket.status === 'aguardando_peca' && (
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <Package size={14} className="text-blue-600" /> Aguardando Envio de Peça de Reposição
                  </div>
                  <p className="text-[11px] text-slate-700">
                    Peça solicitada: <strong>{ticket.pending_part_notes || 'Componente em solicitação'}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {onResumeService && (
                      <button
                        onClick={() => onResumeService(ticket.id)}
                        className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Wrench size={13} /> Peça Chegou (Retomar)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setCompletionTicketId(ticket.id);
                        setSchoolRepName(ticket.requester_name);
                      }}
                      className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Finalizar OS
                    </button>
                  </div>
                </div>
              )}

              {ticket.status === 'aguardando_terceiro' && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <ExternalLink size={14} className="text-amber-600" /> Aguardando Concessionária / Terceiro
                  </div>
                  <p className="text-[11px] text-slate-700">
                    Dependência: <strong>{ticket.third_party_notes || 'Atuação de provedor de internet ou concessionária elétrica.'}</strong>
                  </p>
                  {onResumeService && (
                    <button
                      onClick={() => onResumeService(ticket.id)}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      <Wrench size={13} /> Terceiro Atendeu (Retomar)
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => onViewOS(ticket)}
                className="w-full py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1"
              >
                <Eye size={12} /> Visualizar Prévia da OS
              </button>
            </div>

            {/* FORMULÁRIO DE ORÇAMENTO EXPANSÍVEL */}
            {quoteTicketId === ticket.id && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-amber-200 space-y-3 animate-fadeIn">
                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>Diagnóstico & Orçamento de Peças/Mão de Obra</span>
                  <button
                    onClick={() => setQuoteTicketId(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancelar
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Laudo Técnico Detalhado *
                  </label>
                  <textarea
                    rows={2}
                    value={quoteDiagnosis}
                    onChange={(e) => setQuoteDiagnosis(e.target.value)}
                    placeholder="Ex: Identificado curto-circuito no transformador interno..."
                    className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Itens do Orçamento</span>
                    <button
                      type="button"
                      onClick={handleAddQuoteItem}
                      className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5"
                    >
                      <Plus size={12} /> Adicionar Item
                    </button>
                  </div>

                  {quoteItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={item.item_type}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx].item_type = e.target.value as any;
                            setQuoteItems(updated);
                          }}
                          className="text-[11px] p-1 border rounded-lg bg-slate-50"
                        >
                          <option value="peca">Peça</option>
                          <option value="servico">Serviço</option>
                        </select>
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx].item_name = e.target.value;
                            setQuoteItems(updated);
                          }}
                          placeholder="Descrição do item"
                          className="flex-1 text-[11px] p-1 border rounded-lg"
                        />
                        {quoteItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuoteItem(idx)}
                            className="text-rose-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 text-[11px]">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block">Qtd</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...quoteItems];
                              updated[idx].quantity = parseInt(e.target.value) || 1;
                              setQuoteItems(updated);
                            }}
                            className="w-full p-1 border rounded-lg text-center"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block">Preço Unit. (R$)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...quoteItems];
                              updated[idx].unit_price = parseFloat(e.target.value) || 0;
                              setQuoteItems(updated);
                            }}
                            className="w-full p-1 border rounded-lg text-right"
                          />
                        </div>
                        <div className="flex-1 text-right">
                          <label className="text-[10px] text-slate-400 block">Subtotal</label>
                          <span className="font-bold text-slate-800">
                            R$ {(item.quantity * item.unit_price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleSendQuote(ticket.id)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send size={14} /> Enviar Orçamento para o Diretor
                </button>
              </div>
            )}

            {/* FORMULÁRIO DE ENCERRAMENTO COM ASSINATURA VETORIAL */}
            {completionTicketId === ticket.id && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-emerald-300 space-y-4 animate-fadeIn">
                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>Encerramento de OS & Assinatura Digital</span>
                  <button
                    onClick={() => setCompletionTicketId(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Fechar
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Resumo do Serviço Executado *
                  </label>
                  <textarea
                    rows={2}
                    value={serviceSummary}
                    onChange={(e) => setServiceSummary(e.target.value)}
                    placeholder="Ex: Troca da ventoinha do cooler, aplicação de pasta térmica e testes operacionais aprovados..."
                    className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Nome do Gestor Escolar *
                    </label>
                    <input
                      type="text"
                      value={schoolRepName}
                      onChange={(e) => setSchoolRepName(e.target.value)}
                      placeholder="Diretor / Secretário"
                      className="w-full p-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Matrícula SEEDF / CPF *
                    </label>
                    <input
                      type="text"
                      value={schoolRepDoc}
                      onChange={(e) => setSchoolRepDoc(e.target.value)}
                      placeholder="Matrícula SEEDF"
                      className="w-full p-1.5 border rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Pad de Assinatura Eletrônica em Tela */}
                <SignaturePad onSave={(svg) => setSignatureSvg(svg)} />

                <button
                  type="button"
                  onClick={() => handleFinalizeService(ticket.id)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Emitir Conclusão & Gerar Comprovante
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL DE AGENDAMENTO DE VISITA */}
      {scheduleModalTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-purple-600" />
              Agendar Visita com a Escola
            </h4>
            <p className="text-xs text-slate-500">
              Combine a data e horário ideal com o gestor escolar. O solicitante receberá notificação no WhatsApp.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Data e Horário da Visita *
              </label>
              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Observações do Agendamento
              </label>
              <textarea
                rows={2}
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="Ex: Comparecer no turno matutino, procurar a vice-diretora..."
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!scheduleDateTime}
                onClick={() => {
                  if (onScheduleVisit && scheduleModalTicketId) {
                    onScheduleVisit(scheduleModalTicketId, scheduleDateTime, scheduleNotes);
                  }
                  setScheduleModalTicketId(null);
                  setScheduleDateTime('');
                  setScheduleNotes('');
                }}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow"
              >
                Confirmar Agendamento
              </button>
              <button
                type="button"
                onClick={() => setScheduleModalTicketId(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AGUARDAR PEÇA */}
      {partsModalTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Package size={18} className="text-blue-600" />
              Solicitar Peça de Reposição
            </h4>
            <p className="text-xs text-slate-500">
              Descreva a peça necessária para que a logística da Central HelpTech faça o envio. O SLA do chamado é congelado.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Descrição da Peça / Especificações Técnicas *
              </label>
              <textarea
                rows={3}
                value={partNotes}
                onChange={(e) => setPartNotes(e.target.value)}
                placeholder="Ex: Memória RAM 8GB DDR4 2666MHz ou Placa de rede Gigabit PCI Express..."
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!partNotes.trim()}
                onClick={() => {
                  if (onSetWaitingParts && partsModalTicketId) {
                    onSetWaitingParts(partsModalTicketId, partNotes);
                  }
                  setPartsModalTicketId(null);
                  setPartNotes('');
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow"
              >
                Registrar Espera de Peça
              </button>
              <button
                type="button"
                onClick={() => setPartsModalTicketId(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AGUARDAR TERCEIRO */}
      {thirdPartyModalTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ExternalLink size={18} className="text-amber-600" />
              Aguardar Serviço de Terceiro / Provedor
            </h4>
            <p className="text-xs text-slate-500">
              Indique a dependência externa (operadora de telecomunicação, rede elétrica externa Neoenergia, etc.).
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Identificação do Terceiro & Protocolo Externo *
              </label>
              <textarea
                rows={3}
                value={thirdPartyNotes}
                onChange={(e) => setThirdPartyNotes(e.target.value)}
                placeholder="Ex: Falha no link de fibra ótica da operadora. Protocolo externo aberto junto ao provedor..."
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!thirdPartyNotes.trim()}
                onClick={() => {
                  if (onSetWaitingThirdParty && thirdPartyModalTicketId) {
                    onSetWaitingThirdParty(thirdPartyModalTicketId, thirdPartyNotes);
                  }
                  setThirdPartyModalTicketId(null);
                  setThirdPartyNotes('');
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow"
              >
                Registrar Espera de Terceiro
              </button>
              <button
                type="button"
                onClick={() => setThirdPartyModalTicketId(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
