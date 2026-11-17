<template>
  <section class="space-y-4" aria-labelledby="seat-picker-title">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 id="seat-picker-title" class="font-display text-lg font-bold text-white">Choix des places</h2>
        <p class="text-xs text-cinema-textMuted mt-0.5">
          Touchez un fauteuil libre, ou laissez-nous vous placer au centre de la salle.
        </p>
      </div>
      <button
        type="button"
        class="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-cinema-border bg-cinema-darker text-xs font-semibold text-cinema-text hover:border-accent-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        :disabled="disabled || !layout || quantity < 1"
        @click="autoPlace"
      >
        Placement automatique
      </button>
    </div>

    <div v-if="loading && !layout" class="h-56 rounded-lg bg-cinema-darker animate-pulse" aria-hidden="true"></div>

    <div v-else-if="loadError" role="alert" class="p-3 rounded bg-red-950/60 border border-red-500/40 text-xs text-red-300 flex items-center justify-between gap-3">
      <span>{{ loadError }}</span>
      <button type="button" class="font-bold text-red-200 underline cursor-pointer" @click="reload">Réessayer</button>
    </div>

    <div v-else-if="layout" class="rounded-xl border border-cinema-border bg-cinema-darker/60 px-3 sm:px-6 pt-5 pb-4">
      <div class="mx-auto max-w-md mb-6" aria-hidden="true">
        <div class="h-1.5 rounded-[50%] bg-accent-gold/80 shadow-[0_6px_24px_2px_rgba(200,164,86,0.45)]"></div>
        <p class="text-center text-2xs tracking-[0.4em] text-cinema-textMuted mt-2">ÉCRAN</p>
      </div>

      <div class="overflow-x-auto pb-1">
        <div
          ref="gridRef"
          role="group"
          aria-label="Plan de la salle"
          class="w-max mx-auto space-y-1.5"
          :class="{ 'opacity-50': disabled }"
        >
          <div
            v-for="row in renderedRows"
            :key="row.label"
            role="group"
            :aria-label="`Rangée ${row.label}`"
            class="flex items-center gap-1"
          >
            <span class="w-5 text-center text-2xs font-mono text-cinema-textMuted" aria-hidden="true">{{ row.label }}</span>
            <template v-for="(cell, i) in row.cells" :key="`${row.label}-${i}`">
              <span v-if="cell.kind === 'aisle'" class="w-3 sm:w-5" aria-hidden="true"></span>
              <span v-else-if="cell.kind === 'empty'" class="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true"></span>
              <button
                v-else
                type="button"
                :data-seat="cell.id"
                :tabindex="cell.id === focusId ? 0 : -1"
                :aria-pressed="isSelected(cell.id) ? 'true' : 'false'"
                :aria-disabled="disabled || isTaken(cell.id) ? 'true' : undefined"
                :aria-label="seatAriaLabel(row.label, cell.n, cell.id)"
                class="seat w-6 h-6 sm:w-7 sm:h-7 rounded-t-lg rounded-b-sm border text-2xs font-bold flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                :class="seatClass(cell.id)"
                @click="toggle(cell.id)"
                @keydown="onKeydown($event, cell.id)"
                @focus="focusId = cell.id"
              >
                <span v-if="isSelected(cell.id)" aria-hidden="true">{{ cell.n }}</span>
                <span v-else-if="isTaken(cell.id)" aria-hidden="true" class="text-cinema-textMuted/60">×</span>
              </button>
            </template>
            <span class="w-5 text-center text-2xs font-mono text-cinema-textMuted" aria-hidden="true">{{ row.label }}</span>
          </div>
        </div>
      </div>

      <ul class="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-2xs text-cinema-textMuted" aria-label="Légende">
        <li class="flex items-center gap-1.5"><span class="w-4 h-4 rounded-t-md rounded-b-sm border border-cinema-borderLight bg-cinema-card" aria-hidden="true"></span>Libre</li>
        <li class="flex items-center gap-1.5"><span class="w-4 h-4 rounded-t-md rounded-b-sm border border-accent-gold bg-accent-gold" aria-hidden="true"></span>Votre choix</li>
        <li class="flex items-center gap-1.5"><span class="w-4 h-4 rounded-t-md rounded-b-sm border border-cinema-border bg-cinema-border/60" aria-hidden="true"></span>Occupé</li>
      </ul>
    </div>

    <p class="text-xs" :class="complete ? 'text-emerald-400' : 'text-cinema-textMuted'" aria-live="polite">
      {{ summary }}
    </p>
    <p v-if="notice" role="status" class="text-xs text-amber-300">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { apiClient } from '../services/apiClient';
import {
  aisleWidth,
  columnOf,
  formatSeatList,
  parseSeat,
  pickBestSeats,
  rowOffset,
  seatId,
  type SeatLayout,
  type SeatMapResponse,
} from '../services/seatMap';

const props = withDefaults(defineProps<{
  slotId: string;
  quantity: number;
  modelValue: string[];
  version?: number;
  disabled?: boolean;
}>(), { version: 0, disabled: false });

const emit = defineEmits<{ 'update:modelValue': [seats: string[]] }>();

type Cell = { kind: 'aisle' } | { kind: 'empty' } | { kind: 'seat'; id: string; n: number };

const layout = ref<SeatLayout | null>(null);
const taken = ref<Set<string>>(new Set());
const loading = ref(false);
const loadError = ref('');
const notice = ref('');
const focusId = ref('');
const gridRef = ref<HTMLElement | null>(null);

const renderedRows = computed(() => {
  const l = layout.value;
  if (!l) return [];
  const edge = aisleWidth(l.cols);
  return l.rows.map((row) => {
    const offset = rowOffset(l, row);
    const cells: Cell[] = [];
    for (let col = 0; col < l.cols; col += 1) {
      if (edge > 0 && (col === edge || col === l.cols - edge)) cells.push({ kind: 'aisle' });
      const n = col - offset + 1;
      cells.push(n >= 1 && n <= row.count ? { kind: 'seat', id: seatId(row.label, n), n } : { kind: 'empty' });
    }
    return { label: row.label, cells };
  });
});

const complete = computed(() => props.quantity > 0 && props.modelValue.length === props.quantity);

const summary = computed(() => {
  if (props.quantity < 1) return 'Ajoutez au moins un billet pour choisir vos places.';
  const chosen = layout.value && props.modelValue.length > 0 ? ` : ${formatSeatList(layout.value, props.modelValue)}` : '';
  if (complete.value) {
    return `${props.quantity} place${props.quantity > 1 ? 's' : ''} choisie${props.quantity > 1 ? 's' : ''}${chosen}`;
  }
  const missing = props.quantity - props.modelValue.length;
  return `Choisissez encore ${missing} place${missing > 1 ? 's' : ''}${chosen}`;
});

const isTaken = (id: string) => taken.value.has(id);
const isSelected = (id: string) => props.modelValue.includes(id);

function seatClass(id: string) {
  if (isSelected(id)) return 'bg-accent-gold border-accent-gold text-cinema-dark shadow-[0_0_12px_rgba(200,164,86,0.55)]';
  if (isTaken(id)) return 'bg-cinema-border/60 border-cinema-border cursor-not-allowed';
  if (props.disabled) return 'bg-cinema-card border-cinema-borderLight cursor-not-allowed';
  return 'bg-cinema-card border-cinema-borderLight hover:border-accent-gold hover:bg-accent-gold/20 cursor-pointer';
}

function seatAriaLabel(row: string, n: number, id: string) {
  const state = isSelected(id) ? 'sélectionné' : isTaken(id) ? 'occupé' : 'libre';
  return `Rangée ${row}, fauteuil ${n}, ${state}`;
}

function toggle(id: string) {
  if (props.disabled || isTaken(id) || props.quantity < 1) return;
  notice.value = '';
  if (isSelected(id)) {
    emit('update:modelValue', props.modelValue.filter((s) => s !== id));
    return;
  }
  const next = [...props.modelValue, id];
  emit('update:modelValue', next.length > props.quantity ? next.slice(next.length - props.quantity) : next);
}

function autoPlace() {
  if (!layout.value || props.disabled) return;
  const seats = pickBestSeats(layout.value, taken.value, props.quantity);
  if (!seats) {
    notice.value = 'Pas assez de places libres pour ce nombre de billets.';
    return;
  }
  notice.value = '';
  emit('update:modelValue', seats);
  focusId.value = seats[0];
}

function seatsInRow(label: string) {
  return layout.value?.rows.find((r) => r.label === label)?.count ?? 0;
}

function neighbour(id: string, key: string): string | null {
  const l = layout.value;
  if (!l) return null;
  const { row, number } = parseSeat(id);
  const rowIndex = l.rows.findIndex((r) => r.label === row);
  const count = seatsInRow(row);
  if (key === 'ArrowLeft') return number > 1 ? seatId(row, number - 1) : null;
  if (key === 'ArrowRight') return number < count ? seatId(row, number + 1) : null;
  if (key === 'Home') return seatId(row, 1);
  if (key === 'End') return seatId(row, count);
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const target = l.rows[rowIndex + (key === 'ArrowUp' ? -1 : 1)];
    if (!target) return null;
    const col = columnOf(l, id);
    const n = Math.min(Math.max(col - rowOffset(l, target) + 1, 1), target.count);
    return seatId(target.label, n);
  }
  return null;
}

async function onKeydown(event: KeyboardEvent, id: string) {
  const next = neighbour(id, event.key);
  if (!next) return;
  event.preventDefault();
  focusId.value = next;
  await nextTick();
  gridRef.value?.querySelector<HTMLButtonElement>(`[data-seat="${next}"]`)?.focus();
}

function defaultFocus() {
  const l = layout.value;
  if (!l) return '';
  if (props.modelValue[0]) return props.modelValue[0];
  return pickBestSeats(l, taken.value, 1)?.[0] ?? seatId(l.rows[0].label, 1);
}

async function reload() {
  if (!props.slotId) return;
  loading.value = true;
  loadError.value = '';
  try {
    const { data } = await apiClient.get<SeatMapResponse>(`/api/slots/${props.slotId}/seats`, { skipOfflineTrigger: true });
    layout.value = data.layout;
    taken.value = new Set(data.taken);
    const lost = props.modelValue.filter((s) => taken.value.has(s));
    if (lost.length > 0) {
      notice.value = `${lost.join(', ')} vien${lost.length > 1 ? 'nent' : 't'} d'être réservé${lost.length > 1 ? 's' : ''} par quelqu'un d'autre.`;
      emit('update:modelValue', props.modelValue.filter((s) => !taken.value.has(s)));
    }
    if (!focusId.value || taken.value.has(focusId.value)) focusId.value = defaultFocus();
  } catch {
    loadError.value = 'Impossible de charger le plan de la salle.';
  } finally {
    loading.value = false;
  }
}

watch(() => props.quantity, (qty) => {
  if (props.modelValue.length > qty) emit('update:modelValue', props.modelValue.slice(0, Math.max(0, qty)));
});

watch(() => [props.slotId, props.version], () => { void reload(); });

onMounted(reload);

defineExpose({ reload });
</script>
