<template>
  <div class="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <h1 class="font-display text-3xl font-bold text-white tracking-tight">Statistiques de réservation</h1>
      <p class="text-cinema-textMuted text-sm mt-1 mb-6">Réservations, places vendues et annulations par cinéma, film et jour</p>

      <form class="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8 items-end" @submit.prevent="load">
        <fieldset class="sm:col-span-2">
          <legend class="text-xs font-semibold text-cinema-textMuted mb-1">Regrouper par</legend>
          <div class="flex gap-2" role="group">
            <button
              v-for="option in GROUP_OPTIONS"
              :key="option.value"
              type="button"
              :aria-pressed="groupBy === option.value ? 'true' : 'false'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              :class="groupBy === option.value ? 'bg-accent-gold text-cinema-dark' : 'bg-cinema-card text-cinema-textMuted hover:text-white'"
              @click="groupBy = option.value; load()"
            >
              {{ option.label }}
            </button>
          </div>
        </fieldset>
        <label class="text-xs font-semibold text-cinema-textMuted">
          Cinéma
          <input v-model.trim="cinema" type="text" maxlength="30" placeholder="ex. lumiere" class="mt-1 w-full rounded-md bg-cinema-card border border-cinema-border px-2 py-1.5 text-sm text-white" />
        </label>
        <label class="text-xs font-semibold text-cinema-textMuted">
          Du
          <input v-model="from" type="date" class="mt-1 w-full rounded-md bg-cinema-card border border-cinema-border px-2 py-1.5 text-sm text-white" />
        </label>
        <label class="text-xs font-semibold text-cinema-textMuted">
          Au
          <input v-model="to" type="date" class="mt-1 w-full rounded-md bg-cinema-card border border-cinema-border px-2 py-1.5 text-sm text-white" />
        </label>
        <button type="submit" class="sm:col-start-5 px-4 py-2 rounded-md bg-accent-gold text-cinema-dark font-bold text-sm cursor-pointer">Actualiser</button>
      </form>

      <p v-if="error" role="alert" class="mb-6 p-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-sm">{{ error }}</p>
      <p v-else-if="loading" role="status" class="text-cinema-textMuted text-sm">Chargement…</p>

      <template v-else>
        <dl class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-8">
          <div v-for="kpi in kpis" :key="kpi.label" class="bg-cinema-card/60 border border-cinema-border/50 rounded-xl p-4">
            <dt class="text-xs text-cinema-textMuted">{{ kpi.label }}</dt>
            <dd class="text-2xl font-bold text-white">{{ kpi.value }}</dd>
          </div>
        </dl>

        <section aria-labelledby="top-title" class="mb-10">
          <h2 id="top-title" class="text-xl font-bold text-white mb-3">{{ groupBy === 'movie' ? 'Top films' : 'Cinémas' }}{{ cinema && groupBy === 'movie' ? ` · ${cinema}` : '' }}</h2>
          <p v-if="rows.length === 0" class="text-cinema-textMuted text-sm">Aucune donnée sur la période.</p>
          <figure v-else>
            <ul aria-hidden="true" class="space-y-2 mb-4">
              <li v-for="row in rows" :key="row.key" class="flex items-center gap-3 text-sm">
                <span class="w-40 truncate text-white">{{ row.label }}</span>
                <span class="flex-1 h-3 rounded bg-cinema-border/40">
                  <span class="block h-3 rounded bg-accent-gold" :style="{ width: `${barWidth(row.seats, maxSeats)}%` }"></span>
                </span>
                <span class="w-12 text-right text-cinema-textMuted">{{ row.seats }}</span>
              </li>
            </ul>
            <figcaption class="sr-only">Graphique en barres des places vendues, détaillé dans le tableau suivant.</figcaption>
            <table class="w-full text-sm text-left text-white">
              <caption class="text-left text-cinema-textMuted text-xs mb-2">Données du classement {{ groupBy === 'movie' ? 'par film' : 'par cinéma' }}</caption>
              <thead>
                <tr>
                  <th scope="col">{{ groupBy === 'movie' ? 'Film' : 'Cinéma' }}</th>
                  <th scope="col" class="text-right">Réservations</th>
                  <th scope="col" class="text-right">Annulations</th>
                  <th scope="col" class="text-right">Places</th>
                  <th scope="col" class="text-right">Taux d'annulation</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.key">
                  <th scope="row" class="font-normal">{{ row.label }}</th>
                  <td class="text-right">{{ row.booked }}</td>
                  <td class="text-right">{{ row.cancelled }}</td>
                  <td class="text-right">{{ row.seats }}</td>
                  <td class="text-right">{{ percent(row.cancellationRate) }}</td>
                </tr>
              </tbody>
            </table>
          </figure>
        </section>

        <section aria-labelledby="days-title">
          <h2 id="days-title" class="text-xl font-bold text-white mb-3">Évolution par jour</h2>
          <p v-if="days.length === 0" class="text-cinema-textMuted text-sm">Aucune donnée sur la période.</p>
          <figure v-else>
            <svg aria-hidden="true" :viewBox="`0 0 ${days.length * 24} 100`" preserveAspectRatio="none" class="w-full h-40 mb-4">
              <rect
                v-for="(day, i) in days"
                :key="day.day"
                :x="i * 24 + 4"
                :y="100 - barWidth(day.seats, maxDaySeats)"
                width="16"
                :height="barWidth(day.seats, maxDaySeats)"
                class="fill-accent-gold"
              />
            </svg>
            <figcaption class="sr-only">Histogramme des places vendues par jour, détaillé dans le tableau suivant.</figcaption>
            <table class="w-full text-sm text-left text-white">
              <caption class="text-left text-cinema-textMuted text-xs mb-2">Données quotidiennes (heure de Paris)</caption>
              <thead>
                <tr>
                  <th scope="col">Jour</th>
                  <th scope="col" class="text-right">Réservations</th>
                  <th scope="col" class="text-right">Annulations</th>
                  <th scope="col" class="text-right">Places</th>
                  <th scope="col" class="text-right">Taux d'annulation</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="day in days" :key="day.day">
                  <th scope="row" class="font-normal">{{ day.day }}</th>
                  <td class="text-right">{{ day.booked }}</td>
                  <td class="text-right">{{ day.cancelled }}</td>
                  <td class="text-right">{{ day.seats }}</td>
                  <td class="text-right">{{ percent(day.cancellationRate) }}</td>
                </tr>
              </tbody>
            </table>
          </figure>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiClient } from '../services/apiClient';

interface StatCounters {
  booked: number;
  cancelled: number;
  seats: number;
  cancellationRate: number;
}
interface StatRow extends StatCounters {
  key: string;
  label: string;
}
interface StatDay extends StatCounters {
  day: string;
}

const GROUP_OPTIONS = [
  { value: 'movie', label: 'Film' },
  { value: 'cinema', label: 'Cinéma' },
] as const;

const groupBy = ref<'movie' | 'cinema'>('movie');
const cinema = ref('');
const from = ref('');
const to = ref('');
const rows = ref<StatRow[]>([]);
const days = ref<StatDay[]>([]);
const loading = ref(false);
const error = ref('');

const maxSeats = computed(() => Math.max(0, ...rows.value.map((r) => r.seats)));
const maxDaySeats = computed(() => Math.max(0, ...days.value.map((d) => d.seats)));
const kpis = computed(() => {
  const booked = days.value.reduce((n, d) => n + d.booked, 0);
  const cancelled = days.value.reduce((n, d) => n + d.cancelled, 0);
  return [
    { label: 'Réservations', value: booked },
    { label: 'Annulations', value: cancelled },
    { label: 'Places vendues', value: days.value.reduce((n, d) => n + d.seats, 0) },
    { label: "Taux d'annulation", value: percent(booked ? cancelled / booked : 0) },
  ];
});

const barWidth = (value: number, max: number) => (max > 0 ? Math.max(0, (value / max) * 100) : 0);
const percent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

async function load() {
  loading.value = true;
  error.value = '';
  const params: Record<string, string> = { groupBy: groupBy.value };
  if (cinema.value) params.cinema = cinema.value;
  if (from.value) params.from = from.value;
  if (to.value) params.to = to.value;
  try {
    const { data } = await apiClient.get<{ rows: StatRow[]; days: StatDay[] }>('/api/admin/stats/bookings', { params });
    rows.value = data.rows;
    days.value = data.days;
  } catch (err: any) {
    const status = err?.response?.status;
    error.value = status === 403
      ? 'Accès refusé : ces statistiques sont réservées aux administrateurs de ce cinéma.'
      : err?.response?.data?.detail || 'Le service est momentanément indisponible.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
