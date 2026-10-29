import React from 'react';
import { FileText, Printer, X, ShieldCheck } from 'lucide-react';
import type { Ticket, RegionalCoordination } from '../data/seedData';

interface OfficialAuditReportModalProps {
  isOpen: boolean;
  tickets: Ticket[];
  regions: RegionalCoordination[];
  onClose: () => void;
}

export const OfficialAuditReportModal: React.FC<OfficialAuditReportModalProps> = ({
  isOpen,
  tickets,
  regions,
  onClose
}) => {
  if (!isOpen) return null;

  const totalTickets = tickets.length;
  const completedTickets = tickets.filter((t) => t.status === 'concluido');
  const totalAmountHomologated = completedTickets.reduce((acc, t) => acc + (t.quote?.total_amount || 0), 0);
  const nowStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden">
        {/* Barra superior de ações */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-400" />
            <span className="text-xs font-bold">Relatório Oficial de Prestação de Contas (Auditoria & Governança HelpTech)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow"
            >
              <Printer size={14} /> Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corpo do Documento Timbrado Oficial */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 font-sans print:p-0 print:m-0">
          {/* Cabeçalho Institucional */}
          <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
              HelpTech Informática &bull; Sistema Proprietário de Gestão de TI
            </div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase">
              Relatório Gerencial de Manutenção e Suporte em Tecnologia da Informação
            </h2>
            <p className="text-[11px] text-slate-600">
              Contrato de Prestação de Serviços HelpTech Informática &bull; Emissão: {nowStr}
            </p>
          </div>

          {/* Quadro Resumo Executivo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-[10px] font-bold uppercase text-slate-500">Chamados Registrados</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">{totalTickets}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="text-[10px] font-bold uppercase text-emerald-700">Concluídos com OS</div>
              <div className="text-xl font-extrabold text-emerald-800 mt-1">{completedTickets.length}</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <div className="text-[10px] font-bold uppercase text-blue-700">Total Homologado</div>
              <div className="text-xl font-extrabold text-blue-800 mt-1">
                R$ {totalAmountHomologated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
              <div className="text-[10px] font-bold uppercase text-purple-700">Regionais Atendidas</div>
              <div className="text-xl font-extrabold text-purple-800 mt-1">{regions.length} CREs</div>
            </div>
          </div>

          {/* Tabela de Ordens de Serviço */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              Detalhamento de Ordens de Serviço & Auditoria
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2.5">Protocolo / Hash</th>
                    <th className="p-2.5">Unidade Escolar</th>
                    <th className="p-2.5">CRE</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Técnico</th>
                    <th className="p-2.5 text-right">Valor Orçado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="p-2.5 font-mono font-bold text-blue-600">
                        {t.protocol}
                        <span className="block text-[9px] font-normal text-slate-400 truncate max-w-[120px]">
                          {t.tracking_token}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-800">{t.school_name}</td>
                      <td className="p-2.5 text-slate-600">CRE {t.cre_name}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700">{t.assigned_technician_name || '—'}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        R$ {(t.quote?.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Termo de Ateste / Assinatura do Relatório */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
            <div className="space-y-8">
              <div className="h-0.5 bg-slate-300 w-48 mx-auto" />
              <div>
                <strong>Supervisão Técnica HelpTech Informática</strong>
                <p className="text-[10px] text-slate-400">Responsável Operacional do Contrato</p>
              </div>
            </div>
            <div className="space-y-8">
              <div className="h-0.5 bg-slate-300 w-48 mx-auto" />
              <div>
                <strong>Fiscal do Contrato &bull; HelpTech</strong>
                <p className="text-[10px] text-slate-400">Diretoria de Tecnologia da Informação (DTI)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
