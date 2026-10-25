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
  MapPin
} from 'lucide-react';

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
}

const DRAFT_KEY = 'helptechinfo_school_draft';

export const SchoolPortal: React.FC<SchoolPortalProps> = ({
  schools,
  categories,
  regions,
  tickets,
  onCreateTicket,
  onDecideQuote,
  onViewOS
}) => {
  const [activeTab, setActiveTab] = useState<'abrir' | 'rastrear'>('abrir');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Seleção de CRE (Coordenação Regional de Ensino)
  const [selectedCreId, setSelectedCreId] = useState<string>(() => {
    return regions[0]?.id || 'cre-braz';
  });

  // Escolas filtradas exclusivamente pela CRE selecionada
  const creSchools = schools.filter((s) => s.cre_id === selectedCreId);

  // Formulário
  const [formData, setFormData] = useState<TicketSubmissionData>({
    school_id: creSchools[0]?.id || schools[0]?.id || '',
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

  // Rastreamento
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrackedTicket, setSelectedTrackedTicket] = useState<Ticket | null>(null);

  // Atualiza escola padrão quando a CRE muda
  const handleCreChange = (newCreId: string) => {
    setSelectedCreId(newCreId);
    setSchoolSearch('');
    const newCreSchools = schools.filter((s) => s.cre_id === newCreId);
    if (newCreSchools.length > 0) {
      setFormData((prev) => ({ ...prev, school_id: newCreSchools[0].id }));
    } else {
      setFormData((prev) => ({ ...prev, school_id: '' }));
    }
  };

  // Recupera rascunho salvo do localStorage ao montar
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setFormData((prev) => ({ ...prev, ...parsed }));
        // Se o rascunho tinha uma escola, ajusta a CRE correspondente
        if (parsed.school_id) {
          const matchSchool = schools.find((s) => s.id === parsed.school_id);
          if (matchSchool) {
            setSelectedCreId(matchSchool.cre_id);
          }
        }
      }
    } catch (e) {
      console.warn('Rascunho não encontrado');
    }
  }, [schools]);

  // Salva rascunho continuamente
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch (e) {
      console.warn('Erro ao salvar rascunho');
    }
  }, [formData]);

  // Filtro de escolas pertencentes à CRE com refinamento por busca de texto
  const filteredSchoolsInCre = creSchools.filter(
    (s) =>
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.inep.includes(schoolSearch) ||
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

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Buscar chamado por protocolo ou token
  const handleSearchTicket = () => {
    if (!searchQuery.trim()) return;
    const found = tickets.find(
      (t) =>
        t.protocol.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        t.tracking_token.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        t.equipment_patrimony?.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    setSelectedTrackedTicket(found || null);
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
              <Search size={14} /> Consultar & Orçamentos
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

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => {
                    setSelectedTrackedTicket(createdSuccessTicket);
                    setActiveTab('rastrear');
                    setCreatedSuccessTicket(null);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Search size={14} /> Acompanhar Este Chamado
                </button>
                <button
                  onClick={() => {
                    setCreatedSuccessTicket(null);
                    setStep(1);
                    setAttachments([]);
                    setFormData({
                      school_id: creSchools[0]?.id || '',
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
                          {regions.map((reg) => (
                            <option key={reg.id} value={reg.id}>
                              CRE {reg.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Selecione primeiro a regional para carregar as escolas correspondentes.
                        </span>
                      </div>

                      {/* CAMPO 2: SELEÇÃO DA UNIDADE ESCOLAR (FILTRADA PELA CRE) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>2. Unidade Escolar da CRE Selecionada *</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            {filteredSchoolsInCre.length} escola(s) nesta CRE
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
                            placeholder="Filtrar por nome ou INEP nesta regional..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <select
                          value={formData.school_id}
                          onChange={(e) =>
                            setFormData({ ...formData, school_id: e.target.value })
                          }
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-900 shadow-sm"
                        >
                          {filteredSchoolsInCre.map((sch) => (
                            <option key={sch.id} value={sch.id}>
                              {sch.name} (INEP: {sch.inep})
                            </option>
                          ))}
                        </select>
                        {formErrors.school_id && (
                          <p className="text-[11px] text-rose-500 mt-1">{formErrors.school_id}</p>
                        )}
                      </div>
                    </div>

                    {/* Card de Confirmação da Escola Selecionada */}
                    {selectedSchool && (
                      <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                        <Building2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{selectedSchool.name}</span>
                            <span className="bg-blue-200/70 text-blue-800 text-[10px] px-2 py-0.2 rounded font-mono font-semibold">
                              INEP {selectedSchool.inep}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            {selectedSchool.address} • <strong>CRE {selectedSchool.cre_name}</strong>
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
                            setFormData({ ...formData, requester_phone: e.target.value })
                          }
                          placeholder="(61) 98765-4321"
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nº Patrimônio SEEDF (Opcional)
                        </label>
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

      {/* ABA 2: RASTREAMENTO & APROVAÇÃO DE ORÇAMENTO */}
      {activeTab === 'rastrear' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Consultar Chamado por Protocolo, Token ou Patrimônio
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTicket()}
                placeholder="Ex: OS-2026-08412 ou tk_9f82... ou patrimônio"
                className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleSearchTicket}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Search size={14} /> Localizar
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Atendimentos Recentes Registrados no Sistema:
              </span>
              <div className="flex flex-wrap gap-2">
                {tickets.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTrackedTicket(t);
                      setSearchQuery(t.protocol);
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 font-mono"
                  >
                    <span>{t.protocol}</span>
                    <span className="text-[10px] text-slate-400">({t.cre_name})</span>
                  </button>
                ))}
              </div>
            </div>
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
    </div>
  );
};
