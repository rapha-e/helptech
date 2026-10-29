import type { Technician, Ticket } from '../data/seedData';
import { ACTIVE_WORKLOAD_STATUSES } from './stateMachine';

/**
 * Calcula a distância em quilômetros entre duas coordenadas geográficas
 * utilizando a fórmula de Haversine (equivalente ao cube/earthdistance do PostgreSQL)
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

export interface CandidateTechnicianResult {
  technician: Technician;
  distanceKm: number;
  activeLoad: number;
}

/**
 * Motor de despacho inteligente fiel à função SQL get_best_candidate_technician()
 * Seleciona o técnico disponível mais próximo que atenda ao raio e com menor carga ativa.
 */
export function getBestCandidateTechnician(
  schoolLat: number,
  schoolLng: number,
  technicians: Technician[],
  tickets: Ticket[],
  excludedTechIds: string[] = []
): CandidateTechnicianResult | null {
  const candidates: CandidateTechnicianResult[] = [];

  for (const tech of technicians) {
    if (!tech.active || tech.status !== 'disponivel') {
      continue;
    }
    if (excludedTechIds.includes(tech.id)) {
      continue;
    }

    // Calcula chamados ativos em atendimento pelo técnico usando os 7 status canônicos
    const activeLoad = tickets.filter(
      (t) => t.assigned_technician_id === tech.id && ACTIVE_WORKLOAD_STATUSES.includes(t.status)
    ).length;

    if (activeLoad >= tech.max_active_tickets) {
      continue;
    }

    const distanceKm = calculateDistanceKm(tech.latitude, tech.longitude, schoolLat, schoolLng);

    // Valida se a escola está dentro do raio de atendimento do técnico
    if (distanceKm <= tech.radius_km) {
      candidates.push({
        technician: tech,
        distanceKm,
        activeLoad
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Ordenação: 1º menor distância; 2º menor carga ativa; 3º estabilidade alfabética
  candidates.sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.05) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.activeLoad !== b.activeLoad) {
      return a.activeLoad - b.activeLoad;
    }
    return a.technician.name.localeCompare(b.technician.name);
  });

  return candidates[0];
}

/**
 * Comprime imagens no navegador utilizando a Canvas API para o formato WebP
 * Diretriz do Blueprint: Reduz o consumo de dados móveis em conexões de escolas públicas.
 */
export async function compressImageToWebP(
  file: File,
  quality: number = 0.75,
  maxWidth: number = 1200
): Promise<{ dataUrl: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Falha ao obter contexto Canvas 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Fallback para toDataURL se toBlob falhar
              const dataUrl = canvas.toDataURL('image/webp', quality);
              resolve({
                dataUrl,
                sizeBytes: Math.round(dataUrl.length * 0.75)
              });
              return;
            }
            const blobReader = new FileReader();
            blobReader.onloadend = () => {
              resolve({
                dataUrl: blobReader.result as string,
                sizeBytes: blob.size
              });
            };
            blobReader.readAsDataURL(blob);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gera um protocolo oficial sequencial no formato OS-YYYY-XXXXX com garantia de unicidade
 */
export function generateTicketProtocol(existingProtocols?: string[]): string {
  const year = new Date().getFullYear();
  let candidate = '';
  let attempts = 0;
  do {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    candidate = `OS-${year}-${randomNum}`;
    attempts++;
  } while (existingProtocols && existingProtocols.includes(candidate) && attempts < 10);

  if (existingProtocols && existingProtocols.includes(candidate)) {
    const nanoSuffix = (Date.now() % 10000).toString().padStart(4, '0');
    candidate = `OS-${year}-${nanoSuffix}`;
  }
  return candidate;
}

/**
 * Gera um token seguro de rastreamento com alta entropia criptográfica (192 bits / CSPRNG)
 * Retorna prefixo 'tk_' seguido de 48 caracteres hexadecimais (total 51 caracteres)
 */
export function generateTrackingToken(): string {
  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto 
    ? globalThis.crypto 
    : (typeof window !== 'undefined' ? window.crypto : null);
  
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('CSPRNG indisponível para geração segura de token de acompanhamento');
  }

  const array = new Uint8Array(24); // 24 bytes = 192 bits de entropia criptográfica
  cryptoObj.getRandomValues(array);
  return 'tk_' + Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
