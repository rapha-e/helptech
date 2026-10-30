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
import { InventoryManagementModal } from './InventoryManagementModal';
import { OfficialAuditReportModal } from './OfficialAuditReportModal';
import type { InventoryItem } from '../data/seedData';
import {
  Kanban,
  FileSpreadsheet,
  Cpu,
  Building2,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Filter,
  Download,
  DollarSign,
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
  onCreateSystemUser?: (user: Omit<SystemUser, 'id' | 'created_at'> & { password?: string }) => void;
  onUpdateSystemUser?: (id: string, user: Partial<SystemUser> & { password?: string }) => void;
  onDeleteSystemUser?: (id: string) => void;
  onToggleSystemUserActive?: (id: string) => void;
  onAddTicketNote?: (ticketId: string, note: string) => void;
  onAdminUpdateTicket?: (
    ticketId: string,
    params: {
      status?: Ticket['status'];
      technicianId?: string;
      title?: string;
      description?: string;
      urgencyLevel?: Ticket['urgency_level'];
      equipmentPatrimony?: string;
      notes?: string;
    }
  ) => void;
  onResetDatabase: () => void;
  inventory?: InventoryItem[];
  onUpdateInventoryQuantity?: (id: string, delta: number) => void;
  onAddInventoryItem?: (item: Omit<InventoryItem, 'id'>) => void;
  onUpdateInventoryItem?: (id: string, updates: Partial<InventoryItem>) => void;
  onDeleteInventoryItem?: (id: string) => void;
}



export const CRE_COORDINATES_MAP: Record<string, { lat: number; lng: number }> = {
  'Brazlândia': { lat: -15.6780, lng: -48.1980 },
  'Ceilândia': { lat: -15.8200, lng: -48.1070 },
  'Gama': { lat: -16.0210, lng: -48.0620 },
  'Guará': { lat: -15.8260, lng: -47.9800 },
  'Núcleo Bandeirante': { lat: -15.8710, lng: -47.9680 },
  'Paranoá/Itapoã': { lat: -15.7725, lng: -47.7795 },
  'Paranoá': { lat: -15.7725, lng: -47.7795 },
  'Planaltina': { lat: -15.6190, lng: -47.6510 },
  'Plano Piloto': { lat: -15.7940, lng: -47.8820 },
  'Recanto das Emas': { lat: -15.9080, lng: -48.0630 },
  'Samambaia': { lat: -15.8760, lng: -48.0850 },
  'Santa Maria': { lat: -16.0180, lng: -48.0120 },
  'São Sebastião': { lat: -15.9030, lng: -47.7750 },
  'Sobradinho': { lat: -15.6510, lng: -47.7920 },
  'Taguatinga': { lat: -15.8340, lng: -48.0560 }
};

export const KANBAN_STAGES_FLOW: {
  status: Ticket['status'];
  label: string;
  stepNumber: number;
}[] = [
  { status: 'aberto', label: '1. Triagem / Aberto', stepNumber: 1 },
  { status: 'despachado', label: '2. Despachado (Timeout 20m)', stepNumber: 2 },
  { status: 'visita_agendada', label: '3. Visita Agendada', stepNumber: 3 },
  { status: 'em_deslocamento', label: '4. Em Rota / Deslocamento', stepNumber: 4 },
  { status: 'em_atendimento', label: '5. Em Atendimento Presencial', stepNumber: 5 },
  { status: 'aguardando_orcamento', label: '6. Aguardando Orçamento', stepNumber: 6 },
  { status: 'aguardando_peca', label: '7. Aguardando Peça', stepNumber: 7 },
  { status: 'aguardando_terceiro', label: '8. Aguardando Terceiro', stepNumber: 8 },
  { status: 'concluido', label: '9. Concluído & Assinado', stepNumber: 9 },
  { status: 'cancelado', label: '10. Cancelado', stepNumber: 10 }
];

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
  onAdminUpdateTicket,
  onAddTicketNote: _onAddTicketNote,
  onResetDatabase,
  inventory = [],
  onUpdateInventoryQuantity = () => {},
  onAddInventoryItem = () => {},
  onUpdateInventoryItem,
  onDeleteInventoryItem
}) => {
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  const [showAuditReportModal, setShowAuditReportModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'kanban' | 'prestacao' | 'despacho' | 'sla' | 'tecnicos' | 'usuarios' | 'sql'>('kanban');
  const [selectedCre, setSelectedCre] = useState<string>('todas');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todas');

  // Estado para simulação de despacho
  const [simSchoolId, setSimSchoolId] = useState<string>(schools[0]?.id || '');
  const [simCreFilter, setSimCreFilter] = useState<string>('todas');
  const [simCustomGps, setSimCustomGps] = useState<{ lat: number; lng: number; label: string } | null>(null);

  // Estados para Edição Administrativa da OS e Transição de Etapas
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [showEditTicketModal, setShowEditTicketModal] = useState(false);
  const [cardTechSelect, setCardTechSelect] = useState<Record<string, string>>({});
  const [changingTechTicketId, setChangingTechTicketId] = useState<string | null>(null);
  const [editTicketForm, setEditTicketForm] = useState<{
    status: Ticket['status'];
    technicianId: string;
    title: string;
    description: string;
    urgencyLevel: Ticket['urgency_level'];
    equipmentPatrimony: string;
    notes: string;
  }>({
    status: 'aberto',
    technicianId: '',
    title: '',
    description: '',
    urgencyLevel: 'media',
    equipmentPatrimony: '',
    notes: ''
  });

  const handleOpenEditTicketModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditTicketForm({
      status: ticket.status,
      technicianId: ticket.assigned_technician_id || '',
      title: ticket.title,
      description: ticket.description,
      urgencyLevel: ticket.urgency_level,
      equipmentPatrimony: ticket.equipment_patrimony || '',
      notes: ''
    });
    setShowEditTicketModal(true);
  };

  const handleSaveEditTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    if (onAdminUpdateTicket) {
      onAdminUpdateTicket(editingTicket.id, {
        status: editTicketForm.status,
        technicianId: editTicketForm.technicianId,
        title: editTicketForm.title.trim(),
        description: editTicketForm.description.trim(),
        urgencyLevel: editTicketForm.urgencyLevel,
        equipmentPatrimony: editTicketForm.equipmentPatrimony.trim(),
        notes: editTicketForm.notes.trim()
      });
    } else {
      if (editTicketForm.technicianId && editTicketForm.technicianId !== editingTicket.assigned_technician_id) {
        onManualDispatch(editingTicket.id, editTicketForm.technicianId);
      }
    }
    setShowEditTicketModal(false);
    setEditingTicket(null);
  };

  const handleQuickAssignOrSwapTech = (ticketId: string, technicianId: string) => {
    if (onAdminUpdateTicket) {
      onAdminUpdateTicket(ticketId, { technicianId });
    } else {
      onManualDispatch(ticketId, technicianId);
    }
    setChangingTechTicketId(null);
  };

  const handleQuickMoveStage = (ticket: Ticket, targetStatus: Ticket['status']) => {
    if (onAdminUpdateTicket) {
      onAdminUpdateTicket(ticket.id, { status: targetStatus });
    }
  };


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
    password: '',
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
        password: '',
        role: user.role,
        active: user.active
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        phone: '',
        password: '',
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

    if (!editingUser && (!userForm.password || userForm.password.trim().length < 6)) {
      alert('A senha de acesso do novo administrador/usuário deve ter no mínimo 6 caracteres.');
      return;
    }

    if (editingUser && onUpdateSystemUser) {
      onUpdateSystemUser(editingUser.id, {
        ...userForm,
        password: userForm.password ? userForm.password : undefined
      });
    } else if (onCreateSystemUser) {
      onCreateSystemUser({
        ...userForm,
        password: userForm.password
      });
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

  // Simulação do Motor de Despacho com suporte a filtro por CRE e GPS em Tempo Real
  const simFilteredSchools =
    simCreFilter === 'todas'
      ? schools
      : schools.filter((s) => s.cre_name.toLowerCase() === simCreFilter.toLowerCase() || s.cre_id === simCreFilter);
  const selectedSimSchool =
    simFilteredSchools.find((s) => s.id === simSchoolId) ||
    schools.find((s) => s.id === simSchoolId) ||
    simFilteredSchools[0] ||
    schools[0];

  const targetSimLat = simCustomGps ? simCustomGps.lat : selectedSimSchool?.latitude;
  const targetSimLng = simCustomGps ? simCustomGps.lng : selectedSimSchool?.longitude;

  const bestCandidate =
    targetSimLat !== undefined && targetSimLng !== undefined
      ? getBestCandidateTechnician(targetSimLat, targetSimLng, technicians, tickets, [])
      : null;

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

                      {ticket.notes && (
                        <div className="text-[10px] bg-amber-50/90 p-1.5 rounded-lg border border-amber-200 text-amber-950 line-clamp-2" title={ticket.notes}>
                          <span className="font-bold text-amber-800">📝 Parecer:</span> {ticket.notes}
                        </div>
                      )}

                      {/* Gestão Universal de Técnico Atribuído */}
                      <div className="pt-2 border-t border-slate-100">
                        {ticket.assigned_technician_name ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1 text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                              <div className="truncate text-slate-700">
                                <span className="text-slate-400 font-semibold">Técnico:</span>{' '}
                                <strong className="text-slate-900">{ticket.assigned_technician_name}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setChangingTechTicketId(
                                    changingTechTicketId === ticket.id ? null : ticket.id
                                  )
                                }
                                className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9px] font-bold shrink-0 transition-colors"
                              >
                                {changingTechTicketId === ticket.id ? 'Fechar' : 'Trocar'}
                              </button>
                            </div>

                            {changingTechTicketId === ticket.id && (
                              <div className="p-2 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5 animate-fadeIn">
                                <label className="text-[10px] font-bold text-blue-900 block">
                                  Trocar Técnico da OS em Andamento:
                                </label>
                                <div className="flex gap-1">
                                  <select
                                    value={
                                      cardTechSelect[ticket.id] ||
                                      ticket.assigned_technician_id ||
                                      technicians[0]?.id ||
                                      ''
                                    }
                                    onChange={(e) =>
                                      setCardTechSelect({
                                        ...cardTechSelect,
                                        [ticket.id]: e.target.value
                                      })
                                    }
                                    className="text-[10px] p-1 border rounded bg-white flex-1 truncate text-slate-800"
                                  >
                                    {technicians.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name} ({t.primary_cre_name})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const techId =
                                        cardTechSelect[ticket.id] ||
                                        ticket.assigned_technician_id ||
                                        technicians[0]?.id;
                                      if (techId) handleQuickAssignOrSwapTech(ticket.id, techId);
                                    }}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shrink-0 shadow-xs"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 bg-amber-50 p-2 rounded-lg border border-amber-300">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900">
                              <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                              <span>⚠️ Sem Técnico Atribuído</span>
                            </div>
                            <div className="flex gap-1">
                              <select
                                value={cardTechSelect[ticket.id] || technicians[0]?.id || ''}
                                onChange={(e) =>
                                  setCardTechSelect({
                                    ...cardTechSelect,
                                    [ticket.id]: e.target.value
                                  })
                                }
                                className="text-[10px] p-1 border border-amber-300 rounded bg-white flex-1 truncate text-slate-800"
                              >
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.primary_cre_name})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const techId = cardTechSelect[ticket.id] || technicians[0]?.id;
                                  if (techId) handleQuickAssignOrSwapTech(ticket.id, techId);
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold shrink-0 shadow-xs"
                              >
                                Atribuir
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Controle de Etapas da OS (Avançar e Retornar) */}
                      {(() => {
                        const currentIdx = KANBAN_STAGES_FLOW.findIndex(
                          (s) => s.status === ticket.status
                        );
                        const currentStage = KANBAN_STAGES_FLOW[currentIdx] || {
                          label: ticket.status,
                          stepNumber: currentIdx + 1
                        };
                        const prevStage = currentIdx > 0 ? KANBAN_STAGES_FLOW[currentIdx - 1] : null;
                        const nextStage =
                          currentIdx >= 0 && currentIdx < KANBAN_STAGES_FLOW.length - 1
                            ? KANBAN_STAGES_FLOW[currentIdx + 1]
                            : null;

                        return (
                          <div className="pt-1.5 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 font-semibold">Etapa:</span>
                              <span
                                className="font-bold text-slate-700 truncate max-w-[130px]"
                                title={currentStage.label}
                              >
                                {currentStage.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                disabled={!prevStage}
                                onClick={() => prevStage && handleQuickMoveStage(ticket, prevStage.status)}
                                className="py-1 px-1.5 text-[9px] font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 rounded border border-slate-200 flex items-center justify-center gap-1 transition-colors"
                                title={prevStage ? `Retornar para: ${prevStage.label}` : 'Primeira etapa'}
                              >
                                ◀ Retornar
                              </button>
                              <button
                                type="button"
                                disabled={!nextStage}
                                onClick={() => nextStage && handleQuickMoveStage(ticket, nextStage.status)}
                                className="py-1 px-1.5 text-[9px] font-bold bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:hover:bg-blue-50 text-blue-700 rounded border border-blue-200 flex items-center justify-center gap-1 transition-colors"
                                title={nextStage ? `Avançar para: ${nextStage.label}` : 'Última etapa'}
                              >
                                Avançar ▶
                              </button>
                            </div>
                          </div>
                        );
                      })()}

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

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTicketModal(ticket)}
                          className="flex-1 py-1 px-2 text-center text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Edit size={11} className="text-slate-500" /> Editar OS
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewOS(ticket)}
                          className="flex-1 py-1 px-2 text-center text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors truncate"
                        >
                          Ver OS Oficial →
                        </button>
                      </div>
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

      {/* ABA 3: MOTOR DE DESPACHO INTELIGENTE (PROXIMIDADE & GEOLOCALIZAÇÃO) */}
      {activeTab === 'despacho' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Motor de Despacho Geodésico por Proximidade & Carga
              </h3>
              <p className="text-xs text-slate-500">
                Cálculo Haversine em tempo real considerando coordenadas da unidade escolar ou GPS atual, raio de cobertura e limite de chamados ativos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    alert('Geolocalização não suportada neste navegador.');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setSimCustomGps({
                        lat: Number(pos.coords.latitude.toFixed(6)),
                        lng: Number(pos.coords.longitude.toFixed(6)),
                        label: 'Minha Localização GPS Atual'
                      });
                    },
                    () => {
                      alert('Não foi possível obter o GPS atual. Verifique a permissão de localização do navegador.');
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                  );
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <MapPin size={14} /> Usar Meu GPS Atual
              </button>
              {simCustomGps && (
                <button
                  type="button"
                  onClick={() => setSimCustomGps(null)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Voltar para Escola
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Seletor de Regional e Escola */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Filtrar por Coordenação Regional (CRE):
                </label>
                <select
                  value={simCreFilter}
                  onChange={(e) => {
                    const nextCre = e.target.value;
                    setSimCreFilter(nextCre);
                    setSimCustomGps(null);
                    const nextList =
                      nextCre === 'todas'
                        ? schools
                        : schools.filter(
                            (s) =>
                              s.cre_name.toLowerCase() === nextCre.toLowerCase() || s.cre_id === nextCre
                          );
                    if (nextList[0]) setSimSchoolId(nextList[0].id);
                  }}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
                >
                  <option value="todas">Todas as Regionais ({schools.length} unidades)</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>
                      CRE {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Selecione a Unidade Escolar para Cálculo Geodésico:
                </label>
                <select
                  value={selectedSimSchool?.id || ''}
                  onChange={(e) => {
                    setSimSchoolId(e.target.value);
                    setSimCustomGps(null);
                  }}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900"
                >
                  {simFilteredSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.cre_name}] {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {simCustomGps ? (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1">
                    <MapPin size={14} className="text-emerald-600" /> Origem: {simCustomGps.label}
                  </div>
                  <div className="text-emerald-700 font-mono text-[11px]">
                    Coordenadas GPS: Lat {simCustomGps.lat} | Lng {simCustomGps.lng}
                  </div>
                </div>
              ) : (
                selectedSimSchool && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800">{selectedSimSchool.name}</div>
                    <div className="text-slate-500">
                      Região: CRE {selectedSimSchool.cre_name} &bull; {selectedSimSchool.address}
                    </div>
                    <div className="text-slate-600 font-mono text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      Coordenadas Geodésicas: Lat {selectedSimSchool.latitude} | Lng {selectedSimSchool.longitude}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Resultado do Motor */}
            <div className="space-y-4 bg-blue-50/60 p-4 rounded-xl border border-blue-200 text-xs">
              <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                3. Técnico Selecionado pelo Motor de Proximidade:
              </label>

              {bestCandidate ? (
                <div className="bg-white p-4 rounded-xl border border-blue-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {bestCandidate.technician.name}
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                      1º Elegível Mais Próximo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Distância Geodésica (Haversine):</span>
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
                      <span className="text-slate-400 block">Raio Máximo Configurado:</span>
                      <span className="text-slate-700">{bestCandidate.technician.radius_km} km</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">CRE Base Operacional:</span>
                      <span className="text-slate-700 font-semibold">
                        {bestCandidate.technician.primary_cre_name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-100/60 text-amber-900 rounded-xl border border-amber-300">
                  Nenhum técnico disponível dentro do raio limite ou com capacidade livre. O chamado será encaminhado para atribuição manual na Central.
                </div>
              )}
            </div>
          </div>

          {/* Matriz de Distância de Todos os Técnicos */}
          {targetSimLat !== undefined && targetSimLng !== undefined && (
            <div className="pt-2">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
                Matriz Geodésica Completa dos Técnicos Cadastrados ({technicians.length})
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b">
                    <tr>
                      <th className="p-2.5">Técnico</th>
                      <th className="p-2.5">CRE Base</th>
                      <th className="p-2.5">Coordenadas Base</th>
                      <th className="p-2.5 text-center">Distância Calculada</th>
                      <th className="p-2.5 text-center">Raio Limite</th>
                      <th className="p-2.5 text-center">Status / Elegibilidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {technicians
                      .map((t) => {
                        const R = 6371;
                        const dLat = ((targetSimLat - t.latitude) * Math.PI) / 180;
                        const dLon = ((targetSimLng - t.longitude) * Math.PI) / 180;
                        const a =
                          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos((t.latitude * Math.PI) / 180) *
                            Math.cos((targetSimLat * Math.PI) / 180) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                        const dist =
                          Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
                        return { tech: t, dist };
                      })
                      .sort((a, b) => a.dist - b.dist)
                      .map(({ tech, dist }) => {
                        const inRadius = dist <= tech.radius_km;
                        const isBest = bestCandidate?.technician.id === tech.id;
                        return (
                          <tr key={tech.id} className={isBest ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'}>
                            <td className="p-2.5 text-slate-900">{tech.name}</td>
                            <td className="p-2.5 text-slate-600">CRE {tech.primary_cre_name}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500">
                              {tech.latitude.toFixed(4)}, {tech.longitude.toFixed(4)}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-blue-700">
                              {dist.toFixed(2)} km
                            </td>
                            <td className="p-2.5 text-center text-slate-600">{tech.radius_km} km</td>
                            <td className="p-2.5 text-center">
                              {isBest ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                                  ★ Selecionado (Mais Próximo)
                                </span>
                              ) : !tech.active || tech.status !== 'disponivel' ? (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px]">
                                  Indisponível ({tech.status})
                                </span>
                              ) : inRadius ? (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                                  Elegível (Dentro do Raio)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px]">
                                  Fora do Raio ({dist.toFixed(1)} &gt; {tech.radius_km} km)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                    onChange={(e) => {
                    const newCreId = e.target.value;
                    const regObj = regions.find((r) => r.id === newCreId);
                    const coords = regObj ? CRE_COORDINATES_MAP[regObj.name] : undefined;
                    setTechForm({
                      ...techForm,
                      primary_cre_id: newCreId,
                      latitude: coords ? coords.lat : techForm.latitude,
                      longitude: coords ? coords.lng : techForm.longitude
                    });
                  }}
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

              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-700">Coordenadas GPS da Base do Técnico</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setTechForm({
                          ...techForm,
                          latitude: Number(pos.coords.latitude.toFixed(6)),
                          longitude: Number(pos.coords.longitude.toFixed(6))
                        });
                      },
                      () => alert('Permissão de GPS negada ou indisponível no navegador.')
                    );
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                >
                  <MapPin size={11} /> Capturar GPS Atual
                </button>
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingUser ? 'Alterar Senha de Acesso (Opcional)' : 'Senha de Acesso ao Sistema *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? 'Deixe em branco para manter a senha atual' : 'Mínimo 6 caracteres (Ex: Admin@2026)'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {editingUser
                    ? 'Digite uma nova senha para redefinir o acesso deste usuário na Central e Controladoria.'
                    : 'Esta senha será usada pelo usuário para autenticar na Central e Controladoria.'}
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

      {/* MODAL DE EDIÇÃO COMPLETA DE ORDEM DE SERVIÇO (OS) */}
      {showEditTicketModal && editingTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    Editar Ordem de Serviço &bull; {editingTicket.protocol}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {editingTicket.school_name} &bull; CRE {editingTicket.cre_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditTicketModal(false);
                  setEditingTicket(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditTicket} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Etapa / Status da OS */}
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-1">
                <label className="block font-bold text-blue-950">
                  Etapa do Fluxo Operacional (Avançar / Retornar) *
                </label>
                <select
                  value={editTicketForm.status}
                  onChange={(e) =>
                    setEditTicketForm({
                      ...editTicketForm,
                      status: e.target.value as Ticket['status']
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {KANBAN_STAGES_FLOW.map((s) => (
                    <option key={s.status} value={s.status}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-blue-700">
                  Você pode avançar ou retornar a OS para qualquer uma das 10 etapas operacionais homologadas.
                </p>
              </div>

              {/* Técnico Atribuído */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <label className="block font-bold text-slate-800">
                  Técnico Responsável (Atribuir / Trocar em Andamento)
                </label>
                <select
                  value={editTicketForm.technicianId}
                  onChange={(e) =>
                    setEditTicketForm({ ...editTicketForm, technicianId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sem Técnico (Não Atribuído) --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} &bull; CRE {t.primary_cre_name} ({t.status})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  Permite despachar novo técnico ou substituir o profissional atualmente em rota/campo.
                </p>
              </div>

              {/* Título */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título do Chamado *</label>
                <input
                  type="text"
                  required
                  value={editTicketForm.title}
                  onChange={(e) => setEditTicketForm({ ...editTicketForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição Detalhada do Defeito *</label>
                <textarea
                  required
                  rows={3}
                  value={editTicketForm.description}
                  onChange={(e) => setEditTicketForm({ ...editTicketForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Urgência e Patrimônio em Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nível de Urgência *</label>
                  <select
                    value={editTicketForm.urgencyLevel}
                    onChange={(e) =>
                      setEditTicketForm({
                        ...editTicketForm,
                        urgencyLevel: e.target.value as Ticket['urgency_level']
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="baixa">Baixa (SLA 48h)</option>
                    <option value="media">Média (SLA 24h)</option>
                    <option value="alta">Alta (SLA 12h)</option>
                    <option value="critica">Crítica (SLA 4h)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Patrimônio / Etiqueta</label>
                  <input
                    type="text"
                    value={editTicketForm.equipmentPatrimony}
                    onChange={(e) =>
                      setEditTicketForm({ ...editTicketForm, equipmentPatrimony: e.target.value })
                    }
                    placeholder="Ex: PAT-49921"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Observações Administrativas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nova Nota / Parecer / Despacho na OS
                </label>
                <textarea
                  rows={2}
                  value={editTicketForm.notes}
                  onChange={(e) => setEditTicketForm({ ...editTicketForm, notes: e.target.value })}
                  placeholder="Ex: OS analisada e aprovada para atendimento emergencial com troca de placa."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Histórico Anterior da OS */}
              {editingTicket.history && editingTicket.history.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Linha do Tempo / Histórico Salvo ({editingTicket.history.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {editingTicket.history.map((h, i) => (
                      <div key={h.id || i} className="p-1.5 bg-white rounded border border-slate-100 text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between font-bold text-slate-700">
                          <span>{h.author_name}</span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            {new Date(h.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {h.from_status && h.to_status && h.from_status !== h.to_status && (
                          <div className="text-slate-500">
                            Etapa: <span className="line-through">{h.from_status}</span> &rarr; <span className="text-blue-700 font-semibold">{h.to_status}</span>
                          </div>
                        )}
                        {h.note && (
                          <div className="text-slate-800 font-medium italic">&ldquo;{h.note}&rdquo;</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTicketModal(false);
                    setEditingTicket(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  Salvar Alterações da OS
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
        onUpdateItem={onUpdateInventoryItem}
        onDeleteItem={onDeleteInventoryItem}
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
