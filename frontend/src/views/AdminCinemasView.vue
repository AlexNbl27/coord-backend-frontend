<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl font-bold text-white tracking-tight">Administration des cinémas</h1>
          <p class="text-cinema-textMuted text-sm mt-1">
            Création, activation/désactivation et suppression des cinémas du réseau
          </p>
        </div>
        <button
          type="button"
          :disabled="loading || submitting"
          @click="fetchCinemas"
          class="px-4 py-2 rounded-xl bg-cinema-card border border-cinema-border text-sm font-medium text-cinema-text hover:text-white transition-colors disabled:opacity-50"
        >
          Actualiser
        </button>
      </div>

      <div v-if="errorMessage" role="alert" class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {{ errorMessage }}
      </div>

      <section class="bg-cinema-card/70 p-6 rounded-2xl border border-cinema-border/50 space-y-4">
        <h2 class="text-lg font-semibold text-white">Créer un cinéma</h2>
        <form @submit.prevent="createCinema" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="cinema-slug" class="block text-xs font-medium text-cinema-textMuted mb-1">Slug</label>
            <input
              id="cinema-slug"
              v-model="form.slug"
              type="text"
              required
              placeholder="lyon-bellecour"
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div>
            <label for="cinema-name" class="block text-xs font-medium text-cinema-textMuted mb-1">Nom</label>
            <input
              id="cinema-name"
              v-model="form.name"
              type="text"
              required
              placeholder="CinéSlot Lyon Bellecour"
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div>
            <label for="cinema-city" class="block text-xs font-medium text-cinema-textMuted mb-1">Ville</label>
            <input
              id="cinema-city"
              v-model="form.city"
              type="text"
              required
              placeholder="Lyon"
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div>
            <label for="cinema-address" class="block text-xs font-medium text-cinema-textMuted mb-1">Adresse</label>
            <input
              id="cinema-address"
              v-model="form.address"
              type="text"
              required
              placeholder="14 place Bellecour"
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div>
            <label for="cinema-lat" class="block text-xs font-medium text-cinema-textMuted mb-1">Latitude</label>
            <input
              id="cinema-lat"
              v-model.number="form.latitude"
              type="number"
              step="any"
              required
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div>
            <label for="cinema-lon" class="block text-xs font-medium text-cinema-textMuted mb-1">Longitude</label>
            <input
              id="cinema-lon"
              v-model.number="form.longitude"
              type="number"
              step="any"
              required
              class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
            />
          </div>
          <div class="md:col-span-3 flex justify-end">
            <button
              type="submit"
              :disabled="submitting"
              class="px-5 py-2.5 rounded-xl bg-accent-gold text-cinema-dark font-semibold text-sm hover:opacity-90 disabled:opacity-50"
            >
              Créer le cinéma
            </button>
          </div>
        </form>
      </section>

      <section class="bg-cinema-card/70 p-6 rounded-2xl border border-cinema-border/50 space-y-4">
        <h2 class="text-lg font-semibold text-white">Liste des cinémas</h2>
        <div v-if="loading" class="text-sm text-cinema-textMuted">Chargement...</div>
        <div v-else-if="cinemas.length === 0" class="text-sm text-cinema-textMuted">Aucun cinéma enregistré.</div>
        <div v-else class="divide-y divide-cinema-border/40">
          <div
            v-for="cinema in cinemas"
            :key="cinema.slug"
            class="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div class="flex flex-wrap items-center gap-3">
                <span class="font-semibold text-white">{{ cinema.name }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-cinema-darker text-cinema-textMuted border border-cinema-border/50">
                  {{ cinema.slug }}
                </span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="{
                    'bg-emerald-500/20 text-emerald-300': cinema.status === 'ACTIVE',
                    'bg-amber-500/20 text-amber-300': cinema.status === 'DISABLED',
                    'bg-red-500/20 text-red-300': cinema.status === 'DELETED'
                  }"
                >
                  {{ cinema.status }}
                </span>
              </div>
              <p class="text-xs text-cinema-textMuted mt-1">{{ cinema.address }}, {{ cinema.city }}</p>
            </div>

            <div class="flex items-center gap-3">
              <button
                v-if="cinema.status !== 'DELETED'"
                type="button"
                role="switch"
                :aria-checked="cinema.status === 'ACTIVE' ? 'true' : 'false'"
                :aria-label="`Basculer l'état de ${cinema.slug}`"
                :disabled="loading || submitting"
                @click="toggleStatus(cinema)"
                class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50"
                :class="cinema.status === 'ACTIVE'
                  ? 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10'
                  : 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10'"
              >
                {{ cinema.status === 'ACTIVE' ? 'Désactiver' : 'Activer' }}
              </button>
              <button
                v-if="cinema.status !== 'DELETED'"
                type="button"
                @click="openDeleteModal(cinema.slug)"
                class="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-red-500/50 text-red-300 hover:bg-red-500/10"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <div
          v-if="deleteTarget"
          ref="deleteDialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
          tabindex="-1"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          @click.self="closeDeleteModal"
        >
          <div class="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-cinema-card border border-cinema-border p-6 space-y-4">
            <button
              type="button"
              class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-cinema-textMuted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Fermer la fenêtre de confirmation"
              @click="closeDeleteModal"
            >
              <span aria-hidden="true">✕</span>
            </button>
            <h3 id="delete-dialog-title" class="text-lg font-semibold text-white pr-8">
              Confirmer la suppression de {{ deleteTarget }}
            </h3>
            <p id="delete-dialog-desc" class="text-sm text-cinema-textMuted">
              Les réservations futures seront annulées. Saisissez le slug
              <strong class="text-white">{{ deleteTarget }}</strong> pour confirmer.
            </p>
            <div>
              <label for="confirm-slug-input" class="sr-only">Slug de confirmation</label>
              <input
                id="confirm-slug-input"
                ref="deleteConfirmInputRef"
                v-model="deleteConfirmInput"
                type="text"
                :placeholder="deleteTarget"
                class="w-full px-3 py-2 rounded-xl bg-cinema-darker border border-cinema-border text-sm text-white"
              />
            </div>
            <div class="flex justify-end gap-3">
              <button
                type="button"
                @click="closeDeleteModal"
                class="px-4 py-2 rounded-xl border border-cinema-border text-sm text-cinema-text cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                :disabled="deleteConfirmInput !== deleteTarget || submitting"
                @click="confirmDelete"
                class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { apiClient } from '../services/apiClient';
import { useAccessibleDialog } from '../composables/useAccessibleDialog';

interface AdminCinema {
  slug: string;
  name: string;
  address: string;
  city: string;
  status: 'ACTIVE' | 'DISABLED' | 'DELETED';
}

const cinemas = ref<AdminCinema[]>([]);
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);
const deleteTarget = ref<string | null>(null);
const deleteConfirmInput = ref('');
const deleteDialogRef = ref<HTMLElement | null>(null);
const deleteConfirmInputRef = ref<HTMLInputElement | null>(null);
const isDeleteOpen = computed(() => Boolean(deleteTarget.value));

useAccessibleDialog({
  isOpen: isDeleteOpen,
  dialogRef: deleteDialogRef,
  initialFocusRef: deleteConfirmInputRef,
  onClose: closeDeleteModal
});

const form = reactive({
  slug: '',
  name: '',
  address: '',
  city: '',
  latitude: 45.7578,
  longitude: 4.832
});

function extractError(err: any): string {
  return err?.response?.data?.detail || err?.response?.data?.message || 'Erreur lors de la requête.';
}

async function fetchCinemas() {
  loading.value = true;
  errorMessage.value = null;
  try {
    const res = await apiClient.get<AdminCinema[]>('/api/admin/cinemas', { withCredentials: true });
    cinemas.value = res.data;
  } catch (err) {
    errorMessage.value = extractError(err);
  } finally {
    loading.value = false;
  }
}

async function createCinema() {
  submitting.value = true;
  errorMessage.value = null;
  try {
    await apiClient.post('/api/admin/cinemas', { ...form }, { withCredentials: true });
    form.slug = '';
    form.name = '';
    form.address = '';
    form.city = '';
    await fetchCinemas();
  } catch (err) {
    errorMessage.value = extractError(err);
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(cinema: AdminCinema) {
  submitting.value = true;
  errorMessage.value = null;
  const nextStatus = cinema.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  try {
    await apiClient.patch(`/api/admin/cinemas/${cinema.slug}/status`, { status: nextStatus }, { withCredentials: true });
    cinema.status = nextStatus;
  } catch (err) {
    errorMessage.value = extractError(err);
  } finally {
    submitting.value = false;
  }
}

function openDeleteModal(slug: string) {
  deleteTarget.value = slug;
  deleteConfirmInput.value = '';
}

function closeDeleteModal() {
  deleteTarget.value = null;
  deleteConfirmInput.value = '';
}

async function confirmDelete() {
  if (!deleteTarget.value || deleteConfirmInput.value !== deleteTarget.value) {
    return;
  }
  submitting.value = true;
  errorMessage.value = null;
  try {
    await apiClient.delete(`/api/admin/cinemas/${deleteTarget.value}`, { withCredentials: true });
    closeDeleteModal();
    await fetchCinemas();
  } catch (err) {
    errorMessage.value = extractError(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void fetchCinemas();
});
</script>
