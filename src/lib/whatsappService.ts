/**
 * Módulo de Integração WhatsApp Business API - HelpTech Informática
 * Suporte a:
 *  - Meta WhatsApp Cloud API (Oficial)
 *  - Z-API Gateway
 *  - Evolution API (Open Source)
 *  - Modo Simulado / Fallback Contingencial
 */

import type { Ticket, Technician } from '../data/seedData';

export type WhatsAppProvider = 'meta_cloud' | 'z_api' | 'evolution' | 'simulated';

export interface WhatsAppConfig {
  provider: WhatsAppProvider;
  enabled: boolean;
  autoDispatch: boolean;
  autoQuote: boolean;
  autoCompletion: boolean;
  // Meta Cloud API
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  // Z-API ou Evolution API
  apiUrl?: string;
  apiToken?: string;
  instanceId?: string;
  // Fallback quando a API falhar
  openWaMeOnFailure: boolean;
}

export interface WhatsAppLogEntry {
  id: string;
  timestamp: string;
  phone: string;
  recipientName: string;
  eventType: 'despacho' | 'orcamento' | 'orcamento_aprovado' | 'conclusao' | 'sla_alerta' | 'teste' | 'avulso';
  ticketProtocol?: string;
  status: 'enviado' | 'falha' | 'simulado';
  message: string;
  responsePayload?: string;
}

const STORAGE_KEY_CONFIG = 'helptech_whatsapp_config_v1';
const STORAGE_KEY_LOGS = 'helptech_whatsapp_logs_v1';

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  provider: 'simulated',
  enabled: true,
  autoDispatch: true,
  autoQuote: true,
  autoCompletion: true,
  apiUrl: '',
  apiToken: '',
  instanceId: '',
  metaPhoneNumberId: '',
  metaAccessToken: '',
  openWaMeOnFailure: true
};

/**
 * Carrega a configuração ativa do WhatsApp (do localStorage ou variáveis de ambiente)
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      return { ...DEFAULT_WHATSAPP_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Falha ao ler configuração WhatsApp:', err);
  }

  // Fallback para variáveis de ambiente Vite caso existam
  const envProvider = (import.meta.env.VITE_WHATSAPP_PROVIDER as WhatsAppProvider) || 'simulated';
  return {
    ...DEFAULT_WHATSAPP_CONFIG,
    provider: envProvider,
    apiUrl: import.meta.env.VITE_WHATSAPP_API_URL || '',
    apiToken: import.meta.env.VITE_WHATSAPP_API_TOKEN || '',
    instanceId: import.meta.env.VITE_WHATSAPP_INSTANCE_ID || '',
    metaPhoneNumberId: import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || '',
    metaAccessToken: import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || ''
  };
}

/**
 * Salva a configuração atualizada do WhatsApp
 */
export function saveWhatsAppConfig(config: WhatsAppConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Falha ao persistir configuração WhatsApp:', err);
  }
}

/**
 * Lê os logs dos últimos disparos realizados
 */
export function getWhatsAppLogs(): WhatsAppLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Falha ao ler logs de WhatsApp:', err);
  }
  return [];
}

/**
 * Adiciona um registro ao histórico de disparos
 */
function recordWhatsAppLog(entry: Omit<WhatsAppLogEntry, 'id' | 'timestamp'>) {
  try {
    const logs = getWhatsAppLogs();
    const newEntry: WhatsAppLogEntry = {
      ...entry,
      id: `wlg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    const updated = [newEntry, ...logs].slice(0, 50); // Mantém os 50 mais recentes
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Erro ao gravar log do WhatsApp:', err);
  }
}

/**
 * Sanitiza e formata número no padrão E.164 internacional (+55...)
 */
export function formatToWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Se já começar com 55 e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // DDD (2 dígitos) + 8 ou 9 dígitos -> adiciona 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Envia mensagem através do provedor selecionado
 */
export async function sendWhatsAppMessage(params: {
  phone: string;
  recipientName: string;
  message: string;
  eventType: WhatsAppLogEntry['eventType'];
  ticketProtocol?: string;
}): Promise<{ success: boolean; message: string; fallbackTriggered?: boolean }> {
  const config = getWhatsAppConfig();
  const rawPhone = params.phone;
  const cleanPhone = formatToWhatsAppNumber(rawPhone);

  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, message: 'Telefone inválido ou incompleto para envio de WhatsApp.' };
  }

  // Se estiver desabilitado ou no modo simulado
  if (!config.enabled || config.provider === 'simulated' || (!config.apiToken && !config.metaAccessToken)) {
    console.info(`[WhatsApp Simulado] Disparo para ${cleanPhone} (${params.recipientName}):\n${params.message}`);
    recordWhatsAppLog({
      phone: cleanPhone,
      recipientName: params.recipientName,
      eventType: params.eventType,
      ticketProtocol: params.ticketProtocol,
      status: 'simulado',
      message: params.message,
      responsePayload: 'Enviado no Modo Simulado (API em espera ou credenciais locais)'
    });
    return { success: true, message: 'Mensagem registrada com sucesso no Modo Simulado.' };
  }

  try {
    // 1. Meta WhatsApp Cloud API Oficial
    if (config.provider === 'meta_cloud') {
      const phoneNumberId = config.metaPhoneNumberId;
      const token = config.metaAccessToken;

      if (!phoneNumberId || !token) {
        throw new Error('Meta Cloud API: Phone Number ID ou Access Token ausente nas configurações.');
      }

      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: params.message }
        })
      });

      const responseJson = await res.json();
      if (!res.ok) {
        throw new Error(responseJson?.error?.message || `HTTP ${res.status}`);
      }

      recordWhatsAppLog({
        phone: cleanPhone,
        recipientName: params.recipientName,
        eventType: params.eventType,
        ticketProtocol: params.ticketProtocol,
        status: 'enviado',
        message: params.message,
        responsePayload: JSON.stringify(responseJson)
      });

      return { success: true, message: 'Mensagem enviada com sucesso via Meta Cloud API.' };
    }

    // 2. Z-API Gateway
    if (config.provider === 'z_api') {
      const baseUrl = config.apiUrl?.replace(/\/$/, '') || 'https://api.z-api.io';
      const instance = config.instanceId;
      const token = config.apiToken;

      if (!instance || !token) {
        throw new Error('Z-API: ID da Instância ou Token ausente.');
      }

      const url = `${baseUrl}/instances/${instance}/token/${token}/send-text`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          message: params.message
        })
      });

      const responseJson = await res.json();
      if (!res.ok) {
        throw new Error(responseJson?.message || `HTTP ${res.status}`);
      }

      recordWhatsAppLog({
        phone: cleanPhone,
        recipientName: params.recipientName,
        eventType: params.eventType,
        ticketProtocol: params.ticketProtocol,
        status: 'enviado',
        message: params.message,
        responsePayload: JSON.stringify(responseJson)
      });

      return { success: true, message: 'Mensagem enviada com sucesso via Z-API.' };
    }

    // 3. Evolution API (Open Source)
    if (config.provider === 'evolution') {
      const baseUrl = config.apiUrl?.replace(/\/$/, '');
      const instance = config.instanceId;
      const token = config.apiToken;

      if (!baseUrl || !instance || !token) {
        throw new Error('Evolution API: URL base, Instância ou API Key ausente.');
      }

      const url = `${baseUrl}/message/sendText/${instance}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          number: cleanPhone,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: params.message }
        })
      });

      const responseJson = await res.json();
      if (!res.ok) {
        throw new Error(responseJson?.message || `HTTP ${res.status}`);
      }

      recordWhatsAppLog({
        phone: cleanPhone,
        recipientName: params.recipientName,
        eventType: params.eventType,
        ticketProtocol: params.ticketProtocol,
        status: 'enviado',
        message: params.message,
        responsePayload: JSON.stringify(responseJson)
      });

      return { success: true, message: 'Mensagem enviada com sucesso via Evolution API.' };
    }

    throw new Error('Provedor de WhatsApp não suportado.');
  } catch (err: any) {
    const errorMsg = err?.message || 'Falha desconhecida no envio da mensagem.';
    console.warn(`[WhatsApp API Error] ${errorMsg}`);

    recordWhatsAppLog({
      phone: cleanPhone,
      recipientName: params.recipientName,
      eventType: params.eventType,
      ticketProtocol: params.ticketProtocol,
      status: 'falha',
      message: params.message,
      responsePayload: `Erro: ${errorMsg}`
    });

    // Se configurado fallback wa.me e for disparo direto pelo navegador
    if (config.openWaMeOnFailure) {
      try {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(params.message)}`, '_blank');
        return {
          success: false,
          fallbackTriggered: true,
          message: `API offline. Contingência ativada: link wa.me aberto no navegador. (${errorMsg})`
        };
      } catch {
        // ignora
      }
    }

    return { success: false, message: `Falha no envio via API: ${errorMsg}` };
  }
}

/**
 * =========================================================================
 * TEMPLATES FORMATADOS AUTOMÁTICOS DO CICLO DE ATENDIMENTO
 * =========================================================================
 */

/**
 * 1. Notificação de Atribuição e Despacho de Chamado para o Técnico
 */
export async function notifyTechnicianDispatch(ticket: Ticket, tech: Technician) {
  const mapsQuery = encodeURIComponent(`${ticket.school_name}, ${ticket.school_address || 'Brasília DF'}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const message = [
    `🔔 *NOVA ORDEM DE SERVIÇO ATRIBUÍDA — HELPTECH*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Protocolo:* ${ticket.protocol}`,
    `🏫 *Unidade Escolar:* ${ticket.school_name}`,
    `📍 *CRE Regional:* ${ticket.cre_name}`,
    `⚡ *Urgência:* ${ticket.urgency_level.toUpperCase()}`,
    `⚠️ *Defeito Relatado:* ${ticket.title}`,
    `📝 *Descrição:* ${ticket.description}`,
    `👤 *Solicitante:* ${ticket.requester_name} (${ticket.requester_role})`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧭 *Navegação GPS (Google Maps):*`,
    `${mapsUrl}`,
    ``,
    `📲 *Acesse o PWA de Campo para aceitar:*`,
    `https://helptech-escolas-df.vercel.app/?view=tecnico`
  ].join('\n');

  return sendWhatsAppMessage({
    phone: tech.phone,
    recipientName: tech.name,
    eventType: 'despacho',
    ticketProtocol: ticket.protocol,
    message
  });
}

/**
 * 2. Notificação para a Escola: Técnico a Caminho
 */
export async function notifySchoolTechEnRoute(ticket: Ticket, tech: Technician) {
  const contactPhone = ticket.requester_phone || '';
  if (!contactPhone) return;

  const message = [
    `🚗 *TÉCNICO A CAMINHO — HELPTECH INFORMÁTICA*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Prezada equipe da unidade *${ticket.school_name}*,`,
    ``,
    `Informamos que o técnico *${tech.name}* acaba de ser despachado e está em deslocamento até sua unidade para o atendimento da OS:`,
    ``,
    `📋 *Protocolo:* ${ticket.protocol}`,
    `⚠️ *Problema:* ${ticket.title}`,
    `👷 *Técnico Credenciado:* ${tech.name}`,
    `📞 *Contato Técnico:* ${tech.phone}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Por favor, garanta o acesso do técnico à sala/equipamento quando ele chegar.`
  ].join('\n');

  return sendWhatsAppMessage({
    phone: contactPhone,
    recipientName: ticket.requester_name || ticket.school_name,
    eventType: 'despacho',
    ticketProtocol: ticket.protocol,
    message
  });
}

/**
 * 3. Envio de Orçamento para Aprovação da Direção Escolar
 */
export async function notifySchoolQuoteSubmission(ticket: Ticket) {
  const contactPhone = ticket.requester_phone;
  if (!contactPhone || !ticket.quote) return;

  const quote = ticket.quote;
  const itemsText = quote.items
    .map((it, idx) => `  ${idx + 1}. ${it.item_name} (${it.quantity}x) — R$ ${it.subtotal.toFixed(2).replace('.', ',')}`)
    .join('\n');

  const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total_amount);

  const message = [
    `📄 *ORÇAMENTO DE PEÇAS & SERVIÇOS — HELPTECH*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Olá, *${ticket.requester_name}* (*${ticket.school_name}*),`,
    ``,
    `O técnico concluiu o diagnóstico no local referente à OS *${ticket.protocol}*.`,
    ``,
    `🔍 *Laudo Técnico:*`,
    `"${quote.technical_diagnosis}"`,
    ``,
    `📦 *Itens do Orçamento:*`,
    itemsText,
    ``,
    `💰 *VALOR TOTAL HOMOLOGADO:* *${formattedTotal}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📲 Para autorizar ou registrar parecer, responda a esta mensagem ou visualize a OS online:`
  ].join('\n');

  return sendWhatsAppMessage({
    phone: contactPhone,
    recipientName: ticket.requester_name || ticket.school_name,
    eventType: 'orcamento',
    ticketProtocol: ticket.protocol,
    message
  });
}

/**
 * 4. Notificação de OS Concluída com Termo Assinado e Link de CSAT
 */
export async function notifySchoolCompletion(ticket: Ticket) {
  const contactPhone = ticket.requester_phone;
  if (!contactPhone) return;

  const csatUrl = `https://helptech-escolas-df.vercel.app/?token=${ticket.tracking_token || ticket.protocol}#csat`;

  const message = [
    `✅ *ORDEM DE SERVIÇO CONCLUÍDA — HELPTECH*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Prezada direção do *${ticket.school_name}*,`,
    ``,
    `O atendimento técnico da OS *${ticket.protocol}* foi finalizado com sucesso e o Termo de Conformidade já se encontra assinado.`,
    ``,
    `📋 *Protocolo:* ${ticket.protocol}`,
    `👷 *Técnico:* ${ticket.assigned_technician_name || 'HelpTech Field Service'}`,
    `📝 *Serviço Realizado:* ${ticket.completion?.service_summary || ticket.title}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `⭐ *PESQUISA DE SATISFAÇÃO (CSAT):*`,
    `Sua opinião é fundamental para a qualidade dos nossos serviços. Por favor, avalie o atendimento no link abaixo:`,
    `${csatUrl}`,
    ``,
    `Agradecemos pela parceria!`
  ].join('\n');

  return sendWhatsAppMessage({
    phone: contactPhone,
    recipientName: ticket.requester_name || ticket.school_name,
    eventType: 'conclusao',
    ticketProtocol: ticket.protocol,
    message
  });
}

/**
 * 5. Teste de Conexão com o Gateway
 */
export async function testWhatsAppGatewayConnection(
  targetPhone: string,
  config: WhatsAppConfig
): Promise<{ success: boolean; message: string }> {
  const cleanPhone = formatToWhatsAppNumber(targetPhone);
  if (!cleanPhone) {
    return { success: false, message: 'Digite um número de WhatsApp válido para o teste.' };
  }

  const testMessage = `🧪 *HELPTECH INFORMÁTICA — TESTE DE INTEGRAÇÃO*\n\nConexão com a WhatsApp Business API configurada com sucesso!\n\nProvedor: ${config.provider.toUpperCase()}\nHorário: ${new Date().toLocaleTimeString('pt-BR')}`;

  // Salva temporariamente a config para teste
  saveWhatsAppConfig(config);

  return sendWhatsAppMessage({
    phone: cleanPhone,
    recipientName: 'Teste de Integração',
    eventType: 'teste',
    message: testMessage
  });
}
