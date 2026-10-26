import { apiClient } from './apiClient';
import { useConnectionStore } from '../stores/connection';

export type MutationType = 'RESERVE_SLOT' | 'CANCEL_SLOT' | 'AB_EXPOSURE';

export interface PendingMutation {
  id: string;
  type: MutationType;
  payload: any;
  createdAt: number;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = 'cineslot_offline_queue';

class OfflineQueueManager {
  private queue: PendingMutation[] = [];
  private isProcessing = false;
  private onBookingSyncedCallback?: (tempBookingId: string, serverBookingId: string, slotId: string) => void;
  private onBookingConflictCallback?: (slotId: string, movieTitle: string) => void;

  constructor() {
    this.loadQueue();
  }

  public registerCallbacks(
    onBookingSynced: (tempBookingId: string, serverBookingId: string, slotId: string) => void,
    onBookingConflict: (slotId: string, movieTitle: string) => void
  ) {
    this.onBookingSyncedCallback = onBookingSynced;
    this.onBookingConflictCallback = onBookingConflict;
  }

  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      this.queue = raw ? JSON.parse(raw) : [];
      this.syncPendingCount();
    } catch (err) {
      console.error('[OfflineQueue] Erreur de lecture de la file:', err);
      this.queue = [];
    }
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.syncPendingCount();
    } catch (err) {
      console.error('[OfflineQueue] Erreur de persistance de la file:', err);
    }
  }

  private syncPendingCount(): void {
    try {
      const store = useConnectionStore();
      store.setPendingMutationsCount(this.queue.length);
    } catch {
      // Pinia pas encore initialisé
    }
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getPendingItems(): PendingMutation[] {
    return [...this.queue];
  }

  public isSlotPendingReservation(slotId: string): boolean {
    return this.queue.some(m => m.type === 'RESERVE_SLOT' && m.payload?.slotId === slotId);
  }

  public isSlotPendingCancellation(slotId: string): boolean {
    return this.queue.some(m => m.type === 'CANCEL_SLOT' && m.payload?.slotId === slotId);
  }

  /**
   * Ajoute une opération en file d'attente hors-ligne
   */
  public enqueue(type: MutationType, payload: any): PendingMutation {
    const mutation: PendingMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };

    // Évite les doublons stricts pour un même créneau
    if (type === 'RESERVE_SLOT') {
      const existing = this.queue.findIndex(m => m.type === 'RESERVE_SLOT' && m.payload?.slotId === payload.slotId);
      if (existing >= 0) {
        this.queue[existing] = mutation;
        this.persistQueue();
        return mutation;
      }
    }

    this.queue.push(mutation);
    this.persistQueue();
    console.log(`[OfflineQueue] Opération "${type}" mise en file d'attente (${this.queue.length} en attente).`);
    return mutation;
  }

  /**
   * Traite toutes les mutations en attente de façon séquentielle
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Démarrage du traitement de ${this.queue.length} mutations...`);

    const itemsToProcess = [...this.queue];
    const remainingItems: PendingMutation[] = [];

    for (const item of itemsToProcess) {
      try {
        await this.executeMutation(item);
        console.log(`[OfflineQueue] Mutation ${item.type} (${item.id}) rejouée avec succès.`);
      } catch (err: any) {
        // En cas de conflit 409 (créneau déjà pris par un autre utilisateur entre-temps)
        if (err.response?.status === 409 && item.type === 'RESERVE_SLOT') {
          console.warn(`[OfflineQueue] Conflit 409 sur la séance ${item.payload?.slotId}: déjà réservée.`);
          if (this.onBookingConflictCallback) {
            this.onBookingConflictCallback(item.payload.slotId, item.payload.movieTitle || 'Séance');
          }
          // On ne réessaye pas une opération impossible
          continue;
        }

        // Si l'annulation échoue car le créneau n'existe plus ou est déjà annulé (400/404)
        if ((err.response?.status === 400 || err.response?.status === 404) && item.type === 'CANCEL_SLOT') {
          console.warn(`[OfflineQueue] Séance déjà annulée côté serveur (${err.response.status}).`);
          continue;
        }

        // Si l'exposition A/B échoue (ex: 400 cookie absent ou 409 déjà exposée)
        if (item.type === 'AB_EXPOSURE') {
          console.warn(`[OfflineQueue] Exposition A/B ignorée (${err.response?.status || err.message}).`);
          continue;
        }

        // Abandon après 3 échecs pour éviter de bloquer la file
        if (item.retryCount >= 3) {
          console.warn(`[OfflineQueue] Abandon de l'opération ${item.type} après 3 échecs.`);
          continue;
        }

        // Si c'est une erreur réseau persistante, on conserve dans la file
        item.retryCount++;
        remainingItems.push(item);
        console.error(`[OfflineQueue] Échec rejeu ${item.type}, conservé dans la file:`, err.message);
      }
    }

    this.queue = remainingItems;
    this.persistQueue();
    this.isProcessing = false;
  }

  private async executeMutation(item: PendingMutation): Promise<void> {
    switch (item.type) {
      case 'RESERVE_SLOT': {
        const { slotId, customerId, tempBookingId, tickets } = item.payload;
        const res = await apiClient.post(`/api/slots/${slotId}/reservations`, {
          customerId: customerId || 'Anonyme',
          ...(Array.isArray(tickets) && tickets.length > 0 ? { tickets } : {}),
        }, {
          skipOfflineTrigger: true,
        });

        if (this.onBookingSyncedCallback && res.data?.bookingId) {
          this.onBookingSyncedCallback(tempBookingId, res.data.bookingId, slotId);
        }
        break;
      }

      case 'CANCEL_SLOT': {
        const { slotId } = item.payload;
        await apiClient.delete(`/api/slots/${slotId}/reservations`, {
          skipOfflineTrigger: true,
        });
        break;
      }

      case 'AB_EXPOSURE': {
        await apiClient.post('/api/ab/exposure', {}, {
          skipOfflineTrigger: true,
        });
        break;
      }
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
