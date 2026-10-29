import { OFFICIAL_SCHOOLS } from './schoolsCatalog';

export interface RegionalCoordination {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface School {
  id: string;
  cre_id: string;
  cre_name: string;
  inep?: string;
  name: string;
  address: string;
  cep?: string;
  latitude: number;
  longitude: number;
  contact_phone: string;
  contact_email: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  email: string;
  primary_cre_id: string;
  primary_cre_name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  max_active_tickets: number;
  status: 'disponivel' | 'ocupado' | 'indisponivel' | 'suspenso';
  active: boolean;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'controladoria' | 'auditor_helptech';
  active: boolean;
  created_at: string;
}

export interface TicketCategory {
  id: string;
  name: string;
  sla_response_hours: number;
  sla_resolution_hours: number;
}

export interface TicketQuoteItem {
  id: string;
  quote_id: string;
  item_type: 'peca' | 'servico';
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface TicketQuote {
  id: string;
  ticket_id: string;
  technician_id: string;
  technician_name: string;
  total_amount: number;
  technical_diagnosis: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado';
  decision_by_name?: string;
  decision_reason?: string;
  decided_at?: string;
  created_at: string;
  items: TicketQuoteItem[];
}

export interface TicketCompletion {
  id: string;
  ticket_id: string;
  technician_id: string;
  technician_name: string;
  service_summary: string;
  school_representative_name: string;
  school_representative_doc: string;
  signature_svg: string;
  completed_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  phase: 'abertura' | 'diagnostico' | 'conclusao';
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  created_at: string;
}

export interface TicketDispatchLog {
  id: string;
  ticket_id: string;
  technician_id: string;
  technician_name: string;
  status: 'notificado' | 'aceito' | 'recusado' | 'timeout';
  refusal_reason?: string;
  created_at: string;
}

export interface TicketNotification {
  id: string;
  ticket_id: string;
  type: 'abertura' | 'despacho' | 'visita' | 'orcamento' | 'peca' | 'terceiro' | 'conclusao';
  recipient_role: 'escola' | 'tecnico' | 'central';
  recipient_phone_or_email: string;
  channel: 'whatsapp' | 'push' | 'email';
  title: string;
  message: string;
  sent_at: string;
}

export interface Ticket {
  id: string;
  protocol: string;
  tracking_token: string;
  school_id: string;
  school_name: string;
  cre_name: string;
  school_address: string;
  category_id: string;
  category_name: string;
  requester_name: string;
  requester_role: string;
  requester_phone: string;
  title: string;
  description: string;
  equipment_patrimony?: string;
  urgency_level: 'baixa' | 'media' | 'alta' | 'critica';
  status:
    | 'aberto'
    | 'despachado'
    | 'visita_agendada'
    | 'em_deslocamento'
    | 'em_atendimento'
    | 'aguardando_orcamento'
    | 'aguardando_peca'
    | 'aguardando_terceiro'
    | 'concluido'
    | 'cancelado';
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  dispatch_attempts: number;
  dispatch_timeout_at?: string;
  scheduled_visit_at?: string;
  scheduled_visit_notes?: string;
  pending_part_notes?: string;
  third_party_notes?: string;
  arrival_lat?: number;
  arrival_lng?: number;
  arrived_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  quote?: TicketQuote;
  completion?: TicketCompletion;
  attachments: TicketAttachment[];
  dispatch_logs: TicketDispatchLog[];
  notifications?: TicketNotification[];
  csat_rating?: number;
  csat_comment?: string;
  csat_at?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'rede' | 'hardware' | 'eletrica' | 'impressao' | 'periferico';
  quantity_in_stock: number;
  min_stock_alert: number;
  unit_price: number;
  unit: 'un' | 'm' | 'kit';
}

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-001',
    sku: 'HW-MEM-DDR4-8GB',
    name: 'Memória RAM DDR4 8GB 2666MHz Kingston',
    category: 'hardware',
    quantity_in_stock: 45,
    min_stock_alert: 10,
    unit_price: 145.0,
    unit: 'un'
  },
  {
    id: 'inv-002',
    sku: 'HW-SSD-480GB',
    name: 'SSD 480GB Kingston SATA III 2.5"',
    category: 'hardware',
    quantity_in_stock: 28,
    min_stock_alert: 8,
    unit_price: 189.9,
    unit: 'un'
  },
  {
    id: 'inv-003',
    sku: 'HW-FONTE-500W',
    name: 'Fonte ATX 500W 80 Plus Bronze PFC Ativo',
    category: 'hardware',
    quantity_in_stock: 19,
    min_stock_alert: 5,
    unit_price: 215.0,
    unit: 'un'
  },
  {
    id: 'inv-004',
    sku: 'RED-CABO-CAT6',
    name: 'Cabo de Rede UTP CAT6 Furukawa Azul (Bobina)',
    category: 'rede',
    quantity_in_stock: 320,
    min_stock_alert: 50,
    unit_price: 3.8,
    unit: 'm'
  },
  {
    id: 'inv-005',
    sku: 'RED-RJ45-CAT6',
    name: 'Conector Macho RJ-45 CAT6 Pacote c/ 50 un',
    category: 'rede',
    quantity_in_stock: 64,
    min_stock_alert: 15,
    unit_price: 45.0,
    unit: 'kit'
  },
  {
    id: 'inv-006',
    sku: 'RED-AP-GIGA',
    name: 'Roteador / Access Point Dual Band Gigabit AC1200',
    category: 'rede',
    quantity_in_stock: 14,
    min_stock_alert: 4,
    unit_price: 280.0,
    unit: 'un'
  },
  {
    id: 'inv-007',
    sku: 'PER-KIT-KB-MOUSE',
    name: 'Kit Teclado e Mouse USB ABNT2 Padrão HelpTech',
    category: 'periferico',
    quantity_in_stock: 52,
    min_stock_alert: 12,
    unit_price: 85.0,
    unit: 'kit'
  }
];

export const REGIONAL_COORDINATIONS: RegionalCoordination[] = [
  { id: 'cre-braz', code: 'CRE_BRAZLANDIA', name: 'Brazlândia', active: true },
  { id: 'cre-ceil', code: 'CRE_CEILANDIA', name: 'Ceilândia', active: true },
  { id: 'cre-gama', code: 'CRE_GAMA', name: 'Gama', active: true },
  { id: 'cre-guar', code: 'CRE_GUARA', name: 'Guará', active: true },
  { id: 'cre-nban', code: 'CRE_NUCLEO_BANDEIRANTE', name: 'Núcleo Bandeirante', active: true },
  { id: 'cre-para', code: 'CRE_PARANOA', name: 'Paranoá', active: true },
  { id: 'cre-plan', code: 'CRE_PLANALTINA', name: 'Planaltina', active: true },
  { id: 'cre-ppil', code: 'CRE_PLANO_PILOTO', name: 'Plano Piloto', active: true },
  { id: 'cre-rema', code: 'CRE_RECANTO_DAS_EMAS', name: 'Recanto das Emas', active: true },
  { id: 'cre-sama', code: 'CRE_SAMAMBAIA', name: 'Samambaia', active: true },
  { id: 'cre-smar', code: 'CRE_SANTA_MARIA', name: 'Santa Maria', active: true },
  { id: 'cre-sseb', code: 'CRE_SAO_SEBASTIAO', name: 'São Sebastião', active: true },
  { id: 'cre-sobr', code: 'CRE_SOBRADINHO', name: 'Sobradinho', active: true },
  { id: 'cre-tagu', code: 'CRE_TAGUATINGA', name: 'Taguatinga', active: true }
];

export const TICKET_CATEGORIES: TicketCategory[] = [
  { id: 'cat-rede', name: 'Rede & Conectividade de Internet', sla_response_hours: 2, sla_resolution_hours: 24 },
  { id: 'cat-lab', name: 'Laboratório de Informática / Computadores', sla_response_hours: 4, sla_resolution_hours: 48 },
  { id: 'cat-proj', name: 'Projetores & Telas Interativas', sla_response_hours: 4, sla_resolution_hours: 48 },
  { id: 'cat-imp', name: 'Impressoras & Scanners Administrativos', sla_response_hours: 8, sla_resolution_hours: 72 },
  { id: 'cat-serv', name: 'Servidores & Roteadores Wi-Fi', sla_response_hours: 2, sla_resolution_hours: 12 },
  { id: 'cat-ele', name: 'Elétrica de TI / No-breaks & Nobreaks', sla_response_hours: 2, sla_resolution_hours: 24 }
];

export const SCHOOLS: School[] = OFFICIAL_SCHOOLS.map(os => ({
  id: os.id,
  cre_id: os.cre_id,
  cre_name: os.cre_name,
  inep: os.id.replace('sch-', ''),
  name: os.name,
  address: os.address,
  cep: os.cep,
  latitude: os.latitude,
  longitude: os.longitude,
  contact_phone: os.contact_phone,
  contact_email: os.contact_email
}));

export const TECHNICIANS: Technician[] = [
  {
    id: 'tech-carlos',
    name: 'Carlos Alberto Mendes',
    phone: '(61) 98452-1101',
    email: 'carlos.mendes@fieldservice.df.gov.br',
    primary_cre_id: 'cre-tagu',
    primary_cre_name: 'Taguatinga',
    latitude: -15.8340,
    longitude: -48.0560,
    radius_km: 35,
    max_active_tickets: 4,
    status: 'disponivel',
    active: true
  },
  {
    id: 'tech-marcos',
    name: 'Marcos Vinícius Silveira',
    phone: '(61) 99123-4567',
    email: 'marcos.silveira@fieldservice.df.gov.br',
    primary_cre_id: 'cre-ceil',
    primary_cre_name: 'Ceilândia',
    latitude: -15.8150,
    longitude: -48.1100,
    radius_km: 30,
    max_active_tickets: 4,
    status: 'disponivel',
    active: true
  },
  {
    id: 'tech-rafael',
    name: 'Rafael Souza Ferreira',
    phone: '(61) 98234-8899',
    email: 'rafael.ferreira@fieldservice.df.gov.br',
    primary_cre_id: 'cre-ppil',
    primary_cre_name: 'Plano Piloto',
    latitude: -15.7940,
    longitude: -47.8820,
    radius_km: 40,
    max_active_tickets: 4,
    status: 'disponivel',
    active: true
  },
  {
    id: 'tech-diego',
    name: 'Diego Ribeiro Lima',
    phone: '(61) 99655-3344',
    email: 'diego.lima@fieldservice.df.gov.br',
    primary_cre_id: 'cre-sobr',
    primary_cre_name: 'Sobradinho',
    latitude: -15.6510,
    longitude: -47.7920,
    radius_km: 35,
    max_active_tickets: 4,
    status: 'disponivel',
    active: true
  },
  {
    id: 'tech-lucas',
    name: 'Lucas Eduardo Prado',
    phone: '(61) 98711-2244',
    email: 'lucas.prado@fieldservice.df.gov.br',
    primary_cre_id: 'cre-gama',
    primary_cre_name: 'Gama',
    latitude: -16.0210,
    longitude: -48.0620,
    radius_km: 35,
    max_active_tickets: 4,
    status: 'disponivel',
    active: true
  }
];

export const INITIAL_SYSTEM_USERS: SystemUser[] = [
  {
    id: 'user-suporte-admin',
    name: 'Suporte Central DTI',
    email: 'suporte@helptech.com.br',
    phone: '(61) 3300-2203',
    role: 'admin',
    active: true,
    created_at: '2026-03-01T08:00:00Z'
  },
  {
    id: 'user-admin-1',
    name: 'Raphael Gestão HelpTech',
    email: 'raphael.gestao@helptech.com.br',
    phone: '(61) 98111-2233',
    role: 'admin',
    active: true,
    created_at: '2026-01-15T08:00:00Z'
  },
  {
    id: 'user-ctrl-1',
    name: 'Mariana Castro (Despachante Central)',
    email: 'mariana.despacho@helptech.com.br',
    phone: '(61) 99222-3344',
    role: 'controladoria',
    active: true,
    created_at: '2026-02-01T08:30:00Z'
  },
  {
    id: 'user-helptech-1',
    name: 'Dr. Fernando Lins (Fiscal HelpTech)',
    email: 'fernando.lins@se.df.gov.br',
    phone: '(61) 3901-8000',
    role: 'auditor_helptech',
    active: true,
    created_at: '2026-01-20T09:00:00Z'
  }
];

export const INITIAL_TICKETS: Ticket[] = [];
