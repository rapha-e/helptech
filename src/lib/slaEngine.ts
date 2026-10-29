import type { Ticket, TicketCategory, RegionalCoordination, Technician } from '../data/seedData';

export interface TicketSlaStatus {
  ticketId: string;
  protocol: string;
  elapsedHours: number;
  resolutionTargetHours: number;
  hoursRemaining: number;
  status: 'cumprido' | 'no_prazo' | 'em_risco' | 'estourado';
  badgeColor: string;
  label: string;
}

export interface SlaExecutiveMetrics {
  totalTickets: number;
  completedTickets: number;
  slaComplianceRate: number; // Porcentagem (0 a 100)
  onTrackCount: number;
  atRiskCount: number;
  breachedCount: number;
  averageResolutionHours: number;
  creDistribution: { creName: string; count: number; percentage: number }[];
  technicianPerformance: {
    techId: string;
    techName: string;
    completedCount: number;
    activeCount: number;
    avgHours: number;
  }[];
}

/**
 * Calcula o SLA individual de um chamado
 */
export function calculateTicketSla(
  ticket: Ticket,
  category?: TicketCategory
): TicketSlaStatus {
  const targetHours = category?.sla_resolution_hours || 48;
  const createdTime = new Date(ticket.created_at).getTime();
  const endTime = ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : Date.now();

  const elapsedMs = Math.max(0, endTime - createdTime);
  const elapsedHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10;
  const hoursRemaining = Math.round((targetHours - elapsedHours) * 10) / 10;

  if (ticket.status === 'concluido') {
    const isCompliant = elapsedHours <= targetHours;
    return {
      ticketId: ticket.id,
      protocol: ticket.protocol,
      elapsedHours,
      resolutionTargetHours: targetHours,
      hoursRemaining: 0,
      status: isCompliant ? 'cumprido' : 'estourado',
      badgeColor: isCompliant ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300',
      label: isCompliant ? 'SLA Cumprido' : 'Concluído Fora do SLA'
    };
  }

  if (ticket.status === 'cancelado') {
    return {
      ticketId: ticket.id,
      protocol: ticket.protocol,
      elapsedHours,
      resolutionTargetHours: targetHours,
      hoursRemaining: 0,
      status: 'no_prazo',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      label: 'Cancelado'
    };
  }

  // Chamados em andamento
  if (hoursRemaining < 0) {
    return {
      ticketId: ticket.id,
      protocol: ticket.protocol,
      elapsedHours,
      resolutionTargetHours: targetHours,
      hoursRemaining,
      status: 'estourado',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      label: `SLA Estourado (+${Math.abs(hoursRemaining)}h)`
    };
  }

  if (hoursRemaining <= 8) {
    return {
      ticketId: ticket.id,
      protocol: ticket.protocol,
      elapsedHours,
      resolutionTargetHours: targetHours,
      hoursRemaining,
      status: 'em_risco',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      label: `Em Risco (${hoursRemaining}h restantes)`
    };
  }

  return {
    ticketId: ticket.id,
    protocol: ticket.protocol,
    elapsedHours,
    resolutionTargetHours: targetHours,
    hoursRemaining,
    status: 'no_prazo',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    label: `No Prazo (${hoursRemaining}h)`
  };
}

/**
 * Compila o relatório executivo de governança e SLAs
 */
export function calculateSlaReport(
  tickets: Ticket[],
  regions: RegionalCoordination[],
  technicians: Technician[]
): SlaExecutiveMetrics {
  const total = tickets.length;
  if (total === 0) {
    return {
      totalTickets: 0,
      completedTickets: 0,
      slaComplianceRate: 100,
      onTrackCount: 0,
      atRiskCount: 0,
      breachedCount: 0,
      averageResolutionHours: 0,
      creDistribution: [],
      technicianPerformance: []
    };
  }

  let onTrack = 0;
  let atRisk = 0;
  let breached = 0;
  let completed = 0;
  let completedCompliant = 0;
  let totalResolutionHours = 0;

  for (const t of tickets) {
    const sla = calculateTicketSla(t);
    if (t.status === 'concluido') {
      completed++;
      totalResolutionHours += sla.elapsedHours;
      if (sla.status === 'cumprido') {
        completedCompliant++;
      }
    } else if (t.status !== 'cancelado') {
      if (sla.status === 'no_prazo') onTrack++;
      else if (sla.status === 'em_risco') atRisk++;
      else if (sla.status === 'estourado') breached++;
    }
  }

  const complianceRate =
    completed > 0 ? Math.round((completedCompliant / completed) * 1000) / 10 : 100;

  const avgHours =
    completed > 0 ? Math.round((totalResolutionHours / completed) * 10) / 10 : 0;

  // Distribuição por CRE
  const creCounts = new Map<string, number>();
  for (const reg of regions) {
    creCounts.set(reg.name, 0);
  }
  for (const t of tickets) {
    const cre = t.cre_name || 'Geral';
    creCounts.set(cre, (creCounts.get(cre) || 0) + 1);
  }

  const creDistribution = Array.from(creCounts.entries())
    .map(([creName, count]) => ({
      creName,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Desempenho dos Técnicos
  const techPerformance = technicians.map((tech) => {
    const techTickets = tickets.filter((t) => t.assigned_technician_id === tech.id);
    const techCompleted = techTickets.filter((t) => t.status === 'concluido');
    const techActive = techTickets.filter(
      (t) => !['concluido', 'cancelado'].includes(t.status)
    ).length;

    const techHours = techCompleted.reduce(
      (acc, curr) => acc + calculateTicketSla(curr).elapsedHours,
      0
    );
    const avgTechHours =
      techCompleted.length > 0
        ? Math.round((techHours / techCompleted.length) * 10) / 10
        : 0;

    return {
      techId: tech.id,
      techName: tech.name,
      completedCount: techCompleted.length,
      activeCount: techActive,
      avgHours: avgTechHours
    };
  });

  return {
    totalTickets: total,
    completedTickets: completed,
    slaComplianceRate: complianceRate,
    onTrackCount: onTrack,
    atRiskCount: atRisk,
    breachedCount: breached,
    averageResolutionHours: avgHours,
    creDistribution,
    technicianPerformance: techPerformance
  };
}

/**
 * Gera arquivo CSV com os dados operacionais completos para auditoria da SEEDF
 */
export function exportOperationalReportCsv(tickets: Ticket[]): string {
  const headers = [
    'Protocolo',
    'Escola',
    'CRE',
    'Categoria',
    'Urgencia',
    'Status',
    'Tecnico',
    'Solicitante',
    'Telefone',
    'CriadoEm',
    'SLA_Status',
    'HorasDecorridas',
    'ValorOrcamento'
  ];

  const rows = tickets.map((t) => {
    const sla = calculateTicketSla(t);
    const budget = t.quote ? t.quote.total_amount.toFixed(2) : '0.00';
    return [
      t.protocol,
      `"${t.school_name.replace(/"/g, '""')}"`,
      `"${t.cre_name}"`,
      `"${t.category_name}"`,
      t.urgency_level,
      t.status,
      `"${t.assigned_technician_name || 'Nao atribuido'}"`,
      `"${t.requester_name.replace(/"/g, '""')}"`,
      t.requester_phone,
      t.created_at,
      sla.label,
      sla.elapsedHours,
      budget
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

