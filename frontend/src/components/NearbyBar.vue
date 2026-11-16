<template>
  <div class="bg-cinema-card/70 p-5 rounded-2xl border border-cinema-border/50 shadow-cinema space-y-4">
    <div class="flex flex-col md:flex-row gap-3">
      <button
        type="button"
        class="h-11 px-5 rounded-full bg-accent-gold text-cinema-dark text-sm font-semibold shrink-0 disabled:opacity-60 cursor-pointer"
        :disabled="loading"
        @click="handleLocate"
      >
        {{ loading ? 'Recherche...' : 'Autour de moi (5 km)' }}
      </button>

      <form class="flex flex-col sm:flex-row flex-1 gap-2 min-w-0" @submit.prevent="handleAddress">
        <label for="nearby-address" class="sr-only">Adresse ou code postal</label>
        <input
          id="nearby-address"
          ref="addressInput"
          v-model="address"
          type="text"
          autocomplete="postal-code"
          placeholder="ou une adresse, un code postal"
          class="flex-1 min-w-0 h-11 px-4 rounded-full bg-cinema-darker border border-cinema-border text-cinema-text text-sm focus:border-accent-gold focus:outline-none"
          :aria-describedby="error ? 'nearby-error' : undefined"
        />
        <button
          type="submit"
          class="h-11 px-5 rounded-full border border-cinema-border text-cinema-text text-sm font-semibold hover:border-accent-gold disabled:opacity-60 cursor-pointer"
          :disabled="loading || !address.trim()"
        >
          Chercher autour
        </button>
      </form>
    </div>

    <p v-if="error" id="nearby-error" role="alert" class="text-sm text-red-300">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { type Center, GEO_MESSAGES, GeoError, geocode, getPosition } from '../services/geo';

const emit = defineEmits<{ center: [Center] }>();

const address = ref('');
const error = ref('');
const loading = ref(false);
const addressInput = ref<HTMLInputElement | null>(null);

const showError = async (err: unknown) => {
  error.value = err instanceof GeoError ? err.message : GEO_MESSAGES.network;
  await nextTick();
  addressInput.value?.focus();
};

const handleLocate = async () => {
  error.value = '';
  loading.value = true;
  try {
    emit('center', await getPosition());
  } catch (err) {
    await showError(err);
  } finally {
    loading.value = false;
  }
};

const handleAddress = async () => {
  error.value = '';
  loading.value = true;
  try {
    emit('center', await geocode(address.value));
  } catch (err) {
    await showError(err);
  } finally {
    loading.value = false;
  }
};
</script>
