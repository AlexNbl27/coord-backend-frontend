<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center max-w-md">
      <!-- Icône 404 -->
      <div class="relative mb-8">
        <div class="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-cinema-border to-cinema-darker flex items-center justify-center">
          <span class="text-6xl font-bold text-cinema-textMuted">404</span>
        </div>
        <!-- Éclat doré -->
        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-16 h-8 bg-accent-gold/30 rounded-full blur-xl -rotate-12"></div>
        <div class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 w-24 h-4 bg-accent-gold/20 rounded-full blur-lg rotate-12"></div>
      </div>

      <!-- Message -->
      <h1 class="text-3xl font-bold text-white mb-4">
        Page non trouvée
      </h1>
      <p class="text-cinema-textMuted mb-8">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <router-link to="/" class="btn btn-primary">
          Retour à l'accueil
        </router-link>
        <button @click="goBack" class="btn btn-outline">
          Retour en arrière
        </button>
      </div>

      <!-- Illustration -->
      <div class="mt-12 opacity-50">
        <div class="w-24 h-24 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-full h-full text-cinema-border/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goBack = () => {
  router.go(-1);
};
</script>

<style scoped>
/* Animation pour le nombre 404 */
.w-32 {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Animation pour les éclats */
.absolute.top-0 {
  animation: fadeInOut 2s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% {
    opacity: 0.3;
    transform: translateY(-20px) translateX(-5px) rotate(12deg);
  }
  50% {
    opacity: 0.6;
    transform: translateY(-10px) translateX(5px) rotate(12deg);
  }
}
</style>
