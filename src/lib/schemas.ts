import { z } from 'zod';

export const ticketSubmissionSchema = z.object({
  school_id: z.string().min(1, 'Selecione a Unidade Escolar do DF'),
  category_id: z.string().min(1, 'Selecione a categoria técnica do defeito'),
  requester_name: z
    .string()
    .min(3, 'Nome do solicitante deve ter pelo menos 3 caracteres')
    .max(150, 'Nome muito longo'),
  requester_role: z.string().min(2, 'Informe seu cargo na escola (ex: Diretor, Vice-diretor, Secretário)'),
  requester_phone: z
    .string()
    .min(10, 'Informe um telefone de contato válido com DDD (WhatsApp)'),
  title: z
    .string()
    .min(5, 'Título resumido deve ter pelo menos 5 caracteres')
    .max(120, 'Título muito extenso'),
  description: z
    .string()
    .min(15, 'Descreva detalhadamente o problema técnico enfrentado (mínimo 15 caracteres)'),
  equipment_patrimony: z.string().optional(),
  urgency_level: z.enum(['baixa', 'media', 'alta', 'critica'])
});

export type TicketSubmissionData = z.infer<typeof ticketSubmissionSchema>;

export const quoteItemSchema = z.object({
  item_type: z.enum(['peca', 'servico']),
  item_name: z.string().min(3, 'Nome do item ou serviço é obrigatório'),
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  unit_price: z.number().positive('Preço unitário deve ser maior que zero')
});

export const quoteSubmissionSchema = z.object({
  technical_diagnosis: z
    .string()
    .min(15, 'O laudo e diagnóstico técnico preliminar deve conter ao menos 15 caracteres'),
  items: z.array(quoteItemSchema).min(1, 'Insira ao menos um item ou serviço no orçamento')
});

export type QuoteSubmissionData = z.infer<typeof quoteSubmissionSchema>;

export const ticketCompletionSchema = z.object({
  service_summary: z
    .string()
    .min(15, 'Descreva o serviço técnico efetivamente executado'),
  school_representative_name: z
    .string()
    .min(3, 'Nome completo do gestor escolar que conferiu o serviço'),
  school_representative_doc: z
    .string()
    .min(5, 'Informe a Matrícula SEEDF ou CPF do responsável escolar'),
  signature_svg: z
    .string()
    .min(10, 'A assinatura digital na tela é obrigatória para encerramento da OS')
});

export type TicketCompletionData = z.infer<typeof ticketCompletionSchema>;
