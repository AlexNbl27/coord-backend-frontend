<template>
  <div class="min-h-[calc(100vh-14rem)] flex items-start justify-center py-16 px-4 sm:px-6 lg:px-8">
    <div class="w-full max-w-md bg-cinema-card/80 border border-cinema-border/50 rounded-2xl p-8 backdrop-blur-sm">
      <div
        v-if="currentUser && mode !== 'mfa'"
        role="status"
        class="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between gap-2"
      >
        <span>Connecté en tant que <strong>{{ currentUser.name || currentUser.email }}</strong></span>
        <router-link to="/reservations" class="text-accent-gold font-semibold hover:underline shrink-0">Mes billets →</router-link>
      </div>
      <h1 class="font-display text-3xl font-bold text-white mb-6">{{ TITLES[mode] }}</h1>

      <p v-if="notice" role="status" class="success-message mb-4">{{ notice }}</p>
      <p v-if="error" role="alert" class="error-message mb-4">{{ error }}</p>

      <form v-if="mode === 'mfa'" class="space-y-4" novalidate @submit.prevent="submitMfa">
        <div v-if="totpSecret" class="rounded-xl bg-cinema-darker border border-cinema-border/60 p-4 space-y-2 text-xs text-cinema-textMuted">
          <p class="text-white font-medium">Configuration MFA TOTP</p>
          <p>Scannez ce QR code avec votre application d'authentification :</p>
          <img
            v-if="totpQr"
            :src="totpQr"
            width="192"
            height="192"
            alt="QR code de configuration TOTP pour votre application d'authentification"
            class="mx-auto rounded-lg bg-white p-2"
          />
          <p>Ou saisissez ce secret manuellement :</p>
          <p class="font-mono text-accent-gold break-all select-all">{{ totpSecret }}</p>
        </div>
        <div>
          <label for="auth-totp" class="block text-sm font-medium text-cinema-text mb-1">Code TOTP (6 chiffres)</label>
          <input
            id="auth-totp"
            v-model.trim="totpCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            required
            class="input"
          />
        </div>
        <button type="submit" class="btn btn-primary w-full" :disabled="pending">
          {{ pending ? 'Vérification…' : 'Valider le code MFA' }}
        </button>
      </form>

      <form v-else class="space-y-4" novalidate @submit.prevent="submit">
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
            :minlength="mode === 'register' ? 12 : undefined"
            maxlength="128"
            required
            :aria-describedby="mode === 'register' ? 'auth-password-hint' : undefined"
            class="input"
          />
          <p v-if="mode === 'register'" id="auth-password-hint" class="text-xs text-cinema-textMuted mt-1">12 caractères minimum.</p>
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="pending">
          {{ pending ? 'Patientez…' : SUBMIT_LABELS[mode] }}
        </button>
      </form>

      <template v-if="!isAdminPlane && googleEnabled && mode !== 'forgot'">
        <p class="my-4 text-center text-xs text-cinema-textMuted">ou</p>
        <a :href="googleUrl" class="btn btn-outline w-full text-center">Continuer avec Google</a>
      </template>

      <div v-if="!isAdminPlane" class="mt-6 flex flex-col gap-2 text-sm">
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
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from '../composables/useSession';

type Mode = 'login' | 'register' | 'forgot' | 'mfa';

const TITLES: Record<Mode, string> = {
  login: 'Connexion',
  register: 'Créer un compte',
  forgot: 'Mot de passe oublié',
  mfa: 'Vérification MFA',
};
const SUBMIT_LABELS: Record<Mode, string> = {
  login: 'Se connecter',
  register: 'Créer mon compte',
  forgot: 'Envoyer le lien',
  mfa: 'Valider le code MFA',
};

const route = useRoute();
const router = useRouter();
const {
  currentUser,
  login,
  register,
  forgotPassword,
  setupMfa,
  verifyMfa,
  isAdminPlane,
  googleEnabled,
  mfaEnabled,
  mfaVerifiedAt,
  initSession
} = useSession();

const OAUTH_ERRORS: Record<string, string> = {
  google: 'La connexion avec Google a échoué. Réessayez.',
  google_email_taken: 'Un compte existe déjà avec cet email : connectez-vous avec votre mot de passe.',
  cinema_unavailable: 'Ce cinéma est temporairement indisponible.',
};

const mode = ref<Mode>('login');
const email = ref('');
const name = ref('');
const password = ref('');
const totpCode = ref('');
const totpSecret = ref('');
const totpQr = ref('');
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
    if (isAdminPlane && !mfaVerifiedAt.value) {
      await startMfaStep();
      return;
    }
    await router.replace(redirectTarget());
  } finally {
    pending.value = false;
  }
};

// TOTP step only: QR code + secret on first setup, code field once TOTP is enabled.
async function startMfaStep() {
  if (!mfaEnabled.value) {
    const setup = await setupMfa();
    if (typeof setup === 'string') {
      error.value = setup;
      return;
    }
    totpSecret.value = setup.secret;
    const { default: QRCode } = await import('qrcode');
    totpQr.value = await QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 192 }).catch(() => '');
  }
  mode.value = 'mfa';
}

// Already signed in on the admin portal (reload, or step-up asked by the router): only the TOTP is missing.
onMounted(async () => {
  await initSession();
  if (isAdminPlane && currentUser?.value && (mfaVerifiedAt?.value === null || route.query.mfa === '1')) {
    await startMfaStep();
  }
});

const submitMfa = async () => {
  error.value = '';
  pending.value = true;
  try {
    const failure = await verifyMfa(totpCode.value);
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
