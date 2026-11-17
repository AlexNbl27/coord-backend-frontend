<template>
  <div
    v-if="cinemaDisabled"
    role="status"
    class="border-b border-amber-500/40 bg-amber-500/10"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
      <p class="text-amber-100">
        <strong class="font-semibold text-amber-200">{{ cinema?.name ?? 'Ce cinéma' }}</strong>
        n'accepte plus de réservations pour le moment. Vos billets déjà réservés restent valables.
      </p>
      <a :href="otherCinemasHref" class="shrink-0 text-xs font-bold text-accent-gold hover:underline">
        Choisir un autre cinéma →
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCurrentCinema } from '../composables/useCurrentCinema';
import { apexUrl } from '../services/tenant';

const { cinema, cinemaDisabled } = useCurrentCinema();
const otherCinemasHref = apexUrl('/cinemas');
</script>
