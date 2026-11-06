<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 class="font-display text-3xl font-bold text-white tracking-tight">Choisissez votre cinéma</h1>
        <p class="text-cinema-textMuted text-sm mt-1">
          Chaque cinéma a son propre espace : séances, réservations et billets.
        </p>
      </div>

      <router-link to="/cinemas" class="inline-block text-sm text-accent-gold hover:underline">
        Trouver un cinéma autour de moi
      </router-link>

      <p role="status" class="text-sm text-cinema-text">{{ summary }}</p>
      <p v-if="error" role="alert" class="text-sm text-red-300">{{ error }}</p>

      <ul class="grid gap-3 sm:grid-cols-2" aria-label="Cinémas">
        <li v-for="c in cinemas" :key="c.slug">
          <a
            :href="tenantUrl(c.slug)"
            class="flex h-full flex-col gap-1 p-4 rounded-xl bg-cinema-card border border-cinema-border/60 hover:border-accent-gold focus:border-accent-gold focus:outline-none"
          >
            <span class="font-semibold text-white">{{ c.name }}</span>
            <span class="text-sm text-cinema-textMuted">{{ c.address }}, {{ c.city }}</span>
            <span v-if="c.status === 'DISABLED'" class="text-xs text-amber-300">Réservations temporairement suspendues</span>
          </a>
        </li>
      </ul>

      <nav v-if="pages > 1" class="flex items-center justify-center gap-4" aria-label="Pages de cinémas">
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
import { computed, onMounted, ref, watch } from 'vue';
import { apiClient } from '../services/apiClient';
import { isValidSlug, tenantUrl } from '../services/tenant';

interface CinemaEntry {
  slug: string;
  name: string;
  address: string;
  city: string;
  status?: 'ACTIVE' | 'DISABLED';
}

const PAGE_SIZE = 20;
const page = ref(1);
const total = ref(0);
const cinemas = ref<CinemaEntry[]>([]);
const error = ref('');

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const summary = computed(() => `${total.value} cinéma(s) disponible(s)`);

const load = async () => {
  error.value = '';
  try {
    const { data } = await apiClient.get('/api/cinemas', { params: { page: page.value, limit: PAGE_SIZE } });
    cinemas.value = (data.data as CinemaEntry[]).filter((c) => isValidSlug(c.slug));
    total.value = data.total;
  } catch (err: any) {
    cinemas.value = [];
    total.value = 0;
    error.value = err.response?.data?.detail || 'Impossible de charger la liste des cinémas.';
  }
};

watch(page, load);
onMounted(load);
</script>
