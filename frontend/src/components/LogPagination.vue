<template>
  <nav :aria-label="label" class="flex items-center justify-between gap-3 mt-4">
    <button
      type="button"
      class="px-3 py-1.5 rounded-md bg-cinema-card border border-cinema-border text-xs font-semibold text-cinema-text hover:border-accent-gold/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      :disabled="page <= 1 || loading"
      @click="$emit('change', page - 1)"
    >
      Page précédente
    </button>
    <p class="text-xs text-cinema-textMuted">Page {{ page }} sur {{ totalPages }}</p>
    <button
      type="button"
      class="px-3 py-1.5 rounded-md bg-cinema-card border border-cinema-border text-xs font-semibold text-cinema-text hover:border-accent-gold/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      :disabled="page >= totalPages || loading"
      @click="$emit('change', page + 1)"
    >
      Page suivante
    </button>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  page: number;
  totalPages: number;
  loading: boolean;
}>();

defineEmits<{ change: [page: number] }>();
</script>
