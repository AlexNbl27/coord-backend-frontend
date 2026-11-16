<template>
  <div class="min-h-[calc(100vh-14rem)] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-md">
      <div class="mb-6">
        <div class="w-28 h-28 mx-auto rounded-full bg-cinema-card border border-cinema-border flex items-center justify-center">
          <span class="text-5xl font-bold text-cinema-textMuted">404</span>
        </div>
      </div>

      <h1 class="text-3xl font-bold text-white mb-3">
        Page non trouvée
      </h1>
      <p class="text-cinema-textMuted mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link to="/" class="btn btn-primary">
          Retour à l'accueil
        </router-link>
        <button @click="goBack" class="btn btn-outline">
          Retour en arrière
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goBack = () => {
  if (window.history.length > 2) {
    router.go(-1);
  } else {
    router.push('/');
  }
};
</script>
