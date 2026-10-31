<template>
  <div class="inline-flex flex-col items-start gap-1.5">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :disabled="loading"
        :aria-busy="loading ? 'true' : 'false'"
        :aria-label="movieTitle ? `Ouvrir mon billet PDF pour ${movieTitle}` : 'Ouvrir mon billet PDF'"
        @click="run(false)"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold border border-accent-gold/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
      >
        <span>{{ loading ? 'Préparation…' : 'Mon billet (PDF)' }}</span>
      </button>

      <button
        type="button"
        :disabled="loading"
        :aria-busy="loading ? 'true' : 'false'"
        :aria-label="movieTitle ? `Enregistrer le billet PDF pour ${movieTitle}` : 'Enregistrer le billet PDF'"
        @click="run(true)"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
      >
        <span>Enregistrer</span>
      </button>
    </div>

    <span
      v-if="error"
      role="alert"
      class="text-xs font-medium text-red-400"
    >
      {{ error }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  type BrowserAdapter,
  FALLBACK,
  openTicketPdf,
  realBrowser,
  saveTicketPdf,
  TicketPdfError
} from '../services/ticketPdf';

const props = defineProps<{
  bookingId: string;
  movieTitle?: string;
  browser?: BrowserAdapter;
}>();

const emit = defineEmits<{
  (e: 'unavailable', status: number): void;
}>();

const loading = ref(false);
const error = ref('');

async function run(save: boolean) {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const adapter = props.browser ?? realBrowser;
    const action = save ? saveTicketPdf : openTicketPdf;
    await action(props.bookingId, adapter);
  } catch (err) {
    if (err instanceof TicketPdfError) {
      error.value = err.message;
      if (err.status === 404 || err.status === 409) {
        emit('unavailable', err.status);
      }
    } else {
      error.value = FALLBACK;
    }
  } finally {
    loading.value = false;
  }
}
</script>
