<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <div class="mb-8">
        <h1 class="font-display text-3xl font-bold text-white tracking-tight">À propos de CinéSlot</h1>
        <p class="text-cinema-textMuted text-sm mt-1">Plateforme de réservation de cinéma en temps réel</p>
      </div>

      <div class="space-y-12">
        <div class="mb-12">
          <h2 class="text-2xl font-bold text-white mb-4">Qu'est-ce que CinéSlot ?</h2>
          <p class="text-cinema-textMuted leading-relaxed">
            CinéSlot est une application web de consultation du catalogue et de réservation de séances
            avec mise à jour des disponibilités via <span class="text-accent-gold font-semibold">Server-Sent Events (SSE)</span>.
          </p>
        </div>

        <div class="mb-12">
          <h2 class="text-2xl font-bold text-white mb-6">Fonctionnalités</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">Recherche avancée</h3>
              <p class="text-sm text-cinema-textMuted">
                Filtrez les films par titre, réalisateur, genre ou note minimale avec recherche textuelle dynamique.
              </p>
            </div>

            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">Synchronisation temps réel</h3>
              <p class="text-sm text-cinema-textMuted">
                Les disponibilités des séances sont diffusées en direct par SSE dès qu'une réservation est validée ou annulée.
              </p>
            </div>

            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">Pile technique</h3>
              <p class="text-sm text-cinema-textMuted">
                Vue 3, Vite, TypeScript, Pinia, Tailwind CSS et Docker pour le déploiement des services.
              </p>
            </div>

            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 01-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">Backend performant</h3>
              <p class="text-sm text-cinema-textMuted">
                API Node.js avec clustering multi-cœurs, cache in-memory et MongoDB optimisé.
              </p>
            </div>

            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">Tests de charge</h3>
              <p class="text-sm text-cinema-textMuted">
                k6 avec tableau de bord web pour valider les performances jusqu'à 500 utilisateurs simultanés.
              </p>
            </div>

            <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
              <div class="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center mb-4" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent-gold" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-white font-semibold mb-2">CI/CD automatisée</h3>
              <p class="text-sm text-cinema-textMuted">
                GitHub Actions avec tests de performance automatiques et création de tickets sur rupture.
              </p>
            </div>
          </div>
        </div>

        <!-- Technologies -->
        <div class="mb-12">
          <h2 class="text-2xl font-bold text-white mb-6">Technologies utilisées</h2>
          <div class="bg-cinema-card/50 p-6 rounded-xl border border-cinema-border/50">
            <div class="space-y-4">
              <div>
                <h3 class="text-white font-semibold mb-2">Frontend</h3>
                <div class="flex flex-wrap gap-2">
                  <span class="badge-genre">Vue 3</span>
                  <span class="badge-genre">Vite 5</span>
                  <span class="badge-genre">TypeScript</span>
                  <span class="badge-genre">Pinia</span>
                  <span class="badge-genre">Vue Router</span>
                  <span class="badge-genre">Tailwind CSS</span>
                  <span class="badge-genre">Axios</span>
                </div>
              </div>

              <div>
                <h3 class="text-white font-semibold mb-2">Backend</h3>
                <div class="flex flex-wrap gap-2">
                  <span class="badge-rating">Node.js 22 ESM</span>
                  <span class="badge-rating">Express</span>
                  <span class="badge-rating">Mongoose</span>
                  <span class="badge-rating">MongoDB</span>
                  <span class="badge-rating">OpenTelemetry</span>
                  <span class="badge-rating">SSE</span>
                </div>
              </div>

              <div>
                <h3 class="text-white font-semibold mb-2">DevOps</h3>
                <div class="flex flex-wrap gap-2">
                  <span class="badge-available">Docker</span>
                  <span class="badge-available">Docker Compose</span>
                  <span class="badge-available">GitHub Actions</span>
                  <span class="badge-available">k6</span>
                  <span class="badge-available">Jaeger</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Équipe -->
        <div class="text-center pt-8 border-t border-cinema-border/30">
          <h2 class="text-2xl font-bold text-white mb-2">Projet académique YNOV</h2>
          <p class="text-cinema-textMuted text-sm leading-relaxed">
            Développé dans le cadre du module <span class="text-accent-gold font-semibold">Coordination Backend & Frontend</span>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
