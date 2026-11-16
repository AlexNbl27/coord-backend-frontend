<template>
  <footer class="bg-cinema-darker border-t border-cinema-border/50 mt-20 relative z-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div class="space-y-3 md:col-span-1">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-cinema-card border border-accent-gold/60 rounded flex items-center justify-center">
              <span class="font-display text-base font-bold text-accent-gold">CS</span>
            </div>
            <span class="font-display text-xl font-bold text-white tracking-tight">CinéSlot</span>
          </div>
          <p class="text-xs text-cinema-textMuted leading-relaxed">
            14 rue de la Cinémathèque, 69002 Lyon. Billetterie et réservation de places en ligne.
          </p>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Navigation</h4>
          <ul class="space-y-2 text-xs text-cinema-textMuted">
            <li><router-link to="/" class="hover:text-white transition-colors">Accueil</router-link></li>
            <li><router-link to="/movies" class="hover:text-white transition-colors">Catalogue des films</router-link></li>
            <li><router-link to="/slots" class="hover:text-white transition-colors">Séances & Réservations</router-link></li>
            <li><router-link to="/reservations" class="hover:text-white transition-colors">Mes Billets (e-Billet)</router-link></li>
          </ul>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Salles & Équipements</h4>
          <ul class="space-y-2 text-xs text-cinema-textMuted">
            <li>IMAX Laser 4K Dual</li>
            <li>Dolby Atmos</li>
            <li>Projection 70mm Grand Large</li>
            <li>Fauteuils Club</li>
          </ul>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-accent-gold mb-3">Informations</h4>
          <div class="space-y-2 text-xs text-cinema-textMuted">
            <p>Ouvert tous les jours : 13h30 – 23h30</p>
            <p>Accès PMR dans toutes les salles</p>
            <p>Tarifs & Conditions de vente</p>
          </div>
        </div>
      </div>

      <div class="pt-8 border-t border-cinema-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cinema-textMuted">
        <p>© 2026 CinéSlot. Tous droits réservés.</p>
        <p>Lyon · Cinémathèque & Salles</p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>
