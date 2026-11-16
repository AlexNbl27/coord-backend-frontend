<template>
  <footer class="bg-cinema-darker border-t border-cinema-border/50 mt-20 relative z-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <!-- Brand -->
        <div class="space-y-3 md:col-span-1">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-cinema-card border border-accent-gold/60 rounded flex items-center justify-center">
              <span class="font-display text-base font-bold text-accent-gold">CS</span>
            </div>
            <span class="font-display text-xl font-bold text-white tracking-tight">CinéSlot</span>
          </div>
          <p class="text-xs text-cinema-textMuted leading-relaxed">
            Plateforme cinématographique haute performance avec réservation réactive et synchronisation des séances en temps réel via Server-Sent Events.
          </p>
        </div>

        <!-- Navigation -->
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Navigation</h4>
          <ul class="space-y-2 text-xs text-cinema-textMuted">
            <li><router-link to="/" class="hover:text-white transition-colors">Accueil</router-link></li>
            <li><router-link to="/movies" class="hover:text-white transition-colors">Catalogue des films</router-link></li>
            <li><router-link to="/slots" class="hover:text-white transition-colors">Séances & Réservations</router-link></li>
            <li><router-link to="/reservations" class="hover:text-white transition-colors">Mes Billets (e-Billet)</router-link></li>
          </ul>
        </div>

        <!-- Salles & Tech -->
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Technologies</h4>
          <ul class="space-y-2 text-xs text-cinema-textMuted">
            <li class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> IMAX Laser 4K Dual</li>
            <li class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span> Dolby Atmos 3D Audio</li>
            <li class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Projection 70mm Grand Large</li>
            <li class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Fauteuils Club inclinables</li>
          </ul>
        </div>

        <!-- Architecture info -->
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Architecture</h4>
          <div class="space-y-2 text-xs text-cinema-textMuted">
            <p>Vue 3 + Vite + Tailwind</p>
            <p>OpenTelemetry & Jaeger Tracing</p>
            <p>Node.js 22 ESM & Express API</p>
            <p>MongoDB Replica / Persistent DB</p>
          </div>
        </div>
      </div>

      <div class="pt-8 border-t border-cinema-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cinema-textMuted">
        <p>© 2026 CinéSlot. Tous droits réservés.</p>
        <p class="flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Système de synchronisation opérationnel</span>
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>
