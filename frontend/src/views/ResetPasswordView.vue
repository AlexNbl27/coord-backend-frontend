<template>
  <div class="min-h-screen flex items-start justify-center py-16 px-4">
    <div class="w-full max-w-md bg-cinema-card/80 border border-cinema-border/50 rounded-2xl p-8 backdrop-blur-sm">
      <h1 class="font-display text-3xl font-bold text-white mb-6">Nouveau mot de passe</h1>

      <p v-if="error" role="alert" class="error-message mb-4">{{ error }}</p>

      <form class="space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label for="reset-password" class="block text-sm font-medium text-cinema-text mb-1">Nouveau mot de passe</label>
          <input
            id="reset-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="128"
            required
            aria-describedby="reset-password-hint"
            class="input"
          />
          <p id="reset-password-hint" class="text-xs text-cinema-textMuted mt-1">8 caractères minimum.</p>
        </div>
        <div>
          <label for="reset-confirm" class="block text-sm font-medium text-cinema-text mb-1">Confirmer le mot de passe</label>
          <input id="reset-confirm" v-model="confirm" type="password" autocomplete="new-password" required class="input" />
        </div>
        <button type="submit" class="btn btn-primary w-full" :disabled="pending">
          {{ pending ? 'Patientez…' : 'Changer mon mot de passe' }}
        </button>
      </form>

      <router-link to="/login" class="inline-block mt-6 text-sm text-accent-gold hover:underline">Retour à la connexion</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from '../composables/useSession';

const route = useRoute();
const router = useRouter();
const { resetPassword } = useSession();

const password = ref('');
const confirm = ref('');
const error = ref('');
const pending = ref(false);

const submit = async () => {
  error.value = '';
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (!token) {
    error.value = 'Lien invalide ou expiré.';
    return;
  }
  if (password.value !== confirm.value) {
    error.value = 'Les deux mots de passe ne correspondent pas.';
    return;
  }
  pending.value = true;
  try {
    const failure = await resetPassword(token, password.value);
    if (failure) {
      error.value = failure;
      return;
    }
    await router.replace({ name: 'login', query: { reset: 'ok' } });
  } finally {
    pending.value = false;
  }
};
</script>
