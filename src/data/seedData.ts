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
  inep: string;
  name: string;
  address: string;
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
    | 'em_deslocamento'
    | 'em_atendimento'
    | 'aguardando_orcamento'
    | 'aguardando_peca'
    | 'concluido'
    | 'cancelado';
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  dispatch_attempts: number;
  dispatch_timeout_at?: string;
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
}

export const REGIONAL_COORDINATIONS: RegionalCoordination[] = [
  { id: 'cre-braz', code: 'CRE_BRAZLANDIA', name: 'Brazlândia', active: true },
  { id: 'cre-ceil', code: 'CRE_CEILANDIA', name: 'Ceilândia', active: true },
  { id: 'cre-gama', code: 'CRE_GAMA', name: 'Gama', active: true },
  { id: 'cre-guar', code: 'CRE_GUARA', name: 'Guará', active: true },
  { id: 'cre-nban', code: 'CRE_NUCLEO_BANDEIRANTE', name: 'Núcleo Bandeirante', active: true },
  { id: 'cre-para', code: 'CRE_PARANOA', name: 'Paranoá', active: true },
  { id: 'cre-pita', code: 'CRE_PARANOA_ITAPOA', name: 'Paranoá/Itapoã', active: true },
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

export const SCHOOLS: School[] = [
  // Brazlândia
  { id: 'sch-53005023', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005023', name: 'CED 02 DE BRAZLÂNDIA', address: 'Quadra 02, Brazlândia, DF', latitude: -15.6766, longitude: -48.2046, contact_phone: '(61) 3901-3420', contact_email: 'ced02.brazlandia@se.df.gov.br' },
  { id: 'sch-53005171', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005171', name: 'CED 04 DE BRAZLANDIA', address: 'Setor Sul, Brazlândia, DF', latitude: -15.6710, longitude: -48.2010, contact_phone: '(61) 3901-3421', contact_email: 'ced04.brazlandia@se.df.gov.br' },
  { id: 'sch-53004981', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53004981', name: 'CED INCRA 08', address: 'Zona Rural Incra 08, Brazlândia, DF', latitude: -15.6890, longitude: -48.2230, contact_phone: '(61) 3901-3422', contact_email: 'ced.incra08@se.df.gov.br' },
  { id: 'sch-53005210', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005210', name: 'CED IRMA MARIA REGINA VELANES REGIS', address: 'Brazlândia, DF', latitude: -15.6740, longitude: -48.1990, contact_phone: '(61) 3901-3423', contact_email: 'ced.regina@se.df.gov.br' },
  { id: 'sch-50035007', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '50035007', name: 'CED VEREDINHA', address: 'Veredinha, Brazlândia, DF', latitude: -15.6650, longitude: -48.1920, contact_phone: '(61) 3901-3424', contact_email: 'ced.veredinha@se.df.gov.br' },
  { id: 'sch-53005090', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005090', name: 'CEF 02 DE BRAZLANDIA', address: 'Brazlândia, DF', latitude: -15.6780, longitude: -48.2030, contact_phone: '(61) 3901-3425', contact_email: 'cef02.brazlandia@se.df.gov.br' },
  { id: 'sch-53014553', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53014553', name: 'CEF 03 DE BRAZLANDIA', address: 'Brazlândia, DF', latitude: -15.6730, longitude: -48.2080, contact_phone: '(61) 3901-3426', contact_email: 'cef03.brazlandia@se.df.gov.br' },
  { id: 'sch-53005198', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005198', name: 'CEF INCRA 07', address: 'Incra 07, Brazlândia, DF', latitude: -15.7010, longitude: -48.2150, contact_phone: '(61) 3901-3427', contact_email: 'cef.incra07@se.df.gov.br' },
  { id: 'sch-53005015', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53005015', name: 'CEM 01 DE BRAZLANDIA', address: 'Brazlândia, DF', latitude: -15.6795, longitude: -48.2025, contact_phone: '(61) 3901-3428', contact_email: 'cem01.brazlandia@se.df.gov.br' },
  { id: 'sch-53012720', cre_id: 'cre-braz', cre_name: 'Brazlândia', inep: '53012720', name: 'CENTRO DE ENSINO MÉDIO 02 DE BRAZLÂNDIA', address: 'Brazlândia, DF', latitude: -15.6725, longitude: -48.2065, contact_phone: '(61) 3901-3429', contact_email: 'cem02.brazlandia@se.df.gov.br' },

  // Ceilândia
  { id: 'sch-53003012', cre_id: 'cre-ceil', cre_name: 'Ceilândia', inep: '53003012', name: 'CED 03 DE CEILÂNDIA', address: 'QNM 13, Ceilândia Norte, DF', latitude: -15.8115, longitude: -48.1120, contact_phone: '(61) 3901-6801', contact_email: 'ced03.ceilandia@se.df.gov.br' },
  { id: 'sch-53003045', cre_id: 'cre-ceil', cre_name: 'Ceilândia', inep: '53003045', name: 'CED 07 DE CEILÂNDIA', address: 'QNO 18, Ceilândia Norte, DF', latitude: -15.7980, longitude: -48.1250, contact_phone: '(61) 3901-6802', contact_email: 'ced07.ceilandia@se.df.gov.br' },
  { id: 'sch-53003080', cre_id: 'cre-ceil', cre_name: 'Ceilândia', inep: '53003080', name: 'CEM 02 DE CEILÂNDIA', address: 'QNP 05, P Sul, Ceilândia, DF', latitude: -15.8340, longitude: -48.1340, contact_phone: '(61) 3901-6803', contact_email: 'cem02.ceilandia@se.df.gov.br' },
  { id: 'sch-53003110', cre_id: 'cre-ceil', cre_name: 'Ceilândia', inep: '53003110', name: 'CEF 26 DE CEILÂNDIA', address: 'QNM 24, Ceilândia, DF', latitude: -15.8180, longitude: -48.1060, contact_phone: '(61) 3901-6804', contact_email: 'cef26.ceilandia@se.df.gov.br' },
  { id: 'sch-53003150', cre_id: 'cre-ceil', cre_name: 'Ceilândia', inep: '53003150', name: 'ESCOLA CLASSE 18 DE CEILÂNDIA', address: 'QNN 08, Ceilândia Sul, DF', latitude: -15.8250, longitude: -48.1080, contact_phone: '(61) 3901-6805', contact_email: 'ec18.ceilandia@se.df.gov.br' },

  // Plano Piloto
  { id: 'sch-53001010', cre_id: 'cre-ppil', cre_name: 'Plano Piloto', inep: '53001010', name: 'CENTRO EDUCACIONAL GISNO', address: 'SGAN 907, Asa Norte, Brasília, DF', latitude: -15.7660, longitude: -47.8920, contact_phone: '(61) 3901-2010', contact_email: 'ced.gisno@se.df.gov.br' },
  { id: 'sch-53001020', cre_id: 'cre-ppil', cre_name: 'Plano Piloto', inep: '53001020', name: 'CEM ELEFANTE BRANCO (CEMEB)', address: 'SGAS 908, Asa Sul, Brasília, DF', latitude: -15.8140, longitude: -47.9040, contact_phone: '(61) 3901-2020', contact_email: 'cem.elefante@se.df.gov.br' },
  { id: 'sch-53001030', cre_id: 'cre-ppil', cre_name: 'Plano Piloto', inep: '53001030', name: 'CED 01 DE BRASÍLIA', address: 'EQS 308/309, Asa Sul, Brasília, DF', latitude: -15.8070, longitude: -47.9010, contact_phone: '(61) 3901-2030', contact_email: 'ced01.brasilia@se.df.gov.br' },
  { id: 'sch-53001040', cre_id: 'cre-ppil', cre_name: 'Plano Piloto', inep: '53001040', name: 'CEF 04 DE BRASÍLIA', address: 'SHCGN 712/713, Asa Norte, Brasília, DF', latitude: -15.7530, longitude: -47.8960, contact_phone: '(61) 3901-2040', contact_email: 'cef04.brasilia@se.df.gov.br' },

  // Taguatinga
  { id: 'sch-53002010', cre_id: 'cre-tagu', cre_name: 'Taguatinga', inep: '53002010', name: 'CEM 01 DE TAGUATINGA', address: 'QSB 04/05, Taguatinga Sul, DF', latitude: -15.8390, longitude: -48.0580, contact_phone: '(61) 3901-4410', contact_email: 'cem01.taguatinga@se.df.gov.br' },
  { id: 'sch-53002020', cre_id: 'cre-tagu', cre_name: 'Taguatinga', inep: '53002020', name: 'CED 02 DE TAGUATINGA', address: 'QND 28, Taguatinga Norte, DF', latitude: -15.8210, longitude: -48.0670, contact_phone: '(61) 3901-4420', contact_email: 'ced02.taguatinga@se.df.gov.br' },
  { id: 'sch-53002030', cre_id: 'cre-tagu', cre_name: 'Taguatinga', inep: '53002030', name: 'CEF 08 DE TAGUATINGA', address: 'QSE 03, Taguatinga Sul, DF', latitude: -15.8480, longitude: -48.0520, contact_phone: '(61) 3901-4430', contact_email: 'cef08.taguatinga@se.df.gov.br' },

  // Paranoá & Itapoã
  { id: 'sch-53016378', cre_id: 'cre-pita', cre_name: 'Paranoá/Itapoã', inep: '53016378', name: 'CED 01 ITAPOĀ', address: 'Fazenda Tamanduá, Itapoã, DF', latitude: -15.7480, longitude: -47.7720, contact_phone: '(61) 3901-7710', contact_email: 'ced01.itapoa@se.df.gov.br' },
  { id: 'sch-53019601', cre_id: 'cre-pita', cre_name: 'Paranoá/Itapoã', inep: '53019601', name: 'CEF DOUTORA ZILDA ARNS', address: 'Quadra 378, Del Lago, Itapoã, DF', latitude: -15.7510, longitude: -47.7690, contact_phone: '(61) 3901-7720', contact_email: 'cef.zildaarns@se.df.gov.br' },
  { id: 'sch-53019431', cre_id: 'cre-para', cre_name: 'Paranoá', inep: '53019431', name: 'CED 02 DO PARANOA', address: 'Quadra 03 Área Especial, Paranoá, DF', latitude: -15.7720, longitude: -47.7810, contact_phone: '(61) 3901-7810', contact_email: 'ced02.paranoa@se.df.gov.br' },
  { id: 'sch-53006720', cre_id: 'cre-para', cre_name: 'Paranoá', inep: '53006720', name: 'CED DO PAD-DF', address: 'BR-251 Km 45, PAD-DF, Paranoá, DF', latitude: -15.9980, longitude: -47.5210, contact_phone: '(61) 3901-7820', contact_email: 'ced.paddf@se.df.gov.br' },

  // Recanto das Emas
  { id: 'sch-53011066', cre_id: 'cre-rema', cre_name: 'Recanto das Emas', inep: '53011066', name: 'CED 104 DO RECANTO DAS EMAS', address: 'Quadra 104, Recanto das Emas, DF', latitude: -15.9010, longitude: -48.0680, contact_phone: '(61) 3901-8810', contact_email: 'ced104.recanto@se.df.gov.br' },
  { id: 'sch-53020120', cre_id: 'cre-rema', cre_name: 'Recanto das Emas', inep: '53020120', name: 'CED 203 DO RECANTO DAS EMAS', address: 'Quadra 203, Recanto das Emas, DF', latitude: -15.9080, longitude: -48.0720, contact_phone: '(61) 3901-8820', contact_email: 'ced203.recanto@se.df.gov.br' },
  { id: 'sch-53012119', cre_id: 'cre-rema', cre_name: 'Recanto das Emas', inep: '53012119', name: 'CED 308 DO RECANTO DAS EMAS', address: 'Quadra 308, Recanto das Emas, DF', latitude: -15.9140, longitude: -48.0790, contact_phone: '(61) 3901-8830', contact_email: 'ced308.recanto@se.df.gov.br' },

  // Santa Maria
  { id: 'sch-53068181', cre_id: 'cre-smar', cre_name: 'Santa Maria', inep: '53068181', name: 'CED 310 DE SANTA MARIA', address: 'Quadra 310, Santa Maria, DF', latitude: -16.0120, longitude: -47.9890, contact_phone: '(61) 3901-9910', contact_email: 'ced310.santamaria@se.df.gov.br' },
  { id: 'sch-53002474', cre_id: 'cre-smar', cre_name: 'Santa Maria', inep: '53002474', name: 'CED GESNER TEIXEIRA', address: 'Quadra 100, Santa Maria, DF', latitude: -16.0210, longitude: -47.9810, contact_phone: '(61) 3901-9920', contact_email: 'ced.gesner@se.df.gov.br' },

  // Gama
  { id: 'sch-53004010', cre_id: 'cre-gama', cre_name: 'Gama', inep: '53004010', name: 'CEM 01 DO GAMA', address: 'Setor Sul, Gama, DF', latitude: -16.0240, longitude: -48.0580, contact_phone: '(61) 3901-5510', contact_email: 'cem01.gama@se.df.gov.br' },
  { id: 'sch-53004020', cre_id: 'cre-gama', cre_name: 'Gama', inep: '53004020', name: 'CED 03 DO GAMA', address: 'Setor Oeste, Gama, DF', latitude: -16.0180, longitude: -48.0690, contact_phone: '(61) 3901-5520', contact_email: 'ced03.gama@se.df.gov.br' },

  // Sobradinho
  { id: 'sch-53007010', cre_id: 'cre-sobr', cre_name: 'Sobradinho', inep: '53007010', name: 'CEM 01 DE SOBRADINHO', address: 'Quadra 04, Sobradinho, DF', latitude: -15.6540, longitude: -47.7890, contact_phone: '(61) 3901-3310', contact_email: 'cem01.sobradinho@se.df.gov.br' },
  { id: 'sch-53007020', cre_id: 'cre-sobr', cre_name: 'Sobradinho', inep: '53007020', name: 'CED 02 DE SOBRADINHO', address: 'Quadra 10, Sobradinho, DF', latitude: -15.6490, longitude: -47.7950, contact_phone: '(61) 3901-3320', contact_email: 'ced02.sobradinho@se.df.gov.br' },

  // Guará
  { id: 'sch-53008010', cre_id: 'cre-guar', cre_name: 'Guará', inep: '53008010', name: 'CED 01 DO GUARÁ', address: 'QE 07, Guará I, DF', latitude: -15.8230, longitude: -47.9780, contact_phone: '(61) 3901-2210', contact_email: 'ced01.guara@se.df.gov.br' }
];

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

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tkt-001',
    protocol: 'OS-2026-08412',
    tracking_token: 'tk_9f82a17cb40d',
    school_id: 'sch-53003012',
    school_name: 'CED 03 DE CEILÂNDIA',
    cre_name: 'Ceilândia',
    school_address: 'QNM 13, Ceilândia Norte, DF',
    category_id: 'cat-rede',
    category_name: 'Rede & Conectividade de Internet',
    requester_name: 'Prof.ª Valéria Santos',
    requester_role: 'Diretora Escolar',
    requester_phone: '(61) 98877-6655',
    title: 'Switch central do bloco pedagógico parou de operar',
    description: 'Toda a ala oeste do CED 03 está sem conexão cabeada e sem sinal dos roteadores Wi-Fi. Luz de alimentação piscando em laranja intermitente.',
    equipment_patrimony: 'PAT-SEEDF-2019-94812',
    urgency_level: 'alta',
    status: 'despachado',
    assigned_technician_id: 'tech-marcos',
    assigned_technician_name: 'Marcos Vinícius Silveira',
    dispatch_attempts: 1,
    dispatch_timeout_at: new Date(Date.now() + 14 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    attachments: [
      {
        id: 'att-01',
        ticket_id: 'tkt-001',
        phase: 'abertura',
        file_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80',
        file_name: 'rack_switch_danificado.webp',
        file_size_bytes: 42100,
        created_at: new Date(Date.now() - 44 * 60 * 1000).toISOString()
      }
    ],
    dispatch_logs: [
      {
        id: 'log-01',
        ticket_id: 'tkt-001',
        technician_id: 'tech-marcos',
        technician_name: 'Marcos Vinícius Silveira',
        status: 'notificado',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: 'tkt-002',
    protocol: 'OS-2026-08398',
    tracking_token: 'tk_3c71b90aa15e',
    school_id: 'sch-53001010',
    school_name: 'CENTRO EDUCACIONAL GISNO',
    cre_name: 'Plano Piloto',
    school_address: 'SGAN 907, Asa Norte, Brasília, DF',
    category_id: 'cat-lab',
    category_name: 'Laboratório de Informática / Computadores',
    requester_name: 'Marcio Fontes',
    requester_role: 'Chefe de Secretaria',
    requester_phone: '(61) 98112-9900',
    title: 'Falha na fonte de alimentação de 5 computadores do Lab 2',
    description: 'Após oscilação elétrica no final de semana, 5 máquinas não inicializam. Necessário diagnóstico e eventual substituição de fontes ATX.',
    equipment_patrimony: 'LOTE-LAB2-GISNO',
    urgency_level: 'media',
    status: 'aguardando_orcamento',
    assigned_technician_id: 'tech-rafael',
    assigned_technician_name: 'Rafael Souza Ferreira',
    dispatch_attempts: 1,
    arrived_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    arrival_lat: -15.7661,
    arrival_lng: -47.8922,
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    attachments: [],
    dispatch_logs: [],
    quote: {
      id: 'qt-2001',
      ticket_id: 'tkt-002',
      technician_id: 'tech-rafael',
      technician_name: 'Rafael Souza Ferreira',
      total_amount: 1450.00,
      technical_diagnosis: 'Constatado curto nos capacitores de entrada primária de 5 fontes ATX 500W devido a sobretensão. Placas-mãe e processadores intactos.',
      status: 'pendente',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      items: [
        {
          id: 'qi-01',
          quote_id: 'qt-2001',
          item_type: 'peca',
          item_name: 'Fonte ATX 500W 80 Plus Bronze PFC Ativo (Unid.)',
          quantity: 5,
          unit_price: 230.00,
          subtotal: 1150.00
        },
        {
          id: 'qi-02',
          quote_id: 'qt-2001',
          item_type: 'servico',
          item_name: 'Substituição, limpeza técnica e teste de estresse de 5 máquinas',
          quantity: 1,
          unit_price: 300.00,
          subtotal: 300.00
        }
      ]
    }
  },
  {
    id: 'tkt-003',
    protocol: 'OS-2026-08340',
    tracking_token: 'tk_81e4d092f33c',
    school_id: 'sch-53005023',
    school_name: 'CED 02 DE BRAZLÂNDIA',
    cre_name: 'Brazlândia',
    school_address: 'Quadra 02, Brazlândia, DF',
    category_id: 'cat-proj',
    category_name: 'Projetores & Telas Interativas',
    requester_name: 'Aline Rezende',
    requester_role: 'Coordenadora Pedagógica',
    requester_phone: '(61) 98765-4321',
    title: 'Projetor multimídia do auditório com imagem sem foco e lâmpada superaquecendo',
    description: 'O equipamento desliga com 10 minutos de uso emitindo alerta sonoro de alta temperatura no sensor do filtro de ar.',
    equipment_patrimony: 'PAT-PROJ-8812',
    urgency_level: 'baixa',
    status: 'concluido',
    assigned_technician_id: 'tech-carlos',
    assigned_technician_name: 'Carlos Alberto Mendes',
    dispatch_attempts: 1,
    arrived_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    attachments: [],
    dispatch_logs: [],
    completion: {
      id: 'cmp-01',
      ticket_id: 'tkt-003',
      technician_id: 'tech-carlos',
      technician_name: 'Carlos Alberto Mendes',
      service_summary: 'Realizada desmontagem do conjunto óptico, desobstrução dos dutos de ventilação, troca do filtro de ar lavável e aplicação de pasta térmica no sensor térmico. Testado continuamente por 45 minutos em temperatura operacional nominal.',
      school_representative_name: 'Aline Rezende',
      school_representative_doc: 'Matrícula SEEDF 241.982-1',
      signature_svg: 'M 10 50 Q 50 10 90 50 T 170 50',
      completed_at: new Date(Date.now() - 22 * 3600 * 1000).toISOString()
    }
  }
];
