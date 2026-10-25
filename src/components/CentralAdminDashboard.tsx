import React, { useState } from 'react';
import type {
  Ticket,
  Technician,
  School,
  RegionalCoordination,
  TicketCategory,
  SystemUser
} from '../data/seedData';
import { getBestCandidateTechnician } from '../lib/geoEngine';
import {
  Kanban,
  FileSpreadsheet,
  Cpu,
  Database,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Filter,
  DollarSign,
  Download,
  Plus,
  Trash2,
  Edit,
  Shield,
  Wrench,
  MapPin,
  Phone,
  Mail,
  Search,
  X
} from 'lucide-react';

interface CentralAdminDashboardProps {
  tickets: Ticket[];
  technicians: Technician[];
  systemUsers?: SystemUser[];
  schools: School[];
  regions: RegionalCoordination[];
  categories: TicketCategory[];
  onManualDispatch: (ticketId: string, techId: string) => void;
  onDecideQuote: (ticketId: string, approved: boolean, name: string, reason?: string) => void;
  onViewOS: (ticket: Ticket) => void;
  onCreateTechnician?: (tech: Omit<Technician, 'id'>) => void;
  onUpdateTechnician?: (id: string, tech: Partial<Technician>) => void;
  onDeleteTechnician?: (id: string) => void;
  onToggleTechnicianStatus?: (id: string) => void;
  onCreateSystemUser?: (user: Omit<SystemUser, 'id' | 'created_at'>) => void;
  onUpdateSystemUser?: (id: string, user: Partial<SystemUser>) => void;
  onDeleteSystemUser?: (id: string) => void;
  onToggleSystemUserActive?: (id: string) => void;
  onResetDatabase: () => void;
}

export const CentralAdminDashboard: React.FC<CentralAdminDashboardProps> = ({
  tickets,
  technicians,
  systemUsers = [],
  schools,
  regions,
  categories: _categories,
  onManualDispatch,
  onDecideQuote: _onDecideQuote,
  onViewOS,
  onCreateTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  onToggleTechnicianStatus,
  onCreateSystemUser,
  onUpdateSystemUser,
  onDeleteSystemUser,
  onToggleSystemUserActive,
  onResetDatabase
}) => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'prestacao' | 'despacho' | 'tecnicos' | 'usuarios' | 'sql'>('kanban');
  const [selectedCre, setSelectedCre] = useState<string>('todas');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todas');

  // Estado para simulação de despacho
  const [simSchoolId, setSimSchoolId] = useState<string>(schools[0]?.id || '');
  const [manualDispatchTechId, setManualDispatchTechId] = useState<Record<string, string>>({});

  // Estados para Gestão de Técnicos (CRUD)
  const [searchTech, setSearchTech] = useState('');
  const [filterCreTech, setFilterCreTech] = useState('todas');
  const [showTechModal, setShowTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techForm, setTechForm] = useState({
    name: '',
    phone: '',
    email: '',
    primary_cre_id: 'cre-tagu',
    latitude: -15.8340,
    longitude: -48.0560,
    radius_km: 30,
    max_active_tickets: 4,
    status: 'disponivel' as Technician['status'],
    active: true
  });

  // Estados para Gestão de Administradores / Usuários (CRUD)
  const [searchUser, setSearchUser] = useState('');
  const [filterRoleUser, setFilterRoleUser] = useState('todas');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'controladoria' as SystemUser['role'],
    active: true
  });

  const handleOpenTechModal = (tech?: Technician) => {
    if (tech) {
      setEditingTech(tech);
      setTechForm({
        name: tech.name,
        phone: tech.phone,
        email: tech.email,
        primary_cre_id: tech.primary_cre_id,
        latitude: tech.latitude,
        longitude: tech.longitude,
        radius_km: tech.radius_km,
        max_active_tickets: tech.max_active_tickets,
        status: tech.status,
        active: tech.active
      });
    } else {
      setEditingTech(null);
      setTechForm({
        name: '',
        phone: '',
        email: '',
        primary_cre_id: regions[0]?.id || 'cre-tagu',
        latitude: -15.7940,
        longitude: -47.8820,
        radius_km: 30,
        max_active_tickets: 4,
        status: 'disponivel',
        active: true
      });
    }
    setShowTechModal(true);
  };

  const handleSaveTech = (e: React.FormEvent) => {
    e.preventDefault();
    if (!techForm.name.trim() || !techForm.phone.trim() || !techForm.email.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const regionObj = regions.find((r) => r.id === techForm.primary_cre_id);
    const primary_cre_name = regionObj ? regionObj.name : 'Plano Piloto';

    if (editingTech && onUpdateTechnician) {
      onUpdateTechnician(editingTech.id, {
        ...techForm,
        primary_cre_name
      });
    } else if (onCreateTechnician) {
      onCreateTechnician({
        ...techForm,
        primary_cre_name
      });
    }
    setShowTechModal(false);
  };

  const handleOpenUserModal = (user?: SystemUser) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        phone: '',
        role: 'controladoria',
        active: true
      });
    }
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.phone.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (editingUser && onUpdateSystemUser) {
      onUpdateSystemUser(editingUser.id, userForm);
    } else if (onCreateSystemUser) {
      onCreateSystemUser(userForm);
    }
    setShowUserModal(false);
  };

  // Filtros aplicados aos chamados
  const filteredTickets = tickets.filter((t) => {
    const matchCre = selectedCre === 'todas' || t.cre_name === selectedCre;
    const matchUrgency = selectedUrgency === 'todas' || t.urgency_level === selectedUrgency;
    return matchCre && matchUrgency;
  });

  // Métricas de Governança
  const totalTickets = tickets.length;
  const inProgressTickets = tickets.filter((t) =>
    ['despachado', 'em_deslocamento', 'em_atendimento'].includes(t.status)
  ).length;
  const pendingQuoteTickets = tickets.filter((t) => t.status === 'aguardando_orcamento').length;
  const completedTickets = tickets.filter((t) => t.status === 'concluido').length;
  const totalBudgetSpent = tickets.reduce((acc, curr) => {
    if (curr.quote && curr.quote.status === 'aprovado') {
      return acc + curr.quote.total_amount;
    }
    return acc;
  }, 0);

  // Colunas do Kanban
  const kanbanColumns = [
    {
      id: 'aberto',
      title: 'Triagem / Aguardando Despacho',
      bgHeader: 'bg-slate-100 text-slate-800 border-slate-300',
      items: filteredTickets.filter((t) => t.status === 'aberto')
    },
    {
      id: 'despachado',
      title: 'Despachado (Timeout 20m)',
      bgHeader: 'bg-amber-100 text-amber-900 border-amber-300',
      items: filteredTickets.filter((t) => t.status === 'despachado')
    },
    {
      id: 'em_atendimento',
      title: 'Agendado / Em Rota / Campo',
      bgHeader: 'bg-blue-100 text-blue-900 border-blue-300',
      items: filteredTickets.filter((t) =>
        ['visita_agendada', 'em_deslocamento', 'em_atendimento'].includes(t.status)
      )
    },
    {
      id: 'aguardando_orcamento',
      title: 'Orçamento, Peças & Terceiros',
      bgHeader: 'bg-purple-100 text-purple-900 border-purple-300',
      items: filteredTickets.filter((t) =>
        ['aguardando_orcamento', 'aguardando_peca', 'aguardando_terceiro'].includes(t.status)
      )
    },
    {
      id: 'concluido',
      title: 'Concluído & Assinado',
      bgHeader: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      items: filteredTickets.filter((t) => t.status === 'concluido')
    }
  ];

  // Simulação do Motor de Despacho
  const selectedSimSchool = schools.find((s) => s.id === simSchoolId);
  const bestCandidate = selectedSimSchool
    ? getBestCandidateTechnician(
        selectedSimSchool.latitude,
        selectedSimSchool.longitude,
        technicians,
        tickets,
        []
      )
    : null;

  // Baixar script SQL
  const downloadSchemaSql = () => {
    const element = document.createElement('a');
    const file = new Blob(
      [
        `-- Schema SQL do Supabase - HelpTech Escolas DF\n-- Baixado via Painel Central de Operações\n`
      ],
      { type: 'text/plain' }
    );
    element.href = URL.createObjectURL(file);
    element.download = 'service_desk_escolas_df_schema.sql';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Bar de KPIs em Tempo Real */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total de Chamados</span>
            <Building2 size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalTickets}</div>
          <div className="text-[10px] text-slate-400 mt-1">14 Regionais DF</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Em Campo</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{inProgressTickets}</div>
          <div className="text-[10px] text-slate-400 mt-1">Técnicos em rota/diagnóstico</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Orçamentos Pendentes</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{pendingQuoteTickets}</div>
          <div className="text-[10px] text-slate-400 mt-1">Aguardando aprovação</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Concluídos com OS</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{completedTickets}</div>
          <div className="text-[10px] text-slate-400 mt-1">Assinatura digital atestada</div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Homologado</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            R$ {totalBudgetSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Peças e serviços aprovados</div>
        </div>
      </div>

      {/* Menu Superior do Dashboard */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'kanban'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Kanban size={14} /> Visão Kanban Multi-CRE
          </button>
          <button
            onClick={() => setActiveTab('prestacao')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'prestacao'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet size={14} /> Prestação de Contas
          </button>
          <button
            onClick={() => setActiveTab('despacho')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'despacho'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Cpu size={14} /> Motor de Despacho Geo
          </button>
          <button
            onClick={() => setActiveTab('tecnicos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'tecnicos'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wrench size={14} /> Técnicos ({technicians.length})
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'usuarios'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users size={14} /> Administradores & Acessos ({systemUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'sql'
                ? 'bg-slate-900 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database size={14} /> Supabase DDL
          </button>
        </div>

        <button
          onClick={onResetDatabase}
          className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
        >
          Restaurar Banco de Dados Demo
        </button>
      </div>

      {/* ABA 1: VISÃO KANBAN MULTI-CRE */}
      {activeTab === 'kanban' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-600">
              <Filter size={14} /> Filtros:
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">CRE:</span>
              <select
                value={selectedCre}
                onChange={(e) => setSelectedCre(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-semibold text-slate-800"
              >
                <option value="todas">Todas as 15 Regionais</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    CRE {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Urgência:</span>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-semibold text-slate-800"
              >
                <option value="todas">Todas as Urgências</option>
                <option value="critica">Crítica</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <span className="ml-auto text-[11px] text-slate-400 font-medium">
              Exibindo {filteredTickets.length} de {tickets.length} chamados
            </span>
          </div>

          {/* Colunas do Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
            {kanbanColumns.map((col) => (
              <div
                key={col.id}
                className="bg-slate-100/90 rounded-2xl p-3 border border-slate-200 space-y-3 min-h-[480px]"
              >
                <div
                  className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-between ${col.bgHeader}`}
                >
                  <span className="truncate">{col.title}</span>
                  <span className="px-1.5 py-0.5 bg-white/70 rounded text-[11px] font-mono">
                    {col.items.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {col.items.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-bold text-blue-700">
                          {ticket.protocol}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            ticket.urgency_level === 'critica'
                              ? 'bg-rose-100 text-rose-800'
                              : ticket.urgency_level === 'alta'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ticket.urgency_level}
                        </span>
                      </div>

                      <h5 className="font-bold text-xs text-slate-800 leading-snug line-clamp-2">
                        {ticket.title}
                      </h5>

                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div className="truncate font-medium text-slate-700">
                          {ticket.school_name}
                        </div>
                        <div className="text-[10px] text-slate-400">CRE {ticket.cre_name}</div>
                      </div>

                      {ticket.assigned_technician_name && (
                        <div className="text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-slate-600 truncate">
                          Técnico: <strong>{ticket.assigned_technician_name}</strong>
                        </div>
                      )}

                      {/* Despacho Manual para chamados abertos/sem técnico */}
                      {ticket.status === 'aberto' && (
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">
                            Triagem Manual de Exceção:
                          </label>
                          <div className="flex gap-1">
                            <select
                              value={manualDispatchTechId[ticket.id] || technicians[0]?.id}
                              onChange={(e) =>
                                setManualDispatchTechId({
                                  ...manualDispatchTechId,
                                  [ticket.id]: e.target.value
                                })
                              }
                              className="text-[10px] p-1 border rounded bg-slate-50 flex-1 truncate"
                            >
                              {technicians.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.primary_cre_name})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const techId =
                                  manualDispatchTechId[ticket.id] || technicians[0]?.id;
                                onManualDispatch(ticket.id, techId);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold"
                            >
                              Despachar
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => onViewOS(ticket)}
                        className="w-full text-center text-[10px] font-semibold text-blue-600 hover:text-blue-800 pt-1 block"
                      >
                        Abrir Ordem de Serviço →
                      </button>
                    </div>
                  ))}

                  {col.items.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 italic">
                      Nenhum chamado neste status
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 2: PRESTAÇÃO DE CONTAS & AUDITORIA DE ORÇAMENTOS */}
      {activeTab === 'prestacao' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Auditoria Contábil de Orçamentos e Peças Aplicadas
              </h3>
              <p className="text-xs text-slate-500">
                Relatório consolidado para validação e faturamento da terceirizada de manutenção
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Download size={14} /> Exportar Prestação de Contas
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-3">Protocolo</th>
                  <th className="p-3">Unidade Escolar</th>
                  <th className="p-3">CRE</th>
                  <th className="p-3">Técnico Responsável</th>
                  <th className="p-3">Status do Orçamento</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tickets
                  .filter((t) => t.quote)
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-700">{t.protocol}</td>
                      <td className="p-3 font-semibold text-slate-800">{t.school_name}</td>
                      <td className="p-3 text-slate-600">{t.cre_name}</td>
                      <td className="p-3 text-slate-600">{t.quote?.technician_name}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.quote?.status === 'aprovado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.quote?.status === 'rejeitado'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.quote?.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        R$ {t.quote?.total_amount.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onViewOS(t)}
                          className="text-blue-600 hover:text-blue-800 font-bold text-[11px]"
                        >
                          Ver OS
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: MOTOR DE DESPACHO INTELIGENTE (PROXIMIDADE) */}
      {activeTab === 'despacho' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Simulador do Algoritmo de Despacho por Proximidade e Carga
            </h3>
            <p className="text-xs text-slate-500">
              Testa em tempo real a função SQL <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">get_best_candidate_technician()</code> selecionando qualquer escola pública do DF
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Seletor de Escola */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Selecione a Unidade Escolar para Teste de Despacho:
              </label>
              <select
                value={simSchoolId}
                onChange={(e) => setSimSchoolId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-medium"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.cre_name}] {s.name} - ({s.latitude}, {s.longitude})
                  </option>
                ))}
              </select>

              {selectedSimSchool && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800">{selectedSimSchool.name}</div>
                  <div className="text-slate-500">Região: CRE {selectedSimSchool.cre_name}</div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    Coordenadas: Lat {selectedSimSchool.latitude} | Lng {selectedSimSchool.longitude}
                  </div>
                </div>
              )}
            </div>

            {/* Resultado do Motor */}
            <div className="space-y-4 bg-blue-50/60 p-4 rounded-xl border border-blue-200 text-xs">
              <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                2. Resultado da Execução do Motor de Despacho:
              </label>

              {bestCandidate ? (
                <div className="bg-white p-4 rounded-xl border border-blue-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {bestCandidate.technician.name}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                      Melhor Candidato
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Distância Euclidiana:</span>
                      <strong className="text-blue-700 text-sm">
                        {bestCandidate.distanceKm} km
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Carga de Chamados Ativos:</span>
                      <strong className="text-slate-800 text-sm">
                        {bestCandidate.activeLoad} / {bestCandidate.technician.max_active_tickets}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Raio Máximo:</span>
                      <span className="text-slate-700">{bestCandidate.technician.radius_km} km</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Base Operacional:</span>
                      <span className="text-slate-700">
                        {bestCandidate.technician.primary_cre_name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-100/60 text-amber-900 rounded-xl border border-amber-300">
                  Nenhum técnico disponível dentro do raio limite ou com capacidade disponível.
                  O chamado seria direcionado para a fila de triagem manual de exceção.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: VISUALIZADOR DE DDL SUPABASE & BANCO DE DADOS */}
      {activeTab === 'sql' && (
        <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-bold text-white text-base">
                  Conexão Supabase Configurada
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Projeto conectado: <code className="text-cyan-400 font-mono bg-slate-950 px-2 py-0.5 rounded">https://fmmlvsoevxhoqpjpberk.supabase.co</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    const fullSql = `-- PLATAFORMA DE SERVICE DESK & FIELD SERVICE - ESCOLAS PÚBLICAS DF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE TABLE IF NOT EXISTS regional_coordinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cre_id UUID NOT NULL REFERENCES regional_coordinations(id) ON DELETE RESTRICT,
    inep VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_cre ON schools(cre_id);
CREATE INDEX IF NOT EXISTS idx_schools_inep ON schools(inep);
CREATE INDEX IF NOT EXISTS idx_schools_geo ON schools USING gist (ll_to_earth(latitude, longitude));

CREATE TABLE IF NOT EXISTS technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    primary_cre_id UUID REFERENCES regional_coordinations(id),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    radius_km INT DEFAULT 30,
    max_active_tickets INT DEFAULT 4,
    status VARCHAR(30) DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'indisponivel', 'suspenso')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technicians_geo ON technicians USING gist (ll_to_earth(latitude, longitude));

CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sla_response_hours INT DEFAULT 4,
    sla_resolution_hours INT DEFAULT 48,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(30) UNIQUE NOT NULL,
    tracking_token VARCHAR(64) UNIQUE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES ticket_categories(id) ON DELETE RESTRICT,
    requester_name VARCHAR(150) NOT NULL,
    requester_role VARCHAR(100) NOT NULL,
    requester_phone VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    equipment_patrimony VARCHAR(100),
    urgency_level VARCHAR(20) DEFAULT 'media' CHECK (urgency_level IN ('baixa', 'media', 'alta', 'critica')),
    status VARCHAR(30) DEFAULT 'aberto' CHECK (status IN (
        'aberto',
        'despachado',
        'em_deslocamento',
        'em_atendimento',
        'aguardando_orcamento',
        'aguardando_peca',
        'concluido',
        'cancelado'
    )),
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    dispatch_attempts INT DEFAULT 0,
    dispatch_timeout_at TIMESTAMPTZ,
    arrival_lat FLOAT,
    arrival_lng FLOAT,
    arrived_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_school ON tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tech ON tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_token ON tickets(tracking_token);

CREATE TABLE IF NOT EXISTS ticket_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('notificado', 'aceito', 'recusado', 'timeout')),
    refusal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    phase VARCHAR(20) NOT NULL CHECK (phase IN ('abertura', 'diagnostico', 'conclusao')),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    technical_diagnosis TEXT NOT NULL,
    pdf_url TEXT,
    status VARCHAR(30) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')),
    decision_by_name VARCHAR(150),
    decision_reason TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES ticket_quotes(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('peca', 'servico')),
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES technicians(id),
    service_summary TEXT NOT NULL,
    school_representative_name VARCHAR(150) NOT NULL,
    school_representative_doc VARCHAR(50) NOT NULL,
    signature_svg TEXT NOT NULL,
    pdf_os_url TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_best_candidate_technician(
    p_school_lat FLOAT, 
    p_school_lng FLOAT,
    p_excluded_techs UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
    technician_id UUID,
    name VARCHAR,
    phone VARCHAR,
    distance_km FLOAT,
    active_load BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.phone,
        ROUND((point(t.longitude, t.latitude) <@> point(p_school_lng, p_school_lat)) * 1.609344, 2) AS distance_km,
        COUNT(tk.id) AS active_load
    FROM technicians t
    LEFT JOIN tickets tk ON tk.assigned_technician_id = t.id 
        AND tk.status IN ('despachado', 'em_deslocamento', 'em_atendimento', 'aguardando_peca')
    WHERE t.status = 'disponivel' 
      AND t.active = TRUE
      AND (p_excluded_techs IS NULL OR t.id != ALL(p_excluded_techs))
    GROUP BY t.id, t.name, t.phone, t.longitude, t.latitude, t.max_active_tickets, t.radius_km
    HAVING COUNT(tk.id) < t.max_active_tickets
       AND ROUND((point(t.longitude, t.latitude) <@> point(p_school_lng, p_school_lat)) * 1.609344, 2) <= t.radius_km
    ORDER BY distance_km ASC, active_load ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

INSERT INTO regional_coordinations (code, name) VALUES
('CRE_BRAZLANDIA', 'Brazlândia'),
('CRE_CEILANDIA', 'Ceilândia'),
('CRE_GAMA', 'Gama'),
('CRE_GUARA', 'Guará'),
('CRE_NUCLEO_BANDEIRANTE', 'Núcleo Bandeirante'),
('CRE_PARANOA', 'Paranoá'),
('CRE_PARANOA_ITAPOA', 'Paranoá/Itapoã'),
('CRE_PLANALTINA', 'Planaltina'),
('CRE_PLANO_PILOTO', 'Plano Piloto'),
('CRE_RECANTO_DAS_EMAS', 'Recanto das Emas'),
('CRE_SAMAMBAIA', 'Samambaia'),
('CRE_SANTA_MARIA', 'Santa Maria'),
('CRE_SAO_SEBASTIAO', 'São Sebastião'),
('CRE_SOBRADINHO', 'Sobradinho'),
('CRE_TAGUATINGA', 'Taguatinga')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ticket_categories (name, sla_response_hours, sla_resolution_hours) VALUES
('Rede & Conectividade de Internet', 2, 24),
('Laboratório de Informática / Computadores', 4, 48),
('Projetores & Telas Interativas', 4, 48),
('Impressoras & Scanners Administrativos', 8, 72),
('Servidores & Roteadores Wi-Fi', 2, 12),
('Elétrica de TI / No-breaks & Nobreaks', 2, 24)
ON CONFLICT DO NOTHING;`;
                    await navigator.clipboard.writeText(fullSql);
                    alert('Código SQL copiado para a área de transferência! Cole no SQL Editor do Supabase.');
                  } catch (e) {
                    alert('Falha ao copiar automaticamente. Use o botão Baixar schema.sql');
                  }
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
              >
                Copiar DDL Completo
              </button>
              <button
                onClick={downloadSchemaSql}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
              >
                <Download size={14} /> Baixar schema.sql
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="font-bold text-slate-300">Como executar no Supabase:</div>
            <ol className="list-decimal list-inside text-slate-400 space-y-1">
              <li>Acesse o dashboard do Supabase: <span className="text-blue-400 font-mono">https://supabase.com/dashboard/project/fmmlvsoevxhoqpjpberk</span></li>
              <li>No menu lateral esquerdo, clique em <strong>SQL Editor</strong>.</li>
              <li>Clique em <strong>New Query</strong>, cole o script SQL (clique no botão verde acima) e clique em <strong>Run</strong>.</li>
              <li>Todas as tabelas, extensões e sementes das 15 CREs serão criadas no schema <code className="text-emerald-400 font-mono">public</code>.</li>
            </ol>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
{`-- Extensões para manipulação de coordenadas e distâncias euclidianas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- TABELAS PRINCIPAIS:
-- 1. regional_coordinations (15 CREs do DF)
-- 2. schools (332 Unidades Escolares Oficiais)
-- 3. technicians (Técnicos Credenciados)
-- 4. ticket_categories (Matriz de SLA)
-- 5. tickets (Chamados e Ordens de Serviço)
-- 6. ticket_dispatch_logs (Controle de timeouts de 20 min)
-- 7. ticket_attachments (Evidências WebP comprimidas)
-- 8. ticket_quotes & ticket_quote_items (Orçamentos)
-- 9. ticket_completions (Assinatura digital do Diretor)

-- FUNÇÃO DO MOTOR DE DESPACHO INTELIGENTE:
CREATE OR REPLACE FUNCTION get_best_candidate_technician(
    p_school_lat FLOAT, 
    p_school_lng FLOAT,
    p_excluded_techs UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
    technician_id UUID,
    name VARCHAR,
    phone VARCHAR,
    distance_km FLOAT,
    active_load BIGINT
) AS $$
...
$$ LANGUAGE plpgsql;`}
          </pre>
        </div>
      )}

      {/* ABA 5: GESTÃO DE TÉCNICOS DE CAMPO (CRUD) */}
      {activeTab === 'tecnicos' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Cabeçalho da Aba e Ações */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar técnico por nome, e-mail ou telefone..."
                  value={searchTech}
                  onChange={(e) => setSearchTech(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filterCreTech}
                onChange={(e) => setFilterCreTech(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todas">Todas as Regionais (CREs)</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenTechModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Plus size={15} /> Cadastrar Novo Técnico
            </button>
          </div>

          {/* Cards de Resumo Operacional */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-400">Total de Técnicos</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{technicians.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-emerald-700">Disponíveis Agora</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">
                {technicians.filter((t) => t.status === 'disponivel').length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-amber-700">Ocupados em Rota</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {technicians.filter((t) => t.status === 'ocupado').length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-500">Indisponíveis / Folga</div>
              <div className="text-xl font-black text-slate-600 mt-0.5">
                {technicians.filter((t) => t.status === 'indisponivel' || t.status === 'suspenso').length}
              </div>
            </div>
          </div>

          {/* Tabela de Técnicos */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-3 px-4">Técnico & Contato</th>
                    <th className="py-3 px-4">CRE Base & Raio</th>
                    <th className="py-3 px-4">Coordenadas Base</th>
                    <th className="py-3 px-4">Carga Ativa</th>
                    <th className="py-3 px-4">Status Operacional</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {technicians
                    .filter((t) => {
                      const matchSearch =
                        t.name.toLowerCase().includes(searchTech.toLowerCase()) ||
                        t.email.toLowerCase().includes(searchTech.toLowerCase()) ||
                        t.phone.includes(searchTech);
                      const matchCre = filterCreTech === 'todas' || t.primary_cre_id === filterCreTech;
                      return matchSearch && matchCre;
                    })
                    .map((tech) => {
                      const activeTicketsCount = tickets.filter(
                        (t) =>
                          t.assigned_technician_id === tech.id &&
                          !['concluido', 'recusado'].includes(t.status)
                      ).length;

                      const cleanPhone = tech.phone.replace(/\D/g, '');

                      return (
                        <tr key={tech.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-xs">{tech.name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Mail size={12} className="text-slate-400" />
                              <span>{tech.email}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Phone size={12} className="text-slate-400" />
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:underline font-medium"
                              >
                                {tech.phone} (WhatsApp)
                              </a>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800">{tech.primary_cre_name}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Raio: {tech.radius_km} km</div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                            <div className="flex items-center gap-1 text-slate-700">
                              <MapPin size={12} className="text-blue-500" />
                              <span>{tech.latitude.toFixed(4)}, {tech.longitude.toFixed(4)}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                  activeTicketsCount >= tech.max_active_tickets
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : activeTicketsCount > 0
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {activeTicketsCount} / {tech.max_active_tickets}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">chamados em aberto</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => onToggleTechnicianStatus && onToggleTechnicianStatus(tech.id)}
                              title="Clique para alternar status operacional"
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                tech.status === 'disponivel'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : tech.status === 'ocupado'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  tech.status === 'disponivel'
                                    ? 'bg-emerald-500'
                                    : tech.status === 'ocupado'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span className="capitalize">{tech.status}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenTechModal(tech)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar Cadastro"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Tem certeza de que deseja remover o técnico "${tech.name}" da base HelpTech?`
                                    )
                                  ) {
                                    onDeleteTechnician && onDeleteTechnician(tech.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Excluir Técnico"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 6: GESTÃO DE ADMINISTRADORES & ACESSOS (CRUD) */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Cabeçalho e Ações */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar administrador por nome, e-mail ou telefone..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filterRoleUser}
                onChange={(e) => setFilterRoleUser(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todas">Todos os Perfis de Acesso</option>
                <option value="admin">Administrador Geral</option>
                <option value="controladoria">Controladoria & Despacho</option>
                <option value="auditor_seedf">Auditor Externo SEEDF</option>
              </select>
            </div>

            <button
              onClick={() => handleOpenUserModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Plus size={15} /> Cadastrar Novo Usuário
            </button>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-slate-400">Total de Operadores</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{systemUsers.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-purple-700">Administradores</div>
              <div className="text-xl font-black text-purple-600 mt-0.5">
                {systemUsers.filter((u) => u.role === 'admin').length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-blue-700">Controladoria & Despacho</div>
              <div className="text-xl font-black text-blue-600 mt-0.5">
                {systemUsers.filter((u) => u.role === 'controladoria').length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-amber-700">Auditores SEEDF</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {systemUsers.filter((u) => u.role === 'auditor_seedf').length}
              </div>
            </div>
          </div>

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-3 px-4">Nome & Contato</th>
                    <th className="py-3 px-4">E-mail Institucional</th>
                    <th className="py-3 px-4">Perfil de Acesso & Permissões</th>
                    <th className="py-3 px-4">Data de Cadastro</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemUsers
                    .filter((u) => {
                      const matchSearch =
                        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
                        u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
                        u.phone.includes(searchUser);
                      const matchRole = filterRoleUser === 'todas' || u.role === filterRoleUser;
                      return matchSearch && matchRole;
                    })
                    .map((user) => {
                      const cleanPhone = user.phone.replace(/\D/g, '');

                      const roleBadge = {
                        admin: {
                          label: 'Administrador Geral HelpTech',
                          bg: 'bg-purple-50 text-purple-700 border-purple-200'
                        },
                        controladoria: {
                          label: 'Controladoria & Despachante',
                          bg: 'bg-blue-50 text-blue-700 border-blue-200'
                        },
                        auditor_seedf: {
                          label: 'Auditor Externo SEEDF',
                          bg: 'bg-amber-50 text-amber-800 border-amber-200'
                        }
                      }[user.role];

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-xs">{user.name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={12} className="text-slate-400" />
                              <a
                                href={`https://wa.me/55${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:underline"
                              >
                                {user.phone}
                              </a>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Mail size={12} className="text-slate-400" />
                              <span>{user.email}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleBadge.bg}`}
                            >
                              {roleBadge.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {new Date(user.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => onToggleSystemUserActive && onToggleSystemUserActive(user.id)}
                              title="Clique para ativar/desativar usuário"
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                user.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  user.active ? 'bg-emerald-500' : 'bg-rose-400'
                                }`}
                              />
                              <span>{user.active ? 'Ativo' : 'Inativo'}</span>
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenUserModal(user)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar Usuário"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Tem certeza de que deseja remover o usuário "${user.name}"?`
                                    )
                                  ) {
                                    onDeleteSystemUser && onDeleteSystemUser(user.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Excluir Usuário"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE TÉCNICO */}
      {showTechModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingTech ? 'Editar Cadastro de Técnico' : 'Cadastrar Novo Técnico de Campo'}
                </h3>
              </div>
              <button
                onClick={() => setShowTechModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTech} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={techForm.name}
                  onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
                  placeholder="Ex: Carlos Alberto Mendes"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={techForm.phone}
                    onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
                    placeholder="(61) 98452-1101"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">E-mail Institucional *</label>
                  <input
                    type="email"
                    required
                    value={techForm.email}
                    onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
                    placeholder="carlos@fieldservice.df.gov.br"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CRE Base Principal *</label>
                  <select
                    value={techForm.primary_cre_id}
                    onChange={(e) => setTechForm({ ...techForm, primary_cre_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Raio de Cobertura (km)</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={techForm.radius_km}
                    onChange={(e) => setTechForm({ ...techForm, radius_km: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Latitude da Base</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={techForm.latitude}
                    onChange={(e) => setTechForm({ ...techForm, latitude: Number(e.target.value) })}
                    placeholder="-15.8340"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Longitude da Base</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={techForm.longitude}
                    onChange={(e) => setTechForm({ ...techForm, longitude: Number(e.target.value) })}
                    placeholder="-48.0560"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Operacional</label>
                  <select
                    value={techForm.status}
                    onChange={(e) =>
                      setTechForm({
                        ...techForm,
                        status: e.target.value as Technician['status']
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="disponivel">Disponível para Despacho</option>
                    <option value="ocupado">Ocupado em Atendimento</option>
                    <option value="indisponivel">Indisponível / Folga</option>
                    <option value="suspenso">Suspenso</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Máx. Chamados Simultâneos</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={techForm.max_active_tickets}
                    onChange={(e) =>
                      setTechForm({ ...techForm, max_active_tickets: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTechModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  {editingTech ? 'Salvar Alterações' : 'Cadastrar Técnico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO ADMINISTRADOR */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm">
                  {editingUser ? 'Editar Usuário do Sistema' : 'Cadastrar Novo Usuário / Administrador'}
                </h3>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Ex: Amanda Nogueira"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail Institucional *</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="amanda@helptech.com.br"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Telefone WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="(61) 98111-2233"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Perfil de Acesso & Permissões *</label>
                <select
                  value={userForm.role}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role: e.target.value as SystemUser['role'] })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Administrador Geral (Acesso total)</option>
                  <option value="controladoria">Controladoria & Despacho (Gestão de chamados e orçamentos)</option>
                  <option value="auditor_seedf">Auditor Externo SEEDF (Prestação de contas e relatórios)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Define o nível de permissão no painel de controle e na auditoria.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userForm.active}
                  onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="userActiveCheck" className="text-slate-700 font-semibold cursor-pointer">
                  Usuário Ativo no Sistema
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
