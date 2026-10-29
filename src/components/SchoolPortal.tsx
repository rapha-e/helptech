import React, { useState, useEffect } from 'react';
import type {
  School,
  TicketCategory,
  Ticket,
  RegionalCoordination
} from '../data/seedData';
import { compressImageToWebP } from '../lib/geoEngine';
import { ticketSubmissionSchema } from '../lib/schemas';
import type { TicketSubmissionData } from '../lib/schemas';
import confetti from 'canvas-confetti';
import {
  School as SchoolIcon,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowRight,
  ArrowLeft,
  Search,
  FileText,
  Sparkles,
  ShieldCheck,
  Check,
  XCircle,
  Building2,
  MapPin,
  Phone,
  Mail,
  QrCode,
  Star
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { TicketJourneyTracker } from './TicketJourneyTracker';
import { AiTriageAssistant } from './AiTriageAssistant';
import { analyzeTicketDescription } from '../lib/aiTriageService';
import { CsatSurveyModal } from './CsatSurveyModal';

interface SchoolPortalProps {
  schools: School[];
  categories: TicketCategory[];
  regions: RegionalCoordination[];
  tickets: Ticket[];
  onCreateTicket: (
    data: TicketSubmissionData,
    attachments: { file_url: string; file_name: string; file_size_bytes: number }[]
  ) => Ticket;
  onDecideQuote: (ticketId: string, approved: boolean, name: string, reason?: string) => void;
  onViewOS: (ticket: Ticket) => void;
  onSubmitCsat?: (ticketId: string, rating: number, comment?: string) => void;
}

const DRAFT_KEY = 'helptechinfo_school_draft';
const MY_TICKETS_KEY = 'helptech_my_ticket_ids';
const MY_PHONE_KEY = 'helptech_my_phone';

export const applyPhoneMask = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const SchoolPortal: React.FC<SchoolPortalProps> = ({
  schools,
  categories,
  regions,
  tickets,
  onCreateTicket,
  onDecideQuote,
  onViewOS,
  onSubmitCsat
}) => {
  const [activeTab, setActiveTab] = useState<'abrir' | 'rastrear'>('abrir');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Seleção de CRE (Coordenação Regional de Ensino) - inicia vazia para obrigar seleção
  const [selectedCreId, setSelectedCreId] = useState<string>('');

  // Escolas filtradas exclusivamente pela CRE selecionada
  const creSchools = selectedCreId ? schools.filter((s) => s.cre_id === selectedCreId) : [];

  // Formulário
  const [formData, setFormData] = useState<TicketSubmissionData>({
    school_id: '',
    requester_name: '',
    requester_role: 'Diretor(a) Escolar',
    requester_phone: '',
    category_id: categories[0]?.id || '',
    title: '',
    description: '',
    equipment_patrimony: '',
    urgency_level: 'media'
  });

  const [schoolSearch, setSchoolSearch] = useState('');
  const [attachments, setAttachments] = useState<
    { file_url: string; file_name: string; file_size_bytes: number; originalSize: number }[]
  >([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createdSuccessTicket, setCreatedSuccessTicket] = useState<Ticket | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showCsatModal, setShowCsatModal] = useState(false);
  const [dismissTriage, setDismissTriage] = useState(false);

  // Rastreamento restrito aos chamados do usuário
  const [myTicketIds, setMyTicketIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(MY_TICKETS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [searchPhoneOrProtocol, setSearchPhoneOrProtocol] = useState<string>(() => {
    try {
      return localStorage.getItem(MY_PHONE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [selectedTrackedTicket, setSelectedTrackedTicket] = useState<Ticket | null>(null);
  const triageResult = !dismissTriage ? analyzeTicketDescription(formData.title, formData.description) : null;

  // Atualiza escola quando a CRE muda (mantém escola limpa para seleção)
  const handleCreChange = (newCreId: string) => {
    setSelectedCreId(newCreId);
    setSchoolSearch('');
    setFormData((prev) => ({ ...prev, school_id: '' }));
  };

  // Recupera rascunho salvo do localStorage ao montar (garante que CRE e escola NÃO venham pré-selecionadas)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setFormData((prev) => ({
          ...prev,
          requester_name: parsed.requester_name || '',
          requester_role: parsed.requester_role || 'Diretor(a) Escolar',
          requester_phone: parsed.requester_phone || '',
          category_id: parsed.category_id || categories[0]?.id || '',
          title: parsed.title || '',
          description: parsed.description || '',
          equipment_patrimony: parsed.equipment_patrimony || '',
          urgency_level: parsed.urgency_level || 'media',
          // Nunca pré-seleciona escola automaticamente: o usuário deve sempre escolher a CRE primeiro
          school_id: ''
        }));
        setSelectedCreId('');
      }
    } catch {
      console.warn('Rascunho não encontrado');
    }
  }, [categories]);

  // Salva rascunho continuamente
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {
      console.warn('Erro ao salvar rascunho');
    }
  }, [formData]);

  // Filtro de escolas pertencentes à CRE com refinamento por busca de texto (Nome, CEP ou Endereço)
  const filteredSchoolsInCre = creSchools.filter(
    (s) =>
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      (s.cep && s.cep.replace(/[^\d]/g, '').includes(schoolSearch.replace(/[^\d]/g, ''))) ||
      s.address.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const selectedSchool = schools.find((s) => s.id === formData.school_id);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsCompressing(true);

    const newAttachments = [...attachments];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      try {
        const compressed = await compressImageToWebP(file, 0.75);
        newAttachments.push({
          file_url: compressed.dataUrl,
          file_name: file.name.replace(/\.[^/.]+$/, '') + '.webp',
          file_size_bytes: compressed.sizeBytes,
          originalSize: file.size
        });
      } catch (err) {
        console.error('Erro na compressão:', err);
      }
    }
    setAttachments(newAttachments);
    setIsCompressing(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!selectedCreId) errors.cre = 'Selecione a Coordenação Regional (CRE)';
    if (!formData.school_id) errors.school_id = 'Selecione a Unidade Escolar da CRE';
    if (!formData.requester_name.trim()) errors.requester_name = 'Nome do solicitante é obrigatório';
    if (!formData.requester_phone.trim()) errors.requester_phone = 'Telefone WhatsApp é obrigatório';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!formData.category_id) errors.category_id = 'Selecione a categoria técnica';
    if (formData.title.trim().length < 5) errors.title = 'Título deve ter ao menos 5 caracteres';
    if (formData.description.trim().length < 15)
      errors.description = 'Descreva o problema com ao menos 15 caracteres';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = ticketSubmissionSchema.safeParse(formData);
    if (!result.success) {
      const errObj: Record<string, string> = {};
      result.error.issues.forEach((iss) => {
        errObj[String(iss.path[0])] = iss.message;
      });
      setFormErrors(errObj);
      return;
    }

    const created = onCreateTicket(formData, attachments);
    setCreatedSuccessTicket(created);
    localStorage.removeItem(DRAFT_KEY);

    // Registra o chamado na lista exclusiva do usuário
    try {
      const updated = Array.from(new Set([created.id, ...myTicketIds]));
      setMyTicketIds(updated);
      localStorage.setItem(MY_TICKETS_KEY, JSON.stringify(updated));
      localStorage.setItem(MY_PHONE_KEY, formData.requester_phone);
      setSearchPhoneOrProtocol(formData.requester_phone);
    } catch {
      console.warn('Erro ao salvar chamado do usuário');
    }

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Lista de chamados restritos exclusivamente a este usuário
  const cleanSearchDigits = searchPhoneOrProtocol.replace(/\D/g, '');
  const userMyTickets = tickets.filter((t) => {
    if (myTicketIds.includes(t.id)) return true;
    if (searchPhoneOrProtocol.trim().length >= 3) {
      const matchProtocol = t.protocol.toLowerCase().includes(searchPhoneOrProtocol.trim().toLowerCase());
      const matchToken = t.tracking_token.toLowerCase() === searchPhoneOrProtocol.trim().toLowerCase();
      const matchPhone = cleanSearchDigits.length >= 8 && t.requester_phone.replace(/\D/g, '').includes(cleanSearchDigits);
      return matchProtocol || matchToken || matchPhone;
    }
    return false;
  });

  // Localizar chamado digitado no campo de busca
  const handleSearchTicket = () => {
    if (!searchPhoneOrProtocol.trim()) return;
    const cleanDigits = searchPhoneOrProtocol.replace(/\D/g, '');
    const found = tickets.find(
      (t) =>
        t.protocol.toLowerCase().includes(searchPhoneOrProtocol.trim().toLowerCase()) ||
        t.tracking_token.toLowerCase().includes(searchPhoneOrProtocol.trim().toLowerCase()) ||
        (cleanDigits.length >= 8 && t.requester_phone.replace(/\D/g, '').includes(cleanDigits))
    );
    if (found) {
      setSelectedTrackedTicket(found);
      // Se encontrou pelo WhatsApp/protocolo dele, adiciona na lista para visualização contínua
      if (!myTicketIds.includes(found.id)) {
        const updated = [found.id, ...myTicketIds];
        setMyTicketIds(updated);
        try {
          localStorage.setItem(MY_TICKETS_KEY, JSON.stringify(updated));
        } catch {
          // Fallback silencioso de storage
        }
      }
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Banner Otimizado */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 shadow-lg border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-1.5 border border-blue-400/30">
              <SchoolIcon size={13} /> Portal das Unidades Escolares
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Abertura & Acompanhamento de Atendimento Técnico
            </h2>
            <p className="text-slate-300 text-xs mt-0.5">
              Suporte de TI e manutenção para as Coordenações Regionais de Ensino (CREs) do DF.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('abrir')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'abrir'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Sparkles size={14} /> Abrir Chamado (3 Passos)
            </button>
            <button
              onClick={() => setActiveTab('rastrear')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'rastrear'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Search size={14} /> Acompanhar Meus Chamados ({userMyTickets.length})
            </button>
          </div>
        </div>
      </div>

      {/* ABA 1: ABERTURA EM 3 ETAPAS */}
      {activeTab === 'abrir' && (
        <>
          {createdSuccessTicket ? (
            <div className="bg-white rounded-2xl p-6 border border-emerald-200 shadow-lg text-center max-w-xl mx-auto space-y-4 animate-fadeIn">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chamado Aberto com Sucesso!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  O motor de inteligência geográfica já notificou a equipe técnica mais próxima para atendimento.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Número do Protocolo:</span>
                  <strong className="font-mono text-blue-700 text-sm">
                    {createdSuccessTicket.protocol}
                  </strong>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Unidade Escolar:</span>
                  <span className="font-semibold text-slate-800">
                    {createdSuccessTicket.school_name}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Regional (CRE):</span>
                  <span className="font-semibold text-slate-700">
                    CRE {createdSuccessTicket.cre_name}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">Técnico em Notificação:</span>
                  <span className="font-semibold text-emerald-700">
                    {createdSuccessTicket.assigned_technician_name || 'Buscando técnico disponível'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500">Token de Acompanhamento:</span>
                  <span className="font-mono text-[11px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                    {createdSuccessTicket.tracking_token}
                  </span>
                </div>
              </div>

              {/* Dica de Acompanhamento Contínuo */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <Sparkles size={14} className="text-blue-600" /> Como acompanhar esta solicitação:
                </div>
                <p className="text-[11.5px] text-blue-800/90 leading-relaxed">
                  Este chamado já foi salvo automaticamente na sua aba <strong>"Rastrear Chamados"</strong>. Você também pode consultá-lo a qualquer momento digitando o número do protocolo <strong>{createdSuccessTicket.protocol}</strong> ou o WhatsApp <strong>{createdSuccessTicket.requester_phone}</strong>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => {
                    setSelectedTrackedTicket(createdSuccessTicket);
                    setActiveTab('rastrear');
                    setCreatedSuccessTicket(null);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Search size={14} /> Acompanhar Linha do Tempo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = createdSuccessTicket.requester_phone.replace(/\D/g, '');
                    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                    const text = encodeURIComponent(
                      `📋 *Comprovante de Chamado HelpTech*\n` +
                      `*Protocolo:* ${createdSuccessTicket.protocol}\n` +
                      `*Escola:* ${createdSuccessTicket.school_name} (CRE ${createdSuccessTicket.cre_name})\n` +
                      `*Defeito:* ${createdSuccessTicket.title}\n` +
                      `*Status:* Em processamento de despacho\n` +
                      `*Token:* ${createdSuccessTicket.tracking_token}\n\n` +
                      `Guarde este comprovante para acompanhar o atendimento da sua unidade.`
                    );
                    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow"
                >
                  <Phone size={14} /> Salvar no WhatsApp
                </button>
                <button
                  onClick={() => {
                    setCreatedSuccessTicket(null);
                    setStep(1);
                    setSelectedCreId('');
                    setAttachments([]);
                    setFormData({
                      school_id: '',
                      requester_name: '',
                      requester_role: 'Diretor(a) Escolar',
                      requester_phone: '',
                      category_id: categories[0]?.id || '',
                      title: '',
                      description: '',
                      equipment_patrimony: '',
                      urgency_level: 'media'
                    });
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Abrir Outro Chamado
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
              {/* Barra de Progresso das 3 Etapas */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        step >= 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      1
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        step >= 1 ? 'text-blue-900 font-bold' : 'text-slate-400'
                      }`}
                    >
                      1. CRE, Escola & Contato
                    </span>
                  </div>
                  <div
                    className={`h-0.5 flex-1 mx-3 ${
                      step >= 2 ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        step >= 2 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      2
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        step >= 2 ? 'text-blue-900 font-bold' : 'text-slate-400'
                      }`}
                    >
                      2. Defeito & SLA
                    </span>
                  </div>
                  <div
                    className={`h-0.5 flex-1 mx-3 ${
                      step >= 3 ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        step === 3 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      3
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        step === 3 ? 'text-blue-900 font-bold' : 'text-slate-400'
                      }`}
                    >
                      3. Fotos & Envio
                    </span>
                  </div>
                </div>
              </div>

              {/* Conteúdo do Formulário */}
              <form onSubmit={handleSubmit} className="p-5 sm:p-7 max-w-4xl mx-auto space-y-5">
                {/* ETAPA 1: SELEÇÃO EM CASCATA CRE -> UNIDADE ESCOLAR */}
                {step === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                      {/* CAMPO 1: SELEÇÃO DA CRE */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>1. Coordenação Regional de Ensino (CRE) *</span>
                          <span className="text-[10px] text-blue-600 lowercase font-medium">15 Regionais DF</span>
                        </label>
                        <select
                          value={selectedCreId}
                          onChange={(e) => handleCreChange(e.target.value)}
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 shadow-sm"
                        >
                          <option value="" disabled>
                            Selecione a CRE
                          </option>
                          {regions.map((reg) => (
                            <option key={reg.id} value={reg.id}>
                              CRE {reg.name}
                            </option>
                          ))}
                        </select>
                        {formErrors.cre ? (
                          <p className="text-[11px] text-rose-500 mt-1">{formErrors.cre}</p>
                        ) : (
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Selecione primeiro a regional para carregar as escolas correspondentes.
                          </span>
                        )}
                      </div>

                      {/* CAMPO 2: SELEÇÃO DA UNIDADE ESCOLAR (FILTRADA PELA CRE) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>2. Unidade Escolar da CRE Selecionada *</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            {selectedCreId
                              ? `${filteredSchoolsInCre.length} escola(s) nesta CRE`
                              : 'Aguardando seleção da CRE'}
                          </span>
                        </label>

                        {/* Busca rápida dentro da CRE */}
                        <div className="relative mb-2">
                          <Search
                            size={14}
                            className="absolute left-2.5 top-2 text-slate-400"
                          />
                          <input
                            type="text"
                            value={schoolSearch}
                            onChange={(e) => setSchoolSearch(e.target.value)}
                            disabled={!selectedCreId}
                            placeholder={
                              !selectedCreId
                                ? 'Selecione a CRE primeiro...'
                                : 'Buscar por nome da escola, endereço ou CEP...'
                            }
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                          />
                        </div>

                        <select
                          value={formData.school_id}
                          onChange={(e) =>
                            setFormData({ ...formData, school_id: e.target.value })
                          }
                          disabled={!selectedCreId}
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-900 shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>
                            {!selectedCreId
                              ? 'Selecione primeiro a CRE acima'
                              : 'Selecione a Unidade Escolar'}
                          </option>
                          {filteredSchoolsInCre.map((sch) => (
                            <option key={sch.id} value={sch.id}>
                              {sch.name}
                            </option>
                          ))}
                        </select>
                        {formErrors.school_id && (
                          <p className="text-[11px] text-rose-500 mt-1">{formErrors.school_id}</p>
                        )}
                      </div>
                    </div>

                    {/* Card de Confirmação & Ficha Técnica da Escola Selecionada */}
                    {selectedSchool && (
                      <div className="p-4 bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/70 rounded-2xl border border-blue-200/80 shadow-sm text-xs text-slate-800 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-blue-200/60">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                              <Building2 size={18} />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                                {selectedSchool.name}
                              </h3>
                              <p className="text-[11px] text-blue-700 font-semibold">
                                Coordenação Regional de Ensino: <strong>CRE {selectedSchool.cre_name}</strong>
                              </p>
                            </div>
                          </div>
                          {selectedSchool.cep && (
                            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-800 text-[11px] font-mono font-bold shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              CEP: {selectedSchool.cep}
                            </span>
                          )}
                        </div>

                        {/* Detalhes de Endereço, Geolocalização e Contato */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3">
                          <div className="md:col-span-2 flex items-start gap-1.5 text-slate-700">
                            <MapPin size={15} className="text-blue-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Endereço Oficial
                              </span>
                              <span className="text-xs font-medium text-slate-800">
                                {selectedSchool.address}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/70">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Phone size={13} className="text-emerald-600 shrink-0" />
                              <span className="text-[11px] font-semibold text-slate-800">
                                {selectedSchool.contact_phone || '(61) 3901-2000'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                              <Mail size={13} className="text-blue-500 shrink-0" />
                              <span className="text-[10.5px] font-mono text-slate-700 truncate" title={selectedSchool.contact_email}>
                                {selectedSchool.contact_email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dados do Solicitante */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nome do Solicitante *
                        </label>
                        <input
                          type="text"
                          value={formData.requester_name}
                          onChange={(e) =>
                            setFormData({ ...formData, requester_name: e.target.value })
                          }
                          placeholder="Ex: Maria Alice Ferreira"
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {formErrors.requester_name && (
                          <p className="text-[11px] text-rose-500 mt-1">
                            {formErrors.requester_name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Cargo na Unidade Escolar *
                        </label>
                        <select
                          value={formData.requester_role}
                          onChange={(e) =>
                            setFormData({ ...formData, requester_role: e.target.value })
                          }
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                        >
                          <option value="Diretor(a) Escolar">Diretor(a) Escolar</option>
                          <option value="Vice-Diretor(a)">Vice-Diretor(a)</option>
                          <option value="Chefe de Secretaria">Chefe de Secretaria</option>
                          <option value="Coordenador(a) Pedagógico(a)">
                            Coordenador(a) Pedagógico(a)
                          </option>
                          <option value="Supervisor(a) de Gestão">Supervisor(a) de Gestão</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Telefone WhatsApp para Contato *
                        </label>
                        <input
                          type="text"
                          value={formData.requester_phone}
                          onChange={(e) =>
                            setFormData({ ...formData, requester_phone: applyPhoneMask(e.target.value) })
                          }
                          placeholder="(61) 98765-4321"
                          maxLength={15}
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800"
                        />
                        {formErrors.requester_phone && (
                          <p className="text-[11px] text-rose-500 mt-1">
                            {formErrors.requester_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ETAPA 2: DEFEITO & SLA */}
                {step === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Categoria Técnica do Problema *
                        </label>
                        <select
                          value={formData.category_id}
                          onChange={(e) =>
                            setFormData({ ...formData, category_id: e.target.value })
                          }
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} (SLA: {cat.sla_response_hours}h resp. / {cat.sla_resolution_hours}h resol.)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Nível de Urgência Operacional *
                        </label>
                        <select
                          value={formData.urgency_level}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              urgency_level: e.target.value as any
                            })
                          }
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-semibold"
                        >
                          <option value="baixa">Baixa (Não compromete aulas)</option>
                          <option value="media">Média (Compromete setor parcial)</option>
                          <option value="alta">Alta (Setor administrativo ou bloco parado)</option>
                          <option value="critica">Crítica (Escola inteira sem sinal/luz de TI)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Título Resumido da Solicitação *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Roteador da sala dos professores reiniciando sozinho"
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {formErrors.title && (
                          <p className="text-[11px] text-rose-500 mt-1">{formErrors.title}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            Nº Patrimônio SEEDF (Opcional)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
                            title="Escanear etiqueta de patrimônio via câmera ou leitor"
                          >
                            <QrCode size={13} />
                            Escanear Etiqueta
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.equipment_patrimony}
                          onChange={(e) =>
                            setFormData({ ...formData, equipment_patrimony: e.target.value })
                          }
                          placeholder="Ex: PAT-2023-10492"
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Descrição Detalhada do Problema *
                      </label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Descreva o que ocorreu, se há mensagens de erro, luzes indicadoras piscando ou peças danificadas..."
                        className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                      />
                      {formErrors.description && (
                        <p className="text-[11px] text-rose-500 mt-1">
                          {formErrors.description}
                        </p>
                      )}
                    </div>

                    {/* ASSISTENTE DE IA & TRIAGE PREDITIVA */}
                    {triageResult && (
                      <AiTriageAssistant
                        triage={triageResult}
                        onApplyCategory={(cat, urg) => {
                          setFormData((prev) => ({ ...prev, category_id: cat, urgency_level: urg }));
                        }}
                        onDismiss={() => setDismissTriage(true)}
                      />
                    )}
                  </div>
                )}

                {/* ETAPA 3: FOTOS & CONFIRMAÇÃO */}
                {step === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Fotos e Evidências com Compressão WebP Automática
                      </label>
                      <p className="text-[11px] text-slate-500 mb-2.5">
                        As imagens são otimizadas diretamente no seu navegador para evitar consumo excessivo de dados.
                      </p>

                      <label className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors">
                        <Upload size={22} className="text-blue-600 mb-1" />
                        <span className="text-xs font-semibold text-blue-900">
                          {isCompressing ? 'Otimizando imagens em WebP...' : 'Clique para adicionar fotos ou capturar da câmera'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Formatos aceitos: JPG, PNG • Compressão client-side imediata
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={isCompressing}
                        />
                      </label>

                      {attachments.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                          {attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                            >
                              <img
                                src={att.file_url}
                                alt={att.file_name}
                                className="w-full h-20 object-cover"
                              />
                              <div className="p-1.5 bg-white text-[10px]">
                                <p className="truncate font-medium">{att.file_name}</p>
                                <span className="text-emerald-600 font-semibold">
                                  {(att.file_size_bytes / 1024).toFixed(1)} KB (WebP)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(idx)}
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 shadow"
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resumo Final */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="font-bold text-slate-800 border-b pb-1">
                        Resumo da Solicitação para Envio
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                        <div>
                          <strong>Escola:</strong> {selectedSchool?.name} (CRE {selectedSchool?.cre_name})
                        </div>
                        <div>
                          <strong>Solicitante:</strong> {formData.requester_name} ({formData.requester_role})
                        </div>
                        <div className="sm:col-span-2">
                          <strong>Assunto:</strong> {formData.title}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep((prev) => (prev - 1) as any)}
                      className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      <ArrowLeft size={14} /> Voltar Etapa
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition-colors"
                    >
                      Avançar <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isCompressing}
                      className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors"
                    >
                      <ShieldCheck size={16} /> Confirmar & Abrir Chamado
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ABA 2: RASTREAMENTO & ACOMPANHAMENTO EXCLUSIVO DOS CHAMADOS DO USUÁRIO */}
      {activeTab === 'rastrear' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Caixa de Consulta e Sigilo */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Acompanhamento Exclusivo do Solicitante
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Por sigilo e segurança, você visualiza apenas os chamados gerados por você ou vinculados ao seu WhatsApp/Protocolo.
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold rounded-lg flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {userMyTickets.length} chamado(s) localizado(s)
              </span>
            </div>

            {/* Campo para localizar chamados pelo WhatsApp ou Protocolo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Consultar por Telefone WhatsApp ou Número do Protocolo
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchPhoneOrProtocol}
                    onChange={(e) => setSearchPhoneOrProtocol(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchTicket()}
                    placeholder="Digite seu WhatsApp (ex: 61 98765-4321) ou Protocolo (ex: OS-2026-...)"
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchTicket}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Search size={14} /> Buscar Meus Chamados
                </button>
              </div>
            </div>

            {/* Lista dos Chamados do Usuário */}
            {userMyTickets.length > 0 ? (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Seus Chamados Cadastrados ({userMyTickets.length}):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {userMyTickets.map((t) => {
                    const isSelected = selectedTrackedTicket?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTrackedTicket(t)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500'
                            : 'bg-slate-50/70 hover:bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {t.protocol}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              t.status === 'concluido'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'aguardando_orcamento'
                                ? 'bg-amber-100 text-amber-800'
                                : t.status === 'em_atendimento' || t.status === 'em_deslocamento'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">
                          {t.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                          {t.school_name} • CRE {t.cre_name}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10.5px] text-slate-500">
                          <span>
                            {new Date(t.created_at).toLocaleDateString('pt-BR')} às{' '}
                            {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-blue-600 font-semibold hover:underline">
                            {isSelected ? 'Em exibição' : 'Ver detalhes →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">
                  Nenhum chamado aberto recentemente neste navegador.
                </p>
                <p className="text-[11px]">
                  Caso você já tenha aberto um chamado em outro dispositivo ou anteriormente, informe seu <strong>WhatsApp com DDD</strong> ou o <strong>Protocolo</strong> no campo de busca acima para carregar seus registros com total privacidade.
                </p>
              </div>
            )}
          </div>

          {selectedTrackedTicket && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-blue-700">
                      {selectedTrackedTicket.protocol}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        selectedTrackedTicket.status === 'concluido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedTrackedTicket.status === 'aguardando_orcamento'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedTrackedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 mt-1">{selectedTrackedTicket.title}</h4>
                  <p className="text-xs text-slate-500">
                    {selectedTrackedTicket.school_name} • Regional: CRE {selectedTrackedTicket.cre_name}
                  </p>
                </div>

                <button
                  onClick={() => onViewOS(selectedTrackedTicket)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <FileText size={14} /> Ver Ordem de Serviço
                </button>
              </div>

              {/* JORNADA VISUAL DO ATENDIMENTO (STEPPER) */}
              <TicketJourneyTracker ticket={selectedTrackedTicket} />

              {/* AVALIAÇÃO CSAT SE CHAMADO CONCLUÍDO */}
              {selectedTrackedTicket.status === 'concluido' && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div>
                    <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Atendimento Concluído com Ateste Escolar
                    </div>
                    {selectedTrackedTicket.csat_rating ? (
                      <div className="text-[11.5px] text-emerald-700 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>Sua Avaliação:</span>
                        <span className="font-bold text-amber-500 text-sm">{'★'.repeat(selectedTrackedTicket.csat_rating)}{'☆'.repeat(5 - selectedTrackedTicket.csat_rating)}</span>
                        <span className="text-slate-500 text-[10.5px]">({selectedTrackedTicket.csat_rating}/5 estrelas)</span>
                        {selectedTrackedTicket.csat_comment && (
                          <span className="text-slate-600 italic block w-full mt-0.5 font-medium">"{selectedTrackedTicket.csat_comment}"</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Avalie a rapidez e cortesia do técnico para aprimorar o contrato SEEDF.
                      </p>
                    )}
                  </div>

                  {!selectedTrackedTicket.csat_rating && (
                    <button
                      type="button"
                      onClick={() => setShowCsatModal(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 shrink-0"
                    >
                      <Star size={13} className="fill-amber-300 text-amber-300" /> Avaliar Atendimento
                    </button>
                  )}
                </div>
              )}

              {/* AVISO: VISITA TÉCNICA AGENDADA */}
              {selectedTrackedTicket.status === 'visita_agendada' && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-purple-800">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    Visita Técnica Agendada com o Solicitante
                  </div>
                  <p className="text-[11.5px] text-purple-700">
                    Previsão de Atendimento: <strong>{selectedTrackedTicket.scheduled_visit_at ? new Date(selectedTrackedTicket.scheduled_visit_at).toLocaleString('pt-BR') : 'Data a confirmar'}</strong>
                  </p>
                  {selectedTrackedTicket.scheduled_visit_notes && (
                    <p className="text-[11px] text-purple-600">
                      Observação técnica: {selectedTrackedTicket.scheduled_visit_notes}
                    </p>
                  )}
                </div>
              )}

              {/* AVISO: AGUARDANDO PEÇA */}
              {selectedTrackedTicket.status === 'aguardando_peca' && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-800">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    Aguardando Envio de Peça pela Logística HelpTech
                  </div>
                  <p className="text-[11.5px] text-blue-700">
                    Componente em solicitação: <strong>{selectedTrackedTicket.pending_part_notes || 'Componente em processo de despacho pelo almoxarifado central.'}</strong>
                  </p>
                  <span className="text-[10.5px] text-slate-500 block">
                    O relógio de SLA está congelado formalmente até a chegada da peça na unidade escolar.
                  </span>
                </div>
              )}

              {/* AVISO: AGUARDANDO TERCEIRO */}
              {selectedTrackedTicket.status === 'aguardando_terceiro' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    Aguardando Atuação de Concessionária Externa
                  </div>
                  <p className="text-[11.5px] text-amber-700">
                    Dependência externa: <strong>{selectedTrackedTicket.third_party_notes || 'Provedor de fibra ótica ou concessionária de energia.'}</strong>
                  </p>
                </div>
              )}

              {/* HISTÓRICO DE NOTIFICAÇÕES ENVIADAS PARA O USUÁRIO */}
              {selectedTrackedTicket.notifications && selectedTrackedTicket.notifications.length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Notificações Automáticas Transmitidas ({selectedTrackedTicket.notifications.length}):
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedTrackedTicket.notifications.map((n) => (
                      <div key={n.id} className="text-[11px] p-2 bg-white rounded-lg border border-slate-200 flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-800 block">{n.title}</strong>
                          <span className="text-slate-600">{n.message}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(n.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card de Orçamento se houver */}
              {selectedTrackedTicket.quote && (
                <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-amber-600" size={18} />
                      <span className="font-bold text-xs text-amber-950">
                        Orçamento Apresentado pelo Técnico em Campo
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        selectedTrackedTicket.quote.status === 'aprovado'
                          ? 'bg-emerald-200 text-emerald-900'
                          : selectedTrackedTicket.quote.status === 'rejeitado'
                          ? 'bg-rose-200 text-rose-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      Status: {selectedTrackedTicket.quote.status}
                    </span>
                  </div>

                  <p className="text-xs text-amber-900 bg-white/70 p-2.5 rounded-xl border border-amber-200">
                    <strong>Laudo Técnico:</strong> {selectedTrackedTicket.quote.technical_diagnosis}
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left bg-white rounded-xl overflow-hidden border border-amber-200">
                      <thead className="bg-amber-100 text-amber-950 font-semibold">
                        <tr>
                          <th className="p-2">Tipo</th>
                          <th className="p-2">Item / Serviço</th>
                          <th className="p-2 text-center">Quantidade</th>
                          <th className="p-2 text-right">Unitário</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {selectedTrackedTicket.quote.items.map((it) => (
                          <tr key={it.id}>
                            <td className="p-2 font-medium capitalize">{it.item_type}</td>
                            <td className="p-2">{it.item_name}</td>
                            <td className="p-2 text-center">{it.quantity}</td>
                            <td className="p-2 text-right">R$ {it.unit_price.toFixed(2)}</td>
                            <td className="p-2 text-right font-semibold">
                              R$ {it.subtotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-amber-50 font-bold text-amber-950">
                        <tr>
                          <td colSpan={4} className="p-2 text-right">
                            Total Geral da Proposta:
                          </td>
                          <td className="p-2 text-right text-sm text-blue-900">
                            R$ {selectedTrackedTicket.quote.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {selectedTrackedTicket.quote.status === 'pendente' && (
                    <div className="pt-2 border-t border-amber-200 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => {
                            onDecideQuote(
                              selectedTrackedTicket.id,
                              true,
                              selectedTrackedTicket.requester_name
                            );
                            setSelectedTrackedTicket({
                              ...selectedTrackedTicket,
                              status: 'aguardando_peca',
                              quote: {
                                ...selectedTrackedTicket.quote!,
                                status: 'aprovado',
                                decided_at: new Date().toISOString()
                              }
                            });
                          }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center justify-center gap-1.5"
                        >
                          <Check size={14} /> Aprovar Orçamento para Execução
                        </button>
                        <button
                          onClick={() => {
                            onDecideQuote(
                              selectedTrackedTicket.id,
                              false,
                              selectedTrackedTicket.requester_name,
                              'Recusado pelo gestor escolar para descarte/substituição por patrimônio novo.'
                            );
                            setSelectedTrackedTicket({
                              ...selectedTrackedTicket,
                              status: 'cancelado',
                              quote: {
                                ...selectedTrackedTicket.quote!,
                                status: 'rejeitado',
                                decided_at: new Date().toISOString()
                              }
                            });
                          }}
                          className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle size={14} /> Rejeitar Orçamento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE LEITURA DE CÓDIGO DE BARRAS / QR CODE */}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(detectedCode) => {
          setFormData((prev) => ({ ...prev, equipment_patrimony: detectedCode }));
          setShowScanner(false);
        }}
        title="Escanear Etiqueta de Patrimônio SEEDF"
      />

      {/* MODAL DE PESQUISA DE SATISFAÇÃO CSAT */}
      {selectedTrackedTicket && (
        <CsatSurveyModal
          isOpen={showCsatModal}
          ticketProtocol={selectedTrackedTicket.protocol}
          technicianName={selectedTrackedTicket.assigned_technician_name}
          onClose={() => setShowCsatModal(false)}
          onSubmitRating={(rating, comment) => {
            if (onSubmitCsat) {
              onSubmitCsat(selectedTrackedTicket.id, rating, comment);
            }
            setSelectedTrackedTicket((prev) => prev ? ({ ...prev, csat_rating: rating, csat_comment: comment, csat_at: new Date().toISOString() }) : null);
          }}
        />
      )}
    </div>
  );
};
