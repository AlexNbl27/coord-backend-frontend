<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    @click.self="$emit('close')"
  >
    <div class="relative w-full max-w-3xl bg-cinema-card border border-cinema-border/80 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden">
      <!-- Glow d'arrière-plan -->
      <div class="absolute -top-24 -right-24 w-72 h-72 bg-accent-gold/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- En-tête -->
      <div class="flex items-center justify-between pb-4 border-b border-cinema-border/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-accent-gold/15 border border-accent-gold/30 flex items-center justify-center text-xl shadow-inner">
            🧪
          </div>
          <div>
            <h3 class="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Tableau de bord A/B Testing
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold border border-accent-gold/30 font-semibold uppercase">
                {{ experimentId }}
              </span>
            </h3>
            <p class="text-xs text-cinema-textMuted mt-0.5">
              Évaluation du libellé de réservation sur le taux de conversion des séances
            </p>
          </div>
        </div>

        <button
          @click="$emit('close')"
          class="p-2 rounded-lg text-cinema-textMuted hover:text-white hover:bg-white/5 transition-colors"
          title="Fermer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Statut du navigateur actuel -->
      <div class="my-6 p-4 rounded-xl bg-cinema-darker border border-cinema-border/60 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-cinema-textMuted">Votre statut actuel :</span>
          <span
            class="px-3 py-1 rounded-lg text-xs font-black tracking-wide"
            :class="variant === 'A' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'"
          >
            Variante {{ variant }} : « {{ bookingButtonLabel }} »
          </span>
        </div>

        <div class="flex items-center gap-2 text-xs">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            :class="exposed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="exposed ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'"></span>
            {{ exposed ? 'Exposition validée' : 'Non exposé' }}
          </span>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            :class="measured ? 'bg-purple-500/15 text-purple-400' : 'bg-cinema-card text-cinema-textMuted border border-cinema-border/40'"
          >
            {{ measured ? 'Mesure active' : 'Mesure en attente' }}
          </span>
        </div>
      </div>

      <!-- Grille des métriques A/B -->
      <div v-if="loading" class="py-12 text-center text-cinema-textMuted">
        <div class="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Calcul des conversions en direct...
      </div>

      <div v-else class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Variante A -->
          <div
            class="p-5 rounded-2xl border transition-all"
            :class="variant === 'A' ? 'bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/30' : 'bg-cinema-darker/60 border-cinema-border/40'"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-blue-400">Variante A (Référence)</span>
                <h4 class="text-lg font-black text-white mt-0.5">« Réserver »</h4>
              </div>
              <span v-if="variant === 'A'" class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Votre version
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 py-3 border-y border-cinema-border/30 text-center">
              <div>
                <div class="text-xs text-cinema-textMuted">Assignés</div>
                <div class="text-base font-bold text-white mt-1">{{ metricA?.assigned ?? 0 }}</div>
              </div>
              <div>
                <div class="text-xs text-cinema-textMuted">Exposés</div>
                <div class="text-base font-bold text-white mt-1">{{ metricA?.exposed ?? 0 }}</div>
              </div>
              <div>
                <div class="text-xs text-cinema-textMuted">Convertis</div>
                <div class="text-base font-bold text-white mt-1">{{ metricA?.converted ?? 0 }}</div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <span class="text-xs text-cinema-textMuted">Taux de conversion</span>
              <span class="text-xl font-black text-white">
                {{ formatRate(metricA?.rate) }}
              </span>
            </div>
          </div>

          <!-- Variante B -->
          <div
            class="p-5 rounded-2xl border transition-all"
            :class="variant === 'B' ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-cinema-darker/60 border-cinema-border/40'"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Variante B (Modification)</span>
                <h4 class="text-lg font-black text-white mt-0.5">« Choisir ce créneau »</h4>
              </div>
              <span v-if="variant === 'B'" class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Votre version
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 py-3 border-y border-cinema-border/30 text-center">
              <div>
                <div class="text-xs text-cinema-textMuted">Assignés</div>
                <div class="text-base font-bold text-white mt-1">{{ metricB?.assigned ?? 0 }}</div>
              </div>
              <div>
                <div class="text-xs text-cinema-textMuted">Exposés</div>
                <div class="text-base font-bold text-white mt-1">{{ metricB?.exposed ?? 0 }}</div>
              </div>
              <div>
                <div class="text-xs text-cinema-textMuted">Convertis</div>
                <div class="text-base font-bold text-white mt-1">{{ metricB?.converted ?? 0 }}</div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <span class="text-xs text-cinema-textMuted">Taux de conversion</span>
              <span class="text-xl font-black text-white">
                {{ formatRate(metricB?.rate) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Synthèse comparative -->
        <div class="p-4 rounded-xl bg-cinema-card border border-cinema-border/60 flex items-center justify-between">
          <div class="text-xs text-cinema-textMuted leading-relaxed">
            <strong class="text-white">Règle d'attribution :</strong> Attribution si la réservation intervient dans les 24h suivant l'exposition du navigateur.
            Plusieurs réservations du même visiteur ne comptent que pour <span class="text-accent-gold font-bold">1 visiteur converti unique</span>.
          </div>
          <button
            @click="loadMetrics"
            class="ml-4 shrink-0 px-3.5 py-2 rounded-xl bg-cinema-darker hover:bg-white/5 border border-cinema-border text-xs font-semibold text-cinema-text hover:text-white transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Actualiser</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAbTest, type AbMetric } from '../composables/useAbTest';

defineProps<{
  show: boolean;
}>();

defineEmits(['close']);

const { variant, experimentId, exposed, measured, bookingButtonLabel, fetchMetrics } = useAbTest();

const loading = ref(false);
const metrics = ref<AbMetric[]>([]);

const metricA = computed(() => metrics.value.find(m => m.variant === 'A'));
const metricB = computed(() => metrics.value.find(m => m.variant === 'B'));

const formatRate = (rate: number | null | undefined) => {
  if (rate === null || rate === undefined) return 'N/A';
  return (rate * 100).toFixed(1) + ' %';
};

const loadMetrics = async () => {
  loading.value = true;
  try {
    metrics.value = await fetchMetrics();
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadMetrics();
});
</script>
