<template>
  <div class="min-h-screen flex items-start justify-center py-16 px-4">
    <div class="w-full max-w-md bg-cinema-card/80 border border-cinema-border/50 rounded-2xl p-8 backdrop-blur-sm">
      <h1 class="font-display text-3xl font-bold text-white mb-6">{{ TITLES[mode] }}</h1>

      <p v-if="notice" role="status" class="success-message mb-4">{{ notice }}</p>
      <p v-if="error" role="alert" class="error-message mb-4">{{ error }}</p>

      <form class="space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label for="auth-email" class="block text-sm font-medium text-cinema-text mb-1">Email</label>
          <input id="auth-email" v-model.trim="email" type="email" autocomplete="email" required class="input" />
        </div>

        <div v-if="mode === 'register'">
          <label for="auth-name" class="block text-sm font-medium text-cinema-text mb-1">Nom</label>
          <input id="auth-name" v-model.trim="name" type="text" autocomplete="name" maxlength="80" required class="input" />
        </div>

        <div v-if="mode !== 'forgot'">
          <label for="auth-password" class="block text-sm font-medium text-cinema-text mb-1">Mot de passe</label>
          <input
            id="auth-password"
            v-model="password"
            type="password"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            minlength="8"
            maxlength="128"
            required
            aria-describedby="auth-password-hint"
            class="input"
          />
          <p v-if="mode === 'register'" id="auth-password-hint" class="text-xs text-cinema-textMuted mt-1">8 caractères minimum.</p>
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="pending">
          {{ pending ? 'Patientez…' : SUBMIT_LABELS[mode] }}
        </button>
      </form>

      <template v-if="googleEnabled && mode !== 'forgot'">
        <p class="my-4 text-center text-xs text-cinema-textMuted">ou</p>
        <a :href="googleUrl" class="btn btn-outline w-full text-center">Continuer avec Google</a>
      </template>

      <div class="mt-6 flex flex-col gap-2 text-sm">
        <button v-if="mode === 'login'" type="button" class="text-accent-gold hover:underline text-left cursor-pointer" @click="switchMode('forgot')">
          Mot de passe oublié ?
        </button>
        <button v-if="mode !== 'register'" type="button" class="text-accent-gold hover:underline text-left cursor-pointer" @click="switchMode('register')">
          Pas encore de compte ? Créer un compte
        </button>
        <button v-if="mode !== 'login'" type="button" class="text-accent-gold hover:underline text-left cursor-pointer" @click="switchMode('login')">
          Déjà un compte ? Se connecter
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from '../composables/useSession';

type Mode = 'login' | 'register' | 'forgot';

const TITLES: Record<Mode, string> = {
  login: 'Connexion',
  register: 'Créer un compte',
  forgot: 'Mot de passe oublié',
};
const SUBMIT_LABELS: Record<Mode, string> = {
  login: 'Se connecter',
  register: 'Créer mon compte',
  forgot: 'Envoyer le lien',
};

const route = useRoute();
const router = useRouter();
const { login, register, forgotPassword, googleEnabled, initSession } = useSession();
void initSession();

const OAUTH_ERRORS: Record<string, string> = {
  google: 'La connexion avec Google a échoué. Réessayez.',
  google_email_taken: 'Un compte existe déjà avec cet email : connectez-vous avec votre mot de passe.',
};

const mode = ref<Mode>('login');
const email = ref('');
const name = ref('');
const password = ref('');
const error = ref(OAUTH_ERRORS[String(route.query.error)] ?? '');
const notice = ref(route.query.reset === 'ok' ? 'Mot de passe modifié. Vous pouvez vous connecter.' : '');
const pending = ref(false);

const switchMode = (next: Mode) => {
  mode.value = next;
  error.value = '';
  notice.value = '';
};

// Uniquement des chemins internes (évite les redirections ouvertes)
const redirectTarget = () => {
  const target = route.query.redirect;
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/';
};

const googleUrl = computed(() => `/api/session/google?redirect=${encodeURIComponent(redirectTarget())}`);

const submit = async () => {
  error.value = '';
  notice.value = '';
  pending.value = true;
  try {
    if (mode.value === 'forgot') {
      const failure = await forgotPassword(email.value);
      if (failure) {
        error.value = failure;
      } else {
        notice.value = 'Si un compte existe avec cette adresse, un email de réinitialisation vient d\'être envoyé.';
      }
      return;
    }

    const failure = mode.value === 'login'
      ? await login(email.value, password.value)
      : await register(email.value, name.value, password.value);
    if (failure) {
      error.value = failure;
      return;
    }
    await router.replace(redirectTarget());
  } finally {
    pending.value = false;
  }
};
</script>
