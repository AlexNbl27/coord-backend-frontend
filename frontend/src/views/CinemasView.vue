<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="font-display text-3xl font-bold text-white tracking-tight">Cinémas autour de moi</h1>
        <p class="text-cinema-textMuted text-sm mt-1">
          Votre position n'est pas enregistrée.
        </p>
      </div>

      <NearbyBar @center="handleCenter" />

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label for="cinema-feature" class="sr-only">Équipement</label>
          <select
            id="cinema-feature"
            v-model="feature"
            class="h-10 px-3 rounded-xl bg-cinema-darker border border-cinema-border text-cinema-text text-sm focus:border-accent-gold focus:outline-none"
          >
            <option value="">Tous les équipements</option>
            <option value="imax">IMAX</option>
            <option value="dolby">Dolby</option>
            <option value="vo">Version originale</option>
          </select>
        </div>
        <button
          v-if="center && cinemas.length"
          type="button"
          class="text-sm text-cinema-textMuted hover:text-white underline cursor-pointer"
          :aria-expanded="showMap"
          @click="showMap = !showMap"
        >
          {{ showMap ? 'Masquer la carte' : 'Afficher la carte' }}
        </button>
      </div>

      <p v-if="center?.label" class="text-sm text-cinema-textMuted">Autour de : {{ center.label }}</p>
      <p v-if="center?.accuracyM && center.accuracyM > 1000" class="text-sm text-amber-300">
        Position approximative (environ {{ formatDistance(center.accuracyM / 1000) }}).
      </p>

      <NearbyMap v-if="showMap && center" :center="center" :radius-km="5" :cinemas="cinemas" />

      <p role="status" class="text-sm text-cinema-text">{{ summary }}</p>
      <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>

      <ul class="space-y-3">
        <li
          v-for="c in cinemas"
          :key="c.slug"
          class="flex items-center justify-between gap-4 p-4 rounded-xl bg-cinema-card border border-cinema-border/60"
        >
          <div>
            <p class="font-semibold text-white">{{ c.name }}</p>
            <p class="text-sm text-cinema-textMuted">{{ c.address }}, {{ c.city }}</p>
            <p v-if="c.features?.length" class="text-xs text-cinema-textMuted mt-1">{{ c.features.join(', ').toUpperCase() }}</p>
            <p v-if="c.status === 'DISABLED'" class="text-xs text-amber-300 mt-1">Réservations temporairement suspendues</p>
            <a
              v-if="isValidSlug(c.slug)"
              :href="tenantUrl(c.slug, '/slots')"
              class="inline-block mt-2 text-sm text-accent-gold hover:underline"
            >
              Voir les séances<span class="sr-only"> de {{ c.name }}</span>
            </a>
          </div>
          <p v-if="c.distanceKm !== null" class="text-sm text-accent-gold text-right shrink-0">
            {{ formatDistance(c.distanceKm) }}<br />
            <span class="text-xs text-cinema-textMuted">à vol d'oiseau</span>
          </p>
        </li>
      </ul>

      <nav v-if="pages > 1" class="flex items-center justify-center gap-4" aria-label="Pages de résultats">
        <button type="button" class="px-3 py-1.5 rounded-full border border-cinema-border text-sm disabled:opacity-40" :disabled="page === 1" @click="page--">
          Précédent
        </button>
        <span class="text-sm text-cinema-textMuted">Page {{ page }} sur {{ pages }}</span>
        <button type="button" class="px-3 py-1.5 rounded-full border border-cinema-border text-sm disabled:opacity-40" :disabled="page === pages" @click="page++">
          Suivant
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import NearbyBar from '../components/NearbyBar.vue';
import { apiClient } from '../services/apiClient';
import { type Center, formatDistance, nearbyParams } from '../services/geo';
import { isValidSlug, tenantUrl } from '../services/tenant';

const NearbyMap = defineAsyncComponent(() => import('../components/NearbyMap.vue'));

interface Cinema {
  slug: string;
  name: string;
  address: string;
  city: string;
  features: string[];
  status?: 'ACTIVE' | 'DISABLED';
  latitude: number;
  longitude: number;
  distanceKm: number | null;
}


const center = ref<Center | null>(null);
const feature = ref('');
const page = ref(1);
const cinemas = ref<Cinema[]>([]);
const total = ref(0);
const error = ref('');
const showMap = ref(false);

const pages = computed(() => Math.max(1, Math.ceil(total.value / 6)));
const summary = computed(() =>
  center.value ? `${total.value} cinéma(s) à moins de 5 km` : `${total.value} cinéma(s) dans l'annuaire`
);

const load = async () => {
  error.value = '';
  const params = center.value
    ? nearbyParams(center.value, 5, feature.value, page.value)
    : { feature: feature.value || undefined, page: page.value, limit: 6 };
  try {
    const { data } = await apiClient.get('/api/cinemas', { params });
    cinemas.value = data.data;
    total.value = data.total;
  } catch (err: any) {
    cinemas.value = [];
    total.value = 0;
    error.value = err.response?.data?.detail || 'La recherche a échoué, réessayez.';
  }
};

const reload = () => {
  if (page.value === 1) load();
  else page.value = 1;
};

const handleCenter = (c: Center) => {
  center.value = c;
  reload();
};

watch(feature, reload);
watch(page, load);
onMounted(load);
</script>
