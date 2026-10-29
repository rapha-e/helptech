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
import { SUPABASE_MASTER_DDL } from '../data/supabaseDdl';
import { InventoryManagementModal } from './InventoryManagementModal';
import { OfficialAuditReportModal } from './OfficialAuditReportModal';
import type { InventoryItem } from '../data/seedData';
import {
  Kanban,
  FileSpreadsheet,
  Cpu,
  Database,
  Building2,
  Users,
  AlertTriangle,
  AlertCircle,
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
  X,
  BarChart3,
  Clock,
  Star,
  Package
} from 'lucide-react';
import {
  calculateTicketSla,
  calculateSlaReport,
  exportOperationalReportCsv
} from '../lib/slaEngine';

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
  onCreateTechnician?: (tech: Omit<Technician, 'id'> & { password?: string }) => void;
  onUpdateTechnician?: (id: string, tech: Partial<Technician> & { password?: string }) => void;
  onDeleteTechnician?: (id: string) => void;
  onToggleTechnicianStatus?: (id: string) => void;
  onCreateSystemUser?: (user: Omit<SystemUser, 'id' | 'created_at'>) => void;
  onUpdateSystemUser?: (id: string, user: Partial<SystemUser>) => void;
  onDeleteSystemUser?: (id: string) => void;
  onToggleSystemUserActive?: (id: string) => void;
  onResetDatabase: () => void;
  inventory?: InventoryItem[];
  onUpdateInventoryQuantity?: (id: string, delta: number) => void;
  onAddInventoryItem?: (item: Omit<InventoryItem, 'id'>) => void;
}

export const CentralAdminDashboard: React.FC<CentralAdminDashboardProps> = ({
  tickets,
  technicians,
  systemUsers = [],
  schools,
  regions,
  categories: _categories,
  onManualDispatch,
  onDecideQuote,
  onViewOS,
  onCreateTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  onToggleTechnicianStatus,
  onCreateSystemUser,
  onUpdateSystemUser,
  onDeleteSystemUser,
  onToggleSystemUserActive,
  onResetDatabase,
  inventory = [],
  onUpdateInventoryQuantity = () => {},
  onAddInventoryItem = () => {}
}) => {
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showAuditReportModal, setShowAuditReportModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'kanban' | 'prestacao' | 'despacho' | 'sla' | 'tecnicos' | 'usuarios' | 'sql'>('kanban');
  const [selectedCre, setSelectedCre] = useState<string>('todas');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todas');

  // Estado para simulação de despacho
  const [simSchoolId, setSimSchoolId] = useState<string>(schools[0]?.id || '');
  const [manualDispatchTechId, setManualDispatchTechId] = useState<Record<string, string>>({});

  // Estados para Decisão de Orçamento (Aprovação ou Reprovação/Cancelamento)
  const [rejectingQuoteTicket, setRejectingQuoteTicket] = useState<Ticket | null>(null);
  const [quoteDecisionReason, setQuoteDecisionReason] = useState<string>('');

  // Estado para Confirmação Segura de Reset de Dados
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  // Estados para Gestão de Técnicos (CRUD)
  const [searchTech, setSearchTech] = useState('');
  const [filterCreTech, setFilterCreTech] = useState('todas');
  const [showTechModal, setShowTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techForm, setTechForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
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
        password: '',
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
        password: '',
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

    if (!editingTech && (!techForm.password || techForm.password.trim().length < 6)) {
      alert('A senha de acesso do novo técnico deve ter no mínimo 6 caracteres.');
      return;
    }

    const regionObj = regions.find((r) => r.id === techForm.primary_cre_id);
    const primary_cre_name = regionObj ? regionObj.name : 'Plano Piloto';

    if (editingTech && onUpdateTechnician) {
      onUpdateTechnician(editingTech.id, {
        ...techForm,
        primary_cre_name,
        password: techForm.password ? techForm.password : undefined
      });
    } else if (onCreateTechnician) {
      onCreateTechnician({
        ...techForm,
        primary_cre_name,
        password: techForm.password
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
  const ratedTickets = tickets.filter((t) => t.csat_rating);
  const avgCsatRating = ratedTickets.length > 0
    ? (ratedTickets.reduce((acc, t) => acc + (t.csat_rating || 0), 0) / ratedTickets.length).toFixed(1)
    : '5.0';
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

  // Baixar script SQL Master atualizado
  const downloadSchemaSql = () => {
    const element = document.createElement('a');
    const file = new Blob([SUPABASE_MASTER_DDL], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'service_desk_escolas_df_schema.sql';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Relatório Executivo de SLAs
  const slaReport = calculateSlaReport(tickets, regions, technicians);

  const downloadOperationalCsv = () => {
    const csvContent = exportOperationalReportCsv(tickets);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_operacional_helptech_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Bar de KPIs em Tempo Real */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
  

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Satisfação CSAT</span>
            <Star size={16} className="text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600">{avgCsatRating} ★</div>
          <div className="text-[10px] text-slate-400 mt-1">{ratedTickets.length} avaliações das escolas</div>
        </div>
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
            onClick={() => setActiveTab('sla')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'sla'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 size={14} /> Governança & SLA
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
            type="button"
            onClick={() => setShowInventoryModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs"
            title="Gestão de Estoque e Almoxarifado Central"
          >
            <Package size={14} className="text-amber-500" /> Almoxarifado WMS ({inventory.length})
          </button>
          <button
            type="button"
            onClick={() => setShowAuditReportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs"
            title="Emissão do Relatório Oficial de Prestação de Contas Auditoria & Governança HelpTech"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" /> Relatório Oficial Auditoria Interna
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
          type="button"
          onClick={() => {
            setResetConfirmText('');
            setShowResetConfirmModal(true);
          }}
          className="text-xs text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 font-semibold"
          title="Ação administrativa restrita"
        >
          <AlertTriangle size={13} />
          <span>Restaurar Banco de Dados Demo</span>
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

                      {(() => {
                        const sla = calculateTicketSla(ticket);
                        return (
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${sla.badgeColor}`}>
                              <Clock size={9} />
                              <span>{sla.label}</span>
                            </span>
                          </div>
                        );
                      })()}

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

                      {/* Decisão rápida de Orçamento no Kanban */}
                      {ticket.status === 'aguardando_orcamento' && ticket.quote && ticket.quote.status === 'pendente' && (
                        <div className="pt-2 border-t border-amber-200 bg-amber-50/70 p-2 rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
                            <span>Orçamento: R$ {ticket.quote.total_amount.toFixed(2)}</span>
                            <span className="text-amber-700 font-semibold">{ticket.quote.items.length} item(ns)</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => onDecideQuote(ticket.id, true, 'Controladoria Central / CRE')}
                              className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-xs"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingQuoteTicket(ticket);
                                setQuoteDecisionReason('');
                              }}
                              className="flex-1 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded shadow-xs"
                            >
                              Reprovar / Cancelar
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

      {/* ABA: GOVERNANÇA, MÉTRICAS E SLA EXECUTIVO */}
      {activeTab === 'sla' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-1 border border-blue-200">
                <BarChart3 size={12} /> Painel Executivo HelpTech
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                Governança de SLA & Desempenho Regional
              </h3>
              <p className="text-xs text-slate-500">
                Metas contratuais: Primeiro Atendimento em até 4h • Resolução Completa em até 48h
              </p>
            </div>
            <button
              onClick={downloadOperationalCsv}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Download size={14} /> Exportar Relatório CSV da HelpTech
            </button>
          </div>

          {/* Cards de Métricas de SLA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Taxa de Cumprimento SLA
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl font-black ${
                    slaReport.slaComplianceRate >= 90
                      ? 'text-emerald-600'
                      : slaReport.slaComplianceRate >= 75
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {slaReport.slaComplianceRate}%
                </span>
                <span className="text-[10px] text-slate-400">Meta: 95%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {slaReport.completedTickets} chamados finalizados
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                No Prazo (Operação Ativa)
              </span>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {slaReport.onTrackCount}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Tempo restante confortável</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Em Risco (&lt; 8h restantes)
              </span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {slaReport.atRiskCount}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Exige atenção da expedição</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Prazo Estourado (&gt; 48h)
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {slaReport.breachedCount}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Passível de penalidade</p>
            </div>
          </div>

          {/* Duas Colunas: Distribuição por CRE e Produtividade dos Técnicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Distribuição por CRE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" /> Distribuição de Demandas por CRE
                </h4>
                <span className="text-[10px] font-bold text-slate-400">15 Regionais DF</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {slaReport.creDistribution.map((item) => (
                  <div key={item.creName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>CRE {item.creName}</span>
                      <span className="text-slate-500 text-[11px]">
                        {item.count} chamado(s) ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.max(item.percentage, item.count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Produtividade dos Técnicos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Wrench size={14} className="text-emerald-600" /> Desempenho e Produtividade Técnica
                </h4>
                <span className="text-[10px] font-bold text-slate-400">{technicians.length} Credenciados</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-2">Técnico</th>
                      <th className="p-2 text-center">Ativos</th>
                      <th className="p-2 text-center">Concluídos</th>
                      <th className="p-2 text-right">Média Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slaReport.technicianPerformance.map((tech) => (
                      <tr key={tech.techId} className="hover:bg-slate-50/70">
                        <td className="p-2 font-semibold text-slate-800">{tech.techName}</td>
                        <td className="p-2 text-center font-mono font-bold text-blue-600">{tech.activeCount}</td>
                        <td className="p-2 text-center font-mono font-bold text-emerald-600">{tech.completedCount}</td>
                        <td className="p-2 text-right font-mono text-slate-600">{tech.avgHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                        {t.quote?.status === 'pendente' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onDecideQuote(t.id, true, 'Controladoria HelpTech / CRE')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs transition-colors"
                              title="Aprovar Orçamento"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingQuoteTicket(t);
                                setQuoteDecisionReason('');
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-xs transition-colors"
                              title="Reprovar Orçamento e Cancelar Chamado"
                            >
                              Reprovar / Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewOS(t)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                            >
                              Ver OS
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewOS(t)}
                              className="text-blue-600 hover:text-blue-800 font-bold text-[11px]"
                            >
                              Ver OS
                            </button>
                            {t.quote?.decision_reason && (
                              <span
                                className="text-[10px] text-slate-400 italic max-w-[150px] truncate"
                                title={t.quote.decision_reason}
                              >
                                ({t.quote.decision_reason})
                              </span>
                            )}
                          </div>
                        )}
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
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(SUPABASE_MASTER_DDL);
                    alert('Código DDL Completo copiado para a área de transferência! Cole no SQL Editor do Supabase.');
                  } catch {
                    alert('Falha ao copiar automaticamente. Use o botão Baixar schema.sql');
                  }
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
              >
                Copiar DDL Completo (v2.1)
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
                                    if (onDeleteTechnician) {
                                      onDeleteTechnician(tech.id);
                                    }
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
                <option value="auditor_helptech">Auditor Externo HelpTech</option>
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
              <div className="text-[11px] font-bold uppercase text-amber-700">Auditores Internos</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">
                {systemUsers.filter((u) => u.role === 'auditor_helptech').length}
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
                        auditor_helptech: {
                          label: 'Auditor Externo HelpTech',
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
                                    if (onDeleteSystemUser) {
                                      onDeleteSystemUser(user.id);
                                    }
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingTech ? 'Redefinir Senha de Acesso (Opcional)' : 'Senha de Acesso ao PWA *'}
                </label>
                <input
                  type="password"
                  required={!editingTech}
                  minLength={6}
                  value={techForm.password}
                  onChange={(e) => setTechForm({ ...techForm, password: e.target.value })}
                  placeholder={editingTech ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres (Ex: Tecnico@2026)'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Esta senha será usada pelo técnico para fazer login no PWA de Campo.
                </p>
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
                  <option value="auditor_helptech">Auditor Externo HelpTech (Prestação de contas e relatórios)</option>
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
      {/* MODAL DE JUSTIFICATIVA PARA REPROVAR ORÇAMENTO E CANCELAR CHAMADO */}
      {rejectingQuoteTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h4 className="font-bold text-sm text-rose-700 flex items-center gap-2">
                <AlertCircle size={18} /> Reprovar Orçamento & Cancelar Chamado
              </h4>
              <button
                type="button"
                onClick={() => setRejectingQuoteTicket(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Ao reprovar o orçamento do chamado <strong>{rejectingQuoteTicket.protocol}</strong> ({rejectingQuoteTicket.school_name}), a Ordem de Serviço será <strong>cancelada</strong> e o técnico e a escola serão notificados com o parecer oficial.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Valor Orçado:</span>
              <strong className="text-slate-800 text-sm">R$ {rejectingQuoteTicket.quote?.total_amount.toFixed(2)}</strong>
              <p className="text-[11px] text-slate-600 mt-1">
                Laudo Técnico: "{rejectingQuoteTicket.quote?.technical_diagnosis}"
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Justificativa Obrigatória da Reprovação / Cancelamento *
              </label>
              <textarea
                rows={3}
                value={quoteDecisionReason}
                onChange={(e) => setQuoteDecisionReason(e.target.value)}
                placeholder="Ex: Valor excede tabela contratual com a HelpTech / Equipamento obsoleto com recomendação de baixa patrimonial..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!quoteDecisionReason.trim()}
                onClick={() => {
                  onDecideQuote(
                    rejectingQuoteTicket.id,
                    false,
                    'Controladoria HelpTech / CRE',
                    quoteDecisionReason.trim()
                  );
                  setRejectingQuoteTicket(null);
                  setQuoteDecisionReason('');
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow"
              >
                Confirmar Reprovação & Cancelar
              </button>
              <button
                type="button"
                onClick={() => setRejectingQuoteTicket(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SEGURANÇA: CONFIRMAÇÃO DE RESTAURAÇÃO / RESET DE BANCO */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Ação Destrutiva: Restaurar Dados</h4>
                <p className="text-xs text-rose-600 font-semibold">Atenção: Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Todos os chamados em andamento, ordens de serviço, cadastros de técnicos e histórico local serão <strong>removidos e resetados</strong> para a carga inicial limpa.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Para autorizar, digite exatamente <span className="font-mono text-rose-600 font-extrabold">CONFIRMAR-RESET</span> abaixo:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="CONFIRMAR-RESET"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setResetConfirmText('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetConfirmText !== 'CONFIRMAR-RESET'}
                onClick={() => {
                  onResetDatabase();
                  setShowResetConfirmModal(false);
                  setResetConfirmText('');
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Executar Reset Seguro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALMOXARIFADO CENTRAL & ESTOQUE WMS */}
      <InventoryManagementModal
        isOpen={showInventoryModal}
        inventory={inventory}
        onClose={() => setShowInventoryModal(false)}
        onUpdateQuantity={onUpdateInventoryQuantity}
        onAddItem={onAddInventoryItem}
      />

      {/* MODAL DE RELATÓRIO OFICIAL DE PRESTAÇÃO DE CONTAS Auditoria & Governança HelpTech */}
      <OfficialAuditReportModal
        isOpen={showAuditReportModal}
        tickets={tickets}
        regions={regions}
        onClose={() => setShowAuditReportModal(false)}
      />
    </div>
  );
};
