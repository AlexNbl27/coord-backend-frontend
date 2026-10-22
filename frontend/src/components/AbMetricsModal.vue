<template>
  <div
    v-if="show"
    ref="modalRef"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ab-metrics-modal-title"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    @click.self="$emit('close')"
  >
    <div class="relative w-full max-w-4xl bg-cinema-card border border-cinema-border rounded-lg shadow-2xl p-6 sm:p-8 overflow-hidden max-h-[92vh] overflow-y-auto focus:outline-none" tabindex="-1">
      <div class="flex items-center justify-between pb-4 border-b border-cinema-border/50">
        <div>
          <h2 id="ab-metrics-modal-title" class="font-display text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Tableau de bord A/B Testing
            <span class="text-xs font-mono px-2.5 py-0.5 rounded bg-accent-gold/15 text-accent-gold border border-accent-gold/30 font-semibold uppercase">
              {{ experimentId }}
            </span>
          </h2>
          <p class="text-xs text-cinema-textMuted mt-0.5">
            Z-test, p-value, intervalles de confiance à 95 % et détection SRM
          </p>
        </div>

        <button
          ref="closeButtonRef"
          @click="$emit('close')"
          class="p-2 rounded-lg text-cinema-textMuted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Fermer le tableau de bord A/B testing"
          title="Fermer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Statut du navigateur actuel -->
      <div class="my-5 p-4 rounded-xl bg-cinema-darker border border-cinema-border/60 flex flex-wrap items-center justify-between gap-4">
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
        Calcul des conversions & analyse statistique en direct...
      </div>

      <div v-else class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Variante A -->
          <div
            class="p-5 rounded-2xl border transition-all"
            :class="variant === 'A' ? 'bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/30' : 'bg-cinema-darker/60 border-cinema-border/40'"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-xs font-bold uppercase tracking-wider text-blue-400">Variante A (Contrôle)</span>
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
              <div>
                <div class="text-xs text-cinema-textMuted">Taux de conversion</div>
                <div class="text-xs text-blue-400/80 font-mono mt-0.5">
                  IC 95%: {{ formatCI(metricA?.confidenceInterval) }}
                </div>
              </div>
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
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Variante B (Challenger)</span>
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
              <div>
                <div class="text-xs text-cinema-textMuted">Taux de conversion</div>
                <div class="text-xs text-emerald-400/80 font-mono mt-0.5">
                  IC 95%: {{ formatCI(metricB?.confidenceInterval) }}
                </div>
              </div>
              <span class="text-xl font-black text-white">
                {{ formatRate(metricB?.rate) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Encart : Rigueur Statistique & Verdict Industriel -->
        <div class="p-5 rounded-2xl bg-cinema-darker/80 border border-cinema-border/70 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-accent-gold">
                Analyse Statistique & Décision
              </span>
              <span
                v-if="summary?.isSignificant"
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              >
                Significatif (p &lt; 0.05)
              </span>
              <span
                v-else
                class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30"
              >
                Échantillon / Différence non concluant
              </span>
            </div>

            <!-- Badge SRM (Sample Ratio Mismatch) -->
            <div
              class="text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5"
              :class="summary?.srm?.hasMismatch ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'"
            >
              <span>{{ summary?.srm?.hasMismatch ? '! SRM Détecté' : '✓ Équilibre 50/50 validé' }}</span>
              <span class="text-[10px] opacity-75 font-mono">(p={{ summary?.srm?.pValue ?? '1.0' }})</span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center py-2 bg-black/20 rounded-xl border border-cinema-border/30">
            <div>
              <div class="text-[11px] text-cinema-textMuted">p-value (bilatérale)</div>
              <div class="text-sm font-mono font-bold text-white mt-0.5">{{ summary?.pValue ?? '1.0' }}</div>
            </div>
            <div>
              <div class="text-[11px] text-cinema-textMuted">Z-Score</div>
              <div class="text-sm font-mono font-bold text-white mt-0.5">{{ summary?.zScore ?? '0.00' }}</div>
            </div>
            <div>
              <div class="text-[11px] text-cinema-textMuted">Lift Relatif (B vs A)</div>
              <div
                class="text-sm font-mono font-bold mt-0.5"
                :class="(summary?.relativeLift ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ (summary?.relativeLift ?? 0) >= 0 ? '+' : '' }}{{ summary?.relativeLift ?? 0 }} %
              </div>
            </div>
            <div>
              <div class="text-[11px] text-cinema-textMuted">Recommandation</div>
              <div class="text-sm font-bold mt-0.5" :class="summary?.recommendation ? 'text-accent-gold' : 'text-cinema-textMuted'">
                {{ summary?.recommendation ? `Gagnant : Variante ${summary.recommendation}` : 'Poursuivre le test' }}
              </div>
            </div>
          </div>

          <p class="text-xs text-cinema-textMuted leading-relaxed">
            <span v-if="summary?.isSignificant">
              <strong>Conclusion :</strong> La différence observée est statistiquement significative avec un niveau de confiance supérieur à 95%.
              La variante <strong class="text-accent-gold">{{ summary?.recommendation }}</strong> produit un impact mesurable réel.
            </span>
            <span v-else>
              <strong>Conclusion :</strong> L'écart actuel peut être imputable au bruit aléatoire. Il est recommandé de collecter davantage d'expositions avant de prendre une décision finale.
            </span>
          </p>
        </div>

        <!-- Synthèse comparative & Boutons d'action -->
        <div class="p-4 rounded-xl bg-cinema-card border border-cinema-border/60 flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-cinema-textMuted leading-relaxed max-w-md">
            <strong class="text-white">Attribution robuste :</strong> Écriture différée (Lazy Write), protection anti-course critique et dédoublonnage strict par sujet unique.
          </div>
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button
              @click="handleSimulate"
              :disabled="simulating"
              class="px-3.5 py-2 rounded-md bg-cinema-darker hover:bg-cinema-cardHover border border-cinema-border text-xs font-semibold text-cinema-text transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Simuler un jeu de données A/B pour observer le comportement statistique"
            >
              <span>{{ simulating ? 'Simulation...' : 'Simuler 160 visiteurs' }}</span>
            </button>
            <button
              @click="handleResetSlots"
              class="px-3.5 py-2 rounded-md bg-cinema-darker hover:bg-cinema-cardHover border border-cinema-border text-xs font-semibold text-cinema-text hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
              title="Libérer tous les créneaux"
            >
              <span>Libérer les créneaux</span>
            </button>
            <button
              @click="loadMetrics"
              class="px-3.5 py-2 rounded-md bg-accent-gold/15 hover:bg-accent-gold/25 border border-accent-gold/30 text-xs font-semibold text-accent-gold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>Actualiser</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRef } from 'vue';
import { useAbTest, type AbMetric, type AbSummary } from '../composables/useAbTest';
import { useSlots } from '../composables/useSlots';
import { useAccessibleDialog } from '../composables/useAccessibleDialog';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits(['close']);

const modalRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useAccessibleDialog({
  isOpen: toRef(props, 'show'),
  dialogRef: modalRef,
  initialFocusRef: closeButtonRef,
  onClose: () => emit('close'),
});

const { variant, experimentId, exposed, measured, bookingButtonLabel, fetchMetrics, simulateData } = useAbTest();
const { resetSlots } = useSlots();

const loading = ref(false);
const simulating = ref(false);
const metrics = ref<AbMetric[]>([]);
const summary = ref<AbSummary | undefined>(undefined);

const metricA = computed(() => metrics.value.find(m => m.variant === 'A'));
const metricB = computed(() => metrics.value.find(m => m.variant === 'B'));

const formatRate = (rate: number | null | undefined) => {
  if (rate === null || rate === undefined) return 'N/A';
  return (rate * 100).toFixed(1) + ' %';
};

const formatCI = (ci?: [number, number]) => {
  if (!ci || (ci[0] === 0 && ci[1] === 0)) return '[ — ]';
  return `[${(ci[0] * 100).toFixed(1)}% – ${(ci[1] * 100).toFixed(1)}%]`;
};

const loadMetrics = async () => {
  loading.value = true;
  try {
    const data = await fetchMetrics();
    metrics.value = data.variants;
    summary.value = data.summary;
  } finally {
    loading.value = false;
  }
};

const handleResetSlots = async () => {
  await resetSlots();
  await loadMetrics();
};

const handleSimulate = async () => {
  simulating.value = true;
  try {
    // 80 exposés A avec 16 conversions (20%) vs 80 exposés B avec 32 conversions (40%)
    await simulateData({ countA: 80, convA: 16, countB: 80, convB: 32 });
    await loadMetrics();
  } finally {
    simulating.value = false;
  }
};

onMounted(() => {
  loadMetrics();
});
</script>
