import { useState, useEffect, useCallback } from 'react';

export type OfflineActionType =
  | 'ACCEPT_TICKET'
  | 'REFUSE_TICKET'
  | 'CHECK_IN'
  | 'SUBMIT_QUOTE'
  | 'DECIDE_QUOTE'
  | 'COMPLETE_TICKET'
  | 'SCHEDULE_VISIT'
  | 'SET_WAITING_PARTS'
  | 'SET_WAITING_THIRD_PARTY'
  | 'RESUME_SERVICE';

export interface OfflineMutation<T = any> {
  id: string;
  action: OfflineActionType;
  ticketId: string;
  payload: T;
  actor: { name: string; role: string };
  createdAt: string;
  attempts: number;
}

const OFFLINE_QUEUE_KEY = 'helptech_offline_mutations_v1';

/**
 * Lê a fila de mutações offline armazenada no dispositivo do técnico
 */
export function getOfflineQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Falha ao ler fila offline:', err);
    return [];
  }
}

/**
 * Salva a fila de mutações offline
 */
export function saveOfflineQueue(queue: OfflineMutation[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Falha ao salvar fila offline:', err);
  }
}

/**
 * Adiciona uma mutação à fila offline (FIFO)
 */
export function enqueueOfflineMutation(
  mutationData: Omit<OfflineMutation, 'id' | 'createdAt' | 'attempts'>
): OfflineMutation {
  const queue = getOfflineQueue();
  const mutation: OfflineMutation = {
    ...mutationData,
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    attempts: 0
  };

  queue.push(mutation);
  saveOfflineQueue(queue);
  return mutation;
}

/**
 * Remove uma mutação processada com sucesso
 */
export function dequeueOfflineMutation(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveOfflineQueue(filtered);
}

/**
 * Limpa toda a fila offline
 */
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // Silencioso
  }
}

/**
 * Executa a sincronização de todas as mutações pendentes na ordem em que foram geradas
 */
export async function flushOfflineQueue(
  executor: (mutation: OfflineMutation) => Promise<boolean>
): Promise<{ successCount: number; failCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0 };

  let successCount = 0;
  let failCount = 0;
  const remainingQueue: OfflineMutation[] = [];

  for (const item of queue) {
    try {
      const ok = await executor(item);
      if (ok) {
        successCount++;
      } else {
        failCount++;
        remainingQueue.push({ ...item, attempts: item.attempts + 1 });
      }
    } catch {
      failCount++;
      remainingQueue.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  saveOfflineQueue(remainingQueue);
  return { successCount, failCount };
}

/**
 * Hook para monitoramento em tempo real do estado de conexão e da fila offline do PWA
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingQueue, setPendingQueue] = useState<OfflineMutation[]>(getOfflineQueue);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);

  const refreshQueue = useCallback(() => {
    setPendingQueue(getOfflineQueue());
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueue]);

  return {
    isOnline,
    pendingCount: pendingQueue.length,
    pendingQueue,
    isFlushing,
    setIsFlushing,
    refreshQueue
  };
}
