import { supabase, isSupabaseConfigured } from './supabaseClient';
import { compressImageToWebP } from './geoEngine';

export interface UploadAttachmentResult {
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  is_remote: boolean;
  error?: string;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

/**
 * Processa e faz upload de fotos de evidência com compressão otimizada WebP
 */
export async function uploadEvidenceFile(
  file: File,
  ticketId: string,
  phase: 'abertura' | 'diagnostico' | 'conclusao' = 'abertura'
): Promise<UploadAttachmentResult> {
  // 1. Validação de tamanho e formato
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`O arquivo excede o limite máximo permitido de 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
  }

  // 2. Compressão em cliente para imagens (WebP com 75% de qualidade para economizar dados móveis escolares)
  let uploadBlob: Blob = file;
  let finalFileName = file.name;
  let finalSize = file.size;

  if (file.type.startsWith('image/')) {
    try {
      const compressed = await compressImageToWebP(file, 0.75, 1280);
      // Converte dataURL para Blob
      const res = await fetch(compressed.dataUrl);
      uploadBlob = await res.blob();
      finalFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
      finalSize = uploadBlob.size;
    } catch (compressErr) {
      console.warn('Falha na compressão WebP, usando arquivo original:', compressErr);
    }
  }

  // 3. Upload para Supabase Storage se conectado
  if (isSupabaseConfigured && supabase) {
    try {
      const remotePath = `tickets/${ticketId}/${phase}_${Date.now()}_${finalFileName}`;
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .upload(remotePath, uploadBlob, {
          contentType: uploadBlob.type || 'image/webp',
          upsert: true
        });

      if (!error && data) {
        // Gera URL assinada temporária com TTL de 15 minutos (900s) para conformidade total com LGPD (WS3 / F-06)
        const { data: signedData } = await supabase.storage
          .from('ticket-attachments')
          .createSignedUrl(remotePath, 900);

        return {
          file_url: signedData?.signedUrl || remotePath,
          file_name: finalFileName,
          file_size_bytes: finalSize,
          is_remote: true
        };
      }
    } catch (uploadErr) {
      console.warn('Falha ao enviar para o bucket Supabase, usando fallback local comprimido:', uploadErr);
    }
  }

  // 4. Fallback Local em Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        file_url: reader.result as string,
        file_name: finalFileName,
        file_size_bytes: finalSize,
        is_remote: false
      });
    };
    reader.readAsDataURL(uploadBlob);
  });
}

/**
 * Obtém uma nova URL assinada temporária (TTL padrão: 15 min / 900s) para visualização segura de anexo
 */
export async function getAttachmentSignedUrl(
  pathOrUrl: string,
  ttlSeconds: number = 900
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return pathOrUrl;

  // Se já for data URL base64, retorna diretamente
  if (pathOrUrl.startsWith('data:')) return pathOrUrl;

  try {
    // Extrai o caminho relativo dentro do bucket se for uma URL completa
    let storagePath = pathOrUrl;
    if (pathOrUrl.includes('/ticket-attachments/')) {
      storagePath = pathOrUrl.split('/ticket-attachments/')[1].split('?')[0];
    }

    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(storagePath, ttlSeconds);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('Falha ao gerar URL assinada para anexo:', err);
  }

  return pathOrUrl;
}


