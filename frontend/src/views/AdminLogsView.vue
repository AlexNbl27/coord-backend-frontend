<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto space-y-12">
      <header>
        <h1 class="font-display text-3xl font-bold text-white tracking-tight">Journaux d'activité</h1>
        <p class="text-cinema-textMuted text-sm mt-1">
          Réservations et actions d'administration{{ scopeLabel }}
        </p>
      </header>

      <section aria-labelledby="reservation-logs-title">
        <h2 id="reservation-logs-title" class="font-display text-xl font-bold text-white mb-4">Réservations</h2>

        <form
          role="search"
          aria-label="Filtrer les journaux de réservation"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-cinema-card border border-cinema-border/60"
          @submit.prevent="searchReservations"
        >
          <div>
            <label for="log-cinema" class="block text-xs font-medium text-cinema-text mb-1">Cinéma (slug)</label>
            <input id="log-cinema" v-model="reservationFilters.cinema" type="text" autocomplete="off" class="log-input" />
          </div>
          <div>
            <label for="log-movie" class="block text-xs font-medium text-cinema-text mb-1">Film (identifiant)</label>
            <input id="log-movie" v-model="reservationFilters.movie" type="text" autocomplete="off" class="log-input" />
          </div>
          <div>
            <label for="log-slot" class="block text-xs font-medium text-cinema-text mb-1">Séance (identifiant)</label>
            <input id="log-slot" v-model="reservationFilters.slot" type="text" autocomplete="off" class="log-input" />
          </div>
          <div>
            <label for="log-action" class="block text-xs font-medium text-cinema-text mb-1">Action</label>
            <select id="log-action" v-model="reservationFilters.action" class="log-input">
              <option value="">Toutes</option>
              <option v-for="action in RESERVATION_ACTIONS" :key="action" :value="action">{{ ACTION_LABELS[action] }}</option>
            </select>
          </div>
          <div>
            <label for="log-from" class="block text-xs font-medium text-cinema-text mb-1">Du</label>
            <input id="log-from" v-model="reservationFilters.from" type="datetime-local" class="log-input" />
          </div>
          <div>
            <label for="log-to" class="block text-xs font-medium text-cinema-text mb-1">Au</label>
            <input id="log-to" v-model="reservationFilters.to" type="datetime-local" class="log-input" />
          </div>
          <div class="flex items-end gap-2 sm:col-span-2">
            <button type="submit" class="px-4 py-2 rounded-md bg-accent-gold text-cinema-dark text-sm font-semibold cursor-pointer">
              Filtrer
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-md bg-cinema-darker border border-cinema-border text-sm font-semibold text-cinema-text cursor-pointer"
              @click="clearReservationFilters"
            >
              Réinitialiser
            </button>
          </div>
        </form>

        <p role="status" aria-live="polite" class="text-xs text-cinema-textMuted mt-4">
          {{ reservations.loading.value ? 'Chargement des journaux…' : `${reservations.total.value} entrée(s)` }}
        </p>
        <p v-if="reservations.error.value" role="alert" class="error-message mt-2">{{ reservations.error.value }}</p>

        <div
          class="mt-3 overflow-x-auto rounded-xl border border-cinema-border/60"
          role="region"
          aria-label="Tableau du journal des réservations"
          tabindex="0"
        >
          <table class="min-w-full text-sm text-left">
            <caption class="sr-only">Journal des réservations, du plus récent au plus ancien</caption>
            <thead class="bg-cinema-darker text-xs uppercase text-cinema-textMuted">
              <tr>
                <th scope="col" class="px-3 py-2">Date</th>
                <th scope="col" class="px-3 py-2">Action</th>
                <th scope="col" class="px-3 py-2">Cinéma</th>
                <th scope="col" class="px-3 py-2">Film</th>
                <th scope="col" class="px-3 py-2">Séance</th>
                <th scope="col" class="px-3 py-2">Réservation</th>
                <th scope="col" class="px-3 py-2">Utilisateur</th>
                <th scope="col" class="px-3 py-2">Places</th>
                <th scope="col" class="px-3 py-2">Trace</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!reservations.loading.value && reservations.items.value.length === 0">
                <td colspan="9" class="px-3 py-6 text-center text-cinema-textMuted">Aucune entrée pour ces filtres.</td>
              </tr>
              <tr v-for="log in reservations.items.value" :key="log.id" class="border-t border-cinema-border/40 text-cinema-text">
                <td class="px-3 py-2 whitespace-nowrap"><time :datetime="log.at">{{ formatDate(log.at) }}</time></td>
                <td class="px-3 py-2">{{ ACTION_LABELS[log.action] ?? log.action }}</td>
                <td class="px-3 py-2">{{ log.cinemaSlug ?? '—' }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ log.movieId ?? '—' }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ log.slotId ?? '—' }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ log.bookingId ? shortId(log.bookingId) : '—' }}</td>
                <td class="px-3 py-2 text-xs" :title="log.userId ?? undefined">{{ log.userEmail || (log.userId ? shortId(log.userId) : '—') }}</td>
                <td class="px-3 py-2">{{ log.quantity }}</td>
                <td class="px-3 py-2">
                  <a
                    v-if="log.traceId"
                    :href="jaegerTraceUrl(log.traceId)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-xs text-accent-gold underline hover:text-white"
                    :aria-label="`Ouvrir la trace ${shortId(log.traceId)} dans Jaeger (nouvel onglet)`"
                  >{{ shortId(log.traceId) }}</a>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <LogPagination
          label="Pagination du journal des réservations"
          :page="reservations.page.value"
          :total-pages="reservations.totalPages.value"
          :loading="reservations.loading.value"
          @change="(p) => reservations.load(reservationQuery(), p)"
        />
      </section>

      <section aria-labelledby="audit-logs-title">
        <h2 id="audit-logs-title" class="font-display text-xl font-bold text-white mb-4">Audit des actions d'administration</h2>

        <form
          role="search"
          aria-label="Filtrer le journal d'audit"
          class="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-cinema-card border border-cinema-border/60"
          @submit.prevent="searchAudit"
        >
          <div class="min-w-[180px] flex-1">
            <label for="audit-action" class="block text-xs font-medium text-cinema-text mb-1">Action</label>
            <input id="audit-action" v-model="auditFilters.action" type="text" autocomplete="off" placeholder="ACCESS_DENIED" class="log-input w-full" />
          </div>
          <div class="min-w-[180px] flex-1">
            <label for="audit-cinema" class="block text-xs font-medium text-cinema-text mb-1">Cinéma (slug)</label>
            <input id="audit-cinema" v-model="auditFilters.cinema" type="text" autocomplete="off" class="log-input w-full" />
          </div>
          <button type="submit" class="px-4 py-2 rounded-md bg-accent-gold text-cinema-dark text-sm font-semibold cursor-pointer">
            Filtrer l'audit
          </button>
          <button type="button" class="px-3 py-2 rounded-md border border-cinema-border text-cinema-textMuted hover:text-white text-sm cursor-pointer" @click="resetAudit">
            Réinitialiser
          </button>
        </form>

        <p role="status" aria-live="polite" class="text-xs text-cinema-textMuted mt-4">
          {{ audit.loading.value ? 'Chargement de l\'audit…' : `${audit.total.value} entrée(s) d'audit` }}
        </p>
        <p v-if="audit.error.value" role="alert" class="error-message mt-2">{{ audit.error.value }}</p>

        <div
          class="mt-3 overflow-x-auto rounded-xl border border-cinema-border/60"
          role="region"
          aria-label="Tableau du journal d'audit"
          tabindex="0"
        >
          <table class="min-w-full text-sm text-left">
            <caption class="sr-only">Journal d'audit chaîné, du plus récent au plus ancien</caption>
            <thead class="bg-cinema-darker text-xs uppercase text-cinema-textMuted">
              <tr>
                <th scope="col" class="px-3 py-2">N°</th>
                <th scope="col" class="px-3 py-2">Date</th>
                <th scope="col" class="px-3 py-2">Acteur</th>
                <th scope="col" class="px-3 py-2">Action</th>
                <th scope="col" class="px-3 py-2">Cible</th>
                <th scope="col" class="px-3 py-2">Résultat</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!audit.loading.value && audit.items.value.length === 0">
                <td colspan="6" class="px-3 py-6 text-center text-cinema-textMuted">Aucune entrée d'audit.</td>
              </tr>
              <tr v-for="entry in audit.items.value" :key="entry.seq" class="border-t border-cinema-border/40 text-cinema-text">
                <td class="px-3 py-2 font-mono text-xs">{{ entry.seq }}</td>
                <td class="px-3 py-2 whitespace-nowrap"><time :datetime="entry.at">{{ formatDate(entry.at) }}</time></td>
                <td class="px-3 py-2 text-xs" :title="entry.actor?.id">{{ entry.actor ? `${entry.actor.email || shortId(entry.actor.id)} (${entry.actor.role ?? '?'})` : '—' }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ entry.action }}</td>
                <td class="px-3 py-2 text-xs">{{ formatTarget(entry.target) }}</td>
                <td class="px-3 py-2 text-xs font-semibold">{{ entry.result }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <LogPagination
          label="Pagination du journal d'audit"
          :page="audit.page.value"
          :total-pages="audit.totalPages.value"
          :loading="audit.loading.value"
          @change="(p) => audit.load(auditQuery(), p)"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import LogPagination from '../components/LogPagination.vue';
import {
  RESERVATION_ACTIONS,
  jaegerTraceUrl,
  usePagedLogs,
  type AuditEntry,
  type LogFilters,
  type ReservationAction,
  type ReservationLogEntry,
} from '../composables/useAdminLogs';
import { useSession } from '../composables/useSession';

const ACTION_LABELS: Record<ReservationAction, string> = {
  BOOKED: 'Réservée',
  CANCELLED: 'Annulée',
  REJECTED_DISABLED: 'Refusée (cinéma désactivé)',
  REJECTED_FULL: 'Refusée (complet)',
  REJECTED_CONFLICT: 'Refusée (doublon)',
};

const { currentUser } = useSession();

const scopeLabel = computed(() => {
  const user = currentUser.value;
  if (user?.role === 'CINEMA_ADMIN') {
    return ` — périmètre : ${(user.cinemaSlugs ?? []).join(', ') || 'aucun cinéma'}`;
  }
  return '';
});

const reservations = usePagedLogs<ReservationLogEntry>('/api/admin/logs/reservations');
const audit = usePagedLogs<AuditEntry>('/api/admin/audit');

const emptyReservationFilters = () => ({ cinema: '', movie: '', slot: '', action: '', from: '', to: '' });
const reservationFilters = reactive(emptyReservationFilters());
const auditFilters = reactive({ action: '', cinema: '' });

const toIso = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const reservationQuery = (): LogFilters => ({
  ...reservationFilters,
  from: toIso(reservationFilters.from),
  to: toIso(reservationFilters.to),
});

const auditQuery = (): LogFilters => ({ ...auditFilters });

const searchReservations = () => reservations.load(reservationQuery(), 1);
const searchAudit = () => audit.load(auditQuery(), 1);

const clearReservationFilters = () => {
  Object.assign(reservationFilters, emptyReservationFilters());
  searchReservations();
};

const resetAudit = () => {
  auditFilters.action = '';
  auditFilters.cinema = '';
  searchAudit();
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' }).format(new Date(iso));

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);

const formatTarget = (target: AuditEntry['target']) => {
  if (!target) return '—';
  const parts = [target.type, target.id].filter(Boolean).join(' ');
  return target.cinemaSlug ? `${parts} · ${target.cinemaSlug}` : parts || '—';
};

onMounted(() => {
  searchReservations();
  searchAudit();
});
</script>

<style scoped>
.log-input {
  @apply w-full px-3 py-2 rounded-md bg-cinema-darker border border-cinema-border text-sm text-cinema-text focus:outline-none focus:ring-2 focus:ring-accent-gold;
}
</style>
