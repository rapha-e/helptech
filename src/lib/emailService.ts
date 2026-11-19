/**
 * Serviço de Notificações por E-mail - HelpTech Informática
 * Dispara automaticamente e-mails a cada nova solicitação para:
 *   1. Central de Suporte HelpTech (helptechinfoinformatica@gmail.com)
 *   2. E-mail do Solicitante / Escola
 *   3. E-mail do Técnico Designado
 */

import type { Ticket, Technician } from '../data/seedData';

export const HELPTECH_CENTRAL_EMAIL = 'helptechinfoinformatica@gmail.com';

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  recipients: string[];
  subject: string;
  ticketProtocol: string;
  status: 'enviado' | 'simulado' | 'falha';
  provider: string;
  messageId?: string;
  error?: string;
}

const STORAGE_KEY_EMAIL_CONFIG = 'helptech_email_config_v1';
const STORAGE_KEY_EMAIL_LOGS = 'helptech_email_logs_v1';

export interface EmailConfig {
  enabled: boolean;
  provider: 'resend' | 'webhook' | 'simulated';
  resendApiKey?: string;
  fromEmail: string;
  webhookUrl?: string;
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: true,
  provider: (import.meta.env.VITE_EMAIL_PROVIDER as any) || 'simulated',
  resendApiKey: import.meta.env.VITE_RESEND_API_KEY || '',
  fromEmail: import.meta.env.VITE_FROM_EMAIL || 'HelpTech Suporte <suporte@helptech.com.br>',
  webhookUrl: import.meta.env.VITE_EMAIL_WEBHOOK_URL || ''
};

export function getEmailConfig(): EmailConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_CONFIG);
    if (raw) {
      return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Falha ao ler configuração de e-mail:', err);
  }
  return DEFAULT_EMAIL_CONFIG;
}

export function saveEmailConfig(config: EmailConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_EMAIL_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Falha ao salvar configuração de e-mail:', err);
  }
}

export function getEmailLogs(): EmailLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Falha ao ler logs de e-mail:', err);
  }
  return [];
}

function recordEmailLog(entry: Omit<EmailLogEntry, 'id' | 'timestamp'>) {
  try {
    const logs = getEmailLogs();
    const newEntry: EmailLogEntry = {
      ...entry,
      id: `eml-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    const updated = [newEntry, ...logs].slice(0, 50);
    localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Erro ao gravar log de e-mail:', err);
  }
}

/**
 * Gera o template HTML profissional do e-mail de nova solicitação
 */
export function generateNewTicketEmailHtml(params: {
  ticket: Ticket;
  tech?: Technician | null;
  requesterEmail?: string;
  trackingUrl: string;
}): string {
  const { ticket, tech, requesterEmail, trackingUrl } = params;

  const urgencyBadgeColor = {
    critica: '#dc2626',
    alta: '#ea580c',
    media: '#d97706',
    baixa: '#2563eb'
  }[ticket.urgency_level] || '#2563eb';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Nova Solicitação - ${ticket.protocol}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Cabeçalho -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                      HELP TECH INFORMÁTICA
                    </h1>
                    <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">
                      Service Desk & Field Service — Escolas Públicas do DF
                    </p>
                  </td>
                  <td align="right">
                    <span style="background-color: ${urgencyBadgeColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">
                      ${ticket.urgency_level}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Destaque do Protocolo -->
          <tr>
            <td style="padding: 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                Nova Solicitação Registrada
              </span>
              <div style="font-size: 24px; font-weight: 900; color: #0284c7; margin-top: 4px; font-family: monospace;">
                ${ticket.protocol}
              </div>
              <div style="font-size: 13px; color: #475569; margin-top: 4px;">
                <strong>${ticket.school_name}</strong> &bull; ${ticket.cre_name}
              </div>
            </td>
          </tr>

          <!-- Detalhes do Chamado -->
          <tr>
            <td style="padding: 24px;">
              <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 16px 0; border-left: 4px solid #0284c7; padding-left: 8px;">
                Detalhes da Ocorrência Técnica
              </h2>

              <table width="100%" cellspacing="0" cellpadding="6" style="font-size: 12px; margin-bottom: 16px;">
                <tr>
                  <td width="35%" style="color: #64748b; font-weight: bold;">Categoria do Defeito:</td>
                  <td style="color: #0f172a;">${ticket.category_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: bold;">Título do Problema:</td>
                  <td style="color: #0f172a; font-weight: bold;">${ticket.title}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: bold;">Patrimônio / Equipamento:</td>
                  <td style="color: #0f172a;">${ticket.equipment_patrimony || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: bold;">Solicitante Responsável:</td>
                  <td style="color: #0f172a;">${ticket.requester_name} (${ticket.requester_role})</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: bold;">Contato WhatsApp:</td>
                  <td style="color: #0f172a;">${ticket.requester_phone}</td>
                </tr>
                ${requesterEmail ? `
                <tr>
                  <td style="color: #64748b; font-weight: bold;">E-mail do Solicitante:</td>
                  <td style="color: #0f172a;">${requesterEmail}</td>
                </tr>` : ''}
              </table>

              <!-- Descrição -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
                <span style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px;">
                  Descrição Completa do Defeito:
                </span>
                <p style="margin: 0; font-size: 12.5px; line-height: 1.5; color: #334155; white-space: pre-wrap;">
                  ${ticket.description}
                </p>
              </div>

              <!-- Técnico Designado -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; margin-bottom: 24px;">
                <span style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; display: block; margin-bottom: 6px;">
                  👷 Técnico Credenciado Designado:
                </span>
                ${tech ? `
                  <div style="font-size: 13px; font-weight: bold; color: #14532d;">${tech.name}</div>
                  <div style="font-size: 11.5px; color: #15803d; margin-top: 2px;">
                    E-mail: <strong>${tech.email}</strong> &bull; Telefone: <strong>${tech.phone}</strong>
                  </div>
                  <div style="font-size: 11px; color: #166534; margin-top: 4px;">
                    Base Regional: ${tech.primary_cre_name} (Raio: ${tech.radius_km} km)
                  </div>
                ` : `
                  <div style="font-size: 12px; color: #15803d; font-style: italic;">
                    Chamado na fila de triagem da Controladoria Central para alocação do técnico mais próximo.
                  </div>
                `}
              </div>

              <!-- Botão de Ação -->
              <div style="text-align: center; margin: 28px 0 12px 0;">
                <a href="${trackingUrl}" style="background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);">
                  Acompanhar Ordem de Serviço Online
                </a>
              </div>
            </td>
          </tr>

          <!-- Rodapé Institucional Oficial -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 10.5px; color: #64748b; line-height: 1.6;">
              <strong style="color: #334155;">HELP TECH INFO &bull; SUPORTE & FIELD SERVICE</strong><br>
              CNPJ: 44.761.507/0001-33 &bull; Inscrição Estadual: 08.106.375/001-11<br>
              Telefones: (61) 99214-4732 / (61) 99229-5814<br>
              Quadra 317 casa 28 Del Lago II &bull; Bairro Itapoã &bull; Brasília - DF<br>
              <span style="font-size: 9.5px; color: #94a3b8; display: block; margin-top: 6px;">
                Este e-mail é gerado automaticamente pelo Sistema Operacional de Gestão de Suporte Escolar HelpTech.
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Dispara e-mails para os 3 destinatários obrigatórios a cada nova solicitação:
 *  1. helptechinfoinformatica@gmail.com
 *  2. E-mail do Solicitante / Escola
 *  3. E-mail do Técnico Designado
 */
export async function sendNewTicketNotificationEmails(params: {
  ticket: Ticket;
  tech?: Technician | null;
  requesterEmail?: string;
  schoolContactEmail?: string;
}): Promise<{ success: boolean; recipients: string[]; message: string }> {
  const { ticket, tech, requesterEmail, schoolContactEmail } = params;
  const config = getEmailConfig();

  // 1. Monta a lista consolidada de destinatários únicos
  const recipientsSet = new Set<string>();

  // Destinatário 1: Central HelpTech
  recipientsSet.add(HELPTECH_CENTRAL_EMAIL);

  // Destinatário 2: Solicitante ou E-mail Institucional da Escola
  const schoolEmail = requesterEmail || ticket.requester_email || schoolContactEmail;
  if (schoolEmail && schoolEmail.includes('@')) {
    recipientsSet.add(schoolEmail.trim());
  }

  // Destinatário 3: Técnico Designado
  if (tech?.email && tech.email.includes('@')) {
    recipientsSet.add(tech.email.trim());
  }

  const recipients = Array.from(recipientsSet);
  const subject = `[NOVA SOLICITAÇÃO] ${ticket.protocol} - ${ticket.school_name} (${ticket.urgency_level.toUpperCase()})`;

  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?protocol=${encodeURIComponent(ticket.protocol)}&token=${encodeURIComponent(ticket.tracking_token)}`
    : `https://helptech-escolas-df.vercel.app/?protocol=${encodeURIComponent(ticket.protocol)}`;

  const htmlBody = generateNewTicketEmailHtml({
    ticket,
    tech,
    requesterEmail: schoolEmail,
    trackingUrl
  });

  // Modo Simulado ou sem API Key
  if (!config.enabled || config.provider === 'simulated' || !config.resendApiKey) {
    console.info(`[E-mail Simulado] Disparo automático para: ${recipients.join(', ')}\nAssunto: ${subject}`);
    recordEmailLog({
      recipients,
      subject,
      ticketProtocol: ticket.protocol,
      status: 'simulado',
      provider: 'Modo Simulado / Local'
    });
    return {
      success: true,
      recipients,
      message: `E-mails simulados e registrados com sucesso para: ${recipients.join(', ')}`
    };
  }

  // Envio Real via Resend API
  if (config.provider === 'resend') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.fromEmail || 'HelpTech Suporte <suporte@helptech.com.br>',
          to: recipients,
          subject,
          html: htmlBody
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      recordEmailLog({
        recipients,
        subject,
        ticketProtocol: ticket.protocol,
        status: 'enviado',
        provider: 'Resend API',
        messageId: json?.id
      });

      return {
        success: true,
        recipients,
        message: `E-mails enviados com sucesso para: ${recipients.join(', ')}`
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Falha no envio via Resend API';
      console.warn('[Email Error]', errMsg);
      recordEmailLog({
        recipients,
        subject,
        ticketProtocol: ticket.protocol,
        status: 'falha',
        provider: 'Resend API',
        error: errMsg
      });
      return { success: false, recipients, message: errMsg };
    }
  }

  return { success: true, recipients, message: 'Processamento concluído.' };
}
