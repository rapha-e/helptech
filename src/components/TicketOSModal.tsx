import type { Ticket } from '../data/seedData';
import { X, Printer, ShieldCheck, MapPin, Building2, Calendar, Phone, CheckCircle2 } from 'lucide-react';

interface TicketOSModalProps {
  ticket: Ticket;
  onClose: () => void;
}

export const TicketOSModal: React.FC<TicketOSModalProps> = ({ ticket, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Barra superior de ações */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={20} />
            <span className="font-semibold text-sm">Comprovante Oficial de Ordem de Serviço (OS)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              <Printer size={14} /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Conteúdo imprimível da OS */}
        <div id="printable-os" className="p-8 overflow-y-auto space-y-6 text-slate-800 bg-white">
          {/* Cabeçalho Oficial HelpTech */}
          <div className="text-center pb-6 border-b-2 border-slate-900/20">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-900 rounded-full text-xs font-bold tracking-wider uppercase mb-2">
              Governo do Distrito Federal • Secretaria de Educação (HelpTech)
            </div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              ORDEM DE SERVIÇO & TERMO DE CONFORMIDADE TÉCNICA
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Programa de Manutenção e Suporte Tecnológico das Unidades Escolares do DF
            </p>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <span className="font-mono font-bold bg-slate-100 px-3 py-1 rounded border border-slate-300">
                Protocolo: {ticket.protocol}
              </span>
              <span className="text-slate-600">
                Emissão: {new Date(ticket.created_at).toLocaleDateString('pt-BR')} às{' '}
                {new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Dados da Unidade Escolar e Solicitante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unidade Escolar</div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 size={16} className="text-blue-600" />
                {ticket.school_name}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" />
                {ticket.school_address} • Coordenação Regional: <strong className="text-slate-800">{ticket.cre_name}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Solicitante Responsável</div>
              <div className="font-bold text-slate-900">
                {ticket.requester_name} ({ticket.requester_role})
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <Phone size={14} className="text-slate-400" />
                {ticket.requester_phone}
              </div>
            </div>
          </div>

          {/* Dados do Defeito e Chamado */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
              1. Detalhamento da Ocorrência Técnica
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Categoria:</span>{' '}
                <strong className="text-slate-900">{ticket.category_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Nível de Urgência:</span>{' '}
                <span className="font-bold uppercase text-amber-700">{ticket.urgency_level}</span>
              </div>
              {ticket.equipment_patrimony && (
                <div className="col-span-2">
                  <span className="text-slate-500">Nº de Patrimônio do Equipamento:</span>{' '}
                  <strong className="font-mono text-slate-800">{ticket.equipment_patrimony}</strong>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <strong>Descrição do Problema:</strong> {ticket.description}
            </div>
          </div>

          {/* Informações do Técnico Responsável e Atendimento */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
              2. Equipe Técnica e Execução de Campo
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Técnico Credenciado:</span>{' '}
                <strong className="text-slate-900">{ticket.assigned_technician_name || 'Equipe Central'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Check-in Presencial:</span>{' '}
                <span className="font-mono text-emerald-700 font-semibold">
                  {ticket.arrived_at
                    ? new Date(ticket.arrived_at).toLocaleString('pt-BR')
                    : 'Não registrado'}
                </span>
              </div>
            </div>

            {ticket.completion && (
              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <strong>Parecer e Resumo dos Serviços Executados:</strong>
                <p className="leading-relaxed">{ticket.completion.service_summary}</p>
              </div>
            )}
          </div>

          {/* Orçamento se houver */}
          {ticket.quote && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
                3. Prestação de Contas & Peças Aplicadas
              </h2>
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Item / Especificação</th>
                    <th className="p-2 text-center">Qtd</th>
                    <th className="p-2 text-right">Unitário</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ticket.quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="p-2 capitalize font-medium">{item.item_type}</td>
                      <td className="p-2">{item.item_name}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">R$ {item.unit_price.toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">R$ {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={4} className="p-2 text-right">
                      Valor Total Homologado:
                    </td>
                    <td className="p-2 text-right text-blue-700">
                      R$ {ticket.quote.total_amount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Assinatura Digital do Gestor */}
          <div className="pt-4 border-t-2 border-slate-900/20">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              4. Homologação e Assinatura Digital do Gestor Escolar
            </h2>

            {ticket.completion ? (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 size={16} /> Serviço Atestado e Concluído
                  </div>
                  <div className="text-slate-800">
                    <strong>Responsável:</strong> {ticket.completion.school_representative_name}
                  </div>
                  <div className="text-slate-600">
                    <strong>Matrícula / Vínculo Institucional:</strong>{' '}
                    {ticket.completion.school_representative_doc
                      ? ticket.completion.school_representative_doc.replace(/(\d{3})\.\d{3}\.\d{3}-(\d{2})/, '$1.***.***-$2')
                      : 'Homologado no ato da visita'}
                  </div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Calendar size={12} />
                    Data da assinatura: {new Date(ticket.completion.completed_at).toLocaleString('pt-BR')}
                  </div>
                </div>

                {/* Traçado da Assinatura SVG */}
                <div className="bg-white p-3 rounded-lg border border-slate-300 w-56 flex flex-col items-center">
                  <div className="w-full h-16 flex items-center justify-center">
                    <svg viewBox="0 0 200 70" className="w-full h-full stroke-slate-900 fill-none stroke-[2]">
                      <path d={ticket.completion.signature_svg} />
                    </svg>
                  </div>
                  <div className="w-full border-t border-slate-400 mt-1 pt-1 text-[10px] text-center text-slate-500">
                    Assinatura Eletrônica em Tela
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Ordem de serviço em andamento. A assinatura digital será coletada presencialmente pelo técnico no encerramento do chamado.
              </div>
            )}
          </div>

          {/* Rodapé de autenticidade */}
          <div className="pt-4 text-center text-[10px] text-slate-400 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Token de Autenticidade: <strong className="font-mono text-slate-600">{ticket.tracking_token}</strong></span>
            <span>Sistema Integrado de Suporte e Governança • HelpTech Escolas DF</span>
          </div>
        </div>
      </div>
    </div>
  );
};
