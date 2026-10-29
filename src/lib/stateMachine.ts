import type { Ticket, TicketCompletion } from '../data/seedData';
import { ticketCompletionSchema, quoteSubmissionSchema } from './schemas';
import type { QuoteSubmissionData } from './schemas';

export type TicketStatus = Ticket['status'];

/**
 * Matriz canônica de transições permitidas (Máquina de Estados Finita - FSM)
 */
export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  aberto: ['despachado', 'cancelado'],
  despachado: ['em_deslocamento', 'despachado', 'aberto', 'visita_agendada', 'cancelado'],
  em_deslocamento: ['em_atendimento', 'visita_agendada', 'cancelado'],
  visita_agendada: ['em_deslocamento', 'em_atendimento', 'cancelado'],
  em_atendimento: [
    'aguardando_orcamento',
    'aguardando_peca',
    'aguardando_terceiro',
    'visita_agendada',
    'concluido',
    'cancelado'
  ],
  aguardando_orcamento: ['aguardando_peca', 'em_atendimento', 'cancelado'],
  aguardando_peca: ['em_atendimento', 'visita_agendada', 'cancelado'],
  aguardando_terceiro: ['em_atendimento', 'visita_agendada', 'cancelado'],
  concluido: [], // Estado terminal imutável
  cancelado: []  // Estado terminal imutável
};

/**
 * Catálogo canônico dos 7 status operacionais de campo que consom capacidade do técnico
 */
export const ACTIVE_WORKLOAD_STATUSES: TicketStatus[] = [
  'despachado',
  'visita_agendada',
  'em_deslocamento',
  'em_atendimento',
  'aguardando_orcamento',
  'aguardando_peca',
  'aguardando_terceiro'
];

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
}

export interface TransitionContext {
  refusalReason?: string;
  cancelReason?: string;
  quoteDecision?: { approved: boolean; reason?: string };
  quoteData?: QuoteSubmissionData;
  completionData?: Partial<TicketCompletion>;
  arrivalCoordinates?: { lat: number; lng: number };
}

/**
 * Verifica se a transição entre dois estados é teoricamente permitida pela FSM
 */
export function isAllowedTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true; // Idempotência de estado
  const allowed = VALID_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Valida a transição de estado completa, verificando tanto a FSM quanto os requisitos de payload
 */
export function validateStateTransition(
  from: TicketStatus,
  to: TicketStatus,
  context?: TransitionContext
): TransitionValidationResult {
  // 1. Estados terminais não podem ser reabertos ou alterados
  if (from === 'concluido' || from === 'cancelado') {
    return {
      valid: false,
      error: `Transição inválida: o chamado já se encontra no estado terminal '${from}' e não pode ser alterado.`
    };
  }

  // 2. Transição deve ser permitida na matriz
  if (!isAllowedTransition(from, to)) {
    return {
      valid: false,
      error: `Transição ilegal: não é permitido transicionar de '${from}' para '${to}'.`
    };
  }

  // 3. Regras de negócio por estado de destino
  if (to === 'cancelado' && from === 'aguardando_orcamento') {
    if (!context?.cancelReason && !context?.quoteDecision?.reason) {
      return {
        valid: false,
        error: 'Cancelamento por recusa de orçamento exige justificativa obrigatória.'
      };
    }
  }

  if (to === 'em_atendimento' && context?.arrivalCoordinates) {
    const { lat, lng } = context.arrivalCoordinates;
    if (lat === 0 && lng === 0) {
      return {
        valid: false,
        error: 'Check-in exige coordenadas GPS válidas para cálculo de proximidade.'
      };
    }
  }

  if (to === 'aguardando_orcamento' && context?.quoteData) {
    const parse = quoteSubmissionSchema.safeParse(context.quoteData);
    if (!parse.success) {
      return {
        valid: false,
        error: parse.error.issues[0]?.message || 'Dados do orçamento incompletos ou inválidos.'
      };
    }
  }

  if (to === 'concluido') {
    if (!context?.completionData) {
      return {
        valid: false,
        error: 'Conclusão do chamado exige os dados da Ordem de Serviço e assinatura do responsável.'
      };
    }

    const parse = ticketCompletionSchema.safeParse({
      service_summary: context.completionData.service_summary || '',
      school_representative_name: context.completionData.school_representative_name || '',
      school_representative_doc: context.completionData.school_representative_doc || '',
      signature_svg: context.completionData.signature_svg || ''
    });

    if (!parse.success) {
      return {
        valid: false,
        error: parse.error.issues[0]?.message || 'Validação de conclusão falhou.'
      };
    }
  }

  return { valid: true };
}
